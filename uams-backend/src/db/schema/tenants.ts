import { pgTable, pgEnum, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core'

export const tierEnum = pgEnum('tier', [
  '0-50',
  '51-100',
  '101-500',
  '501-1000',
  '1001+',
])

export const tenants = pgTable('tenants', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       varchar('name', { length: 255 }).notNull(),
  email:      varchar('email', { length: 255 }).notNull().unique(),
  phone:      varchar('phone', { length: 50 }),
  address:    varchar('address', { length: 500 }),
  city:       varchar('city', { length: 100 }),
  country:    varchar('country', { length: 100 }),
  tier:       tierEnum('tier').notNull(),
  subdomain:  varchar('subdomain', { length: 100 }).unique(), // nullable — Phase 2
  isVerified: boolean('is_verified').notNull().default(false),
  isActive:   boolean('is_active').notNull().default(false),  // activated after email verification
  createdAt:  timestamp('created_at').notNull().defaultNow(),
  updatedAt:  timestamp('updated_at').notNull().defaultNow(),
})

export type Tenant    = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
