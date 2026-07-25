import type { WinnerAllocationStrategy, CategoryWinnerRequest, EventWinnersResult, FinalCategoryWinner, PollOption } from '../voting/types';

export const noDuplicateWinnersStrategy: WinnerAllocationStrategy = {
	id: 'no-duplicate-winners',
	name: 'No Duplicate Winners (1 Win Max Per Person)',
	description: 'Prevents any candidate from winning multiple categories. Once a candidate wins a category, they are bypassed in subsequent categories in favor of the runner-up.',

	allocateWinners(categoryRequests: CategoryWinnerRequest[]): EventWinnersResult {
		// Sort by category priority order (lowest priority order number = evaluated first)
		const sortedRequests = [...categoryRequests].sort((a, b) => a.priorityOrder - b.priorityOrder);
		const claimedWinners = new Set<string>(); // Set of claimed candidateKeys or normalized titles
		const categoryWinners: FinalCategoryWinner[] = [];

		const getCandidateIdentifier = (opt: PollOption): string => {
			if (opt.candidateKey && opt.candidateKey.trim() !== '') {
				return opt.candidateKey.trim().toLowerCase();
			}
			return opt.title.trim().toLowerCase();
		};

		for (const req of sortedRequests) {
			const rankings = req.categoryResult.rankings;
			let selectedWinningOption: PollOption | null = null;
			let isRunnerUp = false;
			let originalWinnerTitle: string | undefined = undefined;

			if (rankings.length > 0) {
				const topRanking = rankings[0];
				const originalTopOpt = req.options.find((o) => o.id === topRanking.optionId);
				if (originalTopOpt) {
					originalWinnerTitle = originalTopOpt.title;
				}

				// Find highest ranked candidate who has not yet claimed a win
				for (const r of rankings) {
					const opt = req.options.find((o) => o.id === r.optionId);
					if (opt) {
						const identifier = getCandidateIdentifier(opt);
						if (!claimedWinners.has(identifier)) {
							selectedWinningOption = opt;
							claimedWinners.add(identifier);
							if (r.optionId !== topRanking.optionId) {
								isRunnerUp = true;
							}
							break;
						}
					}
				}
			}

			categoryWinners.push({
				categoryId: req.categoryId,
				categoryTitle: req.categoryTitle,
				winningOption: selectedWinningOption,
				allocatedByRule: 'no-duplicate-winners',
				isRunnerUpFallback: isRunnerUp,
				originalWinnerTitle: isRunnerUp ? originalWinnerTitle : undefined,
				result: req.categoryResult
			});
		}

		return {
			allocationStrategyId: 'no-duplicate-winners',
			categoryWinners
		};
	}
};
