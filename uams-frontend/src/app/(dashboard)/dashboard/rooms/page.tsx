'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { currentUserAtom } from '@/store/auth'
import { DoorOpen, Plus, Pencil, Trash2, X, Check, Upload, Download, AlertCircle, CheckCircle2, FlaskConical, BookOpen } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  listRoomsApi, createRoomApi, updateRoomApi, deleteRoomApi, bulkCreateRoomsApi,
  type RoomRow, type RoomType, type CreateRoomPayload,
} from '@/lib/api/timetable'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<RoomType, string> = {
  THEORY: 'bg-blue-100 text-blue-700',
  LAB:    'bg-emerald-100 text-emerald-700',
}

function TypeBadge({ type }: { type: RoomType }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_STYLES[type]}`}>
      {type === 'LAB' ? <FlaskConical size={10} /> : <BookOpen size={10} />}
      {type}
    </span>
  )
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Name', 'Capacity', 'Type', 'Active'],
    ['Room 101', 40, 'THEORY', true],
    ['Lab A',    25, 'LAB',    true],
    ['Room 201', 60, 'THEORY', true],
  ])
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 8 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rooms')
  XLSX.writeFile(wb, 'rooms_template.xlsx')
}

function parseRoomExcel(file: File): Promise<CreateRoomPayload[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target?.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const parsed = rows.map((r, i) => {
          const name     = String(r['Name'] ?? r['name'] ?? '').trim()
          const capacity = Number(r['Capacity'] ?? r['capacity'] ?? 0)
          const rawType  = String(r['Type'] ?? r['type'] ?? 'THEORY').trim().toUpperCase()
          const active   = String(r['Active'] ?? r['is_active'] ?? 'true').toLowerCase() !== 'false'
          if (!name)     throw new Error(`Row ${i + 2}: Name is required.`)
          if (!capacity) throw new Error(`Row ${i + 2}: Capacity must be a number.`)
          if (!['THEORY', 'LAB'].includes(rawType)) throw new Error(`Row ${i + 2}: Type must be THEORY or LAB.`)
          return { name, capacity, type: rawType as RoomType, isActive: active }
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

function RoomRowItem({ room, canWrite, onSaved, onDeleted }: {
  room:      RoomRow
  canWrite:  boolean
  onSaved:   () => void
  onDeleted: () => void
}) {
  const [editing, setEditing]       = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [form, setForm] = useState({
    name:     room.name,
    capacity: String(room.capacity),
    type:     room.type,
    isActive: room.isActive,
  })

  const updateMut = useMutation({
    mutationFn: () => updateRoomApi(room.id, {
      ...form,
      capacity: parseInt(form.capacity),
    }),
    onSuccess: () => { onSaved(); setEditing(false) },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteRoomApi(room.id),
    onSuccess: onDeleted,
  })

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-sm font-medium text-gray-900">
          {editing
            ? <input autoFocus value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full text-sm border border-indigo-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100" />
            : room.name}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 text-center">
          {editing
            ? <input type="number" min={1} value={form.capacity}
                onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                className="w-20 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300" />
            : room.capacity}
        </td>
        <td className="px-4 py-3">
          {editing
            ? <select value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as RoomType }))}
                className="text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300">
                <option value="THEORY">THEORY</option>
                <option value="LAB">LAB</option>
              </select>
            : <TypeBadge type={room.type} />}
        </td>
        <td className="px-4 py-3 text-center">
          {editing
            ? <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                className="accent-indigo-600" />
            : room.isActive
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
        <tr><td colSpan={5} className="px-4 pb-2">
          <p className="text-xs text-red-600">{(updateMut.error as any)?.response?.data?.error ?? 'Error saving.'}</p>
        </td></tr>
      )}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Delete Room?</h2>
            <p className="text-sm text-gray-500">
              <strong>{room.name}</strong> (capacity {room.capacity}) will be permanently removed.
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

export default function RoomsPage() {
  const qc       = useQueryClient()
  const user     = useAtomValue(currentUserAtom)
  const canWrite = ['admin', 'super_admin'].includes(user?.role ?? '')
  const fileRef  = useRef<HTMLInputElement>(null)

  const [showAdd, setShowAdd]   = useState(false)
  const [typeFilter, setTypeFilter] = useState<'ALL' | RoomType>('ALL')
  const [addForm, setAddForm]   = useState<CreateRoomPayload>({
    name: '', capacity: 30, type: 'THEORY', isActive: true,
  })
  const [uploadState, setUploadState] = useState<
    { status: 'idle' } |
    { status: 'parsing' } |
    { status: 'preview'; rows: CreateRoomPayload[] } |
    { status: 'uploading' } |
    { status: 'done'; inserted: number } |
    { status: 'error'; message: string }
  >({ status: 'idle' })

  const { data, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn:  () => listRoomsApi(),
  })
  const allRooms = data?.data ?? []
  const rooms    = typeFilter === 'ALL' ? allRooms : allRooms.filter(r => r.type === typeFilter)

  const theoryCount = allRooms.filter(r => r.type === 'THEORY').length
  const labCount    = allRooms.filter(r => r.type === 'LAB').length

  const createMut = useMutation({
    mutationFn: () => createRoomApi(addForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      setShowAdd(false)
      setAddForm({ name: '', capacity: 30, type: 'THEORY', isActive: true })
    },
  })

  const bulkMut = useMutation({
    mutationFn: (rows: CreateRoomPayload[]) => bulkCreateRoomsApi(rows),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
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
      const rows = await parseRoomExcel(file)
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
          <div className="p-2 bg-teal-100 rounded-xl">
            <DoorOpen size={18} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Room Master</h1>
            <p className="text-xs text-gray-400">Manage classrooms and labs</p>
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
              className="flex items-center gap-1.5 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={14} /> Add Room
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Rooms', value: allRooms.length, color: 'bg-gray-50 border-gray-100' },
          { label: 'Theory Rooms', value: theoryCount, color: 'bg-blue-50 border-blue-100' },
          { label: 'Labs', value: labCount, color: 'bg-emerald-50 border-emerald-100' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border px-4 py-3 ${c.color}`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Upload feedback */}
      {uploadState.status !== 'idle' && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          uploadState.status === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
          uploadState.status === 'done'  ? 'bg-green-50 border-green-100 text-green-700' :
          'bg-teal-50 border-teal-100 text-teal-700'
        }`}>
          {uploadState.status === 'parsing'   && 'Parsing file…'}
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
              <span>{uploadState.inserted} room{uploadState.inserted !== 1 ? 's' : ''} imported successfully.</span>
              <button onClick={() => setUploadState({ status: 'idle' })} className="ml-auto"><X size={13} /></button>
            </div>
          )}
          {uploadState.status === 'preview' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{uploadState.rows.length} rows ready to import</span>
                <div className="flex gap-2">
                  <button onClick={() => setUploadState({ status: 'idle' })}
                    className="px-3 py-1 text-xs text-teal-700 hover:bg-teal-100 rounded-lg border border-teal-200">
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setUploadState({ status: 'uploading' })
                      bulkMut.mutate(uploadState.rows)
                    }}
                    className="px-3 py-1 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg">
                    Confirm Import
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded border border-teal-200 bg-white">
                <table className="text-xs w-full">
                  <thead className="bg-teal-50">
                    <tr>{['Name', 'Capacity', 'Type', 'Active'].map(h =>
                      <th key={h} className="px-3 py-1.5 text-left font-semibold text-teal-700">{h}</th>
                    )}</tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {uploadState.rows.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1">{r.name}</td>
                        <td className="px-3 py-1">{r.capacity}</td>
                        <td className="px-3 py-1">{r.type}</td>
                        <td className="px-3 py-1">{r.isActive ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                    {uploadState.rows.length > 8 && (
                      <tr><td colSpan={4} className="px-3 py-1 text-teal-400 italic">
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

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['ALL', 'THEORY', 'LAB'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              typeFilter === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'ALL' ? `All (${allRooms.length})` : t === 'THEORY' ? `Theory (${theoryCount})` : `Lab (${labCount})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Room Name', 'Capacity', 'Type', 'Active', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            )}
            {!isLoading && rooms.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                No rooms{typeFilter !== 'ALL' ? ` of type ${typeFilter}` : ''} yet.
                {canWrite && typeFilter === 'ALL' && ' Add one or upload an Excel file.'}
              </td></tr>
            )}
            {rooms.map(room => (
              <RoomRowItem key={room.id} room={room} canWrite={canWrite}
                onSaved={() => qc.invalidateQueries({ queryKey: ['rooms'] })}
                onDeleted={() => qc.invalidateQueries({ queryKey: ['rooms'] })}
              />
            ))}
          </tbody>
        </table>
        {rooms.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {rooms.length} room{rooms.length !== 1 ? 's' : ''} · {rooms.filter(r => r.isActive).length} active
          </div>
        )}
      </div>

      {/* Add Room Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Room</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Name <span className="text-red-500">*</span></label>
                <input autoFocus value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Room 101"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity <span className="text-red-500">*</span></label>
                  <input type="number" min={1} value={addForm.capacity}
                    onChange={e => setAddForm(f => ({ ...f, capacity: parseInt(e.target.value) || 0 }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select value={addForm.type}
                    onChange={e => setAddForm(f => ({ ...f, type: e.target.value as RoomType }))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="THEORY">THEORY</option>
                    <option value="LAB">LAB</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addForm.isActive}
                  onChange={e => setAddForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="accent-teal-600" />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              {createMut.error && (
                <p className="text-sm text-red-600">{(createMut.error as any)?.response?.data?.error ?? 'Error.'}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={!addForm.name.trim() || !addForm.capacity || createMut.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50">
                  {createMut.isPending ? 'Saving…' : 'Add Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
