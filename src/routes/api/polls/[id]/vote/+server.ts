import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';
import { getVotingStrategy } from '$lib/server/voting/strategies';
import { pollEvents } from '$lib/server/events';

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	const pollId = params.id;
	const poll = await repo.getPoll(pollId);

	if (!poll) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	if (poll.status !== 'active') {
		return json({ error: 'Voting is currently closed for this poll.' }, { status: 403 });
	}

	const body = await request.json();
	const { voterToken, nickname, ballots } = body;

	if (!voterToken || !nickname || nickname.trim() === '') {
		return json({ error: 'Nickname and voter session token are required.' }, { status: 400 });
	}

	if (!ballots || typeof ballots !== 'object') {
		return json({ error: 'Invalid ballot data provided.' }, { status: 400 });
	}

	const clientIp = getClientAddress ? getClientAddress() : '127.0.0.1';
	const voter = await repo.registerVoter(pollId, voterToken, nickname.trim(), clientIp);

	const categories = await repo.getCategoriesForPoll(pollId);
	const catMap = new Map(categories.map((c) => [c.id, c]));

	const recordedVotes = [];

	for (const [categoryId, ballotData] of Object.entries(ballots)) {
		const category = catMap.get(categoryId);
		if (!category) continue;

		const options = await repo.getOptionsForCategory(categoryId);
		const strategy = getVotingStrategy(category.votingStrategy);

		const valResult = strategy.validateBallot(
			ballotData,
			options.map((o) => ({ ...o, categoryId: o.categoryId }))
		);

		if (!valResult.valid) {
			return json({ error: `Validation error in ${category.title}: ${valResult.error}` }, { status: 400 });
		}

		const v = await repo.recordVote(categoryId, voter.id, ballotData);
		recordedVotes.push(v);
	}

	const allVoters = await repo.getVotersForPoll(pollId);

	// Broadcast live vote event to TV screen AND Admin Dashboard
	pollEvents.broadcast(pollId, 'vote_submitted', {
		voterNickname: voter.nickname,
		voterId: voter.id,
		totalVoterCount: allVoters.length,
		voters: allVoters
	});

	return json({
		success: true,
		voter,
		recordedVotesCount: recordedVotes.length
	});
};
