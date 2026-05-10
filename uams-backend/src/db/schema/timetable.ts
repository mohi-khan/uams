import { pgTable, pgEnum, uuid, varchar, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const roomTypeEnum = pgEnum('room_type', ['THEORY', 'LAB'])

// ── Time Slots ────────────────────────────────────────────────────────────────

export const timeSlots = pgTable('time_slots', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:            varchar('name', { length: 50 }).notNull(),
  startTime:       varchar('start_time', { length: 5 }).notNull(),   // HH:MM
  endTime:         varchar('end_time', { length: 5 }).notNull(),     // HH:MM
  durationMinutes: integer('duration_minutes').notNull(),
  isActive:        boolean('is_active').notNull().default(true),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_time_slots_tenant_name').on(t.tenantId, t.name),
])

// ── Rooms ─────────────────────────────────────────────────────────────────────

export const rooms = pgTable('rooms', {
  id:       uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:     varchar('name', { length: 100 }).notNull(),
  capacity: integer('capacity').notNull(),
  type:     roomTypeEnum('type').notNull().default('THEORY'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_rooms_tenant_name').on(t.tenantId, t.name),
])

export type TimeSlot = typeof timeSlots.$inferSelect
export type Room     = typeof rooms.$inferSelect
