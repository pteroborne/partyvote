import type { VotingStrategy, RawVote, PollOption, CategoryResult } from '../types';

/**
 * Plurality Voting (First-Past-The-Post)
 * Ballot format: string (optionId) or string[] with 1 element
 */
export const pluralityStrategy: VotingStrategy = {
	id: 'plurality',
	name: 'Plurality (First-Past-The-Post)',
	description: 'Standard single-choice vote. Candidate with the highest number of votes wins.',

	validateBallot(ballotData: any, options: PollOption[]): { valid: boolean; error?: string } {
		let optionId = typeof ballotData === 'string' ? ballotData : Array.isArray(ballotData) ? ballotData[0] : null;
		if (!optionId) {
			return { valid: false, error: 'Please select one candidate.' };
		}
		const validIds = new Set(options.map((o) => o.id));
		if (!validIds.has(optionId)) {
			return { valid: false, error: 'Invalid candidate selection.' };
		}
		return { valid: true };
	},

	calculateResults(votes: RawVote[], options: PollOption[], categoryId: string): CategoryResult {
		const optionMap = new Map<string, PollOption>(options.map((o) => [o.id, o]));
		const tallies: Record<string, number> = {};

		for (const opt of options) {
			tallies[opt.id] = 0;
		}

		let totalBallots = 0;
		for (const v of votes) {
			const id = typeof v.ballotData === 'string' ? v.ballotData : Array.isArray(v.ballotData) ? v.ballotData[0] : null;
			if (id && tallies[id] !== undefined) {
				tallies[id]++;
				totalBallots++;
			}
		}

		const rankings = options
			.map((o) => {
				const voteCount = tallies[o.id] || 0;
				return {
					optionId: o.id,
					title: o.title,
					candidateKey: o.candidateKey,
					votes: voteCount,
					percentage: totalBallots > 0 ? Math.round((voteCount / totalBallots) * 100) : 0
				};
			})
			.sort((a, b) => b.votes - a.votes);

		const top = rankings[0];
		const winnerOpt = top && top.votes > 0 ? optionMap.get(top.optionId) : null;

		return {
			categoryId,
			votingStrategyId: 'plurality',
			totalBallots,
			winnerOptionId: winnerOpt ? winnerOpt.id : null,
			winnerOptionTitle: winnerOpt ? winnerOpt.title : null,
			winnerCandidateKey: winnerOpt?.candidateKey,
			rankings,
			summaryMessage: winnerOpt
				? `Winner: ${winnerOpt.title} with ${top.votes} vote${top.votes > 1 ? 's' : ''}`
				: 'No winner declared.'
		};
	}
};
