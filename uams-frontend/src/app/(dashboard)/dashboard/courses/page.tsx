'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { BookOpen, Search, MoreVertical, Pencil, Trash2, History, X, Plus, GitMerge, ScrollText, Target, ClipboardList } from 'lucide-react'
import {
  listFacultiesApi, listDepartmentsApi,
  listCoursesApi, createCourseApi, updateCourseApi, deleteCourseApi, getCourseAuditLogsApi,
  listPrerequisitesApi, addPrerequisiteApi, removePrerequisiteApi,
  type CourseRow, type AuditLogEntry, type CourseType, type CourseStatus, type CreateCoursePayload,
  type CoursePrerequisiteRow,
} from '@/lib/api/academic'

const TYPE_BADGE: Record<CourseType, string> = {
  CORE:     'bg-indigo-100 text-indigo-700',
  ELECTIVE: 'bg-purple-100 text-purple-700',
}

const STATUS_BADGE: Record<CourseStatus, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  archived: 'bg-orange-100 text-orange-700',
}

const EMPTY_FORM: CreateCoursePayload = {
  departmentId: '',
  code:         '',
  title:        '',
  credits:      3,
  type:         'CORE',
  status:       'active',
  originalFee:  0,
  retakeFee:    0,
}

export default function CoursesPage() {
  const qc        = useQueryClient()
  const router    = useRouter()
  const user      = useAtomValue(currentUserAtom)
  const canWrite  = user?.role === 'admin' || user?.role === 'super_admin'
  const canSyllab = canWrite || user?.role === 'academic_coordinator'

  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [filterFac,    setFilterFac]    = useState('')
  const [filterDept,   setFilterDept]   = useState('')
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<CourseRow | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<CourseRow | null>(null)
  const [auditTarget,   setAuditTarget]   = useState<CourseRow | null>(null)
  const [prereqTarget,  setPrereqTarget]  = useState<CourseRow | null>(null)
  const [form,         setForm]         = useState<CreateCoursePayload>(EMPTY_FORM)

  // Faculties for filter + form dropdown
  const { data: faculties } = useQuery({
    queryKey: ['faculties-all'],
    queryFn:  () => listFacultiesApi(1, undefined, 200),
    staleTime: 60_000,
  })

  // Departments — filtered by selected faculty (filter bar)
  const { data: deptOptions } = useQuery({
    queryKey: ['departments-all', filterFac],
    queryFn:  () => listDepartmentsApi(1, filterFac || undefined, undefined, 200),
    staleTime: 60_000,
  })

  // Departments for form — filtered by form's faculty selection
  const [formFaculty, setFormFaculty] = useState('')
  const { data: formDepts } = useQuery({
    queryKey: ['departments-form', formFaculty],
    queryFn:  () => listDepartmentsApi(1, formFaculty || undefined, undefined, 200),
    enabled:  true,
    staleTime: 30_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['courses', page, filterDept, search],
    queryFn:  () => listCoursesApi(page, filterDept || undefined, search || undefined),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['course-audit', auditTarget?.id],
    queryFn:  () => getCourseAuditLogsApi(auditTarget!.id),
    enabled:  !!auditTarget,
  })

  const createMutation = useMutation({
    mutationFn: () => createCourseApi(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setFormFaculty('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateCourseApi(editTarget!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCourseApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(c: CourseRow) {
    setEditTarget(c)
    setFormFaculty('')
    setForm({
      departmentId: c.departmentId,
      code:         c.code,
      title:        c.title,
      credits:      c.credits,
      type:         c.type,
      status:       c.status,
      originalFee:  c.originalFee,
      retakeFee:    c.retakeFee,
    })
    setMenuId(null)
  }

  const f = (field: keyof CreateCoursePayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search code or title…"
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
            />
          </div>
          <select value={filterFac} onChange={(e) => { setFilterFac(e.target.value); setFilterDept(''); setPage(1) }}
            className="py-2 pl-3 pr-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Faculties</option>
            {faculties?.data.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(1) }}
            className="py-2 pl-3 pr-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Departments</option>
            {deptOptions?.data.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add Course
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Code', 'Title', 'Department', 'Credits', 'Type', 'Status', 'Original Fee', 'Retake Fee', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">No courses found.</td></tr>
            )}
            {data?.data.map((course) => (
              <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className="text-indigo-400 shrink-0" />
                    <span className="font-mono text-xs font-semibold text-gray-800">{course.code}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                  <p className="truncate">{course.title}</p>
                  <p className="text-xs text-gray-400 truncate">{course.facultyName}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{course.departmentName ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {course.credits} cr
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_BADGE[course.type]}`}>
                    {course.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[course.status]}`}>
                    {course.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs font-medium">{course.originalFee.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600 text-xs font-medium">{course.retakeFee.toLocaleString()}</td>
                <td className="px-4 py-3 relative">
                  <button onClick={() => setMenuId(menuId === course.id ? null : course.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <MoreVertical size={15} />
                  </button>
                  {menuId === course.id && (
                    <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                      {canWrite && (
                        <button onClick={() => openEdit(course)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      <button onClick={() => { setPrereqTarget(course); setMenuId(null) }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-teal-600 hover:bg-gray-50">
                        <GitMerge size={14} /> Prerequisites
                      </button>
                      {canSyllab && (
                        <button onClick={() => { router.push(`/dashboard/courses/${course.id}/syllabus`); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-purple-600 hover:bg-gray-50">
                          <ScrollText size={14} /> Manage Syllabus
                        </button>
                      )}
                      {canSyllab && (
                        <button onClick={() => { router.push(`/dashboard/courses/${course.id}/clos`); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                          <Target size={14} /> Manage CLOs
                        </button>
                      )}
                      {canSyllab && (
                        <button onClick={() => { router.push(`/dashboard/courses/${course.id}/assessment-plan`); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-teal-600 hover:bg-gray-50">
                          <ClipboardList size={14} /> Assessment Plan
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => { setAuditTarget(course); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                          <History size={14} /> History
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => { setDeleteTarget(course); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && data.total > data.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <button disabled={page * data.limit >= data.total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Course" onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); setFormFaculty('') }}>
          <CourseForm
            form={form} setForm={setForm} f={f}
            faculties={faculties?.data ?? []}
            formFaculty={formFaculty} setFormFaculty={setFormFaculty}
            formDepts={formDepts?.data ?? []}
            isEdit={false}
            error={(createMutation.error as any)?.response?.data?.error}
            isPending={createMutation.isPending}
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}
            onCancel={() => { setShowCreate(false); setForm(EMPTY_FORM); setFormFaculty('') }}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.code}`} onClose={() => setEditTarget(null)}>
          <CourseForm
            form={form} setForm={setForm} f={f}
            faculties={faculties?.data ?? []}
            formFaculty={formFaculty} setFormFaculty={setFormFaculty}
            formDepts={formDepts?.data ?? []}
            isEdit={true}
            error={(updateMutation.error as any)?.response?.data?.error}
            isPending={updateMutation.isPending}
            onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      {/* Delete */}
      {deleteTarget && (
        <Modal title="Delete Course" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget.code} — {deleteTarget.title}</strong>? This cannot be undone.
            </p>
            {deleteMutation.error && (
              <p className="text-red-600 text-sm">{(deleteMutation.error as any)?.response?.data?.error ?? 'Error deleting course.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Audit History */}
      {auditTarget && (
        <Modal title={`History — ${auditTarget.code}`} onClose={() => setAuditTarget(null)}>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {auditLoading && <p className="text-center text-sm text-gray-400 py-6">Loading…</p>}
            {!auditLoading && auditData?.data.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No history yet.</p>
            )}
            {auditData?.data.map(entry => <AuditEntry key={entry.id} entry={entry} />)}
          </div>
        </Modal>
      )}

      {/* Prerequisites */}
      {prereqTarget && (
        <PrerequisitesModal
          course={prereqTarget}
          canWrite={canWrite}
          onClose={() => setPrereqTarget(null)}
        />
      )}
    </div>
  )
}

// ── Prerequisites Modal ───────────────────────────────────────────────────────

function PrerequisitesModal({
  course,
  canWrite,
  onClose,
}: {
  course: CourseRow
  canWrite: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [addForm, setAddForm] = useState({ prerequisiteCourseId: '', minGrade: '', isMandatory: true })

  const { data: prereqData, isLoading } = useQuery({
    queryKey: ['course-prerequisites', course.id],
    queryFn:  () => listPrerequisitesApi(course.id),
  })

  const { data: allCourses } = useQuery({
    queryKey: ['courses-all'],
    queryFn:  () => listCoursesApi(1, undefined, undefined, 500),
    staleTime: 60_000,
  })

  const mappedIds = new Set([
    course.id,
    ...(prereqData?.data.map(p => p.prerequisiteCourseId) ?? []),
  ])
  const available = allCourses?.data.filter(c => !mappedIds.has(c.id)) ?? []

  const addMutation = useMutation({
    mutationFn: () => addPrerequisiteApi(course.id, {
      prerequisiteCourseId: addForm.prerequisiteCourseId,
      minGrade:             addForm.minGrade || null,
      isMandatory:          addForm.isMandatory,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-prerequisites', course.id] })
      setAddForm({ prerequisiteCourseId: '', minGrade: '', isMandatory: true })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removePrerequisiteApi(course.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-prerequisites', course.id] }),
  })

  const rows: CoursePrerequisiteRow[] = prereqData?.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Prerequisites — {course.code}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{course.title}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading && <p className="text-center text-sm text-gray-400 py-6">Loading…</p>}
          {!isLoading && rows.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-4">No prerequisites defined.</p>
          )}
          {rows.map(row => (
            <div key={row.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <GitMerge size={13} className="text-teal-500 shrink-0" />
              <span className="font-mono text-xs font-semibold text-gray-700">{row.prerequisiteCourseCode}</span>
              <span className="text-xs text-gray-600 flex-1 truncate">{row.prerequisiteCourseTitle}</span>
              {row.minGrade && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                  Min: {row.minGrade}
                </span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${row.isMandatory ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500'}`}>
                {row.isMandatory ? 'Required' : 'Optional'}
              </span>
              {canWrite && (
                <button onClick={() => removeMutation.mutate(row.id)} disabled={removeMutation.isPending}
                  className="p-1 rounded hover:bg-white text-gray-400 hover:text-red-500 ml-1">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}

          {canWrite && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Prerequisite</p>
              <div className="space-y-2">
                <select
                  value={addForm.prerequisiteCourseId}
                  onChange={(e) => setAddForm(f => ({ ...f, prerequisiteCourseId: e.target.value }))}
                  className="input text-xs py-1.5 w-full">
                  <option value="">Select course…</option>
                  {available.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      value={addForm.minGrade}
                      onChange={(e) => setAddForm(f => ({ ...f, minGrade: e.target.value }))}
                      placeholder="Min grade (e.g. C)"
                      maxLength={5}
                      className="input text-xs py-1.5 w-full"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                    <input type="checkbox" checked={addForm.isMandatory}
                      onChange={(e) => setAddForm(f => ({ ...f, isMandatory: e.target.checked }))}
                      className="w-4 h-4" />
                    Required
                  </label>
                  <button
                    onClick={() => addForm.prerequisiteCourseId && addMutation.mutate()}
                    disabled={!addForm.prerequisiteCourseId || addMutation.isPending}
                    className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={13} /> Add
                  </button>
                </div>
                {addMutation.error && (
                  <p className="text-red-600 text-xs">{(addMutation.error as any)?.response?.data?.error ?? 'Error adding prerequisite.'}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared form component ─────────────────────────────────────────────────────

interface CourseFormProps {
  form:           CreateCoursePayload
  setForm:        React.Dispatch<React.SetStateAction<CreateCoursePayload>>
  f:              (field: keyof CreateCoursePayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  faculties:      { id: string; name: string }[]
  formFaculty:    string
  setFormFaculty: (v: string) => void
  formDepts:      { id: string; name: string }[]
  isEdit:         boolean
  error?:         string
  isPending:      boolean
  onSubmit:       (e: React.FormEvent) => void
  onCancel:       () => void
}

function CourseForm({ form, setForm, f, faculties, formFaculty, setFormFaculty, formDepts, isEdit, error, isPending, onSubmit, onCancel }: CourseFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Faculty selector (UI-only filter for dept dropdown) */}
      <Field label="Faculty">
        <select value={formFaculty}
          onChange={(e) => { setFormFaculty(e.target.value); setForm(p => ({ ...p, departmentId: '' })) }}
          className="input">
          <option value="">Select faculty…</option>
          {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Field>
      <Field label="Department">
        <select required value={form.departmentId} onChange={f('departmentId')} className="input">
          <option value="">Select department…</option>
          {formDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Code">
          <input required value={form.code} onChange={f('code')} className="input" placeholder="CSE101" />
        </Field>
        <Field label="Credits">
          <input required type="number" min={1} max={20} value={form.credits} onChange={f('credits')} className="input" />
        </Field>
      </div>

      <Field label="Title">
        <input required value={form.title} onChange={f('title')} className="input" placeholder="Introduction to Algorithms" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select required value={form.type} onChange={f('type')} className="input">
            <option value="CORE">Core</option>
            <option value="ELECTIVE">Elective</option>
          </select>
        </Field>
        <Field label="Status">
          <select required value={form.status} onChange={f('status')} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Original Fee">
          <input required type="number" min={0} step={0.01} value={form.originalFee} onChange={f('originalFee')} className="input" placeholder="0.00" />
        </Field>
        <Field label="Retake Fee">
          <input required type="number" min={0} step={0.01} value={form.retakeFee} onChange={f('retakeFee')} className="input" placeholder="0.00" />
        </Field>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Save'}
        </button>
      </div>
    </form>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const badge = { CREATE: 'bg-green-100 text-green-700', UPDATE: 'bg-blue-100 text-blue-700', DELETE: 'bg-red-100 text-red-700' }
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge[entry.action]}`}>{entry.action}</span>
          <span className="text-sm text-gray-700">{entry.performedByName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-indigo-500 hover:underline">
            {expanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>
      {expanded && (
        <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-48 text-gray-600 leading-relaxed">
          {JSON.stringify(entry.snapshot, null, 2)}
        </pre>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
