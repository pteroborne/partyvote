import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';
import { getVotingStrategy } from '$lib/server/voting/strategies';
import { getWinnerAllocationStrategy } from '$lib/server/allocation';
import { pollEvents } from '$lib/server/events';
import type { CategoryWinnerRequest } from '$lib/server/voting/types';

export const GET: RequestHandler = async ({ params }) => {
	const pollId = params.id;
	const poll = await repo.getPoll(pollId);

	if (!poll) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	const dbCategories = await repo.getCategoriesForPoll(pollId);
	const voters = await repo.getVotersForPoll(pollId);

	const categoryWinnerRequests: CategoryWinnerRequest[] = [];
	const categoryDetails = [];

	for (const cat of dbCategories) {
		const options = await repo.getOptionsForCategory(cat.id);
		const rawVotes = await repo.getVotesForCategory(cat.id);
		const strategy = getVotingStrategy(cat.votingStrategy);

		const result = strategy.calculateResults(
			rawVotes,
			options.map((o) => ({ ...o, categoryId: o.categoryId })),
			cat.id
		);

		categoryDetails.push({
			category: cat,
			options,
			result,
			totalVotes: rawVotes.length
		});

		categoryWinnerRequests.push({
			categoryId: cat.id,
			categoryTitle: cat.title,
			priorityOrder: cat.priorityOrder,
			options: options.map((o) => ({ ...o, categoryId: o.categoryId })),
			categoryResult: result
		});
	}

	// Calculate overall winners using WinnerAllocationStrategy
	const allocationStrategy = getWinnerAllocationStrategy(poll.winnerAllocationStrategy);
	const eventWinners = allocationStrategy.allocateWinners(categoryWinnerRequests);

	return json({
		poll,
		categories: categoryDetails,
		voters,
		eventWinners,
		totalVoterCount: voters.length
	});
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const pollId = params.id;
	const body = await request.json();
	const { showLiveTotals, currentRevealStep, winnerAllocationStrategy, title, description } = body;

	const updates: any = {};
	if (typeof showLiveTotals === 'boolean') updates.showLiveTotals = showLiveTotals;
	if (typeof currentRevealStep === 'number') updates.currentRevealStep = currentRevealStep;
	if (winnerAllocationStrategy) updates.winnerAllocationStrategy = winnerAllocationStrategy;
	if (title) updates.title = title;
	if (description !== undefined) updates.description = description;

	const updated = await repo.updatePoll(pollId, updates);
	if (!updated) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	// Broadcast setting change to connected TV screens and Admin UI
	pollEvents.broadcast(pollId, 'poll_updated', { poll: updated, updates });

	return json({ poll: updated });
};

export const DELETE: RequestHandler = async ({ params }) => {
	const pollId = params.id;
	const success = await repo.deletePoll(pollId);
	if (!success) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}
	return json({ success: true });
};
