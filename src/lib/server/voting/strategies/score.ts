import type { VotingStrategy, RawVote, PollOption, CategoryResult } from '../types';

/**
 * Score / Star Rating Voting
 * Ballot format: Record<string, number> (e.g. { "opt1": 5, "opt2": 3, "opt3": 1 })
 */
export const scoreStrategy: VotingStrategy = {
	id: 'score',
	name: 'Star / Score Rating (1-5 Stars)',
	description: 'Voters rate candidates from 1 to 5 stars. Candidate with highest average/total score wins.',

	validateBallot(ballotData: any, options: PollOption[]): { valid: boolean; error?: string } {
		if (typeof ballotData !== 'object' || ballotData === null) {
			return { valid: false, error: 'Score ballot must be a ratings object.' };
		}
		const validIds = new Set(options.map((o) => o.id));
		for (const [id, rating] of Object.entries(ballotData)) {
			if (!validIds.has(id)) {
				return { valid: false, error: `Invalid candidate in ratings: ${id}` };
			}
			const score = Number(rating);
			if (isNaN(score) || score < 1 || score > 5) {
				return { valid: false, error: 'Ratings must be between 1 and 5 stars.' };
			}
		}
		return { valid: true };
	},

	calculateResults(votes: RawVote[], options: PollOption[], categoryId: string): CategoryResult {
		const optionMap = new Map<string, PollOption>(options.map((o) => [o.id, o]));
		const totalScores: Record<string, number> = {};
		const ratingCounts: Record<string, number> = {};

		for (const opt of options) {
			totalScores[opt.id] = 0;
			ratingCounts[opt.id] = 0;
		}

		let totalBallots = votes.length;
		for (const v of votes) {
			if (v.ballotData && typeof v.ballotData === 'object') {
				for (const [id, val] of Object.entries(v.ballotData)) {
					const score = Number(val);
					if (totalScores[id] !== undefined && !isNaN(score) && score >= 1 && score <= 5) {
						totalScores[id] += score;
						ratingCounts[id]++;
					}
				}
			}
		}

		const maxPossibleScorePerVoter = 5;

		const rankings = options
			.map((o) => {
				const sum = totalScores[o.id] || 0;
				const count = ratingCounts[o.id] || 0;
				const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
				return {
					optionId: o.id,
					title: o.title,
					candidateKey: o.candidateKey,
					votes: sum, // total score accumulated
					percentage: totalBallots > 0 ? Math.round((sum / (totalBallots * maxPossibleScorePerVoter)) * 100) : 0,
					averageScore: avg
				};
			})
			.sort((a, b) => b.votes - a.votes);

		const top = rankings[0];
		const winnerOpt = top && top.votes > 0 ? optionMap.get(top.optionId) : null;

		return {
			categoryId,
			votingStrategyId: 'score',
			totalBallots,
			winnerOptionId: winnerOpt ? winnerOpt.id : null,
			winnerOptionTitle: winnerOpt ? winnerOpt.title : null,
			winnerCandidateKey: winnerOpt?.candidateKey,
			rankings,
			summaryMessage: winnerOpt
				? `Winner: ${winnerOpt.title} (Score: ${top.votes} pts | Avg: ${top.averageScore} ★)`
				: 'No winner declared.'
		};
	}
};
