import type { VotingStrategy, RawVote, PollOption, CategoryResult } from '../types';

/**
 * Approval Voting
 * Ballot format: string[] (array of approved option IDs)
 */
export const approvalStrategy: VotingStrategy = {
	id: 'approval',
	name: 'Approval Voting',
	description: 'Voters can approve (select) any number of candidates. Candidate with the most approvals wins.',

	validateBallot(ballotData: any, options: PollOption[]): { valid: boolean; error?: string } {
		if (!Array.isArray(ballotData)) {
			return { valid: false, error: 'Approval ballot must be an array of candidate IDs.' };
		}
		if (ballotData.length === 0) {
			return { valid: false, error: 'Please approve at least one candidate.' };
		}
		const validIds = new Set(options.map((o) => o.id));
		for (const id of ballotData) {
			if (!validIds.has(id)) {
				return { valid: false, error: `Invalid candidate approved: ${id}` };
			}
		}
		return { valid: true };
	},

	calculateResults(votes: RawVote[], options: PollOption[], categoryId: string): CategoryResult {
		const optionMap = new Map<string, PollOption>(options.map((o) => [o.id, o]));
		const tallies: Record<string, number> = {};

		for (const opt of options) {
			tallies[opt.id] = 0;
		}

		let totalBallots = votes.length;
		for (const v of votes) {
			if (Array.isArray(v.ballotData)) {
				for (const id of v.ballotData) {
					if (tallies[id] !== undefined) {
						tallies[id]++;
					}
				}
			}
		}

		const rankings = options
			.map((o) => {
				const approvals = tallies[o.id] || 0;
				return {
					optionId: o.id,
					title: o.title,
					candidateKey: o.candidateKey,
					votes: approvals,
					percentage: totalBallots > 0 ? Math.round((approvals / totalBallots) * 100) : 0
				};
			})
			.sort((a, b) => b.votes - a.votes);

		const top = rankings[0];
		const winnerOpt = top && top.votes > 0 ? optionMap.get(top.optionId) : null;

		return {
			categoryId,
			votingStrategyId: 'approval',
			totalBallots,
			winnerOptionId: winnerOpt ? winnerOpt.id : null,
			winnerOptionTitle: winnerOpt ? winnerOpt.title : null,
			winnerCandidateKey: winnerOpt?.candidateKey,
			rankings,
			summaryMessage: winnerOpt
				? `Winner: ${winnerOpt.title} (${top.votes} approvals out of ${totalBallots} voters)`
				: 'No winner declared.'
		};
	}
};
