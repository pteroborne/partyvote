import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';

export const polls = pgTable('polls', {
	id: uuid('id').defaultRandom().primaryKey(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description'),
	status: varchar('status', { length: 50 }).notNull().default('draft'), // draft, active, closed
	winnerAllocationStrategy: varchar('winner_allocation_strategy', { length: 50 }).notNull().default('standard'),
	adminPin: varchar('admin_pin', { length: 20 }).default('1234'),
	showLiveTotals: boolean('show_live_totals').default(false), // false = secret ballot mode on TV (shows voters only)
	currentRevealStep: integer('current_reveal_step').default(0), // step index for admin-controlled reveal ceremony
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

export const categories = pgTable('categories', {
	id: uuid('id').defaultRandom().primaryKey(),
	pollId: uuid('poll_id').references(() => polls.id, { onDelete: 'cascade' }).notNull(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description'),
	votingStrategy: varchar('voting_strategy', { length: 50 }).notNull().default('ranked-choice'),
	priorityOrder: integer('priority_order').default(0)
});

export const pollOptions = pgTable('poll_options', {
	id: uuid('id').defaultRandom().primaryKey(),
	categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
	candidateKey: varchar('candidate_key', { length: 100 }),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description'),
	imageUrl: text('image_url'),
	displayOrder: integer('display_order').default(0)
});

export const voters = pgTable('voters', {
	id: uuid('id').defaultRandom().primaryKey(),
	pollId: uuid('poll_id').references(() => polls.id, { onDelete: 'cascade' }).notNull(),
	voterToken: varchar('voter_token', { length: 255 }).notNull(),
	nickname: varchar('nickname', { length: 100 }).notNull(),
	ipAddress: varchar('ip_address', { length: 45 }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (t) => [
	unique().on(t.pollId, t.voterToken)
]);

export const votes = pgTable('votes', {
	id: uuid('id').defaultRandom().primaryKey(),
	categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
	voterId: uuid('voter_id').references(() => voters.id, { onDelete: 'cascade' }).notNull(),
	ballotData: jsonb('ballot_data').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (t) => [
	unique().on(t.categoryId, t.voterId)
]);
