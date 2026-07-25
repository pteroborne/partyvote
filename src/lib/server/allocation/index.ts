import type { WinnerAllocationStrategy } from '../voting/types';
import { standardAllocationStrategy } from './standard';
import { noDuplicateWinnersStrategy } from './noDuplicateWinners';

const allocationStrategies: Record<string, WinnerAllocationStrategy> = {
	[standardAllocationStrategy.id]: standardAllocationStrategy,
	[noDuplicateWinnersStrategy.id]: noDuplicateWinnersStrategy
};

export function getWinnerAllocationStrategy(id: string): WinnerAllocationStrategy {
	const strategy = allocationStrategies[id];
	if (!strategy) {
		return standardAllocationStrategy;
	}
	return strategy;
}

export function getAllWinnerAllocationStrategies(): WinnerAllocationStrategy[] {
	return Object.values(allocationStrategies);
}

export { standardAllocationStrategy, noDuplicateWinnersStrategy };
