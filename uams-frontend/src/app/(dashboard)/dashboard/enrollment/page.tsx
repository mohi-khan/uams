'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import {
  ClipboardList, DollarSign, Search, Plus, Pencil, Trash2,
  X, ChevronRight, ChevronLeft, Loader2, CheckCircle, XCircle,
  CreditCard, Users, Receipt, BookOpen,
} from 'lucide-react'
import { listProgramsApi } from '@/lib/api/academic'
import { listSessionsApi } from '@/lib/api/sessions'
import { listBatchesApi } from '@/lib/api/batches'
import { listStudentsApi } from '@/lib/api/students'
import {
  listFeeStructuresApi, createFeeStructureApi, updateFeeStructureApi, deleteFeeStructureApi,
  listEnrollmentsApi, createEnrollmentApi, updateEnrollmentApi, deleteEnrollmentApi, getEnrollmentApi,
  listSemestersApi, addSemesterApi, updateSemesterApi,
  listInstallmentsApi, updateInstallmentApi,
  listPaymentsApi, recordPaymentApi,
  listProgramOfferingsApi,
} from '@/lib/api/enrollments'
import type {
  FeeStructureRow, EnrollmentRow, EnrollmentDetail,
  SemesterRow, InstallmentRow,
  FeeType, EnrollmentStatus, SemesterStatus, PaymentMethod,
} from '@/lib/api/enrollments'

// ── Constants ─────────────────────────────────────────────────────────────────

const FEE_TYPE_LABELS: Record<FeeType, string> = {
  admission: 'Admission', semester: 'Semester', lab: 'Lab',
  library: 'Library', other: 'Other',
}

const EN_STATUS_CLS: Record<EnrollmentStatus, string> = {
  active:    'bg-green-100 text-green-700',
  suspended: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  dropped:   'bg-red-100 text-red-700',
}

const SEM_STATUS_CLS: Record<SemesterStatus, string> = {
  ongoing:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  repeated:  'bg-amber-100 text-amber-700',
}

const INST_STATUS_CLS = {
  pending: 'bg-gray-100 text-gray-600',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  waived:  'bg-purple-100 text-purple-700',
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnrollmentPage() {
  const qc       = useQueryClient()
  const user     = useAtomValue(currentUserAtom)
  const canWrite = ['admin', 'super_admin', 'academic_coordinator'].includes(user?.role ?? '')

  const [activeTab, setActiveTab] = useState<'enrollments' | 'fee-structures'>('enrollments')

  // ── Shared reference data ─────────────────────────────────────────────────
  const { data: programsData } = useQuery({
    queryKey: ['programs-all'],
    queryFn:  () => listProgramsApi(1, undefined, undefined, 200),
  })
  const programs = programsData?.data ?? []

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions-all'],
    queryFn:  () => listSessionsApi(1, undefined, 200),
  })
  const sessions = sessionsData?.data ?? []

  // ── Enrollments state ─────────────────────────────────────────────────────
  const [enSearch,  setEnSearch]  = useState('')
  const [enProgram, setEnProgram] = useState('')
  const [enStatus,  setEnStatus]  = useState('')
  const [enPage,    setEnPage]    = useState(1)

  // wizard
  const [showWizard,      setShowWizard]      = useState(false)
  const [wizStep,         setWizStep]         = useState<1 | 2>(1)
  const [wizStudent,      setWizStudent]      = useState<{ id: string; label: string } | null>(null)
  const [wizSrch,         setWizSrch]         = useState('')
  const [showStudentDrop, setShowStudentDrop] = useState(false)
  const [wizOfferingId,   setWizOfferingId]   = useState('')
  const [wizBatch,        setWizBatch]        = useState('')
  const [wizDate,         setWizDate]         = useState('')
  const [wizNotes,        setWizNotes]        = useState('')
  const [wizFeeId,        setWizFeeId]        = useState('')
  const [wizTotal,        setWizTotal]        = useState('')
  const [wizInst, setWizInst] = useState<
    { installmentNo: number; description: string; dueDate: string; amount: string }[]
  >([])

  function resetWizard() {
    setWizStep(1)
    setWizStudent(null); setWizSrch(''); setShowStudentDrop(false)
    setWizOfferingId(''); setWizBatch('')
    setWizDate(''); setWizNotes('')
    setWizFeeId(''); setWizTotal(''); setWizInst([])
  }

  // detail
  const [detail,        setDetail]        = useState<EnrollmentDetail | null>(null)
  const [detailTab,     setDetailTab]     = useState<'overview' | 'semesters' | 'installments' | 'payments'>('overview')
  const [detailLoading, setDetailLoading] = useState(false)

  // edit / delete enrollment
  const [enEdit,     setEnEdit]     = useState<EnrollmentRow | null>(null)
  const [enEditSt,   setEnEditSt]   = useState<EnrollmentStatus>('active')
  const [enEditNote, setEnEditNote] = useState('')
  const [enDel,      setEnDel]      = useState<EnrollmentRow | null>(null)

  // semesters
  const [showAddSem, setShowAddSem] = useState(false)
  const [semForm,    setSemForm]    = useState({ semesterNo: 1, sessionId: '', startDate: '', endDate: '', status: 'ongoing' as SemesterStatus })
  const [editSem,    setEditSem]    = useState<SemesterRow | null>(null)
  const [editSemF,   setEditSemF]   = useState({ sessionId: '', startDate: '', endDate: '', status: 'ongoing' as SemesterStatus })

  // payments
  const [showPay,   setShowPay]   = useState(false)
  const [payInstId, setPayInstId] = useState('')
  const [payAmt,    setPayAmt]    = useState('')
  const [payDate,   setPayDate]   = useState(new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payRef,    setPayRef]    = useState('')
  const [payNote,   setPayNote]   = useState('')

  // installments
  const [editInst,   setEditInst]   = useState<InstallmentRow | null>(null)
  const [editInstSt, setEditInstSt] = useState<'pending' | 'overdue' | 'waived'>('pending')
  const [editInstDD, setEditInstDD] = useState('')

  // ── Fee structures state ──────────────────────────────────────────────────
  const [fsProgram,    setFsProgram]    = useState('')
  const [showCreateFs, setShowCreateFs] = useState(false)
  const [editFs,       setEditFs]       = useState<FeeStructureRow | null>(null)
  const [deleteFs,     setDeleteFs]     = useState<FeeStructureRow | null>(null)
  const [fsForm,       setFsForm]       = useState({ programId: '', description: '', feeType: 'semester' as FeeType, amount: '' })
  const [editFsForm,   setEditFsForm]   = useState({ description: '', feeType: 'semester' as FeeType, amount: '', isActive: true })

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: enData, isLoading: enLoading } = useQuery({
    queryKey: ['enrollments', enPage, enProgram, enStatus, enSearch],
    queryFn:  () => listEnrollmentsApi(enPage, {
      programId: enProgram || undefined,
      status:    enStatus  || undefined,
      search:    enSearch  || undefined,
      limit:     20,
    }),
  })
  const enrollments  = enData?.data ?? []
  const enTotal      = enData?.total ?? 0
  const enTotalPages = Math.ceil(enTotal / 20)

  // All open offerings for wizard dropdown
  const { data: wizOfferingsData } = useQuery({
    queryKey: ['program-offerings-open'],
    queryFn:  () => listProgramOfferingsApi(1, { limit: 200 }),
  })
  const wizOfferings = wizOfferingsData?.data ?? []

  // Derive programId from selected offering (for batch/fee-structure sub-queries)
  const wizOfferingProgramId = wizOfferings.find(o => o.id === wizOfferingId)?.programId ?? ''

  const { data: wizBatchData } = useQuery({
    queryKey: ['batches-by-program', wizOfferingProgramId],
    queryFn:  () => listBatchesApi(1, wizOfferingProgramId || undefined, undefined, 200),
    enabled:  !!wizOfferingProgramId,
  })
  const wizBatches = wizBatchData?.data ?? []

  const { data: wizFsData } = useQuery({
    queryKey: ['fee-structures-for-program', wizOfferingProgramId],
    queryFn:  () => listFeeStructuresApi(1, wizOfferingProgramId || undefined, undefined, 200),
    enabled:  !!wizOfferingProgramId,
  })
  const wizFeeStructures = wizFsData?.data?.filter(f => f.isActive) ?? []

  const { data: wizStudentsData } = useQuery({
    queryKey: ['students-all'],
    queryFn:  () => listStudentsApi(1, undefined, 500),
  })
  const allStudents = wizStudentsData?.data ?? []
  const wizStudentResults = wizSrch.trim()
    ? allStudents.filter(s =>
        s.name.toLowerCase().includes(wizSrch.toLowerCase()) ||
        s.studentCode.toLowerCase().includes(wizSrch.toLowerCase()) ||
        s.email.toLowerCase().includes(wizSrch.toLowerCase()),
      )
    : allStudents

  // Detail sub-resources (lazy per tab)
  const { data: dtSemesters }    = useQuery({ queryKey: ['semesters',    detail?.id], queryFn: () => listSemestersApi(detail!.id),    enabled: !!detail && detailTab === 'semesters' })
  const { data: dtInstallments } = useQuery({ queryKey: ['installments', detail?.id], queryFn: () => listInstallmentsApi(detail!.id), enabled: !!detail && detailTab === 'installments' })
  const { data: dtPayments }     = useQuery({ queryKey: ['payments',     detail?.id], queryFn: () => listPaymentsApi(detail!.id),     enabled: !!detail && detailTab === 'payments' })

  // Fee structures tab
  const { data: fsData, isLoading: fsLoading } = useQuery({
    queryKey: ['fee-structures', fsProgram],
    queryFn:  () => listFeeStructuresApi(1, fsProgram || undefined, undefined, 200),
  })
  const feeStructures = fsData?.data ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createEnMut = useMutation({
    mutationFn: () => createEnrollmentApi({
      studentId:         wizStudent!.id,
      programOfferingId: wizOfferingId,
      batchId:           wizBatch  || undefined,
      feeStructureId:    wizFeeId  || undefined,
      enrollmentDate:    wizDate,
      totalFee:          Number(wizTotal),
      notes:             wizNotes  || undefined,
      installments:      wizInst.map(i => ({
        installmentNo: i.installmentNo,
        description:   i.description || undefined,
        dueDate:       i.dueDate,
        amount:        Number(i.amount),
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      qc.invalidateQueries({ queryKey: ['program-offerings'] })
      qc.invalidateQueries({ queryKey: ['program-offerings-open'] })
      setShowWizard(false); resetWizard()
    },
  })

  const updateEnMut = useMutation({
    mutationFn: () => updateEnrollmentApi(enEdit!.id, { status: enEditSt, notes: enEditNote || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); setEnEdit(null) },
  })

  const deleteEnMut = useMutation({
    mutationFn: (id: string) => deleteEnrollmentApi(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enrollments'] }); setEnDel(null) },
  })

  const addSemMut = useMutation({
    mutationFn: () => addSemesterApi(detail!.id, {
      semesterNo: semForm.semesterNo,
      sessionId:  semForm.sessionId  || undefined,
      startDate:  semForm.startDate  || undefined,
      endDate:    semForm.endDate    || undefined,
      status:     semForm.status,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['semesters', detail?.id] })
      setShowAddSem(false)
      setSemForm({ semesterNo: 1, sessionId: '', startDate: '', endDate: '', status: 'ongoing' })
    },
  })

  const updateSemMut = useMutation({
    mutationFn: (semId: string) => updateSemesterApi(detail!.id, semId, {
      sessionId: editSemF.sessionId || null,
      startDate: editSemF.startDate || null,
      endDate:   editSemF.endDate   || null,
      status:    editSemF.status,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['semesters', detail?.id] }); setEditSem(null) },
  })

  const updateInstMut = useMutation({
    mutationFn: (instId: string) => updateInstallmentApi(detail!.id, instId, { status: editInstSt, dueDate: editInstDD || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['installments', detail?.id] }); setEditInst(null) },
  })

  const recordPayMut = useMutation({
    mutationFn: () => recordPaymentApi(detail!.id, {
      installmentId: payInstId || undefined, amount: Number(payAmt),
      paymentDate: payDate, paymentMethod: payMethod,
      transactionRef: payRef || undefined, notes: payNote || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments', detail?.id] })
      qc.invalidateQueries({ queryKey: ['payments',     detail?.id] })
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      getEnrollmentApi(detail!.id).then(setDetail)
      setShowPay(false); setPayAmt(''); setPayRef(''); setPayNote('')
    },
  })

  // Fee structure mutations
  const createFsMut = useMutation({
    mutationFn: () => createFeeStructureApi({ programId: fsForm.programId, description: fsForm.description, feeType: fsForm.feeType, amount: Number(fsForm.amount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structures'] })
      setShowCreateFs(false)
      setFsForm({ programId: '', description: '', feeType: 'semester', amount: '' })
    },
  })

  const updateFsMut = useMutation({
    mutationFn: () => updateFeeStructureApi(editFs!.id, { description: editFsForm.description, feeType: editFsForm.feeType, amount: Number(editFsForm.amount), isActive: editFsForm.isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); setEditFs(null) },
  })

  const deleteFsMut = useMutation({
    mutationFn: (id: string) => deleteFeeStructureApi(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fee-structures'] }); setDeleteFs(null) },
  })

  // ── Helpers ───────────────────────────────────────────────────────────────

  function openDetail(row: EnrollmentRow) {
    setDetailLoading(true); setDetailTab('overview')
    setShowAddSem(false); setEditSem(null); setShowPay(false); setEditInst(null)
    getEnrollmentApi(row.id).then(d => { setDetail(d); setDetailLoading(false) }).catch(() => setDetailLoading(false))
  }

  function openEditEn(row: EnrollmentRow) {
    setEnEdit(row); setEnEditSt(row.status); setEnEditNote(row.notes ?? '')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <TabBtn active={activeTab === 'enrollments'}    onClick={() => setActiveTab('enrollments')}    icon={<ClipboardList size={15} />} label="Enrollments" />
        <TabBtn active={activeTab === 'fee-structures'} onClick={() => setActiveTab('fee-structures')} icon={<DollarSign size={15} />}    label="Fee Structures" />
      </div>

      {/* ═══════════ Enrollments ══════════════════════════════════════════════ */}
      {activeTab === 'enrollments' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={enSearch} onChange={e => { setEnSearch(e.target.value); setEnPage(1) }}
                placeholder="Search student name or code…"
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
            </div>
            <select value={enProgram} onChange={e => { setEnProgram(e.target.value); setEnPage(1) }} className="input w-48">
              <option value="">All Programs</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
            <select value={enStatus} onChange={e => { setEnStatus(e.target.value); setEnPage(1) }} className="input w-36">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
            <div className="ml-auto flex items-center gap-3">
              {enTotal > 0 && <span className="text-xs text-gray-400">{enTotal} enrollment{enTotal !== 1 ? 's' : ''}</span>}
              {canWrite && (
                <button onClick={() => { resetWizard(); setShowWizard(true) }} className="flex items-center gap-2 btn-primary">
                  <Plus size={15} /> Enroll Student
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Student', 'Program', 'Batch / Session', 'Enrolled', 'Fee Summary', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {enLoading && <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin inline-block mr-2" />Loading…</td></tr>}
                {!enLoading && enrollments.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No enrollments found.</td></tr>}
                {enrollments.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {e.studentPhoto
                          ? <img src={e.studentPhoto} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200" />
                          : <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><Users size={13} className="text-indigo-500" /></div>}
                        <div>
                          <p className="font-medium text-gray-900">{e.studentName}</p>
                          <p className="text-xs text-gray-400 font-mono">{e.studentCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 text-xs">{e.programName}</p>
                      <p className="text-xs text-gray-400">{e.programCode}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <p>{e.batchName ?? '—'}</p>
                      <p className="text-gray-400">{e.sessionName ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.enrollmentDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs space-y-0.5">
                      <p className="text-gray-700">Total: <span className="font-semibold">৳{fmt(e.totalFee)}</span></p>
                      <p className="text-green-600">Paid: ৳{fmt(e.paidAmount)}</p>
                      <p className="text-red-500">Due: ৳{fmt(Number(e.totalFee) - Number(e.paidAmount))}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${EN_STATUS_CLS[e.status]}`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openDetail(e)} title="View Details" className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors"><BookOpen size={14} /></button>
                        {canWrite && <>
                          <button onClick={() => openEditEn(e)} title="Edit" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setEnDel(e)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {enTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Page {enPage} of {enTotalPages}</span>
              <div className="flex gap-2">
                <button disabled={enPage === 1} onClick={() => setEnPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
                <button disabled={enPage >= enTotalPages} onClick={() => setEnPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Fee Structures ═══════════════════════════════════════════ */}
      {activeTab === 'fee-structures' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={fsProgram} onChange={e => setFsProgram(e.target.value)} className="input w-52">
              <option value="">All Programs</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
            {canWrite && (
              <button onClick={() => setShowCreateFs(true)} className="ml-auto flex items-center gap-2 btn-primary">
                <Plus size={15} /> Add Fee Structure
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Program', 'Description', 'Type', 'Amount', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fsLoading && <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>}
                {!fsLoading && feeStructures.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No fee structures found.</td></tr>}
                {feeStructures.map(fs => (
                  <tr key={fs.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{fs.programName}</p>
                      <p className="text-xs text-gray-400">{fs.programCode}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fs.description}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{FEE_TYPE_LABELS[fs.feeType]}</span></td>
                    <td className="px-4 py-3 font-semibold text-gray-800">৳{fmt(fs.amount)}</td>
                    <td className="px-4 py-3">
                      {fs.isActive
                        ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Active</span>
                        : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Inactive</span>}
                    </td>
                    <td className="px-4 py-3">
                      {canWrite && (
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => { setEditFs(fs); setEditFsForm({ description: fs.description, feeType: fs.feeType, amount: fs.amount, isActive: fs.isActive }) }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteFs(fs)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════ Modals ══════════════════════════════════════════ */}

      {/* ── Enroll Wizard ─────────────────────────────────────────────────────── */}
      {showWizard && (
        <Modal title={`Enroll Student — Step ${wizStep} of 2`} onClose={() => { setShowWizard(false); resetWizard() }} wide>
          {wizStep === 1 ? (
            <div className="space-y-4">
              {/* Student picker */}
              <Field label="Student *">
                {wizStudent ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-indigo-300 rounded-lg bg-indigo-50">
                    <span className="text-sm font-medium text-indigo-800">{wizStudent.label}</span>
                    <button onClick={() => { setWizStudent(null); setWizSrch(''); setShowStudentDrop(false) }} className="text-indigo-400 hover:text-indigo-600"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={wizSrch} onChange={e => setWizSrch(e.target.value)}
                      onFocus={() => setShowStudentDrop(true)}
                      onBlur={() => setTimeout(() => setShowStudentDrop(false), 150)}
                      className="input pl-9" placeholder="Search by name, code or email…" />
                    {showStudentDrop && (
                      <div className="absolute top-full left-0 right-0 z-30 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
                        {wizStudentResults.length === 0 && <p className="text-sm text-gray-400 text-center py-3">No students found.</p>}
                        {wizStudentResults.map(s => (
                          <button key={s.id} type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setWizStudent({ id: s.id, label: `${s.name} (${s.studentCode})` }); setWizSrch(''); setShowStudentDrop(false) }}
                            className="flex items-center gap-3 w-full px-3 py-2 hover:bg-indigo-50 text-left">
                            {s.photoUrl
                              ? <img src={s.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                              : <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><Users size={12} className="text-indigo-400" /></div>}
                            <div>
                              <p className="text-sm font-medium text-gray-800">{s.name}</p>
                              <p className="text-xs text-gray-400 font-mono">{s.studentCode} · {s.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Field>

              {/* Program Offering picker */}
              <Field label="Program Offering *">
                <select value={wizOfferingId} onChange={e => { setWizOfferingId(e.target.value); setWizBatch(''); setWizFeeId('') }} className="input">
                  <option value="">Select program offering…</option>
                  {wizOfferings.map(o => (
                    <option key={o.id} value={o.id} disabled={o.status === 'closed'}>
                      {o.programName} ({o.programCode}) — {o.sessionName}{o.status === 'closed' ? ' [Closed]' : ''}
                      {o.capacity ? ` · ${o.enrolledCount}/${o.capacity} enrolled` : ''}
                    </option>
                  ))}
                </select>
                {wizOfferingId && wizOfferings.find(o => o.id === wizOfferingId)?.status === 'closed' && (
                  <p className="text-xs text-red-500 mt-1">This offering is closed. Enrollment will be rejected.</p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Batch">
                  <select value={wizBatch} onChange={e => setWizBatch(e.target.value)} className="input" disabled={!wizOfferingProgramId}>
                    <option value="">— none —</option>
                    {wizBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
                <Field label="Enrollment Date *">
                  <input type="date" value={wizDate} onChange={e => setWizDate(e.target.value)} className="input" />
                </Field>
              </div>

              <Field label="Notes">
                <textarea value={wizNotes} onChange={e => setWizNotes(e.target.value)} className="input resize-none" rows={2} placeholder="Optional notes…" />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowWizard(false); resetWizard() }} className="btn-ghost">Cancel</button>
                <button disabled={!wizStudent || !wizOfferingId || !wizDate} onClick={() => setWizStep(2)}
                  className="btn-primary flex items-center gap-1.5">Next <ChevronRight size={15} /></button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Fee Structure (optional)">
                <select value={wizFeeId}
                  onChange={e => { setWizFeeId(e.target.value); const fs = wizFeeStructures.find(f => f.id === e.target.value); if (fs) setWizTotal(fs.amount) }}
                  className="input">
                  <option value="">— select or enter total manually —</option>
                  {wizFeeStructures.map(f => <option key={f.id} value={f.id}>{f.description} — ৳{fmt(f.amount)}</option>)}
                </select>
              </Field>

              <Field label="Total Fee (৳) *">
                <input type="number" min="0" step="0.01" value={wizTotal} onChange={e => setWizTotal(e.target.value)} className="input" placeholder="0.00" />
              </Field>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Installments</label>
                  <button type="button"
                    onClick={() => setWizInst(prev => [...prev, { installmentNo: prev.length + 1, description: '', dueDate: '', amount: '' }])}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                    <Plus size={13} /> Add Row
                  </button>
                </div>
                {wizInst.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 w-8">#</th>
                          <th className="text-left px-3 py-2 text-gray-500">Description</th>
                          <th className="text-left px-3 py-2 text-gray-500 w-32">Due Date</th>
                          <th className="text-left px-3 py-2 text-gray-500 w-28">Amount (৳)</th>
                          <th className="w-7" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {wizInst.map((inst, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-gray-400">{inst.installmentNo}</td>
                            <td className="px-3 py-2">
                              <input value={inst.description} onChange={e => setWizInst(prev => prev.map((r, i) => i === idx ? { ...r, description: e.target.value } : r))}
                                className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400" placeholder="e.g. 1st Semester" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="date" value={inst.dueDate} onChange={e => setWizInst(prev => prev.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r))}
                                className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.01" value={inst.amount} onChange={e => setWizInst(prev => prev.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))}
                                className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400" placeholder="0.00" />
                            </td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => setWizInst(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, installmentNo: i + 1 })))}
                                className="text-red-400 hover:text-red-600"><X size={13} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {wizTotal && (
                      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs">
                        <span className="text-gray-500">Installment sum:</span>
                        {(() => {
                          const sum = wizInst.reduce((a, i) => a + Number(i.amount || 0), 0)
                          const diff = Number(wizTotal) - sum
                          return <span className={diff === 0 ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                            ৳{fmt(sum)} {diff !== 0 && `(৳${fmt(Math.abs(diff))} ${diff > 0 ? 'remaining' : 'over'})`}
                          </span>
                        })()}
                      </div>
                    )}
                  </div>
                )}
                {wizInst.length === 0 && <p className="text-xs text-gray-400 italic">No installments — enrolled without a payment plan.</p>}
              </div>

              {createEnMut.error && <p className="text-red-600 text-sm">{(createEnMut.error as any)?.response?.data?.error ?? 'Error creating enrollment.'}</p>}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setWizStep(1)} className="btn-ghost flex items-center gap-1.5"><ChevronLeft size={15} /> Back</button>
                <button disabled={!wizTotal || createEnMut.isPending} onClick={() => createEnMut.mutate()} className="btn-primary">
                  {createEnMut.isPending ? 'Enrolling…' : 'Confirm Enrollment'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Enrollment Detail ─────────────────────────────────────────────────── */}
      {(detail || detailLoading) && (
        <Modal
          title={detail ? `${detail.studentName} — ${detail.programName}` : 'Loading…'}
          onClose={() => { setDetail(null); setDetailLoading(false); setShowAddSem(false); setEditSem(null); setShowPay(false); setEditInst(null) }}
          wide
        >
          {detailLoading && <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>}
          {detail && (
            <>
              <div className="flex gap-0 border-b border-gray-100 mb-5 -mx-6 px-6">
                {(['overview', 'semesters', 'installments', 'payments'] as const).map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${detailTab === tab ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab}
                  </button>
                ))}
              </div>

              {detailTab === 'overview' && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoRow label="Student Code" value={<span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{detail.studentCode}</span>} />
                  <InfoRow label="Email"         value={detail.studentEmail} />
                  <InfoRow label="Phone"         value={detail.studentPhone ?? '—'} />
                  <InfoRow label="Program"       value={`${detail.programName} (${detail.programCode})`} />
                  <InfoRow label="Batch"         value={detail.batchName ?? '—'} />
                  <InfoRow label="Session"       value={detail.sessionName ?? '—'} />
                  <InfoRow label="Enrolled"      value={new Date(detail.enrollmentDate).toLocaleDateString()} />
                  <InfoRow label="Status"        value={<span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${EN_STATUS_CLS[detail.status]}`}>{detail.status}</span>} />
                  <InfoRow label="Total Fee"     value={`৳${fmt(detail.totalFee)}`} />
                  <InfoRow label="Paid"          value={<span className="text-green-600 font-semibold">৳{fmt(detail.paidAmount)}</span>} />
                  <InfoRow label="Balance Due"   value={<span className="text-red-500 font-semibold">৳{fmt(Number(detail.totalFee) - Number(detail.paidAmount))}</span>} />
                  {detail.notes && <InfoRow label="Notes" value={detail.notes} className="col-span-2" />}
                </div>
              )}

              {detailTab === 'semesters' && (
                <div className="space-y-3">
                  {canWrite && !showAddSem && !editSem && (
                    <button onClick={() => { const nextNo = (dtSemesters?.data.length ?? 0) + 1; setSemForm({ semesterNo: nextNo, sessionId: '', startDate: '', endDate: '', status: 'ongoing' }); setShowAddSem(true) }}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      <Plus size={14} /> Add Semester
                    </button>
                  )}
                  {showAddSem && (
                    <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
                      <p className="text-sm font-semibold text-indigo-700">New Semester</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Semester #"><input type="number" min="1" value={semForm.semesterNo} onChange={e => setSemForm(f => ({ ...f, semesterNo: Number(e.target.value) }))} className="input" /></Field>
                        <Field label="Session">
                          <select value={semForm.sessionId} onChange={e => setSemForm(f => ({ ...f, sessionId: e.target.value }))} className="input">
                            <option value="">— none —</option>
                            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </Field>
                        <Field label="Start Date"><input type="date" value={semForm.startDate} onChange={e => setSemForm(f => ({ ...f, startDate: e.target.value }))} className="input" /></Field>
                        <Field label="End Date"><input type="date" value={semForm.endDate} onChange={e => setSemForm(f => ({ ...f, endDate: e.target.value }))} className="input" /></Field>
                      </div>
                      <Field label="Status">
                        <select value={semForm.status} onChange={e => setSemForm(f => ({ ...f, status: e.target.value as SemesterStatus }))} className="input">
                          <option value="ongoing">Ongoing</option><option value="completed">Completed</option>
                          <option value="failed">Failed</option><option value="repeated">Repeated</option>
                        </select>
                      </Field>
                      {addSemMut.error && <p className="text-red-600 text-xs">{(addSemMut.error as any)?.response?.data?.error ?? 'Error.'}</p>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddSem(false)} className="btn-ghost text-xs py-1.5">Cancel</button>
                        <button onClick={() => addSemMut.mutate()} disabled={addSemMut.isPending} className="btn-primary text-xs py-1.5">{addSemMut.isPending ? 'Saving…' : 'Add'}</button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {!dtSemesters && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
                    {dtSemesters?.data.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No semesters yet.</p>}
                    {dtSemesters?.data.map(sem => (
                      <div key={sem.id} className="border border-gray-100 rounded-xl p-3">
                        {editSem?.id === sem.id ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-600">Edit Semester {sem.semesterNo}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Session">
                                <select value={editSemF.sessionId} onChange={e => setEditSemF(f => ({ ...f, sessionId: e.target.value }))} className="input">
                                  <option value="">— none —</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </Field>
                              <Field label="Status">
                                <select value={editSemF.status} onChange={e => setEditSemF(f => ({ ...f, status: e.target.value as SemesterStatus }))} className="input">
                                  <option value="ongoing">Ongoing</option><option value="completed">Completed</option>
                                  <option value="failed">Failed</option><option value="repeated">Repeated</option>
                                </select>
                              </Field>
                              <Field label="Start Date"><input type="date" value={editSemF.startDate} onChange={e => setEditSemF(f => ({ ...f, startDate: e.target.value }))} className="input" /></Field>
                              <Field label="End Date"><input type="date" value={editSemF.endDate} onChange={e => setEditSemF(f => ({ ...f, endDate: e.target.value }))} className="input" /></Field>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditSem(null)} className="btn-ghost text-xs py-1.5">Cancel</button>
                              <button onClick={() => updateSemMut.mutate(sem.id)} disabled={updateSemMut.isPending} className="btn-primary text-xs py-1.5">{updateSemMut.isPending ? 'Saving…' : 'Save'}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-800">Semester {sem.semesterNo}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${SEM_STATUS_CLS[sem.status]}`}>{sem.status}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {sem.sessionName ?? 'No session'} · {sem.startDate ? new Date(sem.startDate).toLocaleDateString() : '—'} → {sem.endDate ? new Date(sem.endDate).toLocaleDateString() : '—'}
                              </p>
                            </div>
                            {canWrite && (
                              <button onClick={() => { setEditSem(sem); setEditSemF({ sessionId: sem.sessionId ?? '', startDate: sem.startDate ?? '', endDate: sem.endDate ?? '', status: sem.status }) }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><Pencil size={13} /></button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === 'installments' && (
                <div className="space-y-3">
                  {canWrite && !showPay && (
                    <button onClick={() => { setShowPay(true); setPayInstId(''); setPayAmt(''); setPayDate(new Date().toISOString().slice(0, 10)); setPayMethod('cash'); setPayRef(''); setPayNote(''); recordPayMut.reset() }}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      <CreditCard size={14} /> Record Payment
                    </button>
                  )}
                  {showPay && (
                    <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
                      <p className="text-sm font-semibold text-indigo-700">Record Payment</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Apply to Installment">
                          <select value={payInstId} onChange={e => setPayInstId(e.target.value)} className="input">
                            <option value="">General payment</option>
                            {dtInstallments?.data.filter(i => i.status !== 'paid' && i.status !== 'waived').map(i => (
                              <option key={i.id} value={i.id}>#{i.installmentNo} — ৳{fmt(i.amount)} (due {new Date(i.dueDate).toLocaleDateString()})</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Amount (৳) *"><input type="number" min="0.01" step="0.01" value={payAmt} onChange={e => setPayAmt(e.target.value)} className="input" placeholder="0.00" /></Field>
                        <Field label="Payment Date *"><input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="input" /></Field>
                        <Field label="Method *">
                          <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)} className="input">
                            <option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option>
                            <option value="card">Card</option><option value="online">Online</option>
                          </select>
                        </Field>
                        <Field label="Transaction Ref"><input value={payRef} onChange={e => setPayRef(e.target.value)} className="input" placeholder="Optional" /></Field>
                        <Field label="Notes"><input value={payNote} onChange={e => setPayNote(e.target.value)} className="input" placeholder="Optional" /></Field>
                      </div>
                      {recordPayMut.error && <p className="text-red-600 text-xs">{(recordPayMut.error as any)?.response?.data?.error ?? 'Error.'}</p>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowPay(false)} className="btn-ghost text-xs py-1.5">Cancel</button>
                        <button onClick={() => recordPayMut.mutate()} disabled={!payAmt || recordPayMut.isPending} className="btn-primary text-xs py-1.5">{recordPayMut.isPending ? 'Recording…' : 'Record'}</button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {!dtInstallments && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
                    {dtInstallments?.data.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No installments configured.</p>}
                    {dtInstallments?.data.map(inst => (
                      <div key={inst.id} className="border border-gray-100 rounded-xl p-3">
                        {editInst?.id === inst.id ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-600">Edit #{inst.installmentNo}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Status">
                                <select value={editInstSt} onChange={e => setEditInstSt(e.target.value as any)} className="input">
                                  <option value="pending">Pending</option><option value="overdue">Overdue</option><option value="waived">Waived</option>
                                </select>
                              </Field>
                              <Field label="Due Date"><input type="date" value={editInstDD} onChange={e => setEditInstDD(e.target.value)} className="input" /></Field>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditInst(null)} className="btn-ghost text-xs py-1.5">Cancel</button>
                              <button onClick={() => updateInstMut.mutate(inst.id)} disabled={updateInstMut.isPending} className="btn-primary text-xs py-1.5">{updateInstMut.isPending ? 'Saving…' : 'Save'}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-gray-800">#{inst.installmentNo}</span>
                                {inst.description && <span className="text-xs text-gray-500">{inst.description}</span>}
                                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${INST_STATUS_CLS[inst.status]}`}>{inst.status}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Due: {new Date(inst.dueDate).toLocaleDateString()} · Amount: ৳{fmt(inst.amount)} · Paid: <span className="text-green-600">৳{fmt(inst.paidAmount)}</span> · Balance: <span className="text-red-500">৳{fmt(Number(inst.amount) - Number(inst.paidAmount))}</span>
                              </p>
                            </div>
                            {canWrite && inst.status !== 'paid' && inst.status !== 'waived' && (
                              <button onClick={() => { setEditInst(inst); setEditInstSt(inst.status as 'pending' | 'overdue'); setEditInstDD(inst.dueDate.slice(0, 10)) }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 shrink-0"><Pencil size={13} /></button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === 'payments' && (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {!dtPayments && <p className="text-sm text-gray-400 text-center py-4">Loading…</p>}
                  {dtPayments?.data.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No payments recorded.</p>}
                  {dtPayments?.data.map(pmt => (
                    <div key={pmt.id} className="border border-gray-100 rounded-xl p-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-800">৳{fmt(pmt.amount)}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{pmt.paymentMethod.replace('_', ' ')}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(pmt.paymentDate).toLocaleDateString()} · by {pmt.createdByName}
                          {pmt.transactionRef && ` · Ref: ${pmt.transactionRef}`}
                        </p>
                        {pmt.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{pmt.notes}</p>}
                      </div>
                      <Receipt size={16} className="text-gray-300 shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {/* ── Edit Enrollment ───────────────────────────────────────────────────── */}
      {enEdit && (
        <Modal title={`Update — ${enEdit.studentName}`} onClose={() => setEnEdit(null)}>
          <div className="space-y-4">
            <Field label="Status">
              <select value={enEditSt} onChange={e => setEnEditSt(e.target.value as EnrollmentStatus)} className="input">
                <option value="active">Active</option><option value="suspended">Suspended</option>
                <option value="completed">Completed</option><option value="dropped">Dropped</option>
              </select>
            </Field>
            <Field label="Notes"><textarea value={enEditNote} onChange={e => setEnEditNote(e.target.value)} className="input resize-none" rows={3} placeholder="Optional notes…" /></Field>
            {updateEnMut.error && <p className="text-red-600 text-sm">{(updateEnMut.error as any)?.response?.data?.error ?? 'Error.'}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEnEdit(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => updateEnMut.mutate()} disabled={updateEnMut.isPending} className="btn-primary">{updateEnMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Enrollment ─────────────────────────────────────────────────── */}
      {enDel && (
        <Modal title="Remove Enrollment" onClose={() => setEnDel(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Remove enrollment of <strong>{enDel.studentName}</strong> from <strong>{enDel.programName}</strong>? All semesters, installments and payments will be removed. This cannot be undone.</p>
            {deleteEnMut.error && <p className="text-red-600 text-sm">{(deleteEnMut.error as any)?.response?.data?.error ?? 'Error.'}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEnDel(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => deleteEnMut.mutate(enDel.id)} disabled={deleteEnMut.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {deleteEnMut.isPending ? 'Removing…' : 'Remove Enrollment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Create Fee Structure ──────────────────────────────────────────────── */}
      {showCreateFs && (
        <Modal title="Add Fee Structure" onClose={() => { setShowCreateFs(false); setFsForm({ programId: '', description: '', feeType: 'semester', amount: '' }) }}>
          <form onSubmit={e => { e.preventDefault(); createFsMut.mutate() }} className="space-y-4">
            <Field label="Program *">
              <select required value={fsForm.programId} onChange={e => setFsForm(f => ({ ...f, programId: e.target.value }))} className="input">
                <option value="">Select program…</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </Field>
            <Field label="Description *"><input required value={fsForm.description} onChange={e => setFsForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="e.g. Spring 2025 Semester Fee" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fee Type">
                <select value={fsForm.feeType} onChange={e => setFsForm(f => ({ ...f, feeType: e.target.value as FeeType }))} className="input">
                  {(Object.keys(FEE_TYPE_LABELS) as FeeType[]).map(t => <option key={t} value={t}>{FEE_TYPE_LABELS[t]}</option>)}
                </select>
              </Field>
              <Field label="Amount (৳) *"><input required type="number" min="0" step="0.01" value={fsForm.amount} onChange={e => setFsForm(f => ({ ...f, amount: e.target.value }))} className="input" placeholder="0.00" /></Field>
            </div>
            {createFsMut.error && <p className="text-red-600 text-sm">{(createFsMut.error as any)?.response?.data?.error ?? 'Error.'}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreateFs(false)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={createFsMut.isPending} className="btn-primary">{createFsMut.isPending ? 'Saving…' : 'Add Fee Structure'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Fee Structure ────────────────────────────────────────────────── */}
      {editFs && (
        <Modal title={`Edit — ${editFs.description}`} onClose={() => setEditFs(null)}>
          <form onSubmit={e => { e.preventDefault(); updateFsMut.mutate() }} className="space-y-4">
            <Field label="Description *"><input required value={editFsForm.description} onChange={e => setEditFsForm(f => ({ ...f, description: e.target.value }))} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fee Type">
                <select value={editFsForm.feeType} onChange={e => setEditFsForm(f => ({ ...f, feeType: e.target.value as FeeType }))} className="input">
                  {(Object.keys(FEE_TYPE_LABELS) as FeeType[]).map(t => <option key={t} value={t}>{FEE_TYPE_LABELS[t]}</option>)}
                </select>
              </Field>
              <Field label="Amount (৳)"><input type="number" min="0" step="0.01" value={editFsForm.amount} onChange={e => setEditFsForm(f => ({ ...f, amount: e.target.value }))} className="input" /></Field>
            </div>
            <Field label="Status">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => setEditFsForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${editFsForm.isActive ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${editFsForm.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-gray-600">{editFsForm.isActive ? 'Active' : 'Inactive'}</span>
              </label>
            </Field>
            {updateFsMut.error && <p className="text-red-600 text-sm">{(updateFsMut.error as any)?.response?.data?.error ?? 'Error.'}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditFs(null)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={updateFsMut.isPending} className="btn-primary">{updateFsMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Fee Structure ──────────────────────────────────────────────── */}
      {deleteFs && (
        <Modal title="Delete Fee Structure" onClose={() => setDeleteFs(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Delete <strong>{deleteFs.description}</strong> (৳{fmt(deleteFs.amount)}) for <strong>{deleteFs.programName}</strong>? This cannot be undone.</p>
            {deleteFsMut.error && <p className="text-red-600 text-sm">{(deleteFsMut.error as any)?.response?.data?.error ?? 'Error.'}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteFs(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => deleteFsMut.mutate(deleteFs.id)} disabled={deleteFsMut.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {deleteFsMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
      {icon}{label}
    </button>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  )
}
