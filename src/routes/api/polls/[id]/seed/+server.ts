import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';
import { memoryStore } from '$lib/server/db';
import { pollEvents } from '$lib/server/events';

export const POST: RequestHandler = async ({ params }) => {
	const pollId = params.id;
	const poll = await repo.getPoll(pollId);
	if (!poll) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}

	// Remove old voters and votes for this poll
	const categories = await repo.getCategoriesForPoll(pollId);
	const catIds = new Set(categories.map((c) => c.id));

	for (const [vid, v] of Array.from(memoryStore.voters.entries())) {
		if (v.pollId === pollId) {
			memoryStore.voters.delete(vid);
		}
	}

	for (const [voteId, v] of Array.from(memoryStore.votes.entries())) {
		if (catIds.has(v.categoryId)) {
			memoryStore.votes.delete(voteId);
		}
	}

	const seedVoters = [
		{
			id: `voter-${pollId}-1`,
			nickname: 'Fox Mulder',
			ballots: {
				'cat-most-convincing': ['c1-opt5', 'c1-opt7', 'c1-opt1'],
				'cat-most-unhinged': ['c2-opt10', 'c2-opt6', 'c2-opt11'],
				'cat-fbi-watching': ['c3-opt7', 'c3-opt5', 'c3-opt3']
			}
		},
		{
			id: `voter-${pollId}-2`,
			nickname: 'Dana Scully',
			ballots: {
				'cat-most-convincing': ['c1-opt4', 'c1-opt2', 'c1-opt3'],
				'cat-most-unhinged': ['c2-opt2', 'c2-opt4', 'c2-opt8'],
				'cat-fbi-watching': ['c3-opt3', 'c3-opt4', 'c3-opt2']
			}
		},
		{
			id: `voter-${pollId}-3`,
			nickname: 'The Lone Gunmen',
			ballots: {
				'cat-most-convincing': ['c1-opt10', 'c1-opt5', 'c1-opt7'],
				'cat-most-unhinged': ['c2-opt10', 'c2-opt11', 'c2-opt5'],
				'cat-fbi-watching': ['c3-opt10', 'c3-opt7', 'c3-opt5']
			}
		},
		{
			id: `voter-${pollId}-4`,
			nickname: 'Alex Jones (Irony Fan)',
			ballots: {
				'cat-most-convincing': ['c1-opt7', 'c1-opt11'],
				'cat-most-unhinged': ['c2-opt11', 'c2-opt7', 'c2-opt10'],
				'cat-fbi-watching': ['c3-opt7', 'c3-opt11']
			}
		},
		{
			id: `voter-${pollId}-5`,
			nickname: 'Pop Culture Paul',
			ballots: {
				'cat-most-convincing': ['c1-opt1', 'c1-opt8', 'c1-opt9'],
				'cat-most-unhinged': ['c2-opt1', 'c2-opt9', 'c2-opt8'],
				'cat-fbi-watching': ['c3-opt8', 'c3-opt1', 'c3-opt9']
			}
		},
		{
			id: `voter-${pollId}-6`,
			nickname: 'Hip-Hop Historian',
			ballots: {
				'cat-most-convincing': ['c1-opt3', 'c1-opt8', 'c1-opt9'],
				'cat-most-unhinged': ['c2-opt3', 'c2-opt8', 'c2-opt1'],
				'cat-fbi-watching': ['c3-opt3', 'c3-opt8', 'c3-opt4']
			}
		},
		{
			id: `voter-${pollId}-7`,
			nickname: 'Bears Superfan',
			ballots: {
				'cat-most-convincing': ['c1-opt6', 'c1-opt3', 'c1-opt2'],
				'cat-most-unhinged': ['c2-opt6', 'c2-opt3', 'c2-opt10'],
				'cat-fbi-watching': ['c3-opt6', 'c3-opt3', 'c3-opt7']
			}
		},
		{
			id: `voter-${pollId}-8`,
			nickname: 'Flat-Pack Enthusiast',
			ballots: {
				'cat-most-convincing': ['c1-opt2', 'c1-opt5', 'c1-opt8'],
				'cat-most-unhinged': ['c2-opt2', 'c2-opt5', 'c2-opt6'],
				'cat-fbi-watching': ['c3-opt2', 'c3-opt5', 'c3-opt10']
			}
		},
		{
			id: `voter-${pollId}-9`,
			nickname: 'Retro Gamer Tim',
			ballots: {
				'cat-most-convincing': ['c1-opt10', 'c1-opt4', 'c1-opt5'],
				'cat-most-unhinged': ['c2-opt10', 'c2-opt5', 'c2-opt2'],
				'cat-fbi-watching': ['c3-opt10', 'c3-opt4', 'c3-opt5']
			}
		},
		{
			id: `voter-${pollId}-10`,
			nickname: 'Ancient Astronaut Theorist',
			ballots: {
				'cat-most-convincing': ['c1-opt11', 'c1-opt5', 'c1-opt7'],
				'cat-most-unhinged': ['c2-opt11', 'c2-opt5', 'c2-opt10'],
				'cat-fbi-watching': ['c3-opt11', 'c3-opt5', 'c3-opt7']
			}
		},
		{
			id: `voter-${pollId}-11`,
			nickname: 'Single Choice Sam',
			ballots: {
				'cat-most-convincing': ['c1-opt9'],
				'cat-most-unhinged': ['c2-opt9'],
				'cat-fbi-watching': ['c3-opt9']
			}
		},
		{
			id: `voter-${pollId}-12`,
			nickname: 'Truth Seeker Maya',
			ballots: {
				'cat-most-convincing': ['c1-opt8', 'c1-opt1', 'c1-opt3'],
				'cat-most-unhinged': ['c2-opt8', 'c2-opt1', 'c2-opt3'],
				'cat-fbi-watching': ['c3-opt8', 'c3-opt3', 'c3-opt1']
			}
		},
		{
			id: `voter-${pollId}-13`,
			nickname: 'Cyberpunk Kai',
			ballots: {
				'cat-most-convincing': ['c1-opt4', 'c1-opt7', 'c1-opt10'],
				'cat-most-unhinged': ['c2-opt4', 'c2-opt10', 'c2-opt7'],
				'cat-fbi-watching': ['c3-opt4', 'c3-opt7', 'c3-opt10']
			}
		},
		{
			id: `voter-${pollId}-14`,
			nickname: 'Jimbo',
			ballots: {
				'cat-most-convincing': ['c1-opt1', 'c1-opt2', 'c1-opt3'],
				'cat-most-unhinged': ['c2-opt5', 'c2-opt6', 'c2-opt7'],
				'cat-fbi-watching': ['c3-opt5', 'c3-opt3', 'c3-opt2']
			}
		}
	];

	let voteCounter = 1;
	for (const sv of seedVoters) {
		const voterObj = {
			id: sv.id,
			pollId: pollId,
			voterToken: `token-${sv.id}`,
			nickname: sv.nickname,
			ipAddress: '127.0.0.1',
			createdAt: new Date().toISOString()
		};
		memoryStore.voters.set(sv.id, voterObj);

		for (const [catId, ballotData] of Object.entries(sv.ballots)) {
			// Ensure category exists for this poll
			if (catIds.has(catId)) {
				const voteId = `vote-${pollId}-${voteCounter++}`;
				const voteObj = {
					id: voteId,
					categoryId: catId,
					voterId: sv.id,
					ballotData: ballotData,
					createdAt: new Date().toISOString()
				};
				memoryStore.votes.set(voteId, voteObj);
			}
		}
	}

	// Persist changes to store.json
	repo.updatePoll(pollId, { status: 'closed', currentRevealStep: 1 });

	// Broadcast SSE event so open TV display updates instantly
	pollEvents.broadcast(pollId, 'poll_updated', { pollId, voterCount: seedVoters.length });

	return json({ success: true, voterCount: seedVoters.length, voteCount: voteCounter - 1 });
};
