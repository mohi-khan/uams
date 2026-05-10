'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { Link2, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import {
  listClosApi, listPlosApi, listMappingsApi, createMappingApi, updateMappingApi, deleteMappingApi,
  type MappingRow,
} from '@/lib/api/obe'
import { listCoursesApi, listProgramsApi } from '@/lib/api/academic'

// ── Inline editable weight cell ───────────────────────────────────────────────

function WeightCell({
  mapping,
  canWrite,
  onSave,
  onDelete,
}: {
  mapping:  MappingRow
  canWrite: boolean
  onSave:   (id: string, weight: number) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(mapping.weight))

  function save() {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0 || n > 1) return
    onSave(mapping.id, n)
    setEditing(false)
  }

  function cancel() {
    setVal(String(mapping.weight))
    setEditing(false)
  }

  const pct = Math.round(parseFloat(mapping.weight) * 100)

  return (
    <td className="px-4 py-3 w-36">
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="number" min={0} max={1} step={0.05}
            value={val}
            onChange={e => setVal(e.target.value)}
            className="w-20 text-xs border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button onClick={save}   className="p-1 rounded hover:bg-green-50 text-green-600"><Check size={13} /></button>
          <button onClick={cancel} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={13} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-mono text-gray-700 w-8 text-right">{pct}%</span>
          {canWrite && (
            <div className="flex items-center gap-0.5">
              <button onClick={() => setEditing(true)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600"><Pencil size={12} /></button>
              <button onClick={() => onDelete(mapping.id)} className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
            </div>
          )}
        </div>
      )}
    </td>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OBEMappingPage() {
  const qc       = useQueryClient()
  const user     = useAtomValue(currentUserAtom)
  const canWrite = ['admin', 'super_admin', 'academic_coordinator'].includes(user?.role ?? '')

  const [courseId,  setCourseId]  = useState('')
  const [programId, setProgramId] = useState('')
  const [addCloId,  setAddCloId]  = useState('')
  const [addPloId,  setAddPloId]  = useState('')
  const [addWeight, setAddWeight] = useState('0.5')
  const [showAdd,   setShowAdd]   = useState(false)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)

  // All courses + programs for selectors
  const { data: coursesData } = useQuery({
    queryKey: ['courses-all'],
    queryFn:  () => listCoursesApi(1, undefined, undefined, 500),
    staleTime: 60_000,
  })

  const { data: programsData } = useQuery({
    queryKey: ['programs-all'],
    queryFn:  () => listProgramsApi(1, undefined, undefined, 500),
    staleTime: 60_000,
  })

  // CLOs for selected course
  const { data: closData } = useQuery({
    queryKey: ['clos', courseId],
    queryFn:  () => listClosApi(courseId),
    enabled:  !!courseId,
  })

  // PLOs for selected program
  const { data: plosData } = useQuery({
    queryKey: ['plos', programId],
    queryFn:  () => listPlosApi(programId),
    enabled:  !!programId,
  })

  // Fetch all mappings for the selected course in one request
  const { data: allMappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['mappings-by-course', courseId],
    queryFn:  () => listMappingsApi({ courseId }),
    enabled:  !!courseId,
  })
  //console.log('all mappings for course', allMappingsData)
  // Client-side filter by program — reactive because both queries are separate
  const ploSet = new Set(plosData?.data.map(p => p.id) ?? [])
  const mappings = (allMappingsData?.data ?? []).filter(m =>
    !programId || ploSet.has(m.ploId)
  )

  const clos = closData?.data ?? []
  const plos = plosData?.data ?? []

  // Check ALL existing pairs (not just the program-filtered view) to prevent duplicates
  const mappedPairs = new Set((allMappingsData?.data ?? []).map(m => `${m.cloId}:${m.ploId}`))

  const createMut = useMutation({
    mutationFn: () => createMappingApi({
      cloId:  addCloId,
      ploId:  addPloId,
      weight: parseFloat(addWeight),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mappings-by-course', courseId] })
      setAddCloId('')
      setAddPloId('')
      setAddWeight('0.5')
      setShowAdd(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, weight }: { id: string; weight: number }) =>
      updateMappingApi(id, { weight }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mappings', courseId, programId] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMappingApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mappings-by-course', courseId] })
      setDeleteId(null)
    },
  })

  const canAdd = !!addCloId && !!addPloId && !mappedPairs.has(`${addCloId}:${addPloId}`)

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-xl">
          <Link2 size={18} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">CLO–PLO Mapping</h1>
          <p className="text-xs text-gray-400">Map course learning outcomes to program learning outcomes with weights</p>
        </div>
        {canWrite && courseId && programId && (
          <button onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add Mapping
          </button>
        )}
      </div>

      {/* Selectors */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filter by Course & Program</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select
              value={courseId}
              onChange={e => { setCourseId(e.target.value); setAddCloId('') }}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Select course —</option>
              {coursesData?.data.map(c => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
            {courseId && (
              <p className="text-xs text-gray-400 mt-1">{clos.length} CLO{clos.length !== 1 ? 's' : ''} available</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
            <select
              value={programId}
              onChange={e => { setProgramId(e.target.value); setAddPloId('') }}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— Select program —</option>
              {programsData?.data.map(p => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
            {programId && (
              <p className="text-xs text-gray-400 mt-1">{plos.length} PLO{plos.length !== 1 ? 's' : ''} available</p>
            )}
          </div>
        </div>
      </div>

      {/* Mappings table */}
      {!courseId ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <Link2 size={28} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm text-gray-400">Select a course above to view its CLO–PLO mappings.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['CLO', 'CLO Description', 'PLO', 'PLO Description', 'Weight'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mappingsLoading && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
              )}
              {!mappingsLoading && mappings.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400">
                    <Link2 size={28} className="mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">No mappings yet{programId ? ' for this combination' : ''}.</p>
                    {canWrite && courseId && programId && (
                      <button onClick={() => setShowAdd(true)} className="mt-2 text-sm text-indigo-600 hover:underline font-medium">
                        Add first mapping
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {mappings.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 w-20">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {m.cloCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-gray-700 leading-snug line-clamp-2">{m.cloDescription}</p>
                  </td>
                  <td className="px-4 py-3 w-20">
                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      {m.ploCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-gray-700 leading-snug line-clamp-2">{m.ploDescription}</p>
                  </td>
                  <WeightCell
                    mapping={m}
                    canWrite={canWrite}
                    onSave={(id, weight) => updateMut.mutate({ id, weight })}
                    onDelete={(id) => setDeleteId(id)}
                  />
                </tr>
              ))}
            </tbody>
          </table>
          {mappings.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
              {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Add Mapping Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add CLO–PLO Mapping</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CLO <span className="text-red-500">*</span></label>
                <select
                  value={addCloId}
                  onChange={e => setAddCloId(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select CLO —</option>
                  {clos.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.description}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PLO <span className="text-red-500">*</span></label>
                <select
                  value={addPloId}
                  onChange={e => setAddPloId(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select PLO —</option>
                  {plos.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.description}</option>
                  ))}
                </select>
                {addCloId && addPloId && mappedPairs.has(`${addCloId}:${addPloId}`) && (
                  <p className="text-xs text-red-500 mt-1">This CLO–PLO pair is already mapped.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">(0 – 1)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={addWeight}
                    onChange={e => setAddWeight(e.target.value)}
                    className="flex-1 accent-indigo-600"
                  />
                  <input
                    type="number" min={0} max={1} step={0.05}
                    value={addWeight}
                    onChange={e => setAddWeight(e.target.value)}
                    className="w-20 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{Math.round(parseFloat(addWeight) * 100)}% contribution</p>
              </div>
              {createMut.error && (
                <p className="text-red-600 text-sm">{(createMut.error as any)?.response?.data?.error ?? 'Error adding mapping.'}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={!canAdd || createMut.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50">
                  {createMut.isPending ? 'Adding…' : 'Add Mapping'}
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
            <h2 className="font-semibold text-gray-900">Remove Mapping?</h2>
            <p className="text-sm text-gray-500">This CLO–PLO mapping will be permanently deleted.</p>
            {deleteMut.error && (
              <p className="text-red-600 text-sm">{(deleteMut.error as any)?.response?.data?.error ?? 'Error removing mapping.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                {deleteMut.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
