'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { ArrowLeft, Layers, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import {
  listPlosApi, createPloApi, updatePloApi, deletePloApi,
  type PloRow,
} from '@/lib/api/obe'
import { listProgramsApi } from '@/lib/api/academic'

// ── Inline editable row ───────────────────────────────────────────────────────

function PloRow_({
  plo, canWrite, onSave, onDelete,
}: {
  plo:      PloRow
  canWrite: boolean
  onSave:   (id: string, description: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [desc, setDesc]       = useState(plo.description)

  function save() {
    if (!desc.trim()) return
    onSave(plo.id, desc.trim())
    setEditing(false)
  }

  function cancel() {
    setDesc(plo.description)
    setEditing(false)
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 w-20">
        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
          {plo.code}
        </span>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <textarea
            autoFocus
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={2}
            className="w-full text-sm border border-purple-300 rounded-lg px-3 py-1.5 resize-none outline-none focus:ring-2 focus:ring-purple-100"
          />
        ) : (
          <p className="text-sm text-gray-800 leading-snug">{plo.description}</p>
        )}
      </td>
      <td className="px-4 py-3 w-24">
        {canWrite && (
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button onClick={save} className="p-1 rounded hover:bg-green-50 text-green-600"><Check size={14} /></button>
                <button onClick={cancel} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={14} /></button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-purple-600"><Pencil size={14} /></button>
                <button onClick={() => onDelete(plo.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramPLOsPage() {
  const { programId } = useParams<{ programId: string }>()
  const router        = useRouter()
  const qc            = useQueryClient()
  const user          = useAtomValue(currentUserAtom)
  const canWrite      = ['admin', 'super_admin', 'academic_coordinator'].includes(user?.role ?? '')

  const [addDesc,  setAddDesc]  = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Fetch program name
  const { data: programs } = useQuery({
    queryKey: ['programs-all'],
    queryFn:  () => listProgramsApi(1, undefined, undefined, 500),
    staleTime: 60_000,
  })
  const program = programs?.data.find(p => p.id === programId)

  const { data, isLoading } = useQuery({
    queryKey: ['plos', programId],
    queryFn:  () => listPlosApi(programId),
  })

  const plos = data?.data ?? []

  const createMut = useMutation({
    mutationFn: () => createPloApi({ programId, description: addDesc.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plos', programId] })
      setAddDesc('')
      setShowAdd(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      updatePloApi(id, { description }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plos', programId] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePloApi(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plos', programId] }); setDeleteId(null) },
  })

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/programs')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="p-2 bg-purple-100 rounded-xl">
          <Layers size={18} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Program Learning Outcomes{program ? ` — ${program.code}` : ''}
          </h1>
          {program && <p className="text-xs text-gray-400">{program.name}</p>}
        </div>
        {canWrite && (
          <button onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add PLO
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Code', 'Description', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={3} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>}
            {!isLoading && plos.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-16 text-gray-400">
                  <Layers size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">No PLOs defined yet.</p>
                  {canWrite && (
                    <button onClick={() => setShowAdd(true)} className="mt-2 text-sm text-purple-600 hover:underline font-medium">
                      Add first PLO
                    </button>
                  )}
                </td>
              </tr>
            )}
            {plos.map(plo => (
              <PloRow_ key={plo.id} plo={plo} canWrite={canWrite}
                onSave={(id, description) => updateMut.mutate({ id, description })}
                onDelete={(id) => setDeleteId(id)}
              />
            ))}
          </tbody>
        </table>
        {plos.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {plos.length} outcome{plos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Add PLO modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Program Learning Outcome</h2>
              <button onClick={() => { setShowAdd(false); setAddDesc('') }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <textarea
                  autoFocus
                  value={addDesc}
                  onChange={e => setAddDesc(e.target.value)}
                  rows={3}
                  placeholder="Graduates will be able to…"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              {createMut.error && (
                <p className="text-red-600 text-sm">{(createMut.error as any)?.response?.data?.error ?? 'Error adding PLO.'}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setShowAdd(false); setAddDesc('') }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button onClick={() => createMut.mutate()}
                  disabled={!addDesc.trim() || createMut.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50">
                  {createMut.isPending ? 'Adding…' : 'Add PLO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Delete PLO?</h2>
            <p className="text-sm text-gray-500">This will also remove any CLO–PLO mappings linked to it.</p>
            {deleteMut.error && (
              <p className="text-red-600 text-sm">{(deleteMut.error as any)?.response?.data?.error ?? 'Error deleting PLO.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
