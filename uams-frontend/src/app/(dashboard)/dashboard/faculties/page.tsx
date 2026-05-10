'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { School, Search, MoreVertical, Pencil, Trash2, History, X, Plus, CheckCircle, XCircle } from 'lucide-react'
import {
  listFacultiesApi, createFacultyApi, updateFacultyApi, deleteFacultyApi, getFacultyAuditLogsApi,
  type FacultyRow, type AuditLogEntry,
} from '@/lib/api/academic'

type FormState = { name: string; code: string; description: string; isActive: boolean }

export default function FacultiesPage() {
  const qc      = useQueryClient()
  const user    = useAtomValue(currentUserAtom)
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin'

  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<FacultyRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FacultyRow | null>(null)
  const [auditTarget,  setAuditTarget]  = useState<FacultyRow | null>(null)
  const [form,         setForm]         = useState<FormState>({ name: '', code: '', description: '', isActive: true })

  const { data, isLoading } = useQuery({
    queryKey: ['faculties', page, search],
    queryFn:  () => listFacultiesApi(page, search || undefined),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['faculty-audit', auditTarget?.id],
    queryFn:  () => getFacultyAuditLogsApi(auditTarget!.id),
    enabled:  !!auditTarget,
  })

  const createMutation = useMutation({
    mutationFn: () => createFacultyApi({ name: form.name, code: form.code, description: form.description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faculties'] })
      setShowCreate(false)
      setForm({ name: '', code: '', description: '', isActive: true })
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateFacultyApi(editTarget!.id, {
      name:        form.name,
      code:        form.code,
      description: form.description || null,
      isActive:    form.isActive,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faculties'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFacultyApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faculties'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(f: FacultyRow) {
    setEditTarget(f)
    setForm({ name: f.name, code: f.code, description: f.description ?? '', isActive: f.isActive })
    setMenuId(null)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search faculties…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Faculty
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Faculty Name', 'Code', 'Description', 'Status', 'Created', ''].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No faculties found.</td></tr>
            )}
            {data?.data.map((faculty) => (
              <tr key={faculty.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <School size={15} className="text-indigo-500 shrink-0" />
                    {faculty.name}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{faculty.code}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{faculty.description ?? '—'}</td>
                <td className="px-4 py-3">
                  {faculty.isActive
                    ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Active</span>
                    : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={13} /> Inactive</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(faculty.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 relative">
                  <button
                    onClick={() => setMenuId(menuId === faculty.id ? null : faculty.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {menuId === faculty.id && (
                    <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                      {canWrite && (
                        <button onClick={() => openEdit(faculty)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => { setAuditTarget(faculty); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                          <History size={14} /> History
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => { setDeleteTarget(faculty); setMenuId(null) }}
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

      {/* Create */}
      {showCreate && (
        <Modal title="Add Faculty" onClose={() => setShowCreate(false)}>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input" placeholder="Engineering" />
              </Field>
              <Field label="Code">
                <input required value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                  className="input" placeholder="ENG" />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="input resize-none" rows={3} placeholder="Optional description" />
            </Field>
            {createMutation.error && (
              <p className="text-red-600 text-sm">{(createMutation.error as any)?.response?.data?.error ?? 'Error creating faculty.'}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="input" />
              </Field>
              <Field label="Code">
                <input required value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} className="input" />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="input resize-none" rows={3} />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </Field>
            {updateMutation.error && (
              <p className="text-red-600 text-sm">{(updateMutation.error as any)?.response?.data?.error ?? 'Error updating faculty.'}</p>
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
        <Modal title="Delete Faculty" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget.name}</strong>? All departments under this faculty will also be removed. This cannot be undone.
            </p>
            {deleteMutation.error && (
              <p className="text-red-600 text-sm">{(deleteMutation.error as any)?.response?.data?.error ?? 'Error deleting faculty.'}</p>
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
