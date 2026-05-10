'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { Clock, Plus, Pencil, Trash2, X, Check, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  listSlotsApi, createSlotApi, updateSlotApi, deleteSlotApi, bulkCreateSlotsApi,
  type TimeSlotRow, type CreateSlotPayload,
} from '@/lib/api/timetable'

// ── Excel helpers ─────────────────────────────────────────────────────────────

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Start Time', 'End Time', 'Duration (min)', 'Active'],
    ['Slot 1', '09:00', '10:30', 90, true],
    ['Slot 2', '10:45', '12:15', 90, true],
    ['Slot 3', '13:00', '14:30', 90, true],
  ])
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 8 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Slots')
  XLSX.writeFile(wb, 'slots_template.xlsx')
}

function parseSlotExcel(file: File): Promise<CreateSlotPayload[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb    = XLSX.read(e.target?.result, { type: 'binary' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const parsed = rows.map((r, i) => {
          const name    = String(r['Name'] ?? r['name'] ?? '').trim()
          const start   = String(r['Start Time'] ?? r['start_time'] ?? '').trim()
          const end     = String(r['End Time'] ?? r['end_time'] ?? '').trim()
          const dur     = Number(r['Duration (min)'] ?? r['duration_minutes'] ?? 0)
          const active  = String(r['Active'] ?? r['is_active'] ?? 'true').toLowerCase() !== 'false'
          if (!name)  throw new Error(`Row ${i + 2}: Name is required.`)
          if (!start) throw new Error(`Row ${i + 2}: Start Time is required.`)
          if (!end)   throw new Error(`Row ${i + 2}: End Time is required.`)
          if (!dur)   throw new Error(`Row ${i + 2}: Duration must be a number.`)
          return { name, startTime: start, endTime: end, durationMinutes: dur, isActive: active }
        })
        resolve(parsed)
      } catch (err: any) {
        reject(new Error(err.message ?? 'Failed to parse file.'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsBinaryString(file)
  })
}

// ── Inline editable row ───────────────────────────────────────────────────────

function SlotRow({ slot, canWrite, onSaved, onDeleted }: {
  slot:      TimeSlotRow
  canWrite:  boolean
  onSaved:   () => void
  onDeleted: () => void
}) {
  const [editing, setEditing]         = useState(false)
  const [delConfirm, setDelConfirm]   = useState(false)
  const [form, setForm] = useState({
    name:            slot.name,
    startTime:       slot.startTime,
    endTime:         slot.endTime,
    durationMinutes: String(slot.durationMinutes),
    isActive:        slot.isActive,
  })

  const updateMut = useMutation({
    mutationFn: () => updateSlotApi(slot.id, {
      ...form,
      durationMinutes: parseInt(form.durationMinutes),
    }),
    onSuccess: () => { onSaved(); setEditing(false) },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteSlotApi(slot.id),
    onSuccess: onDeleted,
  })

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-sm font-medium text-gray-900">
          {editing
            ? <input autoFocus value={form.name} onChange={f('name')}
                className="w-full text-sm border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100" />
            : slot.name}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-gray-700">
          {editing
            ? <input value={form.startTime} onChange={f('startTime')} placeholder="HH:MM"
                className="w-24 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300" />
            : slot.startTime}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-gray-700">
          {editing
            ? <input value={form.endTime} onChange={f('endTime')} placeholder="HH:MM"
                className="w-24 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300" />
            : slot.endTime}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 text-center">
          {editing
            ? <input type="number" min={1} value={form.durationMinutes} onChange={f('durationMinutes')}
                className="w-20 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300" />
            : `${slot.durationMinutes} min`}
        </td>
        <td className="px-4 py-3 text-center">
          {editing
            ? <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                className="accent-indigo-600" />
            : slot.isActive
              ? <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Active" />
              : <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Inactive" />}
        </td>
        <td className="px-4 py-3 w-20">
          {canWrite && (
            <div className="flex items-center gap-0.5">
              {editing ? (
                <>
                  <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}
                    className="p-1 rounded hover:bg-green-50 text-green-600" title="Save">
                    {updateMut.isPending ? <span className="text-xs">…</span> : <Check size={13} />}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={13} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600" title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDelConfirm(true)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          )}
        </td>
      </tr>
      {updateMut.error && (
        <tr><td colSpan={6} className="px-4 pb-2">
          <p className="text-xs text-red-600">{(updateMut.error as any)?.response?.data?.error ?? 'Error saving.'}</p>
        </td></tr>
      )}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Delete Slot?</h2>
            <p className="text-sm text-gray-500">
              <strong>{slot.name}</strong> ({slot.startTime}–{slot.endTime}) will be permanently removed.
            </p>
            {deleteMut.error && (
              <p className="text-xs text-red-600">{(deleteMut.error as any)?.response?.data?.error ?? 'Error.'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelConfirm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SlotsPage() {
  const qc        = useQueryClient()
  const user      = useAtomValue(currentUserAtom)
  const canWrite  = ['admin', 'super_admin'].includes(user?.role ?? '')
  const fileRef   = useRef<HTMLInputElement>(null)

  const [showAdd, setShowAdd]   = useState(false)
  const [addForm, setAddForm]   = useState<CreateSlotPayload>({
    name: '', startTime: '', endTime: '', durationMinutes: 90, isActive: true,
  })
  const [uploadState, setUploadState] = useState<
    { status: 'idle' } |
    { status: 'parsing' } |
    { status: 'preview'; rows: CreateSlotPayload[] } |
    { status: 'uploading' } |
    { status: 'done'; inserted: number } |
    { status: 'error'; message: string }
  >({ status: 'idle' })

  const { data, isLoading } = useQuery({
    queryKey: ['slots'],
    queryFn:  () => listSlotsApi(),
  })
  const slots = data?.data ?? []

  const createMut = useMutation({
    mutationFn: () => createSlotApi(addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slots'] })
      setShowAdd(false)
      setAddForm({ name: '', startTime: '', endTime: '', durationMinutes: 90, isActive: true })
    },
  })

  const bulkMut = useMutation({
    mutationFn: (rows: CreateSlotPayload[]) => bulkCreateSlotsApi(rows),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['slots'] })
      setUploadState({ status: 'done', inserted: res.inserted })
    },
    onError: (err: any) => {
      setUploadState({ status: 'error', message: err?.response?.data?.error ?? 'Upload failed.' })
    },
  })

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadState({ status: 'parsing' })
    try {
      const rows = await parseSlotExcel(file)
      setUploadState({ status: 'preview', rows })
    } catch (err: any) {
      setUploadState({ status: 'error', message: err.message })
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            <Clock size={18} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Slot Master</h1>
            <p className="text-xs text-gray-400">Manage teaching time slots</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
              <Download size={14} /> Template
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
              <Upload size={14} /> Upload Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={14} /> Add Slot
            </button>
          </div>
        )}
      </div>

      {/* Upload feedback */}
      {uploadState.status !== 'idle' && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          uploadState.status === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
          uploadState.status === 'done'  ? 'bg-green-50 border-green-100 text-green-700' :
          'bg-violet-50 border-violet-100 text-violet-700'
        }`}>
          {uploadState.status === 'parsing' && 'Parsing file…'}
          {uploadState.status === 'uploading' && 'Uploading rows…'}
          {uploadState.status === 'error' && (
            <div className="flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{uploadState.message}</span>
              <button onClick={() => setUploadState({ status: 'idle' })} className="ml-auto"><X size={13} /></button>
            </div>
          )}
          {uploadState.status === 'done' && (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>{uploadState.inserted} slot{uploadState.inserted !== 1 ? 's' : ''} imported successfully.</span>
              <button onClick={() => setUploadState({ status: 'idle' })} className="ml-auto"><X size={13} /></button>
            </div>
          )}
          {uploadState.status === 'preview' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{uploadState.rows.length} rows ready to import</span>
                <div className="flex gap-2">
                  <button onClick={() => setUploadState({ status: 'idle' })}
                    className="px-3 py-1 text-xs text-violet-700 hover:bg-violet-100 rounded-lg border border-violet-200">
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setUploadState({ status: 'uploading' })
                      bulkMut.mutate(uploadState.rows)
                    }}
                    className="px-3 py-1 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg">
                    Confirm Import
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded border border-violet-200 bg-white">
                <table className="text-xs w-full">
                  <thead className="bg-violet-50">
                    <tr>{['Name', 'Start', 'End', 'Duration', 'Active'].map(h =>
                      <th key={h} className="px-3 py-1.5 text-left font-semibold text-violet-700">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-violet-50">
                    {uploadState.rows.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1">{r.name}</td>
                        <td className="px-3 py-1 font-mono">{r.startTime}</td>
                        <td className="px-3 py-1 font-mono">{r.endTime}</td>
                        <td className="px-3 py-1">{r.durationMinutes} min</td>
                        <td className="px-3 py-1">{r.isActive ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                    {uploadState.rows.length > 8 && (
                      <tr><td colSpan={5} className="px-3 py-1 text-violet-400 italic">
                        …and {uploadState.rows.length - 8} more
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Slot Name', 'Start', 'End', 'Duration', 'Active', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && slots.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                No slots yet. {canWrite && 'Add one or upload an Excel file.'}
              </td></tr>
            )}
            {slots.map(slot => (
              <SlotRow key={slot.id} slot={slot} canWrite={canWrite}
                onSaved={() => qc.invalidateQueries({ queryKey: ['slots'] })}
                onDeleted={() => qc.invalidateQueries({ queryKey: ['slots'] })}
              />
            ))}
          </tbody>
        </table>
        {slots.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {slots.length} slot{slots.length !== 1 ? 's' : ''} · {slots.filter(s => s.isActive).length} active
          </div>
        )}
      </div>

      {/* Add Slot Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Time Slot</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input autoFocus value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Slot 1"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                  <input type="time" value={addForm.startTime}
                    onChange={e => setAddForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
                  <input type="time" value={addForm.endTime}
                    onChange={e => setAddForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes) <span className="text-red-500">*</span></label>
                <input type="number" min={1} value={addForm.durationMinutes}
                  onChange={e => setAddForm(f => ({ ...f, durationMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addForm.isActive}
                  onChange={e => setAddForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="accent-violet-600" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              {createMut.error && (
                <p className="text-sm text-red-600">{(createMut.error as any)?.response?.data?.error ?? 'Error.'}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={!addForm.name.trim() || !addForm.startTime || !addForm.endTime || !addForm.durationMinutes || createMut.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50">
                  {createMut.isPending ? 'Saving…' : 'Add Slot'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
