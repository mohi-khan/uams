'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import {
  Layers, Search, MoreVertical, Pencil, Trash2, History,
  X, Plus, CheckCircle, XCircle,
} from 'lucide-react'
import {
  listBatchesApi, createBatchApi, updateBatchApi,
  deleteBatchApi, getBatchAuditLogsApi,
  type BatchRow,
} from '@/lib/api/batches'
import { listProgramsApi, type ProgramRow } from '@/lib/api/academic'
import { listSessionsApi, type SessionRow } from '@/lib/api/sessions'
import type { AuditLogEntry } from '@/lib/api/academic'

type CreateForm = {
  programId: string
  sessionId: string
  code:      string
  name:      string
  capacity:  string
}

type EditForm = CreateForm & { isActive: boolean }

const emptyCreate: CreateForm = { programId: '', sessionId: '', code: '', name: '', capacity: '' }

export default function BatchesPage() {
  const qc       = useQueryClient()
  const user     = useAtomValue(currentUserAtom)
  const canWrite = (
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'academic_coordinator'
  )

  const [search,       setSearch]       = useState('')
  const [filterProgram,setFilterProgram]= useState('')
  const [page,         setPage]         = useState(1)
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<BatchRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BatchRow | null>(null)
  const [auditTarget,  setAuditTarget]  = useState<BatchRow | null>(null)
  const [createForm,   setCreateForm]   = useState<CreateForm>(emptyCreate)
  const [editForm,     setEditForm]     = useState<EditForm>({
    ...emptyCreate, isActive: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['batches', page, search, filterProgram],
    queryFn:  () => listBatchesApi(page, filterProgram || undefined, search || undefined),
  })

  const { data: programsData } = useQuery({
    queryKey: ['programs-all'],
    queryFn:  () => listProgramsApi(1, undefined, undefined, 200),
  })

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions-all'],
    queryFn:  () => listSessionsApi(1, undefined, 200),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['batch-audit', auditTarget?.id],
    queryFn:  () => getBatchAuditLogsApi(auditTarget!.id),
    enabled:  !!auditTarget,
  })

  const programs: ProgramRow[] = programsData?.data ?? []
  const sessions: SessionRow[] = sessionsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: () => createBatchApi({
      programId: createForm.programId,
      sessionId: createForm.sessionId || undefined,
      code:      createForm.code,
      name:      createForm.name,
      capacity:  createForm.capacity ? Number(createForm.capacity) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] })
      setShowCreate(false)
      setCreateForm(emptyCreate)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateBatchApi(editTarget!.id, {
      programId: editForm.programId || undefined,
      sessionId: editForm.sessionId || null,
      code:      editForm.code      || undefined,
      name:      editForm.name      || undefined,
      capacity:  editForm.capacity  ? Number(editForm.capacity) : null,
      isActive:  editForm.isActive,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBatchApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batches'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(b: BatchRow) {
    setEditTarget(b)
    setEditForm({
      programId: b.programId,
      sessionId: b.sessionId ?? '',
      code:      b.code,
      name:      b.name,
      capacity:  b.capacity != null ? String(b.capacity) : '',
      isActive:  b.isActive,
    })
    setMenuId(null)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by code or name…"
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60"
            />
          </div>
          <select
            value={filterProgram}
            onChange={(e) => { setFilterProgram(e.target.value); setPage(1) }}
            className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            <option value="">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Batch
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Code', 'Name', 'Program', 'Session', 'Capacity', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No batches found.</td></tr>
            )}
            {data?.data.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Layers size={14} className="text-indigo-500" />
                    </div>
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{b.code}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{b.programName ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{b.sessionName ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {b.capacity != null ? b.capacity : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {b.isActive
                    ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Active</span>
                    : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Inactive</span>}
                </td>
                <td className="px-4 py-3 relative">
                  <button
                    onClick={() => setMenuId(menuId === b.id ? null : b.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {menuId === b.id && (
                    <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                      {canWrite && (
                        <button onClick={() => openEdit(b)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      <button onClick={() => { setAuditTarget(b); setMenuId(null) }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                        <History size={14} /> History
                      </button>
                      {canWrite && (
                        <button onClick={() => { setDeleteTarget(b); setMenuId(null) }}
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
        <Modal title="New Batch" onClose={() => { setShowCreate(false); setCreateForm(emptyCreate) }}>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="space-y-4">
            <Field label="Program">
              <select required value={createForm.programId}
                onChange={(e) => setCreateForm(f => ({ ...f, programId: e.target.value }))}
                className="input">
                <option value="">Select program…</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Academic Session (optional)">
              <select value={createForm.sessionId}
                onChange={(e) => setCreateForm(f => ({ ...f, sessionId: e.target.value }))}
                className="input">
                <option value="">None</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.term} {s.year})</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Batch Code">
                <input required value={createForm.code}
                  onChange={(e) => setCreateForm(f => ({ ...f, code: e.target.value }))}
                  className="input" placeholder="cse-2026-01" />
              </Field>
              <Field label="Batch Name">
                <input required value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="CSE Batch 2026" />
              </Field>
            </div>
            <Field label="Capacity (optional)">
              <input type="number" min="1" value={createForm.capacity}
                onChange={(e) => setCreateForm(f => ({ ...f, capacity: e.target.value }))}
                className="input" placeholder="60" />
            </Field>
            {createMutation.error && (
              <p className="text-red-600 text-sm">{(createMutation.error as any)?.response?.data?.error ?? 'Error creating batch.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowCreate(false); setCreateForm(emptyCreate) }} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Saving…' : 'Save Batch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }} className="space-y-4">
            <Field label="Program">
              <select required value={editForm.programId}
                onChange={(e) => setEditForm(f => ({ ...f, programId: e.target.value }))}
                className="input">
                <option value="">Select program…</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Academic Session (optional)">
              <select value={editForm.sessionId}
                onChange={(e) => setEditForm(f => ({ ...f, sessionId: e.target.value }))}
                className="input">
                <option value="">None</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.term} {s.year})</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Batch Code">
                <input required value={editForm.code}
                  onChange={(e) => setEditForm(f => ({ ...f, code: e.target.value }))}
                  className="input" />
              </Field>
              <Field label="Batch Name">
                <input required value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="input" />
              </Field>
            </div>
            <Field label="Capacity (optional)">
              <input type="number" min="1" value={editForm.capacity}
                onChange={(e) => setEditForm(f => ({ ...f, capacity: e.target.value }))}
                className="input" />
            </Field>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <button
                type="button"
                onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  editForm.isActive ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  editForm.isActive ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
              <span className="text-sm text-gray-500">{editForm.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            {updateMutation.error && (
              <p className="text-red-600 text-sm">{(updateMutation.error as any)?.response?.data?.error ?? 'Error updating batch.'}</p>
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
        <Modal title="Delete Batch" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete batch <strong>{deleteTarget.name}</strong> (<code>{deleteTarget.code}</code>)? This cannot be undone.
            </p>
            {deleteMutation.error && (
              <p className="text-red-600 text-sm">{(deleteMutation.error as any)?.response?.data?.error ?? 'Error deleting batch.'}</p>
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

      {/* Audit */}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
