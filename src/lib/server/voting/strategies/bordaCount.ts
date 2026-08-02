import type { VotingStrategy, PollOption, RawVote, CategoryResult, CandidateTally, BordaBreakdownItem } from '../types';

export const bordaCountStrategy: VotingStrategy = {
	id: 'borda-count',
	name: 'Borda Count',
	description: 'Voters rank options in order of preference. Points are assigned based on position (1st = N pts, 2nd = N-1 pts, etc.). Option with the highest cumulative Borda Points wins!',

	validateBallot(ballotData: any, options: PollOption[]): { valid: boolean; error?: string } {
		if (!Array.isArray(ballotData)) {
			return { valid: false, error: 'Ballot data must be an array of option IDs in ranked order' };
		}

		if (ballotData.length === 0) {
			return { valid: false, error: 'At least one option must be ranked' };
		}

		const validOptionIds = new Set(options.map((o) => o.id));
		const seen = new Set<string>();

		for (const optId of ballotData) {
			if (typeof optId !== 'string' || !validOptionIds.has(optId)) {
				return { valid: false, error: `Invalid option ID: ${optId}` };
			}
			if (seen.has(optId)) {
				return { valid: false, error: `Duplicate option ranked: ${optId}` };
			}
			seen.add(optId);
		}

		return { valid: true };
	},

	calculateResults(votes: RawVote[], options: PollOption[], categoryId: string): CategoryResult {
		const totalBallots = votes.length;
		const N = options.length;
		const pointsMap: Record<string, number> = {};
		const rankCountsMap: Record<string, Record<number, number>> = {};

		options.forEach((opt) => {
			pointsMap[opt.id] = 0;
			rankCountsMap[opt.id] = {};
			for (let r = 1; r <= N; r++) {
				rankCountsMap[opt.id][r] = 0;
			}
		});

		if (totalBallots === 0 || N === 0) {
			const rankings: CandidateTally[] = options.map((opt) => ({
				optionId: opt.id,
				title: opt.title,
				candidateKey: opt.candidateKey,
				votes: 0,
				percentage: 0,
				bordaBreakdown: []
			}));

			return {
				categoryId,
				votingStrategyId: this.id,
				totalBallots: 0,
				winnerOptionId: null,
				winnerOptionTitle: null,
				rankings,
				summaryMessage: 'No votes received.'
			};
		}

		// Calculate Borda points & rank breakdown for each ballot
		for (const vote of votes) {
			const ballot: string[] = Array.isArray(vote.ballotData) ? vote.ballotData : [];
			ballot.forEach((optionId, index) => {
				if (pointsMap[optionId] !== undefined) {
					const rankPosition = index + 1;
					const pts = Math.max(1, N - index);
					pointsMap[optionId] += pts;
					if (rankCountsMap[optionId]) {
						rankCountsMap[optionId][rankPosition] = (rankCountsMap[optionId][rankPosition] || 0) + 1;
					}
				}
			});
		}

		// Max possible Borda points for 1st place per ballot = N * totalBallots
		const maxPointsPossible = N * totalBallots;

		const rankings: CandidateTally[] = options
			.map((opt) => {
				const pts = pointsMap[opt.id] || 0;
				const percentage = maxPointsPossible > 0 ? Math.round((pts / maxPointsPossible) * 100) : 0;
				
				const bordaBreakdown: BordaBreakdownItem[] = [];
				for (let r = 1; r <= N; r++) {
					const count = rankCountsMap[opt.id]?.[r] || 0;
					const ptsPerVote = Math.max(1, N - (r - 1));
					bordaBreakdown.push({
						rank: r,
						ptsPerVote,
						count,
						totalPoints: count * ptsPerVote
					});
				}

				return {
					optionId: opt.id,
					title: opt.title,
					candidateKey: opt.candidateKey,
					votes: pts,
					percentage,
					bordaBreakdown
				};
			})
			.sort((a, b) => b.votes - a.votes);

		const winner = rankings.length > 0 && rankings[0].votes > 0 ? rankings[0] : null;

		return {
			categoryId,
			votingStrategyId: this.id,
			totalBallots,
			winnerOptionId: winner ? winner.optionId : null,
			winnerOptionTitle: winner ? winner.title : null,
			winnerCandidateKey: winner ? winner.candidateKey : null,
			rankings,
			summaryMessage: winner
				? `${winner.title} won with ${winner.votes} Borda Points across ${totalBallots} ballots.`
				: 'No winner declared.'
		};
	}
};
