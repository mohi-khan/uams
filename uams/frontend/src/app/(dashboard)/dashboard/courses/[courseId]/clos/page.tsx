'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { ArrowLeft, Target, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import {
  listClosApi, createCloApi, updateCloApi, deleteCloApi,
  BLOOMS_LABELS, BLOOMS_COLORS,
  type CloRow, type BloomsLevel,
} from '@/lib/api/obe'
import { getCourseByIdApi } from '@/lib/api/academic'

const BLOOMS_OPTIONS: BloomsLevel[] = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']

// ── Inline editable row ───────────────────────────────────────────────────────

function CloRow_({
  clo, canWrite, onSave, onDelete,
}: {
  clo:      CloRow
  canWrite: boolean
  onSave:   (id: string, description: string, bloomsLevel: BloomsLevel | null) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing]       = useState(false)
  const [desc, setDesc]             = useState(clo.description)
  const [blooms, setBlooms]         = useState<BloomsLevel | ''>(clo.bloomsLevel ?? '')

  function save() {
    if (!desc.trim()) return
    onSave(clo.id, desc.trim(), (blooms as BloomsLevel) || null)
    setEditing(false)
  }

  function cancel() {
    setDesc(clo.description)
    setBlooms(clo.bloomsLevel ?? '')
    setEditing(false)
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Code */}
      <td className="px-4 py-3 w-20">
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
          {clo.code}
        </span>
      </td>

      {/* Description */}
      <td className="px-4 py-3">
        {editing ? (
          <textarea
            autoFocus
            value={desc}
            onChange={e => setDesc(e.target.value)}
            rows={2}
            className="w-full text-sm border border-indigo-300 rounded-lg px-3 py-1.5 resize-none outline-none focus:ring-2 focus:ring-indigo-100"
          />
        ) : (
          <p className="text-sm text-gray-800 leading-snug">{clo.description}</p>
        )}
      </td>

      {/* Bloom's Level */}
      <td className="px-4 py-3 w-40">
        {editing ? (
          <select
            value={blooms}
            onChange={e => setBlooms(e.target.value as BloomsLevel)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-100 w-full"
          >
            <option value="">— None —</option>
            {BLOOMS_OPTIONS.map(b => (
              <option key={b} value={b}>{BLOOMS_LABELS[b]}</option>
            ))}
          </select>
        ) : clo.bloomsLevel ? (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${BLOOMS_COLORS[clo.bloomsLevel]}`}>
            {BLOOMS_LABELS[clo.bloomsLevel]}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-24">
        {canWrite && (
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button onClick={save} className="p-1 rounded hover:bg-green-50 text-green-600" title="Save">
                  <Check size={14} />
                </button>
                <button onClick={cancel} className="p-1 rounded hover:bg-gray-100 text-gray-400" title="Cancel">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600" title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(clo.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CourseCLOsPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const router       = useRouter()
  const qc           = useQueryClient()
  const user         = useAtomValue(currentUserAtom)
  const canWrite     = ['admin', 'super_admin', 'academic_coordinator'].includes(user?.role ?? '')

  const [addDesc,    setAddDesc]    = useState('')
  const [addBlooms,  setAddBlooms]  = useState<BloomsLevel | ''>('')
  const [showAdd,    setShowAdd]    = useState(false)
  const [deleteId,   setDeleteId]   = useState<string | null>(null)

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn:  () => getCourseByIdApi(courseId),
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['clos', courseId],
    queryFn:  () => listClosApi(courseId),
  })

  const clos = data?.data ?? []

  const createMut = useMutation({
    mutationFn: () => createCloApi({
      courseId,
      description: addDesc.trim(),
      bloomsLevel: (addBlooms as BloomsLevel) || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clos', courseId] })
      setAddDesc('')
      setAddBlooms('')
      setShowAdd(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, description, bloomsLevel }: { id: string; description: string; bloomsLevel: BloomsLevel | null }) =>
      updateCloApi(id, { description, bloomsLevel }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clos', courseId] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCloApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clos', courseId] })
      setDeleteId(null)
    },
  })

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/courses')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="p-2 bg-indigo-100 rounded-xl">
          <Target size={18} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Course Learning Outcomes{course ? ` — ${course.code}` : ''}
          </h1>
          {course && <p className="text-xs text-gray-400">{course.title}</p>}
        </div>
        {canWrite && (
          <button onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add CLO
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Code', 'Description', "Bloom's Level", ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            )}
            {!isLoading && clos.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-16 text-gray-400">
                  <Target size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">No CLOs defined yet.</p>
                  {canWrite && (
                    <button onClick={() => setShowAdd(true)} className="mt-2 text-sm text-indigo-600 hover:underline font-medium">
                      Add first CLO
                    </button>
                  )}
                </td>
              </tr>
            )}
            {clos.map(clo => (
              <CloRow_
                key={clo.id}
                clo={clo}
                canWrite={canWrite}
                onSave={(id, description, bloomsLevel) => updateMut.mutate({ id, description, bloomsLevel })}
                onDelete={(id) => setDeleteId(id)}
              />
            ))}
          </tbody>
        </table>

        {clos.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {clos.length} outcome{clos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Add CLO form */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Course Learning Outcome</h2>
              <button onClick={() => { setShowAdd(false); setAddDesc(''); setAddBlooms('') }}
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
                  placeholder="Students will be able to…"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bloom's Taxonomy Level <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  value={addBlooms}
                  onChange={e => setAddBlooms(e.target.value as BloomsLevel)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select level —</option>
                  {BLOOMS_OPTIONS.map(b => (
                    <option key={b} value={b}>{BLOOMS_LABELS[b]}</option>
                  ))}
                </select>
              </div>
              {createMut.error && (
                <p className="text-red-600 text-sm">{(createMut.error as any)?.response?.data?.error ?? 'Error adding CLO.'}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setShowAdd(false); setAddDesc(''); setAddBlooms('') }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={!addDesc.trim() || createMut.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">
                  {createMut.isPending ? 'Adding…' : 'Add CLO'}
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
            <h2 className="font-semibold text-gray-900">Delete CLO?</h2>
            <p className="text-sm text-gray-500">This will also remove any CLO–PLO mappings linked to it.</p>
            {deleteMut.error && (
              <p className="text-red-600 text-sm">{(deleteMut.error as any)?.response?.data?.error ?? 'Error deleting CLO.'}</p>
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
