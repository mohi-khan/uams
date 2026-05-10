import { pgTable, pgEnum, uuid, varchar, text, boolean, timestamp, jsonb, integer, numeric, date, unique } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { users } from './users'

export const auditActionEnum = pgEnum('audit_action', ['CREATE', 'UPDATE', 'DELETE'])

export const faculties = pgTable('faculties', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 255 }).notNull(),
  code:        varchar('code', { length: 50 }).notNull(),
  description: text('description'),
  isActive:    boolean('is_active').notNull().default(true),
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:   uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at'),
})

export const departments = pgTable('departments', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  facultyId:   uuid('faculty_id').notNull().references(() => faculties.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 255 }).notNull(),
  code:        varchar('code', { length: 50 }).notNull(),
  description: text('description'),
  isActive:    boolean('is_active').notNull().default(true),
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:   uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:   uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at'),
})

export const facultyAuditLogs = pgTable('faculty_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  facultyId:   uuid('faculty_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export const departmentAuditLogs = pgTable('department_audit_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').notNull(),
  action:       auditActionEnum('action').notNull(),
  performedBy:  uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:     jsonb('snapshot'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const courseTypeEnum   = pgEnum('course_type',   ['CORE', 'ELECTIVE'])
export const courseStatusEnum = pgEnum('course_status', ['active', 'inactive', 'archived'])

export const courses = pgTable('courses', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  code:         varchar('code', { length: 20 }).notNull(),
  title:        varchar('title', { length: 255 }).notNull(),
  credits:      integer('credits').notNull(),
  type:         courseTypeEnum('type').notNull(),
  status:       courseStatusEnum('status').notNull().default('active'),
  originalFee:  numeric('original_fee', { precision: 10, scale: 2 }).notNull().default('0'),
  retakeFee:    numeric('retake_fee',   { precision: 10, scale: 2 }).notNull().default('0'),
  createdBy:    uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:    uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:    uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at'),
})

export const courseAuditLogs = pgTable('course_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  courseId:    uuid('course_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Program ───────────────────────────────────────────────────────────────────

export const degreeLevelEnum = pgEnum('degree_level', ['bachelor', 'master', 'phd', 'diploma', 'certificate'])

export const programs = pgTable('programs', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  departmentId:      uuid('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  name:              varchar('name', { length: 255 }).notNull(),
  code:              varchar('code', { length: 50 }).notNull(),
  degreeLevel:       degreeLevelEnum('degree_level').notNull(),
  totalCredits:      integer('total_credits').notNull().default(0),
  durationSemesters: integer('duration_semesters').notNull().default(8),
  status:            courseStatusEnum('status').notNull().default('active'),
  createdBy:         uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:         uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:         uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
  deletedAt:         timestamp('deleted_at'),
})

export const programAuditLogs = pgTable('program_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  programId:   uuid('program_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export const programCourses = pgTable('program_courses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  programId:   uuid('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  courseId:    uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  semesterNo:  integer('semester_no').notNull(),
  isMandatory: boolean('is_mandatory').notNull().default(true),
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export const coursePrerequisites = pgTable('course_prerequisites', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  tenantId:             uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  courseId:             uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  prerequisiteCourseId: uuid('prerequisite_course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  minGrade:             varchar('min_grade', { length: 5 }),
  isMandatory:          boolean('is_mandatory').notNull().default(true),
  createdBy:            uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
})

export type Faculty             = typeof faculties.$inferSelect
export type Department          = typeof departments.$inferSelect
export type Course              = typeof courses.$inferSelect
export type Program             = typeof programs.$inferSelect
export type ProgramCourse       = typeof programCourses.$inferSelect
export type CoursePrerequisite  = typeof coursePrerequisites.$inferSelect
export type FacultyAuditLog     = typeof facultyAuditLogs.$inferSelect
export type DepartmentAuditLog  = typeof departmentAuditLogs.$inferSelect
export type CourseAuditLog      = typeof courseAuditLogs.$inferSelect
export type ProgramAuditLog     = typeof programAuditLogs.$inferSelect

// ── Teacher ───────────────────────────────────────────────────────────────────

export const designationEnum = pgEnum('designation', ['Professor', 'Lecturer'])

export const teachers = pgTable('teachers', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  departmentId: uuid('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
  facultyId:    uuid('faculty_id').notNull().references(() => faculties.id, { onDelete: 'restrict' }),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name:         varchar('name', { length: 255 }).notNull(),
  email:        varchar('email', { length: 255 }).notNull(),
  phone:        varchar('phone', { length: 30 }),
  designation:  designationEnum('designation').notNull(),
  joiningDate:  date('joining_date').notNull(),
  isActive:     boolean('is_active').notNull().default(true),
  createdBy:    uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy:    uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy:    uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at'),
}, (table) => [
  unique('uq_teachers_tenant_email').on(table.tenantId, table.email),
])

export const teacherAuditLogs = pgTable('teacher_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  teacherId:   uuid('teacher_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export type Teacher          = typeof teachers.$inferSelect
export type NewTeacher       = typeof teachers.$inferInsert
export type TeacherAuditLog  = typeof teacherAuditLogs.$inferSelect

// ── Academic Session ──────────────────────────────────────────────────────────

export const termEnum          = pgEnum('term',             ['SPRING', 'SUMMER', 'FALL'])
export const sessionStatusEnum = pgEnum('session_status',   ['draft', 'active', 'completed', 'archived'])

export const academicSessions = pgTable('academic_sessions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      varchar('name', { length: 100 }).notNull(),
  year:      integer('year').notNull(),
  term:      termEnum('term').notNull(),
  startDate: date('start_date').notNull(),
  endDate:   date('end_date').notNull(),
  status:    sessionStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  unique('uq_session_tenant_year_term').on(table.tenantId, table.year, table.term),
])

export const academicSessionAuditLogs = pgTable('academic_session_audit_logs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sessionId:   uuid('session_id').notNull(),
  action:      auditActionEnum('action').notNull(),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  snapshot:    jsonb('snapshot'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export type AcademicSession         = typeof academicSessions.$inferSelect
export type NewAcademicSession      = typeof academicSessions.$inferInsert
export type AcademicSessionAuditLog = typeof academicSessionAuditLogs.$inferSelect
