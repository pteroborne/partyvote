import type { VotingStrategy } from '../types';
import { rankedChoiceStrategy } from './rankedChoice';
import { pluralityStrategy } from './plurality';
import { approvalStrategy } from './approval';
import { scoreStrategy } from './score';
import { bordaCountStrategy } from './bordaCount';

const votingStrategies: Record<string, VotingStrategy> = {
	[rankedChoiceStrategy.id]: rankedChoiceStrategy,
	[pluralityStrategy.id]: pluralityStrategy,
	[approvalStrategy.id]: approvalStrategy,
	[scoreStrategy.id]: scoreStrategy,
	[bordaCountStrategy.id]: bordaCountStrategy
};

export function getVotingStrategy(id: string): VotingStrategy {
	const strategy = votingStrategies[id];
	if (!strategy) {
		return pluralityStrategy; // Fallback default
	}
	return strategy;
}

export function getAllVotingStrategies(): VotingStrategy[] {
	return Object.values(votingStrategies);
}

export { rankedChoiceStrategy, pluralityStrategy, approvalStrategy, scoreStrategy, bordaCountStrategy };
