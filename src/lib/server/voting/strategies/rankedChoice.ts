import type { VotingStrategy, RawVote, PollOption, CategoryResult, RCVRound, CandidateTally } from '../types';

/**
 * Ranked Choice Voting (Instant-Runoff Voting / IRV)
 * Ballot format: string[] (array of optionIds in order of preference, e.g. ["opt1", "opt2", "opt3"])
 */
export const rankedChoiceStrategy: VotingStrategy = {
	id: 'ranked-choice',
	name: 'Ranked Choice (Instant Runoff)',
	description: 'Voters rank candidates in order of preference. Lowest candidate eliminated each round until majority winner emerges.',

	validateBallot(ballotData: any, options: PollOption[]): { valid: boolean; error?: string } {
		if (!Array.isArray(ballotData)) {
			return { valid: false, error: 'Ranked choice ballot must be an array of candidate IDs in rank order.' };
		}
		const validOptionIds = new Set(options.map((o) => o.id));
		for (const id of ballotData) {
			if (!validOptionIds.has(id)) {
				return { valid: false, error: `Invalid candidate selected: ${id}` };
			}
		}
		const uniqueIds = new Set(ballotData);
		if (uniqueIds.size !== ballotData.length) {
			return { valid: false, error: 'Duplicate candidates found in ranked choice ballot.' };
		}
		return { valid: true };
	},

	calculateResults(votes: RawVote[], options: PollOption[], categoryId: string): CategoryResult {
		const validOptionIds = new Set(options.map((o) => o.id));
		const optionMap = new Map<string, PollOption>(options.map((o) => [o.id, o]));

		// Extract valid ballots (arrays of optionIds)
		const ballots: string[][] = [];
		for (const v of votes) {
			if (Array.isArray(v.ballotData)) {
				const filtered = v.ballotData.filter((id: string) => validOptionIds.has(id));
				if (filtered.length > 0) {
					ballots.push(filtered);
				}
			}
		}

		const totalBallots = ballots.length;
		if (totalBallots === 0 || options.length === 0) {
			return {
				categoryId,
				votingStrategyId: 'ranked-choice',
				totalBallots: 0,
				winnerOptionId: null,
				winnerOptionTitle: null,
				rankings: options.map((o) => ({
					optionId: o.id,
					title: o.title,
					candidateKey: o.candidateKey,
					votes: 0,
					percentage: 0
				})),
				rcvRounds: [],
				summaryMessage: 'No votes recorded yet.'
			};
		}

		let activeOptionIds = new Set<string>(options.map((o) => o.id));
		const rcvRounds: RCVRound[] = [];
		let roundNum = 1;
		let winnerId: string | null = null;

		while (activeOptionIds.size > 0 && !winnerId) {
			// Count 1st choice votes among currently active options
			const tallies: Record<string, number> = {};
			for (const optId of activeOptionIds) {
				tallies[optId] = 0;
			}

			let countThisRound = 0;
			for (const ballot of ballots) {
				const topActive = ballot.find((id) => activeOptionIds.has(id));
				if (topActive) {
					tallies[topActive] = (tallies[topActive] || 0) + 1;
					countThisRound++;
				}
			}

			// Check for majority (>50%)
			let highestOptionId: string | null = null;
			let maxVotes = -1;

			for (const [id, count] of Object.entries(tallies)) {
				if (count > maxVotes) {
					maxVotes = count;
					highestOptionId = id;
				}
			}

			const majorityThreshold = countThisRound > 0 ? Math.floor(countThisRound / 2) + 1 : 1;

			// Check for winner round
			if (activeOptionIds.size === 1 || (highestOptionId && maxVotes >= majorityThreshold)) {
				winnerId = highestOptionId;
				rcvRounds.push({
					roundNumber: roundNum,
					tallies: { ...tallies },
					eliminatedOptionId: null,
					exhaustedCount: totalBallots - countThisRound,
					note: winnerId
						? `${optionMap.get(winnerId)?.title} won with ${maxVotes} votes (${countThisRound > 0 ? Math.round((maxVotes / countThisRound) * 100) : 0}%)`
						: 'Round ended'
				});
				break;
			}

			// Find candidate with lowest votes to eliminate
			let lowestOptionId: string | null = null;
			let minVotes = Infinity;

			for (const [id, count] of Object.entries(tallies)) {
				if (count < minVotes) {
					minVotes = count;
					lowestOptionId = id;
				}
			}

			// If lowest is tie among all remaining, declare top winner
			const allSame = Object.values(tallies).every((val) => val === minVotes);
			if (allSame) {
				winnerId = highestOptionId;
				rcvRounds.push({
					roundNumber: roundNum,
					tallies: { ...tallies },
					eliminatedOptionId: null,
					exhaustedCount: totalBallots - countThisRound,
					note: `Tie broken. ${optionMap.get(winnerId!)?.title} declared winner.`
				});
				break;
			}

			// Calculate vote transfers before removing lowest candidate
			if (lowestOptionId) {
				const eliminatedTitle = optionMap.get(lowestOptionId)?.title || null;
				const transfers: Record<string, number> = {};
				const prevActiveOptionIds = new Set(activeOptionIds);
				
				// Remove lowest candidate from active set
				activeOptionIds.delete(lowestOptionId);

				// Find where the eliminated candidate's top-choice votes transfer
				for (const ballot of ballots) {
					const topBefore = ballot.find((id) => prevActiveOptionIds.has(id));
					if (topBefore === lowestOptionId) {
						const nextActive = ballot.find((id) => activeOptionIds.has(id));
						if (nextActive) {
							transfers[nextActive] = (transfers[nextActive] || 0) + 1;
						} else {
							transfers['exhausted'] = (transfers['exhausted'] || 0) + 1;
						}
					}
				}

				rcvRounds.push({
					roundNumber: roundNum,
					tallies: { ...tallies },
					eliminatedOptionId: lowestOptionId,
					eliminatedOptionTitle: eliminatedTitle,
					transferredVotes: tallies[lowestOptionId] || 0,
					transfers,
					exhaustedCount: totalBallots - countThisRound,
					note: `Eliminated ${eliminatedTitle}`
				});
			}

			roundNum++;
		}

		// Final rankings calculation based on final round + initial choices
		const lastRoundTallies = rcvRounds.length > 0 ? rcvRounds[rcvRounds.length - 1].tallies : {};
		const sortedOptions = [...options].sort((a, b) => {
			const votesA = lastRoundTallies[a.id] || 0;
			const votesB = lastRoundTallies[b.id] || 0;
			return votesB - votesA;
		});

		const winnerOpt = winnerId ? optionMap.get(winnerId) : null;

		return {
			categoryId,
			votingStrategyId: 'ranked-choice',
			totalBallots,
			winnerOptionId: winnerOpt ? winnerOpt.id : null,
			winnerOptionTitle: winnerOpt ? winnerOpt.title : null,
			winnerCandidateKey: winnerOpt?.candidateKey,
			rankings: sortedOptions.map((o) => {
				const v = lastRoundTallies[o.id] || 0;
				return {
					optionId: o.id,
					title: o.title,
					candidateKey: o.candidateKey,
					votes: v,
					percentage: totalBallots > 0 ? Math.round((v / totalBallots) * 100) : 0
				};
			}),
			rcvRounds,
			summaryMessage: winnerOpt
				? `Winner: ${winnerOpt.title} (via Ranked Choice in ${rcvRounds.length} round${rcvRounds.length > 1 ? 's' : ''})`
				: 'No winner declared.'
		};
	}
};
