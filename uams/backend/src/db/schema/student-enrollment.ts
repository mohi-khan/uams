import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, numeric, integer, date, unique, jsonb,
} from 'drizzle-orm/pg-core'
import { tenants }                      from './tenants'
import { users }                         from './users'
import { programs, academicSessions, auditActionEnum } from './academic'
import { students, batches }             from './enrollment'

// ── Enums ─────────────────────────────────────────────────────────────────────

export const feeTypeEnum           = pgEnum('fee_type',           ['admission', 'semester', 'lab', 'library', 'other'])
export const enrollmentStatusEnum  = pgEnum('enrollment_status',  ['active', 'suspended', 'completed', 'dropped'])
export const semesterStatusEnum    = pgEnum('semester_status',    ['ongoing', 'completed', 'failed', 'repeated'])
export const installmentStatusEnum = pgEnum('installment_status', ['pending', 'paid', 'overdue', 'waived'])
export const paymentMethodEnum     = pgEnum('payment_method',     ['cash', 'bank_transfer', 'card', 'online'])
export const offeringStatusEnum    = pgEnum('offering_status',    ['open', 'closed'])

// ── Fee Structure ─────────────────────────────────────────────────────────────

export const feeStructures = pgTable('fee_structures', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id,   { onDelete: 'cascade'   }),
  programId:   uuid('program_id').notNull().references(() => programs.id, { onDelete: 'restrict'  }),
  description: varchar('description', { length: 255 }).notNull(),
  feeType:     feeTypeEnum('fee_type').notNull().default('other'),
  amount:      numeric('amount', { precision: 12, scale: 2 }).notNull(),
  isActive:    boolean('is_active').notNull().default(true),
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:   uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at'),
})

// ── Program Offering ──────────────────────────────────────────────────────────
// Links a program to an academic session for a specific intake.
// Coordinators open/close offerings; enrollment must reference an open offering.

export const programOfferings = pgTable('program_offerings', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id,               { onDelete: 'cascade'  }),
  programId:          uuid('program_id').notNull().references(() => programs.id,             { onDelete: 'restrict' }),
  academicSessionId:  uuid('academic_session_id').notNull().references(() => academicSessions.id, { onDelete: 'restrict' }),
  admissionStartDate: date('admission_start_date'),
  admissionEndDate:   date('admission_end_date'),
  capacity:           integer('capacity'),
  status:             offeringStatusEnum('status').notNull().default('open'),
  createdBy:          uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:          uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:          uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
  updatedAt:          timestamp('updated_at').notNull().defaultNow(),
  deletedAt:          timestamp('deleted_at'),
}, (t) => [
  unique('uq_program_offering').on(t.tenantId, t.programId, t.academicSessionId),
])

// ── Student Enrollment ────────────────────────────────────────────────────────

export const studentEnrollments = pgTable('student_enrollments', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id,             { onDelete: 'cascade'  }),
  studentId:          uuid('student_id').notNull().references(() => students.id,           { onDelete: 'restrict' }),
  programOfferingId:  uuid('program_offering_id').references(() => programOfferings.id,    { onDelete: 'restrict' }),
  programId:          uuid('program_id').notNull().references(() => programs.id,           { onDelete: 'restrict' }),
  batchId:            uuid('batch_id').references(() => batches.id,                        { onDelete: 'set null' }),
  sessionId:          uuid('session_id').references(() => academicSessions.id,             { onDelete: 'set null' }),
  feeStructureId:     uuid('fee_structure_id').references(() => feeStructures.id,          { onDelete: 'set null' }),
  enrollmentDate:     date('enrollment_date').notNull(),
  status:             enrollmentStatusEnum('status').notNull().default('active'),
  totalFee:           numeric('total_fee',  { precision: 12, scale: 2 }).notNull().default('0'),
  paidAmount:         numeric('paid_amount',{ precision: 12, scale: 2 }).notNull().default('0'),
  notes:              text('notes'),
  createdBy:          uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:          uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:          uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
  updatedAt:          timestamp('updated_at').notNull().defaultNow(),
  deletedAt:          timestamp('deleted_at'),
})

// ── Student Semester ──────────────────────────────────────────────────────────

export const studentSemesters = pgTable('student_semesters', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id,                { onDelete: 'cascade'  }),
  enrollmentId: uuid('enrollment_id').notNull().references(() => studentEnrollments.id, { onDelete: 'cascade'  }),
  studentId:    uuid('student_id').notNull().references(() => students.id,              { onDelete: 'restrict' }),
  semesterNo:   integer('semester_no').notNull(),
  sessionId:    uuid('session_id').references(() => academicSessions.id, { onDelete: 'set null' }),
  startDate:    date('start_date'),
  endDate:      date('end_date'),
  status:       semesterStatusEnum('status').notNull().default('ongoing'),
  createdBy:    uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:    uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('uq_student_semester').on(t.enrollmentId, t.semesterNo),
])

// ── Student Installment ───────────────────────────────────────────────────────

export const studentInstallments = pgTable('student_installments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id,                { onDelete: 'cascade'  }),
  enrollmentId:  uuid('enrollment_id').notNull().references(() => studentEnrollments.id, { onDelete: 'cascade'  }),
  studentId:     uuid('student_id').notNull().references(() => students.id,              { onDelete: 'restrict' }),
  installmentNo: integer('installment_no').notNull(),
  description:   varchar('description', { length: 255 }),
  dueDate:       date('due_date').notNull(),
  amount:        numeric('amount',      { precision: 12, scale: 2 }).notNull(),
  paidAmount:    numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  status:        installmentStatusEnum('status').notNull().default('pending'),
  createdBy:     uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:     uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
})

// ── Student Payment ───────────────────────────────────────────────────────────

export const studentPayments = pgTable('student_payments', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id,                { onDelete: 'cascade'  }),
  enrollmentId:   uuid('enrollment_id').notNull().references(() => studentEnrollments.id, { onDelete: 'cascade'  }),
  studentId:      uuid('student_id').notNull().references(() => students.id,              { onDelete: 'restrict' }),
  installmentId:  uuid('installment_id').references(() => studentInstallments.id,         { onDelete: 'set null' }),
  amount:         numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate:    date('payment_date').notNull(),
  paymentMethod:  paymentMethodEnum('payment_method').notNull(),
  transactionRef: varchar('transaction_ref', { length: 100 }),
  notes:          text('notes'),
  createdBy:      uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const programOfferingAuditLogs = pgTable('program_offering_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  offeringId:  uuid('offering_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export const feeStructureAuditLogs = pgTable('fee_structure_audit_logs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  feeStructureId: uuid('fee_structure_id').notNull(),
  action:         auditActionEnum('action').notNull(),
  performedBy:    uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:       jsonb('snapshot'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

export const enrollmentAuditLogs = pgTable('enrollment_audit_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').notNull(),
  action:       auditActionEnum('action').notNull(),
  performedBy:  uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:     jsonb('snapshot'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const semesterAuditLogs = pgTable('semester_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  semesterId:  uuid('semester_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export const installmentAuditLogs = pgTable('installment_audit_logs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  installmentId: uuid('installment_id').notNull(),
  action:        auditActionEnum('action').notNull(),
  performedBy:   uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:      jsonb('snapshot'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
})

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeeStructure              = typeof feeStructures.$inferSelect
export type ProgramOffering           = typeof programOfferings.$inferSelect
export type StudentEnrollment         = typeof studentEnrollments.$inferSelect
export type StudentSemester           = typeof studentSemesters.$inferSelect
export type StudentInstallment        = typeof studentInstallments.$inferSelect
export type StudentPayment            = typeof studentPayments.$inferSelect
export type ProgramOfferingAuditLog   = typeof programOfferingAuditLogs.$inferSelect
export type FeeStructureAuditLog      = typeof feeStructureAuditLogs.$inferSelect
export type EnrollmentAuditLog        = typeof enrollmentAuditLogs.$inferSelect
export type SemesterAuditLog          = typeof semesterAuditLogs.$inferSelect
export type InstallmentAuditLog       = typeof installmentAuditLogs.$inferSelect
