import { z } from 'zod'

export const createFacultySchema = z.object({
  name:        z.string().min(1).max(255),
  code:        z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
})

export const updateFacultySchema = z.object({
  name:        z.string().min(1).max(255).optional(),
  code:        z.string().min(1).max(50).optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive:    z.boolean().optional(),
})

export const createDepartmentSchema = z.object({
  facultyId:   z.string().min(1),
  name:        z.string().min(1).max(255),
  code:        z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
})

export const updateDepartmentSchema = z.object({
  name:        z.string().min(1).max(255).optional(),
  code:        z.string().min(1).max(50).optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive:    z.boolean().optional(),
})

export const createCourseSchema = z.object({
  departmentId: z.string().min(1),
  code:         z.string().min(1).max(20),
  title:        z.string().min(1).max(255),
  credits:      z.number().int().min(1).max(20),
  type:         z.enum(['CORE', 'ELECTIVE']),
  status:       z.enum(['active', 'inactive', 'archived']).default('active'),
  originalFee:  z.number().min(0),
  retakeFee:    z.number().min(0),
})

export const updateCourseSchema = z.object({
  departmentId: z.string().min(1).optional(),
  code:         z.string().min(1).max(20).optional(),
  title:        z.string().min(1).max(255).optional(),
  credits:      z.number().int().min(1).max(20).optional(),
  type:         z.enum(['CORE', 'ELECTIVE']).optional(),
  status:       z.enum(['active', 'inactive', 'archived']).optional(),
  originalFee:  z.number().min(0).optional(),
  retakeFee:    z.number().min(0).optional(),
})

// ── Program ──────────────────────────────────────────────────────────────────

export const createProgramSchema = z.object({
  departmentId:      z.string().uuid(),
  name:              z.string().min(2).max(255),
  code:              z.string().min(1).max(50),
  degreeLevel:       z.enum(['bachelor', 'master', 'phd', 'diploma', 'certificate']),
  totalCredits:      z.number().int().min(0),
  durationSemesters: z.number().int().min(1).max(20),
  status:            z.enum(['active', 'inactive', 'archived']).default('active'),
})

export const updateProgramSchema = createProgramSchema.partial()

// ── Program-Course mapping ────────────────────────────────────────────────────

export const addProgramCourseSchema = z.object({
  courseId:    z.string().uuid(),
  semesterNo:  z.number().int().min(1),
  isMandatory: z.boolean().default(true),
})

export const updateProgramCourseSchema = z.object({
  semesterNo:  z.number().int().min(1).optional(),
  isMandatory: z.boolean().optional(),
})

// ── Course Prerequisite ───────────────────────────────────────────────────────

export const addPrerequisiteSchema = z.object({
  prerequisiteCourseId: z.string().uuid(),
  minGrade:             z.string().max(5).optional().nullable(),
  isMandatory:          z.boolean().default(true),
})

export type CreateFacultyInput      = z.infer<typeof createFacultySchema>
export type UpdateFacultyInput      = z.infer<typeof updateFacultySchema>
export type CreateDepartmentInput   = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput   = z.infer<typeof updateDepartmentSchema>
export type CreateCourseInput       = z.infer<typeof createCourseSchema>
export type UpdateCourseInput       = z.infer<typeof updateCourseSchema>
export type CreateProgramInput      = z.infer<typeof createProgramSchema>
export type UpdateProgramInput      = z.infer<typeof updateProgramSchema>
export type AddProgramCourseInput   = z.infer<typeof addProgramCourseSchema>
export type UpdateProgramCourseInput = z.infer<typeof updateProgramCourseSchema>
export type AddPrerequisiteInput    = z.infer<typeof addPrerequisiteSchema>

// ── Teacher ───────────────────────────────────────────────────────────────────

export const createTeacherSchema = z.object({
  departmentId: z.string().uuid(),
  facultyId:    z.string().uuid(),
  name:         z.string().min(2).max(255),
  email:        z.string().email().toLowerCase(),
  phone:        z.string().max(30).optional(),
  designation:  z.enum(['Professor', 'Lecturer']),
  joiningDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
})

export const updateTeacherSchema = z.object({
  departmentId: z.string().uuid().optional(),
  facultyId:    z.string().uuid().optional(),
  name:         z.string().min(2).max(255).optional(),
  phone:        z.string().max(30).nullable().optional(),
  designation:  z.enum(['Professor', 'Lecturer']).optional(),
  joiningDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive:     z.boolean().optional(),
})

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>

// ── Academic Session ──────────────────────────────────────────────────────────

export const createSessionSchema = z.object({
  name:      z.string().min(1).max(100),
  year:      z.number().int().min(2000).max(2100),
  term:      z.enum(['SPRING', 'SUMMER', 'FALL']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  status:    z.enum(['draft', 'active', 'completed', 'archived']).default('draft'),
})

export const updateSessionSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  year:      z.number().int().min(2000).max(2100).optional(),
  term:      z.enum(['SPRING', 'SUMMER', 'FALL']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status:    z.enum(['draft', 'active', 'completed', 'archived']).optional(),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>
