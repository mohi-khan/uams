'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import {
  GraduationCap, Save, CheckCircle, XCircle, Loader2, CheckSquare, Square,
} from 'lucide-react'
import { listProgramsApi } from '@/lib/api/academic'
import { listSessionsApi } from '@/lib/api/sessions'
import { listProgramOfferingsApi, bulkSaveOfferingsApi } from '@/lib/api/enrollments'
import type { OfferingStatus, ProgramOfferingRow } from '@/lib/api/enrollments'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProgramSelection {
  checked:            boolean
  capacity:           string
  admissionStartDate: string
  admissionEndDate:   string
  status:             OfferingStatus
  existingId?:        string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramOfferingsPage() {
  const qc      = useQueryClient()
  const user    = useAtomValue(currentUserAtom)
  const canWrite = ['admin', 'super_admin', 'academic_coordinator'].includes(user?.role ?? '')

  const [sessionId,   setSessionId]   = useState('')
  const [selections,  setSelections]  = useState<Record<string, ProgramSelection>>({})
  const [saved,       setSaved]       = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Reference data ──────────────────────────────────────────────────────────

  const { data: sessionsData } = useQuery({
    queryKey: ['sessions-all'],
    queryFn:  () => listSessionsApi(1, undefined, 200),
  })
  const sessions = sessionsData?.data ?? []

  const { data: programsData } = useQuery({
    queryKey: ['programs-all'],
    queryFn:  () => listProgramsApi(1, undefined, undefined, 200),
  })
  const programs = programsData?.data ?? []

  // ── Existing offerings for selected session ─────────────────────────────────

  const { data: existingData, isLoading: existingLoading } = useQuery({
    queryKey: ['program-offerings-for-session', sessionId],
    queryFn:  () => listProgramOfferingsApi(1, { sessionId, limit: 200 }),
    enabled:  !!sessionId,
  })
  const existingOfferings: ProgramOfferingRow[] = existingData?.data ?? []

  // Sync selections when session or existing offerings change
  useEffect(() => {
    if (!sessionId) { setSelections({}); return }

    const existingMap = new Map(existingOfferings.map(o => [o.programId, o]))

    const next: Record<string, ProgramSelection> = {}
    for (const p of programs) {
      const ex = existingMap.get(p.id)
      next[p.id] = ex
        ? {
            checked:            true,
            capacity:           ex.capacity ? String(ex.capacity) : '',
            admissionStartDate: ex.admissionStartDate ?? '',
            admissionEndDate:   ex.admissionEndDate   ?? '',
            status:             ex.status,
            existingId:         ex.id,
          }
        : {
            checked:            false,
            capacity:           '',
            admissionStartDate: '',
            admissionEndDate:   '',
            status:             'open',
          }
    }
    setSelections(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, existingOfferings.length])

  // ── Mutation ────────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: () => bulkSaveOfferingsApi({
      academicSessionId: sessionId,
      programs: Object.entries(selections)
        .filter(([, s]) => s.checked)
        .map(([programId, s]) => ({
          programId,
          admissionStartDate: s.admissionStartDate || null,
          admissionEndDate:   s.admissionEndDate   || null,
          capacity:           s.capacity ? Number(s.capacity) : null,
          status:             s.status,
        })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['program-offerings'] })
      qc.invalidateQueries({ queryKey: ['program-offerings-open'] })
      qc.invalidateQueries({ queryKey: ['program-offerings-for-session', sessionId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function updateSel(programId: string, patch: Partial<ProgramSelection>) {
    setSelections(prev => ({ ...prev, [programId]: { ...prev[programId], ...patch } }))
  }

  function toggleAll(checked: boolean) {
    setSelections(prev => {
      const next = { ...prev }
      for (const id of Object.keys(next)) next[id] = { ...next[id], checked }
      return next
    })
  }

  const checkedCount  = Object.values(selections).filter(s => s.checked).length
  const filteredProgs = programs.filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
            <GraduationCap size={18} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Program Offerings</h1>
            <p className="text-xs text-gray-400">Define which programs are offered each semester</p>
          </div>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle size={16} /> Saved successfully
          </span>
        )}
      </div>

      {/* Session selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Academic Session</label>
        <select
          value={sessionId}
          onChange={e => { setSessionId(e.target.value); setSaved(false) }}
          className="input max-w-sm"
        >
          <option value="">Select a session…</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {sessionId && (
          <p className="text-xs text-gray-400 mt-2">
            {existingOfferings.length} program{existingOfferings.length !== 1 ? 's' : ''} already configured for this session
          </p>
        )}
      </div>

      {/* Program list */}
      {sessionId && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter programs…"
              className="input text-sm w-56"
            />
            <div className="flex items-center gap-3 ml-1 text-sm text-gray-500">
              <button onClick={() => toggleAll(true)}  className="hover:text-indigo-600 transition-colors">Select all</button>
              <span className="text-gray-200">|</span>
              <button onClick={() => toggleAll(false)} className="hover:text-gray-700 transition-colors">Deselect all</button>
            </div>
            <span className="ml-auto text-xs text-gray-400">{checkedCount} selected</span>
          </div>

          {existingLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[2rem_1fr_7rem_9rem_9rem_7rem] gap-x-3 px-5 py-2 border-b border-gray-100 bg-gray-50">
                <div />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Program</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Capacity</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Adm. Start</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Adm. End</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</p>
              </div>

              <div className="divide-y divide-gray-50 max-h-[calc(100vh-26rem)] overflow-y-auto">
                {filteredProgs.length === 0 && (
                  <p className="text-center py-10 text-sm text-gray-400">No programs found.</p>
                )}
                {filteredProgs.map(p => {
                  const sel = selections[p.id]
                  if (!sel) return null
                  return (
                    <div
                      key={p.id}
                      className={`grid grid-cols-[2rem_1fr_7rem_9rem_9rem_7rem] gap-x-3 items-center px-5 py-3 transition-colors ${sel.checked ? 'bg-indigo-50/40' : 'hover:bg-gray-50'}`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => updateSel(p.id, { checked: !sel.checked })}
                        className={`transition-colors ${sel.checked ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'}`}
                      >
                        {sel.checked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>

                      {/* Program name */}
                      <div>
                        <p className={`text-sm font-medium ${sel.checked ? 'text-gray-900' : 'text-gray-500'}`}>{p.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                      </div>

                      {/* Capacity */}
                      <input
                        type="number" min="1"
                        value={sel.capacity}
                        onChange={e => updateSel(p.id, { capacity: e.target.value })}
                        disabled={!sel.checked}
                        placeholder="∞"
                        className="input text-sm disabled:opacity-40 disabled:cursor-not-allowed w-full"
                      />

                      {/* Admission start */}
                      <input
                        type="date"
                        value={sel.admissionStartDate}
                        onChange={e => updateSel(p.id, { admissionStartDate: e.target.value })}
                        disabled={!sel.checked}
                        className="input text-sm disabled:opacity-40 disabled:cursor-not-allowed w-full"
                      />

                      {/* Admission end */}
                      <input
                        type="date"
                        value={sel.admissionEndDate}
                        onChange={e => updateSel(p.id, { admissionEndDate: e.target.value })}
                        disabled={!sel.checked}
                        className="input text-sm disabled:opacity-40 disabled:cursor-not-allowed w-full"
                      />

                      {/* Status */}
                      <select
                        value={sel.status}
                        onChange={e => updateSel(p.id, { status: e.target.value as OfferingStatus })}
                        disabled={!sel.checked}
                        className="input text-sm disabled:opacity-40 disabled:cursor-not-allowed w-full"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Save footer */}
      {sessionId && canWrite && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <div className="text-sm text-gray-500">
            {checkedCount === 0
              ? 'No programs selected — select at least one to save.'
              : <><span className="font-semibold text-gray-800">{checkedCount}</span> program{checkedCount !== 1 ? 's' : ''} will be saved for this session.</>}
          </div>
          <div className="flex items-center gap-3">
            {saveMut.error && (
              <span className="flex items-center gap-1 text-sm text-red-500">
                <XCircle size={14} /> {(saveMut.error as any)?.response?.data?.error ?? 'Save failed.'}
              </span>
            )}
            <button
              onClick={() => saveMut.mutate()}
              disabled={checkedCount === 0 || saveMut.isPending}
              className="flex items-center gap-2 btn-primary disabled:opacity-50"
            >
              {saveMut.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                : <><Save size={15} /> Save Offerings</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
