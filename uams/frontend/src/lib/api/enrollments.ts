import { apiClient } from './client'
import type { PagedResult, AuditLogEntry } from './academic'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OfferingStatus    = 'open' | 'closed'
export type FeeType           = 'admission' | 'semester' | 'lab' | 'library' | 'other'
export type EnrollmentStatus  = 'active' | 'suspended' | 'completed' | 'dropped'
export type SemesterStatus    = 'ongoing' | 'completed' | 'failed' | 'repeated'
export type InstallmentStatus = 'pending' | 'paid' | 'overdue' | 'waived'
export type PaymentMethod     = 'cash' | 'bank_transfer' | 'card' | 'online'

export interface ProgramOfferingRow {
  id:                 string
  programId:          string
  programName:        string
  programCode:        string
  academicSessionId:  string
  sessionName:        string
  admissionStartDate: string | null
  admissionEndDate:   string | null
  capacity:           number | null
  status:             OfferingStatus
  enrolledCount:      number
  createdAt:          string
}

export interface FeeStructureRow {
  id:          string
  programId:   string
  programName: string
  programCode: string
  description: string
  feeType:     FeeType
  amount:      string
  isActive:    boolean
  createdAt:   string
}

export interface EnrollmentRow {
  id:                string
  studentId:         string
  studentName:       string
  studentCode:       string
  studentPhoto:      string | null
  programId:         string
  programName:       string
  programCode:       string
  programOfferingId: string | null
  batchId:           string | null
  batchName:         string | null
  sessionId:         string | null
  sessionName:       string | null
  enrollmentDate:    string
  status:            EnrollmentStatus
  totalFee:          string
  paidAmount:        string
  notes:             string | null
  createdAt:         string
}

export interface EnrollmentDetail extends EnrollmentRow {
  studentEmail: string
  studentPhone: string | null
  feeStructureId: string | null
  updatedAt:    string
}

export interface SemesterRow {
  id:          string
  semesterNo:  number
  sessionId:   string | null
  sessionName: string | null
  startDate:   string | null
  endDate:     string | null
  status:      SemesterStatus
  createdAt:   string
}

export interface InstallmentRow {
  id:            string
  installmentNo: number
  description:   string | null
  dueDate:       string
  amount:        string
  paidAmount:    string
  status:        InstallmentStatus
  createdAt:     string
}

export interface PaymentRow {
  id:             string
  installmentId:  string | null
  amount:         string
  paymentDate:    string
  paymentMethod:  PaymentMethod
  transactionRef: string | null
  notes:          string | null
  createdByName:  string
  createdAt:      string
}

// ── Fee Structures ────────────────────────────────────────────────────────────

export async function listFeeStructuresApi(
  page = 1, programId?: string, search?: string, limit = 50,
): Promise<PagedResult<FeeStructureRow>> {
  const { data } = await apiClient.get('/api/fee-structures', { params: { page, limit, programId, search } })
  return data
}

export async function createFeeStructureApi(payload: {
  programId: string; description: string; feeType: FeeType; amount: number
}): Promise<FeeStructureRow> {
  const { data } = await apiClient.post('/api/fee-structures', payload)
  return data
}

export async function updateFeeStructureApi(id: string, payload: {
  description?: string; feeType?: FeeType; amount?: number; isActive?: boolean
}): Promise<FeeStructureRow> {
  const { data } = await apiClient.put(`/api/fee-structures/${id}`, payload)
  return data
}

export async function deleteFeeStructureApi(id: string): Promise<void> {
  await apiClient.delete(`/api/fee-structures/${id}`)
}

// ── Enrollments ───────────────────────────────────────────────────────────────

export async function getMyEnrollmentsApi(): Promise<PagedResult<EnrollmentRow>> {
  const { data } = await apiClient.get('/api/enrollments/me')
  return data
}

export async function listEnrollmentsApi(
  page = 1,
  opts: { programId?: string; status?: string; search?: string; limit?: number } = {},
): Promise<PagedResult<EnrollmentRow>> {
  const { data } = await apiClient.get('/api/enrollments', {
    params: { page, limit: opts.limit ?? 20, ...opts },
  })
  return data
}

export async function getEnrollmentApi(id: string): Promise<EnrollmentDetail> {
  const { data } = await apiClient.get(`/api/enrollments/${id}`)
  return data
}

export async function createEnrollmentApi(payload: {
  studentId: string; programOfferingId: string; batchId?: string
  feeStructureId?: string; enrollmentDate: string; totalFee: number; notes?: string
  installments?: { installmentNo: number; description?: string; dueDate: string; amount: number }[]
}): Promise<EnrollmentRow> {
  const { data } = await apiClient.post('/api/enrollments', payload)
  return data
}

export async function updateEnrollmentApi(id: string, payload: {
  batchId?: string | null; status?: EnrollmentStatus; notes?: string | null
}): Promise<EnrollmentRow> {
  const { data } = await apiClient.put(`/api/enrollments/${id}`, payload)
  return data
}

export async function deleteEnrollmentApi(id: string): Promise<void> {
  await apiClient.delete(`/api/enrollments/${id}`)
}

export async function getEnrollmentAuditLogsApi(id: string): Promise<{ data: AuditLogEntry[] }> {
  const { data } = await apiClient.get(`/api/enrollments/${id}/audit`)
  return data
}

// ── Semesters ─────────────────────────────────────────────────────────────────

export async function listSemestersApi(enrollmentId: string): Promise<{ data: SemesterRow[] }> {
  const { data } = await apiClient.get(`/api/enrollments/${enrollmentId}/semesters`)
  return data
}

export async function addSemesterApi(enrollmentId: string, payload: {
  semesterNo: number; sessionId?: string; startDate?: string; endDate?: string; status?: SemesterStatus
}): Promise<SemesterRow> {
  const { data } = await apiClient.post(`/api/enrollments/${enrollmentId}/semesters`, payload)
  return data
}

export async function updateSemesterApi(enrollmentId: string, semId: string, payload: {
  sessionId?: string | null; startDate?: string | null; endDate?: string | null; status?: SemesterStatus
}): Promise<SemesterRow> {
  const { data } = await apiClient.put(`/api/enrollments/${enrollmentId}/semesters/${semId}`, payload)
  return data
}

// ── Installments ──────────────────────────────────────────────────────────────

export async function listInstallmentsApi(enrollmentId: string): Promise<{ data: InstallmentRow[] }> {
  const { data } = await apiClient.get(`/api/enrollments/${enrollmentId}/installments`)
  return data
}

export async function updateInstallmentApi(enrollmentId: string, instId: string, payload: {
  status?: 'pending' | 'overdue' | 'waived'; dueDate?: string
}): Promise<InstallmentRow> {
  const { data } = await apiClient.put(`/api/enrollments/${enrollmentId}/installments/${instId}`, payload)
  return data
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function listPaymentsApi(enrollmentId: string): Promise<{ data: PaymentRow[] }> {
  const { data } = await apiClient.get(`/api/enrollments/${enrollmentId}/payments`)
  return data
}

export async function recordPaymentApi(enrollmentId: string, payload: {
  installmentId?: string; amount: number; paymentDate: string
  paymentMethod: PaymentMethod; transactionRef?: string; notes?: string
}): Promise<PaymentRow> {
  const { data } = await apiClient.post(`/api/enrollments/${enrollmentId}/payments`, payload)
  return data
}

// ── Program Offerings ─────────────────────────────────────────────────────────

export async function listProgramOfferingsApi(
  page = 1,
  opts: { programId?: string; sessionId?: string; status?: string; limit?: number } = {},
): Promise<PagedResult<ProgramOfferingRow>> {
  const { data } = await apiClient.get('/api/program-offerings', {
    params: { page, limit: opts.limit ?? 50, ...opts },
  })
  return data
}

export async function createProgramOfferingApi(payload: {
  programId: string; academicSessionId: string
  admissionStartDate?: string; admissionEndDate?: string
  capacity?: number; status?: OfferingStatus
}): Promise<ProgramOfferingRow> {
  const { data } = await apiClient.post('/api/program-offerings', payload)
  return data
}

export async function updateProgramOfferingApi(id: string, payload: {
  admissionStartDate?: string | null; admissionEndDate?: string | null
  capacity?: number | null; status?: OfferingStatus
}): Promise<ProgramOfferingRow> {
  const { data } = await apiClient.put(`/api/program-offerings/${id}`, payload)
  return data
}

export async function deleteProgramOfferingApi(id: string): Promise<void> {
  await apiClient.delete(`/api/program-offerings/${id}`)
}

// ── Batch Assignment ──────────────────────────────────────────────────────────

export interface SemesterOfferingEnrollmentRow {
  id:             string
  studentId:      string
  studentName:    string
  studentCode:    string
  studentPhoto:   string | null
  batchId:        string | null
  batchName:      string | null
  batchCode:      string | null
  status:         EnrollmentStatus
  enrollmentDate: string
}

export interface SemesterOfferingEnrollmentsResult {
  data:      SemesterOfferingEnrollmentRow[]
  programId: string
  sessionId: string
}

export async function getEnrollmentsBySemesterOfferingApi(
  semesterOfferingId: string,
): Promise<SemesterOfferingEnrollmentsResult> {
  const { data } = await apiClient.get(`/api/enrollments/by-semester-offering/${semesterOfferingId}`)
  return data
}

export async function bulkAssignBatchApi(payload: {
  enrollmentIds: string[]
  batchId: string | null
}): Promise<{ updated: number }> {
  const { data } = await apiClient.put('/api/enrollments/bulk-assign-batch', payload)
  return data
}

export async function bulkSaveOfferingsApi(payload: {
  academicSessionId: string
  programs: {
    programId:           string
    admissionStartDate?: string | null
    admissionEndDate?:   string | null
    capacity?:           number | null
    status:              OfferingStatus
  }[]
}): Promise<PagedResult<ProgramOfferingRow>> {
  const { data } = await apiClient.post('/api/program-offerings/bulk', payload)
  return data
}
