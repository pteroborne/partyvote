export interface PollOption {
	id: string;
	categoryId: string;
	candidateKey?: string | null;
	title: string;
	description?: string | null;
	imageUrl?: string | null;
	displayOrder: number;
}

export interface RawVote {
	id: string;
	categoryId: string;
	voterId: string;
	ballotData: any; // Strategy-specific ballot structure
	createdAt: Date | string;
}

export interface CandidateTally {
	optionId: string;
	title: string;
	candidateKey?: string | null;
	votes: number;
	percentage: number;
}

export interface RCVRound {
	roundNumber: number;
	tallies: Record<string, number>; // optionId -> vote count in this round
	eliminatedOptionId?: string | null;
	transferredVotes?: number;
	note?: string;
}

export interface CategoryResult {
	categoryId: string;
	votingStrategyId: string;
	totalBallots: number;
	winnerOptionId: string | null;
	winnerOptionTitle: string | null;
	winnerCandidateKey?: string | null;
	rankings: CandidateTally[]; // Ordered list of options from highest to lowest score/votes
	rcvRounds?: RCVRound[]; // Breakdown for Ranked Choice Voting
	summaryMessage: string;
}

export interface VotingStrategy {
	id: string;
	name: string;
	description: string;
	
	// Validates guest ballot payload structure
	validateBallot(ballotData: any, options: PollOption[]): { valid: boolean; error?: string };

	// Tallies votes and produces category results
	calculateResults(votes: RawVote[], options: PollOption[], categoryId: string): CategoryResult;
}

export interface CategoryWinnerRequest {
	categoryId: string;
	categoryTitle: string;
	priorityOrder: number;
	options: PollOption[];
	categoryResult: CategoryResult;
}

export interface FinalCategoryWinner {
	categoryId: string;
	categoryTitle: string;
	winningOption: PollOption | null;
	allocatedByRule: string;
	isRunnerUpFallback: boolean;
	originalWinnerTitle?: string;
	result: CategoryResult;
}

export interface EventWinnersResult {
	allocationStrategyId: string;
	categoryWinners: FinalCategoryWinner[];
}

export interface WinnerAllocationStrategy {
	id: string;
	name: string;
	description: string;
	allocateWinners(categoryRequests: CategoryWinnerRequest[]): EventWinnersResult;
}
