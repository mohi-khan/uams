import { pgTable, pgEnum, uuid, varchar, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const roleEnum = pgEnum('role', [
  'super_admin',
  'admin',
  'dean',
  'academic_coordinator',
  'teacher',
  'student',
])

export const authProviderEnum = pgEnum('auth_provider', [
  'email',   // teachers, admins, dean, super_admin — bcrypt password
  'google',  // students only — Google ID token, no password stored
])

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'inactive',
  'suspended',
])

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  email:        varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  googleId:     varchar('google_id', { length: 255 }),
  authProvider: authProviderEnum('auth_provider').notNull(),
  firstName:    varchar('first_name', { length: 100 }).notNull(),
  lastName:     varchar('last_name', { length: 100 }).notNull(),
  role:         roleEnum('role').notNull(),
  status:       userStatusEnum('status').notNull().default('active'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique('uq_users_tenant_email').on(table.tenantId, table.email),
  unique('uq_users_tenant_google').on(table.tenantId, table.googleId),
])

export type User    = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
