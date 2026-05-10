'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import {
  GraduationCap, Search, MoreVertical, Pencil, History, X, Plus,
  CheckCircle, XCircle, Mail, ToggleLeft, ToggleRight,
} from 'lucide-react'
import {
  listTeachersApi, createTeacherApi, updateTeacherApi,
  toggleTeacherStatusApi, resendTeacherInvitationApi, getTeacherAuditLogsApi,
  type TeacherRow, type Designation,
} from '@/lib/api/teachers'
import { listFacultiesApi, listDepartmentsApi, type AuditLogEntry } from '@/lib/api/academic'

type CreateForm = {
  facultyId: string; departmentId: string; name: string; email: string
  phone: string; designation: Designation; joiningDate: string
}
type EditForm = {
  facultyId: string; departmentId: string; name: string; phone: string
  designation: Designation; joiningDate: string
}

const DESIGNATIONS: Designation[] = ['Professor', 'Lecturer']

export default function TeachersPage() {
  const qc      = useQueryClient()
  const user    = useAtomValue(currentUserAtom)
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin'

  const [search,        setSearch]        = useState('')
  const [page,          setPage]          = useState(1)
  const [filterFaculty, setFilterFaculty] = useState('')
  const [filterDept,    setFilterDept]    = useState('')
  const [menuId,        setMenuId]        = useState<string | null>(null)
  const [showCreate,    setShowCreate]    = useState(false)
  const [editTarget,    setEditTarget]    = useState<TeacherRow | null>(null)
  const [auditTarget,   setAuditTarget]   = useState<TeacherRow | null>(null)
  const [resendTarget,  setResendTarget]  = useState<TeacherRow | null>(null)

  const emptyCreate: CreateForm = {
    facultyId: '', departmentId: '', name: '', email: '',
    phone: '', designation: 'Lecturer', joiningDate: '',
  }
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate)
  const [editForm,   setEditForm]   = useState<EditForm>({
    facultyId: '', departmentId: '', name: '', phone: '', designation: 'Lecturer', joiningDate: '',
  })

  const { data: facultyOptions } = useQuery({
    queryKey: ['faculties-all'],
    queryFn:  () => listFacultiesApi(1, undefined, 200),
    staleTime: 60_000,
  })

  const { data: deptOptions } = useQuery({
    queryKey: ['departments-all', filterFaculty],
    queryFn:  () => listDepartmentsApi(1, filterFaculty || undefined, undefined, 200),
    staleTime: 60_000,
  })

  const { data: createDeptOptions } = useQuery({
    queryKey: ['departments-for-faculty', createForm.facultyId],
    queryFn:  () => listDepartmentsApi(1, createForm.facultyId, undefined, 200),
    enabled:  !!createForm.facultyId,
    staleTime: 60_000,
  })

  const { data: editDeptOptions } = useQuery({
    queryKey: ['departments-for-faculty', editForm.facultyId],
    queryFn:  () => listDepartmentsApi(1, editForm.facultyId, undefined, 200),
    enabled:  !!editForm.facultyId,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['teachers', page, filterFaculty, filterDept, search],
    queryFn:  () => listTeachersApi(
      page,
      filterDept    || undefined,
      filterFaculty || undefined,
      search        || undefined,
    ),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['teacher-audit', auditTarget?.id],
    queryFn:  () => getTeacherAuditLogsApi(auditTarget!.id),
    enabled:  !!auditTarget,
  })

  const createMutation = useMutation({
    mutationFn: () => createTeacherApi({
      facultyId:    createForm.facultyId,
      departmentId: createForm.departmentId,
      name:         createForm.name,
      email:        createForm.email,
      phone:        createForm.phone || undefined,
      designation:  createForm.designation,
      joiningDate:  createForm.joiningDate,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      setShowCreate(false)
      setCreateForm(emptyCreate)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateTeacherApi(editTarget!.id, {
      facultyId:    editForm.facultyId,
      departmentId: editForm.departmentId,
      name:         editForm.name,
      phone:        editForm.phone || null,
      designation:  editForm.designation,
      joiningDate:  editForm.joiningDate,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      setEditTarget(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleTeacherStatusApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      setMenuId(null)
    },
  })

  const resendMutation = useMutation({
    mutationFn: (id: string) => resendTeacherInvitationApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers'] })
      setResendTarget(null)
    },
  })

  function openEdit(t: TeacherRow) {
    setEditTarget(t)
    setEditForm({
      facultyId:    t.facultyId,
      departmentId: t.departmentId,
      name:         t.name,
      phone:        t.phone ?? '',
      designation:  t.designation,
      joiningDate:  t.joiningDate.slice(0, 10),
    })
    setMenuId(null)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search teachers…"
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
            />
          </div>
          <select
            value={filterFaculty}
            onChange={(e) => { setFilterFaculty(e.target.value); setFilterDept(''); setPage(1) }}
            className="py-2 pl-3 pr-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Faculties</option>
            {facultyOptions?.data.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPage(1) }}
            className="py-2 pl-3 pr-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {deptOptions?.data.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Teacher
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Teacher', 'Contact', 'Designation', 'Department', 'Joining Date', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No teachers found.</td></tr>
            )}
            {data?.data.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={15} className="text-indigo-500 shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{t.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    {t.designation}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  <p>{t.departmentName ?? '—'}</p>
                  <p className="text-gray-400">{t.facultyName ?? ''}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {t.joiningDate ? new Date(t.joiningDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {t.isActive
                    ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Active</span>
                    : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Inactive</span>}
                </td>
                <td className="px-4 py-3 relative">
                  <button
                    onClick={() => setMenuId(menuId === t.id ? null : t.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {menuId === t.id && (
                    <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48">
                      {canWrite && (
                        <button onClick={() => openEdit(t)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => { setAuditTarget(t); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                          <History size={14} /> History
                        </button>
                      )}
                      {canWrite && !t.isActive && (
                        <button onClick={() => { setResendTarget(t); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-amber-600 hover:bg-gray-50">
                          <Mail size={14} /> Resend Invite
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => toggleMutation.mutate(t.id)}
                          disabled={toggleMutation.isPending}
                          className={`flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-50 ${t.isActive ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {t.isActive
                            ? <><ToggleLeft size={14} /> Deactivate</>
                            : <><ToggleRight size={14} /> Activate</>}
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
        <Modal title="Add Teacher" onClose={() => { setShowCreate(false); setCreateForm(emptyCreate) }}>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faculty" full>
                <select
                  required
                  value={createForm.facultyId}
                  onChange={(e) => setCreateForm(f => ({ ...f, facultyId: e.target.value, departmentId: '' }))}
                  className="input"
                >
                  <option value="">Select faculty…</option>
                  {facultyOptions?.data.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Department" full>
                <select
                  required
                  value={createForm.departmentId}
                  onChange={(e) => setCreateForm(f => ({ ...f, departmentId: e.target.value }))}
                  className="input"
                  disabled={!createForm.facultyId}
                >
                  <option value="">Select department…</option>
                  {createDeptOptions?.data.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name">
                <input required value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="Dr. Jane Smith" />
              </Field>
              <Field label="Email">
                <input required type="email" value={createForm.email}
                  onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className="input" placeholder="jane@university.edu" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input value={createForm.phone}
                  onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  className="input" placeholder="+1 555 000 0000" />
              </Field>
              <Field label="Designation">
                <select required value={createForm.designation}
                  onChange={(e) => setCreateForm(f => ({ ...f, designation: e.target.value as Designation }))}
                  className="input">
                  {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Joining Date">
              <input required type="date" value={createForm.joiningDate}
                onChange={(e) => setCreateForm(f => ({ ...f, joiningDate: e.target.value }))}
                className="input" />
            </Field>
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              An invitation email with a 24-hour activation link will be sent to the teacher.
            </p>
            {createMutation.error && (
              <p className="text-red-600 text-sm">{(createMutation.error as any)?.response?.data?.error ?? 'Error creating teacher.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowCreate(false); setCreateForm(emptyCreate) }} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Saving…' : 'Save & Send Invite'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Faculty" full>
                <select
                  value={editForm.facultyId}
                  onChange={(e) => setEditForm(f => ({ ...f, facultyId: e.target.value, departmentId: '' }))}
                  className="input"
                >
                  <option value="">Select faculty…</option>
                  {facultyOptions?.data.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Department" full>
                <select
                  value={editForm.departmentId}
                  onChange={(e) => setEditForm(f => ({ ...f, departmentId: e.target.value }))}
                  className="input"
                  disabled={!editForm.facultyId}
                >
                  <option value="">Select department…</option>
                  {editDeptOptions?.data.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Full Name">
              <input required value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input value={editForm.phone}
                  onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="input" />
              </Field>
              <Field label="Designation">
                <select value={editForm.designation}
                  onChange={(e) => setEditForm(f => ({ ...f, designation: e.target.value as Designation }))}
                  className="input">
                  {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Joining Date">
              <input type="date" value={editForm.joiningDate}
                onChange={(e) => setEditForm(f => ({ ...f, joiningDate: e.target.value }))}
                className="input" />
            </Field>
            <p className="text-xs text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2">
              Email address cannot be changed after creation.
            </p>
            {updateMutation.error && (
              <p className="text-red-600 text-sm">{(updateMutation.error as any)?.response?.data?.error ?? 'Error updating teacher.'}</p>
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

      {/* Resend Invitation Confirm */}
      {resendTarget && (
        <Modal title="Resend Invitation" onClose={() => setResendTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Resend a 24-hour activation link to <strong>{resendTarget.email}</strong>?
            </p>
            {resendMutation.error && (
              <p className="text-red-600 text-sm">{(resendMutation.error as any)?.response?.data?.error ?? 'Error sending invitation.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setResendTarget(null)} className="btn-ghost">Cancel</button>
              <button
                onClick={() => resendMutation.mutate(resendTarget.id)}
                disabled={resendMutation.isPending}
                className="btn-primary"
              >
                {resendMutation.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Audit History */}
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

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const badge: Record<string, string> = {
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
