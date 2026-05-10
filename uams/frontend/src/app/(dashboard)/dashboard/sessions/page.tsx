'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { CalendarDays, Search, MoreVertical, Pencil, Trash2, History, X, Plus } from 'lucide-react'
import {
  listSessionsApi, createSessionApi, updateSessionApi,
  deleteSessionApi, getSessionAuditLogsApi,
  type SessionRow, type Term, type SessionStatus,
} from '@/lib/api/sessions'
import type { AuditLogEntry } from '@/lib/api/academic'

const TERMS: Term[]          = ['SPRING', 'SUMMER', 'FALL']
const STATUSES: SessionStatus[] = ['draft', 'active', 'completed', 'archived']

const STATUS_STYLES: Record<SessionStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  archived:  'bg-amber-100 text-amber-700',
}

const TERM_STYLES: Record<Term, string> = {
  SPRING: 'bg-emerald-50 text-emerald-700',
  SUMMER: 'bg-orange-50 text-orange-700',
  FALL:   'bg-indigo-50 text-indigo-700',
}

type FormState = {
  name: string; year: string; term: Term
  startDate: string; endDate: string; status: SessionStatus
}

const emptyForm: FormState = {
  name: '', year: String(new Date().getFullYear()),
  term: 'SPRING', startDate: '', endDate: '', status: 'draft',
}

export default function SessionsPage() {
  const qc       = useQueryClient()
  const user     = useAtomValue(currentUserAtom)
  const canWrite = user?.role === 'admin' || user?.role === 'super_admin'

  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [menuId,       setMenuId]       = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<SessionRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SessionRow | null>(null)
  const [auditTarget,  setAuditTarget]  = useState<SessionRow | null>(null)
  const [form,         setForm]         = useState<FormState>(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', page, search],
    queryFn:  () => listSessionsApi(page, search || undefined),
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['session-audit', auditTarget?.id],
    queryFn:  () => getSessionAuditLogsApi(auditTarget!.id),
    enabled:  !!auditTarget,
  })

  const createMutation = useMutation({
    mutationFn: () => createSessionApi({
      name:      form.name,
      year:      Number(form.year),
      term:      form.term,
      startDate: form.startDate,
      endDate:   form.endDate,
      status:    form.status,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setShowCreate(false)
      setForm(emptyForm)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => updateSessionApi(editTarget!.id, {
      name:      form.name,
      year:      Number(form.year),
      term:      form.term,
      startDate: form.startDate,
      endDate:   form.endDate,
      status:    form.status,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSessionApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(s: SessionRow) {
    setEditTarget(s)
    setForm({
      name:      s.name,
      year:      String(s.year),
      term:      s.term,
      startDate: s.startDate.slice(0, 10),
      endDate:   s.endDate.slice(0, 10),
      status:    s.status,
    })
    setMenuId(null)
  }

  function f(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search sessions…"
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60"
          />
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Session
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Session', 'Year', 'Term', 'Period', 'Status', ''].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No sessions found.</td></tr>
            )}
            {data?.data.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-indigo-400 shrink-0" />
                    {s.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.year}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TERM_STYLES[s.term]}`}>
                    {s.term}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(s.startDate).toLocaleDateString()} — {new Date(s.endDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[s.status]}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 relative">
                  <button
                    onClick={() => setMenuId(menuId === s.id ? null : s.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {menuId === s.id && (
                    <div className="absolute right-8 top-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                      {canWrite && (
                        <button onClick={() => openEdit(s)}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Pencil size={14} /> Edit
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => { setAuditTarget(s); setMenuId(null) }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50">
                          <History size={14} /> History
                        </button>
                      )}
                      {canWrite && (
                        <button onClick={() => { setDeleteTarget(s); setMenuId(null) }}
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
        <Modal title="Add Academic Session" onClose={() => { setShowCreate(false); setForm(emptyForm) }}>
          <SessionForm
            form={form} onChange={f}
            error={createMutation.error}
            isPending={createMutation.isPending}
            submitLabel="Save Session"
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}
            onCancel={() => { setShowCreate(false); setForm(emptyForm) }}
          />
        </Modal>
      )}

      {/* Edit */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <SessionForm
            form={form} onChange={f}
            error={updateMutation.error}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
            onSubmit={(e) => { e.preventDefault(); updateMutation.mutate() }}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      {/* Delete */}
      {deleteTarget && (
        <Modal title="Delete Session" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Delete <strong>{deleteTarget.name}</strong>? Active sessions cannot be deleted.
            </p>
            {deleteMutation.error && (
              <p className="text-red-600 text-sm">{(deleteMutation.error as any)?.response?.data?.error ?? 'Error deleting session.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
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

function SessionForm({
  form, onChange, error, isPending, submitLabel, onSubmit, onCancel,
}: {
  form: { name: string; year: string; term: Term; startDate: string; endDate: string; status: SessionStatus }
  onChange: (key: any) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  error: unknown
  isPending: boolean
  submitLabel: string
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Session Name">
        <input required value={form.name} onChange={onChange('name')}
          className="input" placeholder="Spring 2026" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Year">
          <input required type="number" min={2000} max={2100}
            value={form.year} onChange={onChange('year')}
            className="input" />
        </Field>
        <Field label="Term">
          <select required value={form.term} onChange={onChange('term')} className="input">
            {(['SPRING', 'SUMMER', 'FALL'] as Term[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Date">
          <input required type="date" value={form.startDate} onChange={onChange('startDate')} className="input" />
        </Field>
        <Field label="End Date">
          <input required type="date" value={form.endDate} onChange={onChange('endDate')} className="input" />
        </Field>
      </div>
      <Field label="Status">
        <select value={form.status} onChange={onChange('status')} className="input">
          {(['draft', 'active', 'completed', 'archived'] as SessionStatus[]).map((s) => (
            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </Field>
      {error && (
        <p className="text-red-600 text-sm">{(error as any)?.response?.data?.error ?? 'An error occurred.'}</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
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
