'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { BookMarked, Search, MoreVertical, Pencil, Trash2, History, X, Plus, BookOpen, ChevronRight, ChevronDown, Layers } from 'lucide-react'
import {
  listFacultiesApi, listDepartmentsApi,
  listProgramsApi, createProgramApi, updateProgramApi, deleteProgramApi, getProgramAuditLogsApi,
  listCoursesApi, listProgramCoursesApi, addProgramCourseApi, updateProgramCourseApi, removeProgramCourseApi,
  type ProgramRow, type AuditLogEntry, type DegreeLevel, type CourseStatus, type CreateProgramPayload,
  type ProgramCourseRow,
} from '@/lib/api/academic'

const DEGREE_LABELS: Record<DegreeLevel, string> = {
  bachelor:    'Bachelor',
  master:      'Master',
  phd:         'PhD',
  diploma:     'Diploma',
  certificate: 'Certificate',
}

const DEGREE_BADGE: Record<DegreeLevel, string> = {
  bachelor:    'bg-blue-100 text-blue-700',
  master:      'bg-purple-100 text-purple-700',
  phd:         'bg-rose-100 text-rose-700',
  diploma:     'bg-amber-100 text-amber-700',
  certificate: 'bg-teal-100 text-teal-700',
}

const STATUS_BADGE: Record<CourseStatus, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  archived: 'bg-orange-100 text-orange-700',
}

const EMPTY_FORM: CreateProgramPayload = {
  departmentId:      '',
  name:              '',
  code:              '',
  degreeLevel:       'bachelor',
  totalCredits:      120,
  durationSemesters: 8,
  status:            'active',
}

export default function ProgramsPage() {
  const qc       = useQueryClient()
  const router   = useRouter()
  const user     = useAtomValue(currentUserAtom)
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin'
  const canObe   = canWrite || user?.role === 'academic_coordinator'

  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [filterFac,    setFilterFac]    = useState('')
  const [filterDept,   setFilterDept]   = useState('')
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<ProgramRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProgramRow | null>(null)
  const [auditTarget,  setAuditTarget]  = useState<ProgramRow | null>(null)
  const [form,         setForm]         = useState<CreateProgramPayload>(EMPTY_FORM)
  const [formFaculty,  setFormFaculty]  = useState('')

  const { data: faculties } = useQuery({
    queryKey: ['faculties-all'],
    queryFn:  () => listFacultiesApi(1, undefined, 200),
    staleTime: 60_000,
  })

  const { data: deptOptions } = useQuery({
    queryKey: ['departments-all', filterFac],
    queryFn:  () => listDepartmentsApi(1, filterFac || undefined, undefined, 200),
    staleTime: 60_000,
  })

  const { data: formDepts } = useQuery({
    queryKey: ['departments-form', formFaculty],
    queryFn:  () => listDepartmentsApi(1, formFaculty || undefined, undefined, 200),
    staleTime: 30_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['programs', page, filterDept, search],
    queryFn:  () => listProgramsApi(page, filterDept || undefined, search || undefined),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['program-audit', auditTarget?.id],
    queryFn:  () => getProgramAuditLogsApi(auditTarget!.id),
    enabled:  !!auditTarget,
  })

  const createMutation = useMutation({
    mutationFn: () => createProgramApi(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      setFormFaculty('')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateProgramApi(editTarget!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProgramApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(p: ProgramRow) {
    setEditTarget(p)
    setFormFaculty('')
    setForm({
      departmentId:      p.departmentId,
      name:              p.name,
      code:              p.code,
      degreeLevel:       p.degreeLevel,
      totalCredits:      p.totalCredits,
      durationSemesters: p.durationSemesters,
      status:            p.status,
    })
    setMenuId(null)
  }

  const f = (field: keyof CreateProgramPayload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  const programForm = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Faculty (filter)">
          <select value={formFaculty} onChange={(e) => { setFormFaculty(e.target.value); setForm(v => ({ ...v, departmentId: '' })) }} className="input">
            <option value="">All Faculties</option>
            {faculties?.data.map(fac => <option key={fac.id} value={fac.id}>{fac.name}</option>)}
          </select>
        </Field>
        <Field label="Department *">
          <select required value={form.departmentId} onChange={f('departmentId')} className="input">
            <option value="">Select department…</option>
            {formDepts?.data.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Program Name *">
          <input required value={form.name} onChange={f('name')} className="input" placeholder="B.Sc. Computer Science" />
        </Field>
        <Field label="Code *">
          <input required value={form.code} onChange={f('code')} className="input" placeholder="BSC-CS" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Degree Level *">
          <select required value={form.degreeLevel} onChange={f('degreeLevel')} className="input">
            {(Object.keys(DEGREE_LABELS) as DegreeLevel[]).map(dl => (
              <option key={dl} value={dl}>{DEGREE_LABELS[dl]}</option>
            ))}
          </select>
        </Field>
        <Field label="Total Credits *">
          <input required type="number" min={0} value={form.totalCredits} onChange={f('totalCredits')} className="input" />
        </Field>
        <Field label="Duration (Semesters) *">
          <input required type="number" min={1} max={20} value={form.durationSemesters} onChange={f('durationSemesters')} className="input" />
        </Field>
      </div>
      <Field label="Status">
        <select value={form.status} onChange={f('status')} className="input">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
    </div>
  )

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
              placeholder="Search code or name…"
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
            />
          </div>
          <select value={filterFac} onChange={(e) => { setFilterFac(e.target.value); setFilterDept(''); setPage(1) }}
            className="py-2 pl-3 pr-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Faculties</option>
            {faculties?.data.map(fac => <option key={fac.id} value={fac.id}>{fac.name}</option>)}
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
            <Plus size={15} /> Add Program
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Code', 'Program Name', 'Department', 'Level', 'Credits', 'Semesters', 'Status', 'Created', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">No programs found.</td></tr>
            )}
            {data?.data.map((prog) => (
              <>
                <tr key={prog.id} className={`hover:bg-gray-50 transition-colors ${expandedId === prog.id ? 'bg-indigo-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setExpandedId(expandedId === prog.id ? null : prog.id)}
                        className="p-0.5 rounded hover:bg-indigo-100 transition-colors text-gray-400 hover:text-indigo-600"
                        title={expandedId === prog.id ? 'Collapse courses' : 'Expand courses'}
                      >
                        {expandedId === prog.id
                          ? <ChevronDown size={13} className="text-indigo-500" />
                          : <ChevronRight size={13} />}
                      </button>
                      <BookMarked size={14} className="text-indigo-400 shrink-0" />
                      <span className="font-mono text-xs font-semibold text-gray-800">{prog.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                    <p className="truncate">{prog.name}</p>
                    <p className="text-xs text-gray-400 truncate">{prog.facultyName}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{prog.departmentName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${DEGREE_BADGE[prog.degreeLevel]}`}>
                      {DEGREE_LABELS[prog.degreeLevel]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {prog.totalCredits} cr
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">{prog.durationSemesters}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[prog.status]}`}>
                      {prog.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(prog.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 relative">
                    <button onClick={() => setMenuId(menuId === prog.id ? null : prog.id)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <MoreVertical size={15} />
                    </button>
                    {menuId === prog.id && (
                      <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                        {canWrite && (
                          <button onClick={() => openEdit(prog)}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                        {canObe && (
                          <button onClick={() => { router.push(`/dashboard/programs/${prog.id}/plos`); setMenuId(null) }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-purple-600 hover:bg-gray-50">
                            <Layers size={14} /> Manage PLOs
                          </button>
                        )}
                        {canWrite && (
                          <button onClick={() => { setAuditTarget(prog); setMenuId(null) }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                            <History size={14} /> History
                          </button>
                        )}
                        {canWrite && (
                          <button onClick={() => { setDeleteTarget(prog); setMenuId(null) }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {expandedId === prog.id && (
                  <tr key={`${prog.id}-courses`}>
                    <td colSpan={9} className="bg-indigo-50/30 border-b border-indigo-100 px-0 py-0">
                      <InlineCoursePanel program={prog} canWrite={canWrite} />
                    </td>
                  </tr>
                )}
              </>
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

      {/* Create */}
      {showCreate && (
        <Modal title="Add Program" onClose={() => { setShowCreate(false); setForm(EMPTY_FORM); setFormFaculty('') }}>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="space-y-4">
            {programForm}
            {createMutation.error && (
              <p className="text-red-600 text-sm">{(createMutation.error as any)?.response?.data?.error ?? 'Error creating program.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setFormFaculty('') }} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }} className="space-y-4">
            {programForm}
            {updateMutation.error && (
              <p className="text-red-600 text-sm">{(updateMutation.error as any)?.response?.data?.error ?? 'Error updating program.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete */}
      {deleteTarget && (
        <Modal title="Delete Program" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget.name}</strong>? All course mappings for this program will also be removed. This cannot be undone.
            </p>
            {deleteMutation.error && (
              <p className="text-red-600 text-sm">{(deleteMutation.error as any)?.response?.data?.error ?? 'Error deleting program.'}</p>
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

      {/* History */}
      {auditTarget && (
        <Modal title={`History — ${auditTarget.name}`} onClose={() => setAuditTarget(null)}>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {auditLoading && <p className="text-center text-sm text-gray-400 py-6">Loading…</p>}
            {!auditLoading && auditData?.data.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">No history yet.</p>
            )}
            {auditData?.data.map((entry) => <AuditEntry key={entry.id} entry={entry} />)}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Inline Course Panel ───────────────────────────────────────────────────────

function InlineCoursePanel({
  program,
  canWrite,
}: {
  program: ProgramRow
  canWrite: boolean
}) {
  const qc = useQueryClient()
  const [addForm, setAddForm] = useState({ courseId: '', semesterNo: 1, isMandatory: true })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState({ semesterNo: 1, isMandatory: true })

  const { data: mappingData, isLoading } = useQuery({
    queryKey: ['program-courses', program.id],
    queryFn:  () => listProgramCoursesApi(program.id),
  })

  const { data: allCourses } = useQuery({
    queryKey: ['courses-all'],
    queryFn:  () => listCoursesApi(1, undefined, undefined, 500),
    staleTime: 60_000,
  })

  const mappedIds = new Set(mappingData?.data.map(m => m.courseId) ?? [])
  const availableCourses = allCourses?.data.filter(c => !mappedIds.has(c.id)) ?? []

  const addMutation = useMutation({
    mutationFn: () => addProgramCourseApi(program.id, addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program-courses', program.id] })
      setAddForm({ courseId: '', semesterNo: 1, isMandatory: true })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateProgramCourseApi(program.id, id, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program-courses', program.id] })
      setEditingId(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeProgramCourseApi(program.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['program-courses', program.id] }),
  })

  const rows = mappingData?.data ?? []
  const maxSemester = program.durationSemesters

  const bySemester: Record<number, ProgramCourseRow[]> = {}
  for (const row of rows) {
    ;(bySemester[row.semesterNo] ??= []).push(row)
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700">Course Curriculum — {program.name}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {rows.length} course{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No courses mapped yet. Add the first one below.</p>
      )}

      {Object.keys(bySemester).sort((a, b) => Number(a) - Number(b)).map(sem => (
        <div key={sem} className="mb-4">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
            Semester {sem}
          </p>
          <div className="grid gap-1.5">
            {bySemester[Number(sem)].map(row => (
              <div key={row.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm">
                {editingId === row.id ? (
                  <>
                    <input
                      type="number" min={1} max={maxSemester}
                      value={editForm.semesterNo}
                      onChange={(e) => setEditForm(f => ({ ...f, semesterNo: Number(e.target.value) }))}
                      className="input w-20 py-1 text-xs"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={editForm.isMandatory}
                        onChange={(e) => setEditForm(f => ({ ...f, isMandatory: e.target.checked }))}
                        className="w-3.5 h-3.5" />
                      Mandatory
                    </label>
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => updateMutation.mutate(row.id)} disabled={updateMutation.isPending}
                        className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-md">Save</button>
                      <button onClick={() => setEditingId(null)}
                        className="text-xs border border-gray-300 px-2 py-1 rounded-md">Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <BookOpen size={13} className="text-indigo-400 shrink-0" />
                    <span className="font-mono text-xs font-semibold text-gray-700 w-24 shrink-0">{row.courseCode}</span>
                    <span className="text-xs text-gray-600 flex-1 truncate">{row.courseTitle}</span>
                    <span className="text-xs text-gray-400">{row.credits} cr</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${row.isMandatory ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                      {row.isMandatory ? 'Mandatory' : 'Elective'}
                    </span>
                    {canWrite && (
                      <div className="flex gap-1 ml-1">
                        <button onClick={() => { setEditingId(row.id); setEditForm({ semesterNo: row.semesterNo, isMandatory: row.isMandatory }) }}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => removeMutation.mutate(row.id)} disabled={removeMutation.isPending}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {canWrite && (
        <div className="border-t border-indigo-100 pt-4 mt-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Course</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-52">
              <label className="block text-xs text-gray-500 mb-1">Course</label>
              <select value={addForm.courseId} onChange={(e) => setAddForm(f => ({ ...f, courseId: e.target.value }))} className="input text-xs py-1.5">
                <option value="">Select course…</option>
                {availableCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-gray-500 mb-1">Semester</label>
              <input type="number" min={1} max={maxSemester} value={addForm.semesterNo}
                onChange={(e) => setAddForm(f => ({ ...f, semesterNo: Number(e.target.value) }))}
                className="input text-xs py-1.5" />
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <input type="checkbox" id={`mandatory-${program.id}`} checked={addForm.isMandatory}
                onChange={(e) => setAddForm(f => ({ ...f, isMandatory: e.target.checked }))}
                className="w-4 h-4" />
              <label htmlFor={`mandatory-${program.id}`} className="text-xs text-gray-600 cursor-pointer">Mandatory</label>
            </div>
            <button
              onClick={() => addForm.courseId && addMutation.mutate()}
              disabled={!addForm.courseId || addMutation.isPending}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={13} /> Add
            </button>
          </div>
          {addMutation.error && (
            <p className="text-red-600 text-xs mt-2">{(addMutation.error as any)?.response?.data?.error ?? 'Error adding course.'}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const badge = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
  }
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
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
