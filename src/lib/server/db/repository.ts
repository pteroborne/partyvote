import { memoryStore, type DbPoll, type DbCategory, type DbPollOption, type DbVoter, type DbVote } from './index';
import type { RawVote, PollOption } from '../voting/types';

export const repo = {
	async getPoll(id: string): Promise<DbPoll | null> {
		return memoryStore.polls.get(id) || null;
	},

	async getAllPolls(): Promise<DbPoll[]> {
		return Array.from(memoryStore.polls.values()).sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
	},

	async createPoll(poll: Omit<DbPoll, 'createdAt'>): Promise<DbPoll> {
		const newPoll: DbPoll = {
			...poll,
			createdAt: new Date().toISOString()
		};
		memoryStore.polls.set(newPoll.id, newPoll);
		return newPoll;
	},

	async updatePoll(id: string, updates: Partial<DbPoll>): Promise<DbPoll | null> {
		const existing = memoryStore.polls.get(id);
		if (!existing) return null;
		const updated = { ...existing, ...updates };
		memoryStore.polls.set(id, updated);
		return updated;
	},

	async deletePoll(id: string): Promise<boolean> {
		// Delete categories, options, voters, votes associated
		const categories = await this.getCategoriesForPoll(id);
		for (const cat of categories) {
			await this.deleteCategory(cat.id);
		}
		const voters = Array.from(memoryStore.voters.values()).filter((v) => v.pollId === id);
		for (const v of voters) {
			memoryStore.voters.delete(v.id);
		}
		return memoryStore.polls.delete(id);
	},

	async getCategoriesForPoll(pollId: string): Promise<DbCategory[]> {
		return Array.from(memoryStore.categories.values())
			.filter((c) => c.pollId === pollId)
			.sort((a, b) => a.priorityOrder - b.priorityOrder);
	},

	async createCategory(cat: DbCategory): Promise<DbCategory> {
		memoryStore.categories.set(cat.id, cat);
		return cat;
	},

	async updateCategory(id: string, updates: Partial<DbCategory>): Promise<DbCategory | null> {
		const existing = memoryStore.categories.get(id);
		if (!existing) return null;
		const updated = { ...existing, ...updates };
		memoryStore.categories.set(id, updated);
		return updated;
	},

	async deleteCategory(id: string): Promise<boolean> {
		// Delete options in category
		const opts = await this.getOptionsForCategory(id);
		for (const o of opts) {
			memoryStore.options.delete(o.id);
		}
		// Delete votes in category
		const categoryVotes = Array.from(memoryStore.votes.values()).filter((v) => v.categoryId === id);
		for (const v of categoryVotes) {
			memoryStore.votes.delete(v.id);
		}
		return memoryStore.categories.delete(id);
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
		return opt;
	},

	async deleteOption(id: string): Promise<boolean> {
		return memoryStore.options.delete(id);
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
		return newVoter;
	},

	async recordVote(categoryId: string, voterId: string, ballotData: any): Promise<DbVote> {
		// Replace previous vote if voter already voted in this category
		const existingVote = Array.from(memoryStore.votes.values()).find(
			(v) => v.categoryId === categoryId && v.voterId === voterId
		);

		if (existingVote) {
			existingVote.ballotData = ballotData;
			existingVote.createdAt = new Date().toISOString();
			memoryStore.votes.set(existingVote.id, existingVote);
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
	}
};
