import { memoryStore, type DbPoll, type DbCategory, type DbPollOption, type DbVoter, type DbVote } from './index';
import type { RawVote } from '../voting/types';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists and auto-load saved state on startup
try {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}
	if (fs.existsSync(BACKUP_FILE)) {
		const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
		const json = JSON.parse(raw);
		if (json.polls) memoryStore.polls = new Map(json.polls);
		if (json.categories) memoryStore.categories = new Map(json.categories);
		if (json.options) memoryStore.options = new Map(json.options);
		if (json.voters) memoryStore.voters = new Map(json.voters);
		if (json.votes) memoryStore.votes = new Map(json.votes);
		console.log('[PartyVote Persistence] Successfully loaded saved polls from disk.');
	}
} catch (e) {
	console.warn('[PartyVote Persistence] Failed to load store.json from disk:', e);
}

function persistStoreToDisk() {
	try {
		if (!fs.existsSync(DATA_DIR)) {
			fs.mkdirSync(DATA_DIR, { recursive: true });
		}
		const state = {
			polls: Array.from(memoryStore.polls.entries()),
			categories: Array.from(memoryStore.categories.entries()),
			options: Array.from(memoryStore.options.entries()),
			voters: Array.from(memoryStore.voters.entries()),
			votes: Array.from(memoryStore.votes.entries())
		};
		fs.writeFileSync(BACKUP_FILE, JSON.stringify(state, null, 2), 'utf-8');
	} catch (e) {
		console.error('[PartyVote Persistence] Failed to write store.json to disk:', e);
	}
}
function reloadStoreFromDisk() {
	try {
		if (fs.existsSync(BACKUP_FILE)) {
			const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
			const json = JSON.parse(raw);
			if (json.polls) memoryStore.polls = new Map(json.polls);
			if (json.categories) memoryStore.categories = new Map(json.categories);
			if (json.options) memoryStore.options = new Map(json.options);
			if (json.voters) memoryStore.voters = new Map(json.voters);
			if (json.votes) memoryStore.votes = new Map(json.votes);
		}
	} catch (e) {
		console.warn('[PartyVote Persistence] Failed to reload store.json:', e);
	}
}

export const repo = {
	async getPoll(id: string): Promise<DbPoll | null> {
		if (!memoryStore.polls.has(id)) {
			reloadStoreFromDisk();
		}
		return memoryStore.polls.get(id) || null;
	},

	async getAllPolls(): Promise<DbPoll[]> {
		reloadStoreFromDisk();
		return Array.from(memoryStore.polls.values()).sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	},

	async createPoll(poll: Omit<DbPoll, 'createdAt' | 'currentRevealSubStep' | 'isAutoPlaying'> & Partial<DbPoll>): Promise<DbPoll> {
		const newPoll: DbPoll = {
			currentRevealSubStep: 0,
			isAutoPlaying: false,
			...poll,
			createdAt: new Date().toISOString()
		};
		memoryStore.polls.set(newPoll.id, newPoll);
		persistStoreToDisk();
		return newPoll;
	},

	async updatePoll(id: string, updates: Partial<DbPoll>): Promise<DbPoll | null> {
		const existing = memoryStore.polls.get(id);
		if (!existing) return null;
		const updated = { ...existing, ...updates };
		memoryStore.polls.set(id, updated);
		persistStoreToDisk();
		return updated;
	},

	async deletePoll(id: string): Promise<boolean> {
		const categories = await this.getCategoriesForPoll(id);
		for (const cat of categories) {
			await this.deleteCategory(cat.id);
		}
		const voters = Array.from(memoryStore.voters.values()).filter((v) => v.pollId === id);
		for (const v of voters) {
			memoryStore.voters.delete(v.id);
		}
		const deleted = memoryStore.polls.delete(id);
		persistStoreToDisk();
		return deleted;
	},

	async getCategoriesForPoll(pollId: string): Promise<DbCategory[]> {
		return Array.from(memoryStore.categories.values())
			.filter((c) => c.pollId === pollId)
			.sort((a, b) => a.priorityOrder - b.priorityOrder);
	},

	async createCategory(cat: DbCategory): Promise<DbCategory> {
		memoryStore.categories.set(cat.id, cat);
		persistStoreToDisk();
		return cat;
	},

	async updateCategory(id: string, updates: Partial<DbCategory>): Promise<DbCategory | null> {
		const existing = memoryStore.categories.get(id);
		if (!existing) return null;
		const updated = { ...existing, ...updates };
		memoryStore.categories.set(id, updated);
		persistStoreToDisk();
		return updated;
	},

	async deleteCategory(id: string): Promise<boolean> {
		const opts = await this.getOptionsForCategory(id);
		for (const o of opts) {
			memoryStore.options.delete(o.id);
		}
		const categoryVotes = Array.from(memoryStore.votes.values()).filter((v) => v.categoryId === id);
		for (const v of categoryVotes) {
			memoryStore.votes.delete(v.id);
		}
		const deleted = memoryStore.categories.delete(id);
		persistStoreToDisk();
		return deleted;
	},

	async getOptionsForCategory(categoryId: string): Promise<DbPollOption[]> {
		return Array.from(memoryStore.options.values())
			.filter((o) => o.categoryId === categoryId)
			.sort((a, b) => a.displayOrder - b.displayOrder);
	},

	async getAllOptionsForPoll(pollId: string): Promise<DbPollOption[]> {
		const categories = await this.getCategoriesForPoll(pollId);
		const catIds = new Set(categories.map((c) => c.id));
		return Array.from(memoryStore.options.values()).filter((o) => catIds.has(o.categoryId));
	},

	async createOption(opt: DbPollOption): Promise<DbPollOption> {
		memoryStore.options.set(opt.id, opt);
		persistStoreToDisk();
		return opt;
	},

	async deleteOption(id: string): Promise<boolean> {
		const deleted = memoryStore.options.delete(id);
		persistStoreToDisk();
		return deleted;
	},

	async getVoterByToken(pollId: string, token: string): Promise<DbVoter | null> {
		return (
			Array.from(memoryStore.voters.values()).find(
				(v) => v.pollId === pollId && v.voterToken === token
			) || null
		);
	},

	async getVotersForPoll(pollId: string): Promise<DbVoter[]> {
		return Array.from(memoryStore.voters.values())
			.filter((v) => v.pollId === pollId)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	},

	async registerVoter(pollId: string, token: string, nickname: string, ipAddress?: string): Promise<DbVoter> {
		let existing = await this.getVoterByToken(pollId, token);
		if (existing) {
			if (existing.nickname !== nickname) {
				existing.nickname = nickname;
				memoryStore.voters.set(existing.id, existing);
				persistStoreToDisk();
			}
			return existing;
		}
		const newVoter: DbVoter = {
			id: 'voter-' + Math.random().toString(36).substring(2, 10),
			pollId,
			voterToken: token,
			nickname,
			ipAddress,
			createdAt: new Date().toISOString()
		};
		memoryStore.voters.set(newVoter.id, newVoter);
		persistStoreToDisk();
		return newVoter;
	},

	async recordVote(categoryId: string, voterId: string, ballotData: any): Promise<DbVote> {
		const existingVote = Array.from(memoryStore.votes.values()).find(
			(v) => v.categoryId === categoryId && v.voterId === voterId
		);

		if (existingVote) {
			existingVote.ballotData = ballotData;
			existingVote.createdAt = new Date().toISOString();
			memoryStore.votes.set(existingVote.id, existingVote);
			persistStoreToDisk();
			return existingVote;
		}

		const newVote: DbVote = {
			id: 'vote-' + Math.random().toString(36).substring(2, 10),
			categoryId,
			voterId,
			ballotData,
			createdAt: new Date().toISOString()
		};
		memoryStore.votes.set(newVote.id, newVote);
		persistStoreToDisk();
		return newVote;
	},

	async getVotesForCategory(categoryId: string): Promise<RawVote[]> {
		return Array.from(memoryStore.votes.values())
			.filter((v) => v.categoryId === categoryId)
			.map((v) => ({
				id: v.id,
				categoryId: v.categoryId,
				voterId: v.voterId,
				ballotData: v.ballotData,
				createdAt: v.createdAt
			}));
	},

	async getVotesForPoll(pollId: string): Promise<RawVote[]> {
		const categories = await this.getCategoriesForPoll(pollId);
		const catIds = new Set(categories.map((c) => c.id));
		return Array.from(memoryStore.votes.values())
			.filter((v) => catIds.has(v.categoryId))
			.map((v) => ({
				id: v.id,
				categoryId: v.categoryId,
				voterId: v.voterId,
				ballotData: v.ballotData,
				createdAt: v.createdAt
			}));
	},

	// Export full poll dump JSON
	async exportPoll(pollId: string) {
		const poll = await this.getPoll(pollId);
		if (!poll) return null;
		const categories = await this.getCategoriesForPoll(pollId);
		const options = await this.getAllOptionsForPoll(pollId);
		const voters = await this.getVotersForPoll(pollId);
		const votes = await this.getVotesForPoll(pollId);

		return {
			exportedAt: new Date().toISOString(),
			poll,
			categories,
			options,
			voters,
			votes
		};
	},

	// Import full poll dump JSON
	async importPoll(dump: any) {
		if (!dump || !dump.poll || !dump.poll.id) {
			throw new Error('Invalid poll backup payload.');
		}
		const poll: DbPoll = dump.poll;
		memoryStore.polls.set(poll.id, poll);

		if (Array.isArray(dump.categories)) {
			dump.categories.forEach((c: DbCategory) => memoryStore.categories.set(c.id, c));
		}
		if (Array.isArray(dump.options)) {
			dump.options.forEach((o: DbPollOption) => memoryStore.options.set(o.id, o));
		}
		if (Array.isArray(dump.voters)) {
			dump.voters.forEach((v: DbVoter) => memoryStore.voters.set(v.id, v));
		}
		if (Array.isArray(dump.votes)) {
			dump.votes.forEach((v: DbVote) => memoryStore.votes.set(v.id, v));
		}

		persistStoreToDisk();
		return poll;
	}
};
