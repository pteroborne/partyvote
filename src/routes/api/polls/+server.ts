import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';

export const GET: RequestHandler = async () => {
	const polls = await repo.getAllPolls();
	return json({ polls });
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { title, description, winnerAllocationStrategy, adminPin, showLiveTotals, categories } = body;

		if (!title || title.trim() === '') {
			return json({ error: 'Poll title is required.' }, { status: 400 });
		}

		const pollId = 'poll-' + Math.random().toString(36).substring(2, 10);
		const poll = await repo.createPoll({
			id: pollId,
			title: title.trim(),
			description: description ? description.trim() : '',
			status: 'active',
			winnerAllocationStrategy: winnerAllocationStrategy || 'no-duplicate-winners',
			adminPin: adminPin || '1234',
			showLiveTotals: typeof showLiveTotals === 'boolean' ? showLiveTotals : false,
			currentRevealStep: 0
		});

		if (Array.isArray(categories)) {
			for (let i = 0; i < categories.length; i++) {
				const catData = categories[i];
				const catId = 'cat-' + Math.random().toString(36).substring(2, 10);
				await repo.createCategory({
					id: catId,
					pollId: poll.id,
					title: catData.title || `Category ${i + 1}`,
					description: catData.description || '',
					votingStrategy: catData.votingStrategy || 'ranked-choice',
					priorityOrder: i + 1
				});

				if (Array.isArray(catData.options)) {
					for (let j = 0; j < catData.options.length; j++) {
						const optData = catData.options[j];
						await repo.createOption({
							id: 'opt-' + Math.random().toString(36).substring(2, 10),
							categoryId: catId,
							candidateKey: optData.candidateKey || null,
							title: optData.title || `Candidate ${j + 1}`,
							description: optData.description || '',
							imageUrl: optData.imageUrl || null,
							displayOrder: j + 1
						});
					}
				}
			}
		}

		return json({ poll }, { status: 201 });
	} catch (e: any) {
		return json({ error: e.message || 'Failed to create poll' }, { status: 500 });
	}
};
