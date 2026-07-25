import type { WinnerAllocationStrategy, CategoryWinnerRequest, EventWinnersResult, FinalCategoryWinner } from '../voting/types';

export const standardAllocationStrategy: WinnerAllocationStrategy = {
	id: 'standard',
	name: 'Standard / Independent Winners',
	description: 'Category winners are declared independently. Candidates can win multiple categories if voted top in each.',

	allocateWinners(categoryRequests: CategoryWinnerRequest[]): EventWinnersResult {
		const sortedRequests = [...categoryRequests].sort((a, b) => a.priorityOrder - b.priorityOrder);

		const categoryWinners: FinalCategoryWinner[] = sortedRequests.map((req) => {
			const winnerId = req.categoryResult.winnerOptionId;
			const winningOpt = winnerId ? req.options.find((o) => o.id === winnerId) || null : null;

			return {
				categoryId: req.categoryId,
				categoryTitle: req.categoryTitle,
				winningOption: winningOpt,
				allocatedByRule: 'standard',
				isRunnerUpFallback: false,
				result: req.categoryResult
			};
		});

		return {
			allocationStrategyId: 'standard',
			categoryWinners
		};
	}
};
