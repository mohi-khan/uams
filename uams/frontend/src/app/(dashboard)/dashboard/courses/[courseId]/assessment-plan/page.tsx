'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import {
  ArrowLeft, ClipboardList, Plus, Pencil, Trash2, X, Check,
  CheckCircle, Star, Lock, Link2, ChevronDown, ChevronRight, Copy,
} from 'lucide-react'
import {
  listPlansApi, createPlanApi, copyPlanApi, getPlanApi,
  finalizePlanApi, setDefaultPlanApi, deletePlanApi,
  createComponentApi, updateComponentApi, deleteComponentApi,
  addCloLinkApi, removeCloLinkApi,
  COMPONENT_TYPE_LABELS, COMPONENT_TYPE_COLORS,
  type AssessmentPlanRow, type AssessmentComponentRow, type AssessmentComponentType,
} from '@/lib/api/assessment'
import { listClosApi } from '@/lib/api/obe'
import { getCourseByIdApi } from '@/lib/api/academic'
import { listSessionsApi } from '@/lib/api/sessions'

const COMPONENT_TYPES: AssessmentComponentType[] = [
  'quiz', 'assignment', 'midterm', 'final', 'lab', 'project', 'presentation', 'other',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'final' }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
      status === 'final' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
    }`}>{status}</span>
  )
}

function WeightBar({ total }: { total: number }) {
  const pct   = Math.min(total, 100)
  const exact = Math.abs(total - 100) < 0.01
  const over  = total > 100.01
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            over ? 'bg-red-500' : exact ? 'bg-green-500' : 'bg-amber-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold w-14 text-right ${
        over ? 'text-red-600' : exact ? 'text-green-600' : 'text-amber-600'
      }`}>
        {total.toFixed(1)}%
      </span>
      {exact && <CheckCircle size={13} className="text-green-500 shrink-0" />}
    </div>
  )
}

// ── Inline-editable Component Row ─────────────────────────────────────────────

function ComponentRow({
  component,
  planId,
  canWrite,
  readOnly,
  courseId,
  onUpdated,
  onDeleted,
}: {
  component: AssessmentComponentRow
  planId:    string
  canWrite:  boolean
  readOnly:  boolean
  courseId:  string
  onUpdated: () => void
  onDeleted: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing]         = useState(false)
  const [expanded, setExpanded]       = useState(false)
  const [showAddClo, setShowAddClo]   = useState(false)
  const [addCloId, setAddCloId]       = useState('')
  const [addCloWeight, setAddCloWeight] = useState('100')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const [form, setForm] = useState({
    name:             component.name,
    componentType:    component.componentType,
    weightPercentage: String(component.weightPercentage),
    totalMarks:       String(component.totalMarks),
    assessmentCount:  String(component.assessmentCount),
    cloMapped:        component.cloMapped,
  })

  const { data: closData } = useQuery({
    queryKey: ['clos', courseId],
    queryFn:  () => listClosApi(courseId),
    staleTime: 60_000,
    enabled:  showAddClo,
  })

  const linkedCloIds = new Set(component.cloLinks.map(l => l.cloId))
  const availableClos = (closData?.data ?? []).filter(c => !linkedCloIds.has(c.id))

  const updateMut = useMutation({
    mutationFn: () => updateComponentApi(planId, component.id, {
      name:             form.name,
      componentType:    form.componentType as AssessmentComponentType,
      weightPercentage: parseFloat(form.weightPercentage),
      totalMarks:       parseInt(form.totalMarks),
      assessmentCount:  parseInt(form.assessmentCount),
      cloMapped:        form.cloMapped,
    }),
    onSuccess: () => { onUpdated(); setEditing(false) },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteComponentApi(planId, component.id),
    onSuccess: () => onDeleted(),
  })

  const addCloMut = useMutation({
    mutationFn: () => addCloLinkApi(planId, component.id, {
      cloId:  addCloId,
      weight: parseFloat(addCloWeight),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessment-plan', planId] })
      setAddCloId('')
      setAddCloWeight('100')
      setShowAddClo(false)
    },
  })

  const removeCloMut = useMutation({
    mutationFn: (linkId: string) => removeCloLinkApi(planId, component.id, linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-plan', planId] }),
  })

  const weight = parseFloat(component.weightPercentage)

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        {/* Expand toggle */}
        <td className="px-3 py-3 w-8">
          {component.cloMapped && (
            <button onClick={() => setExpanded(e => !e)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
        </td>

        {/* Name */}
        <td className="px-3 py-3">
          {editing ? (
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full text-sm border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100"
            />
          ) : (
            <span className="text-sm font-medium text-gray-900">{component.name}</span>
          )}
        </td>

        {/* Type */}
        <td className="px-3 py-3 w-36">
          {editing ? (
            <select
              value={form.componentType}
              onChange={e => setForm(f => ({ ...f, componentType: e.target.value as AssessmentComponentType }))}
              className="text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300 w-full"
            >
              {COMPONENT_TYPES.map(t => <option key={t} value={t}>{COMPONENT_TYPE_LABELS[t]}</option>)}
            </select>
          ) : (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COMPONENT_TYPE_COLORS[component.componentType]}`}>
              {COMPONENT_TYPE_LABELS[component.componentType]}
            </span>
          )}
        </td>

        {/* Weight % */}
        <td className="px-3 py-3 w-28">
          {editing ? (
            <input
              type="number" min={0.01} max={100} step={0.5}
              value={form.weightPercentage}
              onChange={e => setForm(f => ({ ...f, weightPercentage: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
            />
          ) : (
            <span className="text-sm font-mono font-semibold text-gray-700">{weight.toFixed(1)}%</span>
          )}
        </td>

        {/* Marks */}
        <td className="px-3 py-3 w-20 text-center">
          {editing ? (
            <input
              type="number" min={1}
              value={form.totalMarks}
              onChange={e => setForm(f => ({ ...f, totalMarks: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
            />
          ) : (
            <span className="text-sm text-gray-600">{component.totalMarks}</span>
          )}
        </td>

        {/* Count */}
        <td className="px-3 py-3 w-16 text-center">
          {editing ? (
            <input
              type="number" min={1}
              value={form.assessmentCount}
              onChange={e => setForm(f => ({ ...f, assessmentCount: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300"
            />
          ) : (
            <span className="text-sm text-gray-600">×{component.assessmentCount}</span>
          )}
        </td>

        {/* CLO Mapped */}
        <td className="px-3 py-3 w-24 text-center">
          {editing ? (
            <input type="checkbox" checked={form.cloMapped}
              onChange={e => setForm(f => ({ ...f, cloMapped: e.target.checked }))}
              className="accent-indigo-600"
            />
          ) : component.cloMapped ? (
            <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium">
              <Link2 size={11} /> {component.cloLinks.length}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 w-20">
          {canWrite && !readOnly && (
            <div className="flex items-center gap-0.5">
              {editing ? (
                <>
                  <button
                    onClick={() => updateMut.mutate()}
                    disabled={updateMut.isPending}
                    className="p-1 rounded hover:bg-green-50 text-green-600"
                    title="Save"
                  >
                    {updateMut.isPending ? <span className="text-xs">…</span> : <Check size={13} />}
                  </button>
                  <button onClick={() => { setEditing(false); setForm({ name: component.name, componentType: component.componentType, weightPercentage: String(component.weightPercentage), totalMarks: String(component.totalMarks), assessmentCount: String(component.assessmentCount), cloMapped: component.cloMapped }) }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={13} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600" title="Edit"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteConfirm(true)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Error row */}
      {(updateMut.error || deleteMut.error) && (
        <tr>
          <td colSpan={8} className="px-4 pb-2">
            <p className="text-xs text-red-600">
              {((updateMut.error || deleteMut.error) as any)?.response?.data?.error ?? 'An error occurred.'}
            </p>
          </td>
        </tr>
      )}

      {/* CLO Links sub-row */}
      {expanded && component.cloMapped && (
        <tr>
          <td colSpan={8} className="bg-indigo-50/30 px-0 py-0 border-b border-indigo-100">
            <div className="px-10 py-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">CLO Links</p>

              {component.cloLinks.length === 0 && (
                <p className="text-xs text-gray-400">No CLOs linked yet.</p>
              )}

              {component.cloLinks.map(link => (
                <div key={link.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm">
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{link.cloCode}</span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{link.cloDesc}</span>
                  <span className="text-xs font-mono text-gray-500 w-12 text-right">{parseFloat(link.weight).toFixed(0)}%</span>
                  {canWrite && !readOnly && (
                    <button onClick={() => removeCloMut.mutate(link.id)} disabled={removeCloMut.isPending}
                      className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}

              {/* Add CLO link inline */}
              {canWrite && !readOnly && !showAddClo && (
                <button onClick={() => setShowAddClo(true)}
                  className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1 mt-1">
                  <Plus size={11} /> Link a CLO
                </button>
              )}

              {showAddClo && (
                <div className="flex items-center gap-2 mt-2">
                  <select
                    value={addCloId}
                    onChange={e => setAddCloId(e.target.value)}
                    className="text-xs border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-300 flex-1"
                  >
                    <option value="">— Select CLO —</option>
                    {availableClos.map(c => (
                      <option key={c.id} value={c.id}>{c.code} — {c.description}</option>
                    ))}
                  </select>
                  <input
                    type="number" min={1} max={100} placeholder="Weight %"
                    value={addCloWeight}
                    onChange={e => setAddCloWeight(e.target.value)}
                    className="w-20 text-xs border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                  <button
                    onClick={() => addCloMut.mutate()}
                    disabled={!addCloId || addCloMut.isPending}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {addCloMut.isPending ? '…' : 'Add'}
                  </button>
                  <button onClick={() => setShowAddClo(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={13} /></button>
                </div>
              )}
              {addCloMut.error && (
                <p className="text-xs text-red-600">{(addCloMut.error as any)?.response?.data?.error ?? 'Error linking CLO.'}</p>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <tr>
          <td colSpan={8}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-semibold text-gray-900">Delete Component?</h2>
                <p className="text-sm text-gray-500">
                  <strong>{component.name}</strong> and its CLO links will be removed from this plan.
                </p>
                {deleteMut.error && (
                  <p className="text-xs text-red-600">{(deleteMut.error as any)?.response?.data?.error ?? 'Error deleting.'}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                    className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                    {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Assessment Plan Panel ─────────────────────────────────────────────────────

function PlanPanel({
  planId,
  courseId,
  canWrite,
}: {
  planId:   string
  courseId: string
  canWrite: boolean
}) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState({
    name:             '',
    componentType:    'quiz' as AssessmentComponentType,
    weightPercentage: '',
    totalMarks:       '100',
    assessmentCount:  '1',
    cloMapped:        false,
  })

  const { data: plan, isLoading } = useQuery({
    queryKey: ['assessment-plan', planId],
    queryFn:  () => getPlanApi(planId),
  })

  const createMut = useMutation({
    mutationFn: () => createComponentApi(planId, {
      name:             addForm.name,
      componentType:    addForm.componentType,
      weightPercentage: parseFloat(addForm.weightPercentage),
      totalMarks:       parseInt(addForm.totalMarks) || 100,
      assessmentCount:  parseInt(addForm.assessmentCount) || 1,
      cloMapped:        addForm.cloMapped,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessment-plan', planId] })
      setShowAdd(false)
      setAddForm({ name: '', componentType: 'quiz', weightPercentage: '', totalMarks: '100', assessmentCount: '1', cloMapped: false })
    },
  })

  const finalizeMut = useMutation({
    mutationFn: () => finalizePlanApi(planId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-plan', planId] }),
  })

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-20">Loading…</div>
  if (!plan)     return <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-20">Plan not found.</div>

  const readOnly    = plan.status === 'final'
  const components  = plan.components ?? []
  const totalWeight = components.reduce((s, c) => s + parseFloat(c.weightPercentage), 0)
  const weightOk    = Math.abs(totalWeight - 100) < 0.01
  const remaining   = 100 - totalWeight

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">{plan.version}</span>
          <StatusBadge status={plan.status} />
          {plan.isDefault && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
              <Star size={10} /> Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canWrite && !readOnly && (
            <>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={13} /> Add Component
              </button>
              <button
                onClick={() => finalizeMut.mutate()}
                disabled={!weightOk || finalizeMut.isPending}
                title={!weightOk ? `Total weight must be 100% (currently ${totalWeight.toFixed(1)}%)` : undefined}
                className="flex items-center gap-1 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Lock size={13} /> {finalizeMut.isPending ? 'Finalizing…' : 'Finalize'}
              </button>
            </>
          )}
          {readOnly && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Lock size={12} /> Finalized — read only
            </div>
          )}
        </div>
      </div>

      {finalizeMut.error && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-600">{(finalizeMut.error as any)?.response?.data?.error ?? 'Error finalizing plan.'}</p>
        </div>
      )}

      {/* Weight progress */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 max-w-sm">
          <span className="text-xs text-gray-500 w-24 shrink-0">Total Weight</span>
          <WeightBar total={totalWeight} />
        </div>
        {!weightOk && components.length > 0 && (
          <p className="text-xs text-amber-600 mt-1">
            {remaining > 0 ? `${remaining.toFixed(1)}% remaining to reach 100%` : `${Math.abs(remaining).toFixed(1)}% over budget`}
          </p>
        )}
      </div>

      {/* Components table */}
      {components.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-400">
          <ClipboardList size={32} className="mb-3 text-gray-200" />
          <p className="text-sm">No components yet.</p>
          {canWrite && !readOnly && (
            <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-600 hover:underline font-medium">
              Add first component
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                <th className="w-8 px-3 py-2" />
                {['Name', 'Type', 'Weight', 'Marks', 'Count', 'CLOs', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {components.map(c => (
                <ComponentRow
                  key={c.id}
                  component={c}
                  planId={planId}
                  canWrite={canWrite}
                  readOnly={readOnly}
                  courseId={courseId}
                  onUpdated={() => qc.invalidateQueries({ queryKey: ['assessment-plan', planId] })}
                  onDeleted={() => qc.invalidateQueries({ queryKey: ['assessment-plan', planId] })}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {components.length} component{components.length !== 1 ? 's' : ''} · total weight {totalWeight.toFixed(1)}%
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Assessment Component</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    autoFocus
                    value={addForm.name}
                    onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Quiz 1, Mid-Term…"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select
                    value={addForm.componentType}
                    onChange={e => setAddForm(f => ({ ...f, componentType: e.target.value as AssessmentComponentType }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {COMPONENT_TYPES.map(t => <option key={t} value={t}>{COMPONENT_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight % <span className="text-red-500">*</span>
                    {remaining > 0 && <span className="text-gray-400 font-normal ml-1">(max {remaining.toFixed(1)}%)</span>}
                  </label>
                  <input
                    type="number" min={0.01} max={remaining > 0 ? remaining : 100} step={0.5}
                    value={addForm.weightPercentage}
                    onChange={e => setAddForm(f => ({ ...f, weightPercentage: e.target.value }))}
                    placeholder="e.g. 20"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
                  <input
                    type="number" min={1}
                    value={addForm.totalMarks}
                    onChange={e => setAddForm(f => ({ ...f, totalMarks: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
                  <input
                    type="number" min={1}
                    value={addForm.assessmentCount}
                    onChange={e => setAddForm(f => ({ ...f, assessmentCount: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.cloMapped}
                  onChange={e => setAddForm(f => ({ ...f, cloMapped: e.target.checked }))}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-gray-700">Map to CLOs</span>
              </label>
              {createMut.error && (
                <p className="text-sm text-red-600">{(createMut.error as any)?.response?.data?.error ?? 'Error adding component.'}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={!addForm.name.trim() || !addForm.weightPercentage || createMut.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                >
                  {createMut.isPending ? 'Adding…' : 'Add Component'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssessmentPlanPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const router       = useRouter()
  const qc           = useQueryClient()
  const user         = useAtomValue(currentUserAtom)
  const canWrite     = ['admin', 'super_admin', 'academic_coordinator'].includes(user?.role ?? '')

  const [sessionId,           setSessionId]           = useState('')
  const [planId,              setPlanId]              = useState<string | null>(null)
  const [deleteId,            setDeleteId]            = useState<string | null>(null)
  const [showCopyPanel,       setShowCopyPanel]       = useState(false)
  const [copySourceSessionId, setCopySourceSessionId] = useState('')

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn:  () => getCourseByIdApi(courseId),
    staleTime: 60_000,
  })

  const { data: sessions } = useQuery({
    queryKey: ['sessions-all'],
    queryFn:  () => listSessionsApi(1, undefined, 200),
    staleTime: 60_000,
  })

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['assessment-plans', courseId, sessionId],
    queryFn:  () => listPlansApi(courseId, sessionId || undefined),
    enabled:  !!sessionId,
  })
  const plans = plansData?.data ?? []

  // All plans for this course (no session filter) — used to know which sessions have plans
  const { data: allCoursePlansData } = useQuery({
    queryKey: ['assessment-plans-all', courseId],
    queryFn:  () => listPlansApi(courseId),
    staleTime: 60_000,
  })

  // Sessions that have at least one final plan, excluding the currently selected session
  const sessionIdsWithPlans = new Set(
    (allCoursePlansData?.data ?? [])
      .filter(p => p.academicSessionId !== sessionId)
      .map(p => p.academicSessionId)
  )
  const sessionsWithPlans = (sessions?.data ?? []).filter(s => sessionIdsWithPlans.has(s.id))

  // Auto-select first plan when list loads
  const activePlan = plans.find(p => p.id === planId) ?? plans[0] ?? null

  const createPlanMut = useMutation({
    mutationFn: () => createPlanMutFn(),
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: ['assessment-plans', courseId, sessionId] })
      qc.invalidateQueries({ queryKey: ['assessment-plans-all', courseId] })
      setPlanId(plan.id)
    },
  })

  async function createPlanMutFn(): Promise<AssessmentPlanRow> {
    return createPlanApi({ courseId, academicSessionId: sessionId })
  }

  const copyMut = useMutation({
    mutationFn: (sourceSessionId: string) => copyPlanApi({ courseId, sourceSessionId, targetSessionId: sessionId }),
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: ['assessment-plans', courseId, sessionId] })
      qc.invalidateQueries({ queryKey: ['assessment-plans-all', courseId] })
      setPlanId(plan.id)
      setShowCopyPanel(false)
      setCopySourceSessionId('')
    },
  })

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => setDefaultPlanApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-plans', courseId, sessionId] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePlanApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessment-plans', courseId, sessionId] })
      if (planId === deleteId) setPlanId(null)
      setDeleteId(null)
    },
  })

  const selectedPlanId = activePlan?.id ?? null

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/courses')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="p-2 bg-indigo-100 rounded-xl">
          <ClipboardList size={18} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Assessment Plan{course ? ` — ${course.code}` : ''}
          </h1>
          {course && <p className="text-xs text-gray-400">{course.title}</p>}
        </div>
      </div>

      {/* Session selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 shrink-0">Academic Session</label>
          <select
            value={sessionId}
            onChange={e => { setSessionId(e.target.value); setPlanId(null); setShowCopyPanel(false); setCopySourceSessionId('') }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          >
            <option value="">— Select session —</option>
            {sessions?.data.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.year} {s.term})</option>
            ))}
          </select>
        </div>
      </div>

      {!sessionId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center text-gray-400">
          <ClipboardList size={32} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm">Select an academic session above to manage assessment plans.</p>
        </div>
      )}

      {/* Empty state — no plans yet for this session */}
      {sessionId && !plansLoading && plans.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 px-8">
          <div className="max-w-lg mx-auto text-center mb-8">
            <div className="p-3 bg-indigo-50 rounded-2xl inline-block mb-4">
              <ClipboardList size={28} className="text-indigo-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">No assessment plan yet</h2>
            <p className="text-sm text-gray-400">
              Create a new plan from scratch, or copy the component structure from a previous session.
            </p>
          </div>

          {canWrite && (
            <div className="max-w-lg mx-auto grid grid-cols-2 gap-4">
              {/* Create from scratch */}
              <button
                onClick={() => createPlanMut.mutate()}
                disabled={createPlanMut.isPending}
                className="flex flex-col items-center gap-3 border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-2xl p-6 transition-all group disabled:opacity-50"
              >
                <div className="p-2.5 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                  <Plus size={22} className="text-indigo-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-800 text-sm">Create from scratch</p>
                  <p className="text-xs text-gray-400 mt-0.5">Start with an empty plan</p>
                </div>
                {createPlanMut.isPending && <span className="text-xs text-indigo-500">Creating…</span>}
              </button>

              {/* Copy from previous session */}
              <div
                className={`border-2 rounded-2xl p-6 transition-all ${
                  sessionsWithPlans.length === 0
                    ? 'border-dashed border-gray-100 opacity-40 cursor-not-allowed'
                    : showCopyPanel
                      ? 'border-indigo-300 bg-indigo-50/30'
                      : 'border-dashed border-gray-200 hover:border-teal-300 hover:bg-teal-50/20 cursor-pointer'
                }`}
                onClick={() => sessionsWithPlans.length > 0 && !showCopyPanel && setShowCopyPanel(true)}
              >
                {!showCopyPanel ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-2.5 bg-teal-100 rounded-xl">
                      <Copy size={22} className="text-teal-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-800 text-sm">Copy from session</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {sessionsWithPlans.length === 0
                          ? 'No previous sessions with plans'
                          : `${sessionsWithPlans.length} session${sessionsWithPlans.length !== 1 ? 's' : ''} available`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3" onClick={e => e.stopPropagation()}>
                    <p className="text-sm font-semibold text-gray-800">Choose source session</p>
                    <select
                      value={copySourceSessionId}
                      onChange={e => setCopySourceSessionId(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Select session —</option>
                      {sessionsWithPlans.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.year} {s.term})</option>
                      ))}
                    </select>
                    {copyMut.error && (
                      <p className="text-xs text-red-600">{(copyMut.error as any)?.response?.data?.error ?? 'Copy failed.'}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyMut.mutate(copySourceSessionId)}
                        disabled={!copySourceSessionId || copyMut.isPending}
                        className="flex-1 py-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                      >
                        {copyMut.isPending ? 'Copying…' : 'Copy Plan'}
                      </button>
                      <button
                        onClick={() => { setShowCopyPanel(false); setCopySourceSessionId('') }}
                        className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {createPlanMut.error && (
            <p className="text-sm text-red-600 text-center mt-4">
              {(createPlanMut.error as any)?.response?.data?.error ?? 'Error creating plan.'}
            </p>
          )}
        </div>
      )}

      {/* Sidebar + panel — shown once plans exist */}
      {sessionId && (plansLoading || plans.length > 0) && (
        <div className="flex gap-4 min-h-[500px]">
          {/* Sidebar — version list */}
          <div className="w-52 shrink-0 space-y-2">
            {canWrite && (
              <button
                onClick={() => createPlanMut.mutate()}
                disabled={createPlanMut.isPending}
                className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 hover:border-indigo-300 text-gray-400 hover:text-indigo-600 text-sm font-medium py-2 rounded-xl transition-colors"
              >
                <Plus size={14} />
                {createPlanMut.isPending ? 'Creating…' : 'New Version'}
              </button>
            )}
            {createPlanMut.error && (
              <p className="text-xs text-red-600 px-1">{(createPlanMut.error as any)?.response?.data?.error ?? 'Error creating plan.'}</p>
            )}

            {plansLoading && <p className="text-xs text-gray-400 text-center py-4">Loading…</p>}

            {plans.map(plan => (
              <div
                key={plan.id}
                onClick={() => setPlanId(plan.id)}
                className={`rounded-xl border px-3 py-3 cursor-pointer transition-all space-y-2 ${
                  selectedPlanId === plan.id
                    ? 'border-indigo-300 bg-indigo-50/60 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">{plan.version}</span>
                  <StatusBadge status={plan.status} />
                </div>
                {plan.isDefault && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <Star size={10} /> Default
                  </div>
                )}
                {canWrite && (
                  <div className="flex gap-1 pt-1">
                    {plan.status === 'final' && !plan.isDefault && (
                      <button
                        onClick={e => { e.stopPropagation(); setDefaultMut.mutate(plan.id) }}
                        disabled={setDefaultMut.isPending}
                        className="text-xs text-amber-600 hover:underline"
                      >
                        Set default
                      </button>
                    )}
                    {plan.status === 'draft' && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteId(plan.id) }}
                        className="text-xs text-red-500 hover:underline ml-auto"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            {selectedPlanId ? (
              <PlanPanel
                key={selectedPlanId}
                planId={selectedPlanId}
                courseId={courseId}
                canWrite={canWrite}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Select a version on the left.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete plan confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Delete Draft Plan?</h2>
            <p className="text-sm text-gray-500">
              This version and all its components will be permanently removed.
            </p>
            {deleteMut.error && (
              <p className="text-sm text-red-600">{(deleteMut.error as any)?.response?.data?.error ?? 'Error deleting plan.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
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
