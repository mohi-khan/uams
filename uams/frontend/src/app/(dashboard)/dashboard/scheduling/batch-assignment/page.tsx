'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, CheckSquare, Square, ChevronDown, Save, X } from 'lucide-react'
import { listSemesterOfferingsApi } from '@/lib/api/scheduling'
import { listBatchesApi } from '@/lib/api/batches'
import {
  getEnrollmentsBySemesterOfferingApi,
  bulkAssignBatchApi,
  type SemesterOfferingEnrollmentRow,
} from '@/lib/api/enrollments'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RowState {
  enrollmentId: string
  studentId:    string
  studentCode:  string
  studentName:  string
  studentPhoto: string | null
  status:       string
  batchId:      string | null   // current committed value
  pendingBatchId: string | null // local edit before save
  dirty:        boolean
}

// ── Batch Select Cell ─────────────────────────────────────────────────────────

function BatchCell({
  row,
  batches,
  onChange,
}: {
  row: RowState
  batches: { id: string; name: string; code: string }[]
  onChange: (batchId: string | null) => void
}) {
  return (
    <div className="relative">
      <select
        value={row.pendingBatchId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`w-full text-sm border rounded-lg px-3 py-1.5 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          row.dirty ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
        }`}
      >
        <option value="">— Unassigned —</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BatchAssignmentPage() {
  const qc = useQueryClient()

  const [selectedSemOffId, setSelectedSemOffId] = useState<string>('')
  const [rows, setRows]                         = useState<RowState[]>([])
  const [selected, setSelected]                 = useState<Set<string>>(new Set())
  const [bulkBatchId, setBulkBatchId]           = useState<string>('')
  const [showBulkPanel, setShowBulkPanel]       = useState(false)

  // ── Semester Offerings ────────────────────────────────────────────────────

  const { data: semOffData } = useQuery({
    queryKey: ['semesterOfferings', 'all'],
    queryFn:  () => listSemesterOfferingsApi({ limit: 200 }),
  })
  const semOfferings = semOffData?.data ?? []

  // ── Enrollments for selected semester offering ────────────────────────────

  const { data: enrollmentData, isFetching: loadingEnrollments } = useQuery({
    queryKey: ['enrollmentsBySemOff', selectedSemOffId],
    queryFn:  () => getEnrollmentsBySemesterOfferingApi(selectedSemOffId),
    enabled:  !!selectedSemOffId,
  })

  const programId = enrollmentData?.programId ?? ''

  // When data arrives, rebuild local row state
  const syncRows = (data: SemesterOfferingEnrollmentRow[]) => {
    setRows(data.map((r) => ({
      enrollmentId:   r.id,
      studentId:      r.studentId,
      studentCode:    r.studentCode,
      studentName:    r.studentName,
      studentPhoto:   r.studentPhoto,
      status:         r.status,
      batchId:        r.batchId,
      pendingBatchId: r.batchId,
      dirty:          false,
    })))
    setSelected(new Set())
    setShowBulkPanel(false)
  }

  // Sync whenever the query result changes
  useMemo(() => {
    if (enrollmentData?.data) syncRows(enrollmentData.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentData])

  // ── Batches for the selected program ─────────────────────────────────────

  const { data: batchData } = useQuery({
    queryKey: ['batches', programId],
    queryFn:  () => listBatchesApi(1, programId, undefined, 200),
    enabled:  !!programId,
  })
  const batches = (batchData?.data ?? []).map((b) => ({ id: b.id, name: b.name, code: b.code }))

  // ── Local row mutations ───────────────────────────────────────────────────

  const updateRowBatch = (enrollmentId: string, batchId: string | null) => {
    setRows((prev) =>
      prev.map((r) =>
        r.enrollmentId === enrollmentId
          ? { ...r, pendingBatchId: batchId, dirty: batchId !== r.batchId }
          : r
      )
    )
  }

  const applyBulkBatch = () => {
    const bid = bulkBatchId || null
    setRows((prev) =>
      prev.map((r) =>
        selected.has(r.enrollmentId)
          ? { ...r, pendingBatchId: bid, dirty: bid !== r.batchId }
          : r
      )
    )
    setShowBulkPanel(false)
    setBulkBatchId('')
  }

  // ── Checkbox helpers ──────────────────────────────────────────────────────

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map((r) => r.enrollmentId)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Save mutation ─────────────────────────────────────────────────────────

  const dirtyRows = rows.filter((r) => r.dirty)

  const saveMut = useMutation({
    mutationFn: async () => {
      // Group dirty rows by their pendingBatchId for efficient bulk calls
      const groups = new Map<string | null, string[]>()
      for (const r of dirtyRows) {
        const key = r.pendingBatchId ?? null
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(r.enrollmentId)
      }
      for (const [batchId, enrollmentIds] of groups) {
        await bulkAssignBatchApi({ enrollmentIds, batchId })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollmentsBySemOff', selectedSemOffId] })
    },
  })

  // ── Derived state ─────────────────────────────────────────────────────────

  const allSelected = rows.length > 0 && selected.size === rows.length
  const someSelected = selected.size > 0 && selected.size < rows.length

  const selectedSemOff = semOfferings.find((s) => s.id === selectedSemOffId)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-xl">
          <Users size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Batch Assignment</h1>
          <p className="text-sm text-gray-500">Assign enrolled students to batches for a semester offering</p>
        </div>
      </div>

      {/* Semester Offering Selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Semester Offering</label>
        <div className="relative max-w-xl">
          <select
            value={selectedSemOffId}
            onChange={(e) => {
              setSelectedSemOffId(e.target.value)
              setRows([])
              setSelected(new Set())
            }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— Select a semester offering —</option>
            {semOfferings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.programName} ({s.programCode}) · {s.sessionName} · Semester {s.semesterNo}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
        </div>

        {selectedSemOff && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded-md">{selectedSemOff.programName}</span>
            <span className="bg-gray-100 px-2 py-1 rounded-md">{selectedSemOff.sessionName}</span>
            <span className="bg-gray-100 px-2 py-1 rounded-md">Semester {selectedSemOff.semesterNo}</span>
            <span className={`px-2 py-1 rounded-md font-medium ${
              selectedSemOff.status === 'active'    ? 'bg-green-100 text-green-700' :
              selectedSemOff.status === 'completed' ? 'bg-blue-100 text-blue-700'  :
                                                      'bg-gray-100 text-gray-600'
            }`}>{selectedSemOff.status}</span>
          </div>
        )}
      </div>

      {/* Students Table */}
      {selectedSemOffId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {loadingEnrollments ? 'Loading…' : `${rows.length} student${rows.length !== 1 ? 's' : ''}`}
              </span>
              {selected.size > 0 && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  {selected.size} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowBulkPanel((v) => !v)}
                    className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                  >
                    <Users size={14} />
                    Bulk Assign
                    <ChevronDown size={13} />
                  </button>

                  {showBulkPanel && (
                    <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-60">
                      <p className="text-xs text-gray-500 mb-2">Assign {selected.size} selected students to:</p>
                      <select
                        value={bulkBatchId}
                        onChange={(e) => setBulkBatchId(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                      >
                        <option value="">— Unassigned —</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={applyBulkBatch}
                          className="flex-1 bg-indigo-600 text-white text-xs py-1.5 rounded-lg hover:bg-indigo-700"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setShowBulkPanel(false)}
                          className="px-2 text-gray-500 hover:text-gray-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          {loadingEnrollments ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading students…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">No enrolled students found for this semester offering.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-indigo-600">
                      {allSelected ? (
                        <CheckSquare size={16} className="text-indigo-600" />
                      ) : someSelected ? (
                        <CheckSquare size={16} className="text-indigo-400" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-24">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 w-56">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row) => (
                  <tr
                    key={row.enrollmentId}
                    className={`hover:bg-gray-50 transition-colors ${selected.has(row.enrollmentId) ? 'bg-indigo-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <button onClick={() => toggleOne(row.enrollmentId)} className="text-gray-400 hover:text-indigo-600">
                        {selected.has(row.enrollmentId)
                          ? <CheckSquare size={16} className="text-indigo-600" />
                          : <Square size={16} />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.studentCode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.studentPhoto
                          ? <img src={row.studentPhoto} alt="" className="w-7 h-7 rounded-full object-cover" />
                          : <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                              {row.studentName[0]}
                            </div>
                        }
                        <span className="font-medium text-gray-800">{row.studentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.status === 'active'    ? 'bg-green-100 text-green-700' :
                        row.status === 'completed' ? 'bg-blue-100 text-blue-700'  :
                        row.status === 'dropped'   ? 'bg-red-100 text-red-600'    :
                                                     'bg-yellow-100 text-yellow-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BatchCell
                        row={row}
                        batches={batches}
                        onChange={(batchId) => updateRowBatch(row.enrollmentId, batchId)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Save Footer */}
          {dirtyRows.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-t border-amber-200">
              <span className="text-sm text-amber-700 font-medium">
                {dirtyRows.length} unsaved change{dirtyRows.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (enrollmentData?.data) syncRows(enrollmentData.data)
                  }}
                  className="text-sm text-amber-600 hover:text-amber-800 px-3 py-1.5"
                >
                  Discard
                </button>
                <button
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                  className="flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-60"
                >
                  <Save size={14} />
                  {saveMut.isPending ? 'Saving…' : 'Save Assignments'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedSemOffId && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a semester offering above to view enrolled students</p>
        </div>
      )}
    </div>
  )
}
