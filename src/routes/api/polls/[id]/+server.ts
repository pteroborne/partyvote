import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { repo } from '$lib/server/db/repository';
import { getVotingStrategy } from '$lib/server/voting/strategies';
import { getWinnerAllocationStrategy } from '$lib/server/allocation';
import { pollEvents } from '$lib/server/events';
import type { CategoryWinnerRequest } from '$lib/server/voting/types';
import crypto from 'crypto';

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
	const { showLiveTotals, currentRevealStep, winnerAllocationStrategy, title, description, categories } = body;

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

	// Synchronize categories and options if passed
	if (Array.isArray(categories)) {
		const existingCategories = await repo.getCategoriesForPoll(pollId);
		const existingCatIds = new Set(existingCategories.map((c) => c.id));
		const incomingCatIds = new Set<string>();

		for (let cIdx = 0; cIdx < categories.length; cIdx++) {
			const catInput = categories[cIdx];
			let categoryId = catInput.id || `cat-${crypto.randomUUID()}`;
			incomingCatIds.add(categoryId);

			if (existingCatIds.has(categoryId)) {
				await repo.updateCategory(categoryId, {
					title: catInput.title,
					description: catInput.description || '',
					votingStrategy: catInput.votingStrategy || 'ranked-choice',
					priorityOrder: cIdx + 1
				});
			} else {
				await repo.createCategory({
					id: categoryId,
					pollId,
					title: catInput.title,
					description: catInput.description || '',
					votingStrategy: catInput.votingStrategy || 'ranked-choice',
					priorityOrder: cIdx + 1
				});
			}

			// Synchronize options for this category
			if (Array.isArray(catInput.options)) {
				const existingOptions = await repo.getOptionsForCategory(categoryId);
				const existingOptIds = new Set(existingOptions.map((o) => o.id));
				const incomingOptIds = new Set<string>();

				for (let oIdx = 0; oIdx < catInput.options.length; oIdx++) {
					const optInput = catInput.options[oIdx];
					let optId = optInput.id || `opt-${crypto.randomUUID()}`;
					incomingOptIds.add(optId);

					const candidateKey = optInput.candidateKey || optInput.title.toLowerCase().replace(/[^a-z0-9]/g, '');

					if (existingOptIds.has(optId)) {
						const existingOpt = existingOptions.find((o) => o.id === optId);
						if (existingOpt) {
							memoryStore_updateOption(optId, {
								title: optInput.title,
								description: optInput.description || '',
								candidateKey,
								displayOrder: oIdx + 1
							});
						}
					} else {
						await repo.createOption({
							id: optId,
							categoryId,
							title: optInput.title,
							description: optInput.description || '',
							candidateKey,
							displayOrder: oIdx + 1
						});
					}
				}

				// Delete options that were removed
				for (const opt of existingOptions) {
					if (!incomingOptIds.has(opt.id)) {
						await repo.deleteOption(opt.id);
					}
				}
			}
		}

		// Delete categories that were removed
		for (const cat of existingCategories) {
			if (!incomingCatIds.has(cat.id)) {
				await repo.deleteCategory(cat.id);
			}
		}
	}

	// Broadcast update event to connected TV screens and Admin UI
	pollEvents.broadcast(pollId, 'poll_updated', { poll: updated, updates });

	return json({ poll: updated });
};

// Helper internal option updater
function memoryStore_updateOption(optId: string, updates: any) {
	import('$lib/server/db/index').then(({ memoryStore }) => {
		const existing = memoryStore.options.get(optId);
		if (existing) {
			memoryStore.options.set(optId, { ...existing, ...updates });
		}
	});
}

export const DELETE: RequestHandler = async ({ params }) => {
	const pollId = params.id;
	const success = await repo.deletePoll(pollId);
	if (!success) {
		return json({ error: 'Poll not found' }, { status: 404 });
	}
	return json({ success: true });
};
