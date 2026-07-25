import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface DbPoll {
	id: string;
	title: string;
	description?: string | null;
	status: 'draft' | 'active' | 'closed';
	winnerAllocationStrategy: string;
	adminPin: string;
	showLiveTotals: boolean;
	currentRevealStep: number;
	createdAt: string;
}

export interface DbCategory {
	id: string;
	pollId: string;
	title: string;
	description?: string | null;
	votingStrategy: string;
	priorityOrder: number;
}

export interface DbPollOption {
	id: string;
	categoryId: string;
	candidateKey?: string | null;
	title: string;
	description?: string | null;
	imageUrl?: string | null;
	displayOrder: number;
}

export interface DbVoter {
	id: string;
	pollId: string;
	voterToken: string;
	nickname: string;
	ipAddress?: string | null;
	createdAt: string;
}

export interface DbVote {
	id: string;
	categoryId: string;
	voterId: string;
	ballotData: any;
	createdAt: string;
}

// In-Memory persistent store for zero-config fallback
class MemoryStore {
	polls: Map<string, DbPoll> = new Map();
	categories: Map<string, DbCategory> = new Map();
	options: Map<string, DbPollOption> = new Map();
	voters: Map<string, DbVoter> = new Map();
	votes: Map<string, DbVote> = new Map();

	constructor() {
		this.seedDemoData();
	}

	private seedDemoData() {
		const pollId = 'demo-party-2026';
		const p: DbPoll = {
			id: pollId,
			title: 'Party Awards 2026',
			description: 'Welcome to tonight’s party! Scan the QR code to submit your votes.',
			status: 'active',
			winnerAllocationStrategy: 'no-duplicate-winners',
			adminPin: '1234',
			showLiveTotals: false,
			currentRevealStep: 0,
			createdAt: new Date().toISOString()
		};
		this.polls.set(p.id, p);

		// Category 1: Best Costume (Ranked Choice Voting)
		const cat1: DbCategory = {
			id: 'cat-best-costume',
			pollId,
			title: 'Best Costume Award',
			description: 'Rank your top costume candidates from 1st to 3rd choice.',
			votingStrategy: 'ranked-choice',
			priorityOrder: 1
		};
		this.categories.set(cat1.id, cat1);

		const optsCat1: DbPollOption[] = [
			{ id: 'c1-opt1', categoryId: cat1.id, candidateKey: 'alex', title: 'Alex as Cyberpunk Neo', description: 'Glowing neon coat with LED glasses', displayOrder: 1 },
			{ id: 'c1-opt2', categoryId: cat1.id, candidateKey: 'jordan', title: 'Jordan as Disco Banana', description: 'Sparkly yellow sequined jumpsuit', displayOrder: 2 },
			{ id: 'c1-opt3', categoryId: cat1.id, candidateKey: 'taylor', title: 'Taylor as Retro Mario', description: 'Classic overalls with giant mustache', displayOrder: 3 },
			{ id: 'c1-opt4', categoryId: cat1.id, candidateKey: 'morgan', title: 'Morgan as Space Astronaut', description: 'Inflatable helmet with cosmic lights', displayOrder: 4 }
		];
		optsCat1.forEach((o) => this.options.set(o.id, o));

		// Category 2: Best Signature Cocktail (Score Rating 1-5 Stars)
		const cat2: DbCategory = {
			id: 'cat-best-cocktail',
			pollId,
			title: 'Best Signature Cocktail',
			description: 'Rate each drink from 1 to 5 stars.',
			votingStrategy: 'score',
			priorityOrder: 2
		};
		this.categories.set(cat2.id, cat2);

		const optsCat2: DbPollOption[] = [
			{ id: 'c2-opt1', categoryId: cat2.id, candidateKey: 'drink-spiced', title: 'Spiced Passionfruit Margarita', description: 'Tangy, sweet, and smoked chili rim', displayOrder: 1 },
			{ id: 'c2-opt2', categoryId: cat2.id, candidateKey: 'drink-blackberry', title: 'Blackberry Lavender Fizz', description: 'Gin, fresh mint, and sparkling soda', displayOrder: 2 },
			{ id: 'c2-opt3', categoryId: cat2.id, candidateKey: 'drink-espresso', title: 'Dark Chocolate Espresso Martini', description: 'Rich espresso with vanilla cream', displayOrder: 3 }
		];
		optsCat2.forEach((o) => this.options.set(o.id, o));

		// Category 3: Karaoke Champion (Approval Voting)
		const cat3: DbCategory = {
			id: 'cat-karaoke',
			pollId,
			title: 'Karaoke Champion',
			description: 'Approve all singers who rocked the stage tonight.',
			votingStrategy: 'approval',
			priorityOrder: 3
		};
		this.categories.set(cat3.id, cat3);

		const optsCat3: DbPollOption[] = [
			{ id: 'c3-opt1', categoryId: cat3.id, candidateKey: 'jordan', title: 'Jordan - "Bohemian Rhapsody"', description: 'High pitched operatic solo', displayOrder: 1 },
			{ id: 'c3-opt2', categoryId: cat3.id, candidateKey: 'taylor', title: 'Taylor & Sam - "Don’t Stop Believin"', description: 'Duet performance with crowd chorus', displayOrder: 2 },
			{ id: 'c3-opt3', categoryId: cat3.id, candidateKey: 'alex', title: 'Alex - "Mr. Brightside"', description: 'Jumped on couch during chorus', displayOrder: 3 }
		];
		optsCat3.forEach((o) => this.options.set(o.id, o));

		// Initial sample voters & votes
		const voter1: DbVoter = {
			id: 'voter-sample-1',
			pollId,
			voterToken: 'token-sample-1',
			nickname: 'Sarah M.',
			ipAddress: '127.0.0.1',
			createdAt: new Date().toISOString()
		};
		this.voters.set(voter1.id, voter1);

		this.votes.set('vote-1', {
			id: 'vote-1',
			categoryId: cat1.id,
			voterId: voter1.id,
			ballotData: ['c1-opt1', 'c1-opt2', 'c1-opt3'],
			createdAt: new Date().toISOString()
		});

		this.votes.set('vote-2', {
			id: 'vote-2',
			categoryId: cat2.id,
			voterId: voter1.id,
			ballotData: { 'c2-opt1': 5, 'c2-opt2': 4, 'c2-opt3': 3 },
			createdAt: new Date().toISOString()
		});

		this.votes.set('vote-3', {
			id: 'vote-3',
			categoryId: cat3.id,
			voterId: voter1.id,
			ballotData: ['c3-opt1', 'c3-opt3'],
			createdAt: new Date().toISOString()
		});
	}
}

export const memoryStore = new MemoryStore();

let dbInstance: any = null;
const connectionString = process.env.DATABASE_URL;

if (connectionString) {
	try {
		const client = postgres(connectionString);
		dbInstance = drizzle(client, { schema });
		console.log('Connected to PostgreSQL via Drizzle ORM');
	} catch (e) {
		console.warn('PostgreSQL connection failed, using memory store fallback:', e);
	}
}

export const db = dbInstance;
