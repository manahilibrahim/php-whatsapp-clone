import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phone: text('phone').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'bigint' }).notNull(),
});

export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  contactUserId: integer('contact_user_id').notNull().references(() => users.id),
  alias: text('alias'),
  createdAt: integer('created_at', { mode: 'bigint' }).notNull(),
}, (table) => ({
  uniqueUserContact: unique().on(table.userId, table.contactUserId),
}));

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  senderId: integer('sender_id').notNull().references(() => users.id),
  receiverId: integer('receiver_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  status: text('status').notNull().default('sent'),
  createdAt: integer('created_at', { mode: 'bigint' }).notNull(),
});

export const calls = sqliteTable('calls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  callerId: integer('caller_id').notNull().references(() => users.id),
  calleeId: integer('callee_id').notNull().references(() => users.id),
  status: text('status').notNull(),
  startedAt: integer('started_at', { mode: 'bigint' }),
  endedAt: integer('ended_at', { mode: 'bigint' }),
  createdAt: integer('created_at', { mode: 'bigint' }).notNull(),
});