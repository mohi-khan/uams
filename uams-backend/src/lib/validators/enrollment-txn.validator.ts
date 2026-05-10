import { z } from 'zod'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')

// ── Program Offering ──────────────────────────────────────────────────────────

export const createProgramOfferingSchema = z.object({
  programId:          z.string().uuid(),
  academicSessionId:  z.string().uuid(),
  admissionStartDate: dateStr.optional(),
  admissionEndDate:   dateStr.optional(),
  capacity:           z.number().int().min(1).optional(),
  status:             z.enum(['open', 'closed']).default('open'),
})

export const updateProgramOfferingSchema = z.object({
  admissionStartDate: dateStr.nullable().optional(),
  admissionEndDate:   dateStr.nullable().optional(),
  capacity:           z.number().int().min(1).nullable().optional(),
  status:             z.enum(['open', 'closed']).optional(),
})

export const bulkSaveOfferingsSchema = z.object({
  academicSessionId: z.string().uuid(),
  programs: z.array(z.object({
    programId:          z.string().uuid(),
    admissionStartDate: dateStr.nullable().optional(),
    admissionEndDate:   dateStr.nullable().optional(),
    capacity:           z.number().int().min(1).nullable().optional(),
    status:             z.enum(['open', 'closed']).default('open'),
  })).min(1),
})

export type CreateProgramOfferingInput = z.infer<typeof createProgramOfferingSchema>
export type UpdateProgramOfferingInput = z.infer<typeof updateProgramOfferingSchema>
export type BulkSaveOfferingsInput     = z.infer<typeof bulkSaveOfferingsSchema>

// ── Fee Structure ─────────────────────────────────────────────────────────────

export const createFeeStructureSchema = z.object({
  programId:   z.string().uuid(),
  description: z.string().min(2).max(255),
  feeType:     z.enum(['admission', 'semester', 'lab', 'library', 'other']),
  amount:      z.number().min(0),
})

export const updateFeeStructureSchema = z.object({
  description: z.string().min(2).max(255).optional(),
  feeType:     z.enum(['admission', 'semester', 'lab', 'library', 'other']).optional(),
  amount:      z.number().min(0).optional(),
  isActive:    z.boolean().optional(),
})

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>
export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>

// ── Enrollment ────────────────────────────────────────────────────────────────

const installmentItemSchema = z.object({
  installmentNo: z.number().int().min(1),
  description:   z.string().max(255).optional(),
  dueDate:       dateStr,
  amount:        z.number().min(0.01),
})

export const createEnrollmentSchema = z.object({
  studentId:         z.string().uuid(),
  programOfferingId: z.string().uuid(),
  batchId:           z.string().uuid().optional(),
  feeStructureId:    z.string().uuid().optional(),
  enrollmentDate:    dateStr,
  totalFee:          z.number().min(0),
  notes:             z.string().max(1000).optional(),
  installments:      z.array(installmentItemSchema).optional(),
})

export const updateEnrollmentSchema = z.object({
  batchId: z.string().uuid().nullable().optional(),
  status:  z.enum(['active', 'suspended', 'completed', 'dropped']).optional(),
  notes:   z.string().max(1000).nullable().optional(),
})

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>

// ── Semester ──────────────────────────────────────────────────────────────────

export const addSemesterSchema = z.object({
  semesterNo: z.number().int().min(1).max(12),
  sessionId:  z.string().uuid().optional(),
  startDate:  dateStr.optional(),
  endDate:    dateStr.optional(),
  status:     z.enum(['ongoing', 'completed', 'failed', 'repeated']).default('ongoing'),
})

export const updateSemesterSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  startDate: dateStr.nullable().optional(),
  endDate:   dateStr.nullable().optional(),
  status:    z.enum(['ongoing', 'completed', 'failed', 'repeated']).optional(),
})

export type AddSemesterInput    = z.infer<typeof addSemesterSchema>
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>

// ── Payment ───────────────────────────────────────────────────────────────────

export const recordPaymentSchema = z.object({
  installmentId:  z.string().uuid().optional(),
  amount:         z.number().min(0.01),
  paymentDate:    dateStr,
  paymentMethod:  z.enum(['cash', 'bank_transfer', 'card', 'online']),
  transactionRef: z.string().max(100).optional(),
  notes:          z.string().max(1000).optional(),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

// ── Installment update ────────────────────────────────────────────────────────

export const updateInstallmentSchema = z.object({
  status:  z.enum(['pending', 'overdue', 'waived']).optional(),
  dueDate: dateStr.optional(),
})

export type UpdateInstallmentInput = z.infer<typeof updateInstallmentSchema>

// ── Bulk Batch Assignment ─────────────────────────────────────────────────────

export const bulkAssignBatchSchema = z.object({
  enrollmentIds: z.array(z.string().uuid()).min(1),
  batchId:       z.string().uuid().nullable(),
})

export type BulkAssignBatchInput = z.infer<typeof bulkAssignBatchSchema>
