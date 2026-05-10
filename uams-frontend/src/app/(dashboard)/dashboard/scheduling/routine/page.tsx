'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarRange, ChevronDown, AlertTriangle, CheckCircle2,
  Trash2, Loader2, ArrowRight, BookOpen, Clock, Plus,
} from 'lucide-react'
import {
  listOfferingsForRoutineApi,
  checkConflictsApi,
  bulkCreateSchedulesApi,
  type ScheduleConflict,
  type BulkCreateRow,
  type DayOfWeek,
} from '@/lib/api/class-schedule'
import { listSlotsApi, listRoomsApi, type TimeSlotRow, type RoomRow } from '@/lib/api/timetable'
import { listSyllabiApi, getSyllabusApi } from '@/lib/api/syllabus'

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'SUN', label: 'Su' },
  { key: 'MON', label: 'Mo' },
  { key: 'TUE', label: 'Tu' },
  { key: 'WED', label: 'We' },
  { key: 'THU', label: 'Th' },
  { key: 'FRI', label: 'Fr' },
  { key: 'SAT', label: 'Sa' },
]

const DAY_JS_INDEX: Record<DayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface PatternSlot {
  id:        string  // uuid for React key
  days:      DayOfWeek[]
  timeSlotId: string
}

interface PreviewRow extends BulkCreateRow {
  _key:     string
  _slotName: string
  _roomName: string
  _conflicts: ScheduleConflict[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

function dayOfWeekEnum(d: Date): DayOfWeek {
  return DAYS[d.getDay()].key
}

function generateDates(
  startDate: string,
  endDate:   string,
  patterns:  PatternSlot[],
  roomId:    string | null,
): BulkCreateRow[] {
  const rows: BulkCreateRow[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate   + 'T00:00:00')

  const cur = new Date(start)
  while (cur <= end) {
    const dow = dayOfWeekEnum(cur)
    for (const p of patterns) {
      if (p.days.includes(dow) && p.timeSlotId) {
        rows.push({
          sessionDate:  formatDate(cur),
          dayOfWeek:    dow,
          timeSlotId:   p.timeSlotId,
          roomId:       roomId || null,
          isMakeupClass: false,
        })
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return rows
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConflictBadge({ conflicts }: { conflicts: ScheduleConflict[] }) {
  if (conflicts.length === 0) return null
  const types = [...new Set(conflicts.map(c => c.conflictType))]
  return (
    <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
      <AlertTriangle size={12} />
      {types.join(', ')} conflict
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ClassRoutinePage() {
  const qc = useQueryClient()

  // Remote data
  const { data: offerings = [] } = useQuery({
    queryKey: ['routine-offerings'],
    queryFn:  listOfferingsForRoutineApi,
  })
  const { data: slotsRes } = useQuery({
    queryKey: ['slots-active'],
    queryFn:  () => listSlotsApi(true),
  })
  const { data: roomsRes } = useQuery({
    queryKey: ['rooms-active'],
    queryFn:  () => listRoomsApi(true),
  })
  const slots: TimeSlotRow[] = slotsRes?.data ?? []
  const rooms: RoomRow[]     = roomsRes?.data ?? []

  // Form state
  const [offeringId, setOfferingId]   = useState('')
  const [patterns,   setPatterns]     = useState<PatternSlot[]>([{ id: uid(), days: [], timeSlotId: '' }])
  const [startDate,  setStartDate]    = useState('')
  const [endDate,    setEndDate]      = useState('')
  const [globalRoom, setGlobalRoom]   = useState('')

  const selectedOffering = offerings.find(o => o.offering_id === offeringId)

  // Syllabus for selected course — pick default, else first final, else first
  const { data: syllabiRes } = useQuery({
    queryKey: ['syllabi', selectedOffering?.course_id],
    queryFn:  () => listSyllabiApi(selectedOffering!.course_id),
    enabled:  !!selectedOffering?.course_id,
  })
  const syllabi    = syllabiRes?.data ?? []
  const pickedSyllabus = syllabi.find(s => s.isDefault)
    ?? syllabi.find(s => s.status === 'final')
    ?? syllabi[0]

  const { data: syllabusDetail } = useQuery({
    queryKey: ['syllabus-detail', pickedSyllabus?.id],
    queryFn:  () => getSyllabusApi(pickedSyllabus!.id),
    enabled:  !!pickedSyllabus?.id,
  })
  const syllabusTopics = syllabusDetail?.topics ?? []
  const totalRequiredHours = syllabusTopics.reduce(
    (sum, t) => sum + (t.estimatedHours ? parseFloat(t.estimatedHours) : 0),
    0,
  )

  // Preview state
  const [preview,    setPreview]      = useState<PreviewRow[] | null>(null)
  const [checking,   setChecking]     = useState(false)
  const [conflictsMap, setConflictsMap] = useState<Record<string, ScheduleConflict[]>>({})
  const [hoursValidation, setHoursValidation] = useState<{
    classCount:    number
    classHours:    number
    requiredHours: number
    topicCount:    number
  } | null>(null)

  // Add-class form
  const [addForm, setAddForm]           = useState({ date: '', timeSlotId: '', roomId: '', isMakeupClass: false })
  const [addChecking, setAddChecking]   = useState(false)
  const [addConflicts, setAddConflicts] = useState<ScheduleConflict[]>([])
  const [pendingAddRow, setPendingAddRow] = useState<PreviewRow | null>(null)

  // Submit
  const [submitError, setSubmitError] = useState('')
  const [submitOk,    setSubmitOk]    = useState(false)

  const submitMutation = useMutation({
    mutationFn: () => bulkCreateSchedulesApi(
      offeringId,
      preview!.map(r => ({
        sessionDate:   r.sessionDate,
        dayOfWeek:     r.dayOfWeek,
        timeSlotId:    r.timeSlotId,
        roomId:        r.roomId,
        isMakeupClass: r.isMakeupClass,
        notes:         r.notes,
      })),
    ),
    onSuccess: () => {
      setSubmitOk(true)
      setPreview(null)
      qc.invalidateQueries({ queryKey: ['routine-offerings'] })
      qc.invalidateQueries({ queryKey: ['pending-routine-count'] })
    },
    onError: (e: any) => setSubmitError(e?.response?.data?.error ?? e.message),
  })

  // Pattern helpers
  function toggleDay(patternId: string, day: DayOfWeek) {
    setPatterns(ps => ps.map(p =>
      p.id !== patternId ? p : {
        ...p,
        days: p.days.includes(day) ? p.days.filter(d => d !== day) : [...p.days, day],
      }
    ))
  }

  function setPatternSlot(patternId: string, slotId: string) {
    setPatterns(ps => ps.map(p => p.id === patternId ? { ...p, timeSlotId: slotId } : p))
  }

  function addPattern() {
    setPatterns(ps => [...ps, { id: uid(), days: [], timeSlotId: '' }])
  }

  function removePattern(id: string) {
    setPatterns(ps => ps.filter(p => p.id !== id))
  }

  // Recompute hours validation after preview rows change (add / remove)
  function recomputeHours(rows: PreviewRow[]) {
    const slotMap = Object.fromEntries(slots.map(s => [s.id, s]))
    const totalMins = rows.reduce((sum, r) => sum + (slotMap[r.timeSlotId]?.durationMinutes ?? 0), 0)
    setHoursValidation(prev => prev
      ? { ...prev, classCount: rows.length, classHours: totalMins / 60 }
      : null
    )
  }

  // Add a single class to the preview (called from the "Add class" panel)
  async function handleAddClass() {
    if (!addForm.date || !addForm.timeSlotId) return
    const dow = dayOfWeekEnum(new Date(addForm.date + 'T00:00:00'))
    const newBulkRow = {
      sessionDate:   addForm.date,
      dayOfWeek:     dow,
      timeSlotId:    addForm.timeSlotId,
      roomId:        addForm.roomId || null,
      isMakeupClass: addForm.isMakeupClass,
    }

    setAddChecking(true)
    setAddConflicts([])
    setPendingAddRow(null)

    let rowConflicts: ScheduleConflict[] = []
    try {
      rowConflicts = await checkConflictsApi(offeringId, [newBulkRow])
    } catch { /* don't block on API error */ }

    const slotMap = Object.fromEntries(slots.map(s => [s.id, s]))
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]))
    const s  = slotMap[newBulkRow.timeSlotId]
    const rm = newBulkRow.roomId ? roomMap[newBulkRow.roomId] : null
    const previewRow: PreviewRow = {
      ...newBulkRow,
      _key:       `add-${uid()}`,
      _slotName:  s ? `${s.name} (${s.startTime}–${s.endTime})` : newBulkRow.timeSlotId,
      _roomName:  rm?.name ?? '—',
      _conflicts: rowConflicts,
    }

    setAddChecking(false)

    if (rowConflicts.length === 0) {
      const next = [...(preview ?? []), previewRow]
      setPreview(next)
      recomputeHours(next)
      setAddForm({ date: '', timeSlotId: '', roomId: '', isMakeupClass: false })
    } else {
      setAddConflicts(rowConflicts)
      setPendingAddRow(previewRow)
    }
  }

  function confirmAddAnyway() {
    if (!pendingAddRow) return
    const next = [...(preview ?? []), pendingAddRow]
    setPreview(next)
    recomputeHours(next)
    setAddForm({ date: '', timeSlotId: '', roomId: '', isMakeupClass: false })
    setAddConflicts([])
    setPendingAddRow(null)
  }

  function cancelPendingAdd() {
    setAddConflicts([])
    setPendingAddRow(null)
  }

  // Generate preview + auto-check conflicts + hours validation
  async function handleGeneratePreview() {
    if (!offeringId || !startDate || !endDate) return
    if (patterns.some(p => p.days.length === 0 || !p.timeSlotId)) return

    const rawRows = generateDates(startDate, endDate, patterns, globalRoom || null)
    if (rawRows.length === 0) return

    const slotMap = Object.fromEntries(slots.map(s => [s.id, s]))
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]))

    // Hours validation
    const totalClassMinutes = rawRows.reduce((sum, r) => {
      const slot = slotMap[r.timeSlotId]
      return sum + (slot?.durationMinutes ?? 0)
    }, 0)
    const totalClassHours = totalClassMinutes / 60
    setHoursValidation({
      classCount:    rawRows.length,
      classHours:    totalClassHours,
      requiredHours: totalRequiredHours,
      topicCount:    syllabusTopics.length,
    })

    setChecking(true)
    let cMap: Record<string, ScheduleConflict[]> = {}
    try {
      const conflicts = await checkConflictsApi(offeringId, rawRows.map(r => ({
        sessionDate: r.sessionDate,
        dayOfWeek:   r.dayOfWeek,
        timeSlotId:  r.timeSlotId,
        roomId:      r.roomId,
      })))
      for (const c of conflicts) {
        const key = `${c.sessionDate}|${c.timeSlotId}`
        cMap[key] = [...(cMap[key] ?? []), c]
      }
    } catch { /* ignore — don't block preview */ }
    setConflictsMap(cMap)
    setChecking(false)

    const rows: PreviewRow[] = rawRows.map((r, i) => {
      const key = `${r.sessionDate}|${r.timeSlotId}`
      const s  = slotMap[r.timeSlotId]
      const rm = r.roomId ? roomMap[r.roomId] : null
      return {
        ...r,
        _key:       `${i}`,
        _slotName:  s ? `${s.name} (${s.startTime}–${s.endTime})` : r.timeSlotId,
        _roomName:  rm?.name ?? '—',
        _conflicts: cMap[key] ?? [],
      }
    })
    setPreview(rows)
    setSubmitOk(false)
    setSubmitError('')
  }

  // Per-row edits in preview
  function removePreviewRow(key: string) {
    setPreview(p => {
      const next = p?.filter(r => r._key !== key) ?? null
      if (next) recomputeHours(next)
      return next
    })
  }

  function updatePreviewRoom(key: string, roomId: string) {
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]))
    setPreview(p => p?.map(r => {
      if (r._key !== key) return r
      return { ...r, roomId: roomId || null, _roomName: roomMap[roomId]?.name ?? '—' }
    }) ?? null)
  }

  function updatePreviewSlot(key: string, slotId: string) {
    const slotMap = Object.fromEntries(slots.map(s => [s.id, s]))
    setPreview(p => p?.map(r => {
      if (r._key !== key) return r
      const s = slotMap[slotId]
      return {
        ...r,
        timeSlotId: slotId,
        _slotName: s ? `${s.name} (${s.startTime}–${s.endTime})` : slotId,
      }
    }) ?? null)
  }
  const conflictCount    = preview?.reduce((n, r) => n + (r._conflicts.length > 0 ? 1 : 0), 0) ?? 0
  const canSubmit        = !!preview && preview.length > 0 && !submitMutation.isPending

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarRange size={24} className="text-indigo-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Class Routine Builder</h1>
          <p className="text-sm text-gray-500">Build weekly schedules for course offerings</p>
        </div>
      </div>

      {/* Step 1 — Select offering */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
          1 · Select Course Offering
        </h2>
        <div className="relative">
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={offeringId}
            onChange={e => { setOfferingId(e.target.value); setPreview(null); setHoursValidation(null); setAddConflicts([]); setPendingAddRow(null) }}
          >
            <option value="">— select a course offering —</option>
            {offerings.map(o => (
              <option key={o.offering_id} value={o.offering_id}>
                {o.course_code} · {o.course_title}
                {o.batch_name ? ` · ${o.batch_name}` : ''}
                {o.has_routine ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {selectedOffering && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {selectedOffering.teacher_name && (
              <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
                Teacher: <strong>{selectedOffering.teacher_name}</strong>
              </span>
            )}
            {selectedOffering.batch_name && (
              <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
                Batch: <strong>{selectedOffering.batch_name}</strong>
              </span>
            )}
            {pickedSyllabus ? (
              <span className="bg-blue-50 border border-blue-100 text-blue-700 rounded px-2 py-1 flex items-center gap-1">
                <BookOpen size={11} />
                Syllabus {pickedSyllabus.version}
                {totalRequiredHours > 0
                  ? ` · ${syllabusTopics.length} topics · ${totalRequiredHours.toFixed(1)} hrs required`
                  : ` · ${syllabusTopics.length} topics (no hour estimates)`}
              </span>
            ) : (
              <span className="bg-gray-50 border border-gray-100 text-gray-400 rounded px-2 py-1 flex items-center gap-1">
                <BookOpen size={11} /> No syllabus found for this course
              </span>
            )}
            {selectedOffering.has_routine && (
              <span className="bg-green-50 border border-green-100 text-green-700 rounded px-2 py-1 flex items-center gap-1">
                <CheckCircle2 size={11} /> Routine exists — re-creating will add additional classes
              </span>
            )}
          </div>
        )}
      </section>

      {/* Step 2 — Weekly pattern */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
          2 · Weekly Pattern
        </h2>

        {patterns.map((p, idx) => (
          <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            {/* Day toggles */}
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(p.id, d.key)}
                  className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                    p.days.includes(d.key)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-400'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Time slot */}
            <div className="relative flex-1 min-w-[180px]">
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={p.timeSlotId}
                onChange={e => setPatternSlot(p.id, e.target.value)}
              >
                <option value="">— pick time slot —</option>
                {slots.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Remove */}
            {patterns.length > 1 && (
              <button
                type="button"
                onClick={() => removePattern(p.id)}
                className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addPattern}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          + Add another slot
        </button>
      </section>

      {/* Step 3 — Date range + room */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
          3 · Date Range &amp; Room
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start date</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End date</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Room (default for all)</label>
            <div className="relative">
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={globalRoom}
                onChange={e => setGlobalRoom(e.target.value)}
              >
                <option value="">— no room —</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.type}, cap {r.capacity})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGeneratePreview}
          disabled={
            !offeringId || !startDate || !endDate ||
            patterns.some(p => p.days.length === 0 || !p.timeSlotId) ||
            checking
          }
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {checking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          {checking ? 'Checking conflicts…' : 'Generate Preview'}
        </button>
      </section>

      {/* Step 4 — Preview pane */}
      {preview !== null && (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">

          {/* Hours validation summary */}
          {hoursValidation && (() => {
            const { classCount, classHours, requiredHours, topicCount } = hoursValidation
            const hasRequirement = requiredHours > 0
            const diff = classHours - requiredHours
            const isShort = hasRequirement && diff < -0.5
            const isOver  = hasRequirement && diff > 0.5
            const isOk    = hasRequirement && !isShort && !isOver

            return (
              <div className={`flex flex-wrap items-center gap-4 rounded-lg px-4 py-3 text-sm border ${
                isShort ? 'bg-red-50 border-red-200' :
                isOver  ? 'bg-amber-50 border-amber-200' :
                isOk    ? 'bg-green-50 border-green-200' :
                          'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400 shrink-0" />
                  <span className="text-gray-600">
                    <strong>{classCount}</strong> classes ·{' '}
                    <strong>{classHours.toFixed(1)} hrs</strong> total teaching time
                  </span>
                </div>
                <div className="w-px h-4 bg-gray-300 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-gray-400 shrink-0" />
                  {hasRequirement ? (
                    <span className="text-gray-600">
                      Syllabus: <strong>{topicCount} topics</strong> · <strong>{requiredHours.toFixed(1)} hrs</strong> estimated
                    </span>
                  ) : (
                    <span className="text-gray-400">No hour estimates in syllabus topics</span>
                  )}
                </div>
                {hasRequirement && (
                  <>
                    <div className="w-px h-4 bg-gray-300 hidden sm:block" />
                    {isOk && (
                      <span className="flex items-center gap-1 font-medium text-green-700">
                        <CheckCircle2 size={13} /> Hours match
                      </span>
                    )}
                    {isShort && (
                      <span className="flex items-center gap-1 font-medium text-red-600">
                        <AlertTriangle size={13} /> {Math.abs(diff).toFixed(1)} hrs short — consider adding more classes
                      </span>
                    )}
                    {isOver && (
                      <span className="flex items-center gap-1 font-medium text-amber-700">
                        <AlertTriangle size={13} /> {diff.toFixed(1)} hrs over syllabus estimate
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })()}

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
              4 · Preview &amp; Edit ({preview.length} classes)
            </h2>
            <div className="flex items-center gap-3">
              {conflictCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-3 py-1">
                  <AlertTriangle size={12} /> {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} detected
                </span>
              )}
              {conflictCount === 0 && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-3 py-1">
                  <CheckCircle2 size={12} /> No conflicts
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Date</th>
                  <th className="text-left pb-2 font-medium">Day</th>
                  <th className="text-left pb-2 font-medium">Time Slot</th>
                  <th className="text-left pb-2 font-medium">Room</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.map(row => (
                  <tr key={row._key} className={row._conflicts.length > 0 ? 'bg-red-50' : ''}>
                    <td className="py-2 pr-3 font-medium text-gray-800">{row.sessionDate}</td>
                    <td className="py-2 pr-3 text-gray-500">{row.dayOfWeek}</td>

                    {/* Editable time slot */}
                    <td className="py-2 pr-3">
                      <select
                        className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 max-w-[200px]"
                        value={row.timeSlotId}
                        onChange={e => updatePreviewSlot(row._key, e.target.value)}
                      >
                        {slots.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.startTime}–{s.endTime})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Editable room */}
                    <td className="py-2 pr-3">
                      <select
                        className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 max-w-[160px]"
                        value={row.roomId ?? ''}
                        onChange={e => updatePreviewRoom(row._key, e.target.value)}
                      >
                        <option value="">— no room —</option>
                        {rooms.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>

                    <td className="py-2 pr-3">
                      <ConflictBadge conflicts={row._conflicts} />
                      {row._conflicts.length === 0 && (
                        <span className="text-xs text-green-600">OK</span>
                      )}
                    </td>

                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => removePreviewRow(row._key)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add class panel */}
          <div className="border border-dashed border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add a class</p>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={e => { setAddForm(f => ({ ...f, date: e.target.value })); setAddConflicts([]); setPendingAddRow(null) }}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-gray-400 mb-1">Time slot</label>
                <div className="relative">
                  <select
                    value={addForm.timeSlotId}
                    onChange={e => { setAddForm(f => ({ ...f, timeSlotId: e.target.value })); setAddConflicts([]); setPendingAddRow(null) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">— pick slot —</option>
                    {slots.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs text-gray-400 mb-1">Room (optional)</label>
                <div className="relative">
                  <select
                    value={addForm.roomId}
                    onChange={e => { setAddForm(f => ({ ...f, roomId: e.target.value })); setAddConflicts([]); setPendingAddRow(null) }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">— no room —</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-500 pb-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addForm.isMakeupClass}
                    onChange={e => setAddForm(f => ({ ...f, isMakeupClass: e.target.checked }))}
                    className="rounded text-indigo-500"
                  />
                  Makeup class
                </label>
                <button
                  type="button"
                  onClick={handleAddClass}
                  disabled={!addForm.date || !addForm.timeSlotId || addChecking}
                  className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addChecking ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  {addChecking ? 'Checking…' : 'Check & Add'}
                </button>
              </div>
            </div>

            {/* Conflict warning for the new row */}
            {addConflicts.length > 0 && pendingAddRow && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  {addConflicts.length} conflict{addConflicts.length > 1 ? 's' : ''} on {pendingAddRow.sessionDate}
                </p>
                <ul className="text-xs text-amber-700 space-y-0.5 pl-4">
                  {addConflicts.map((c, i) => (
                    <li key={i}>· {c.conflictType} — already occupied by {c.existingCourse}</li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={confirmAddAnyway}
                    className="text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1 rounded-md transition-colors"
                  >
                    Add anyway
                  </button>
                  <button
                    type="button"
                    onClick={cancelPendingAdd}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900 px-3 py-1 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{submitError}</p>
          )}
          {submitOk && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2 flex items-center gap-2">
              <CheckCircle2 size={14} /> Schedule created successfully!
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => { setPreview(null); setHoursValidation(null); setAddConflicts([]); setPendingAddRow(null) }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Modify pattern
            </button>
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
            >
              {submitMutation.isPending ? (
                <><Loader2 size={15} className="animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle2 size={15} /> Create Schedule ({preview.length} classes)</>
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
