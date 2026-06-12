'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent, deleteEvent, updateEvent } from '@/lib/firebase/events'
import { useAuthStore } from '@/store/auth.store'
import { EventForm } from '@/components/admin/EventForm'
import { JudgeAssignmentManager } from '@/components/admin/JudgeAssignmentManager'
import { EntryManager } from '@/components/admin/EntryManager'
import type { Competition, Event, EntryMode } from '@/types'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  ShieldAlert,
  Layers,
  Users,
  Gavel,
  ListChecks,
} from 'lucide-react'

const statusLabels: Record<string, string> = {
  PENDING: 'Beklemede',
  IN_PROGRESS: 'Devam Ediyor',
  AWAITING_APPROVAL: 'Onay Bekliyor',
  APPROVED: 'Onaylandı',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  AWAITING_APPROVAL: 'bg-orange-100 text-orange-800',
  APPROVED: 'bg-green-100 text-green-800',
}

const disciplineLabels: Record<string, string> = {
  Standard: 'Standart',
  Latin: 'Latin',
  Freestyle: 'Freestyle',
}

const genderLabels: Record<string, string> = { M: 'Erkek', F: 'Kadın', Mixed: 'Karışık' }

const classLabels: Record<string, string> = {
  Class1: 'Class 1',
  Class2: 'Class 2',
  Powerchair: 'Powerchair',
  VI: 'VI',
}

const entryModeLabels: Record<EntryMode, string> = {
  AUTO: 'Otomatik',
  TABLE: 'Masa Hakemi',
}

export default function CompetitionDetailPage() {
  const params = useParams()
  const competitionId = params.competitionId as string
  const { user } = useAuthStore()

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningEvent, setAssigningEvent] = useState<Event | null>(null)
  const [entryEvent, setEntryEvent] = useState<Event | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)

  // Tüm kategorilerin giriş modunu tek seferde güncelle (toplu)
  const bulkSetEntryMode = async (mode: EntryMode) => {
    if (events.length === 0) return
    setBulkBusy(true)
    try {
      const batch = writeBatch(db)
      for (const ev of events) {
        batch.update(doc(db, 'events', ev.id), { entryMode: mode })
      }
      await batch.commit()
    } catch (err) {
      console.error('Toplu giriş modu güncelleme hatası:', err)
      alert('Toplu güncelleme başarısız oldu.')
    } finally {
      setBulkBusy(false)
    }
  }

  // Tek kategorinin giriş modunu değiştir
  const setRowEntryMode = async (ev: Event, mode: EntryMode) => {
    if (ev.entryMode === mode) return
    setRowBusyId(ev.id)
    try {
      await updateEvent(ev.id, { entryMode: mode })
    } catch (err) {
      console.error('Giriş modu güncelleme hatası:', err)
      alert('Güncelleme başarısız oldu.')
    } finally {
      setRowBusyId(null)
    }
  }

  // Yarışmayı dinle
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'competitions', competitionId), (snap) => {
      if (snap.exists()) {
        setCompetition(mapCompetition(snap.id, snap.data()))
      } else {
        setCompetition(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [competitionId])

  // Kategorileri dinle
  useEffect(() => {
    const q = query(collection(db, 'events'), where('competitionId', '==', competitionId))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => mapEvent(d.id, d.data()))
        // İstemci tarafında koda göre sırala (composite index gerektirmez)
        list.sort((a, b) => a.eventCode.localeCompare(b.eventCode))
        setEvents(list)
      },
      (err) => console.error('Events listener error:', err)
    )
    return () => unsub()
  }, [competitionId])

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
          <p className="text-gray-600 mt-2">Bu sayfaya yalnızca yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="p-12 text-center text-gray-500">Yükleniyor...</div>
  }

  if (!competition) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/admin/competitions"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Yarışmalara dön
        </Link>
        <div className="p-12 text-center text-gray-500">Yarışma bulunamadı.</div>
      </div>
    )
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteEvent(id)
    } catch (err) {
      console.error('Delete error:', err)
      alert('Silme işlemi başarısız oldu.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Geri + başlık */}
      <div>
        <Link
          href="/dashboard/admin/competitions"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Yarışmalara dön
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{competition.name}</h1>
            <p className="text-gray-600 mt-1 font-mono text-sm">
              {competition.code} ·{' '}
              {competition.date.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              · {competition.venue}
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Yeni Kategori
          </button>
        </div>
      </div>

      {/* Kategori listesi */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Kategoriler</h2>
          <span className="text-sm text-gray-500">({events.length})</span>
        </div>

        {events.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <span className="text-sm font-medium text-gray-700">
              Tüm kategorilerin giriş modunu ayarla:
            </span>
            <button
              onClick={() => bulkSetEntryMode('AUTO')}
              disabled={bulkBusy}
              className="rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Tümü: Otomatik
            </button>
            <button
              onClick={() => bulkSetEntryMode('TABLE')}
              disabled={bulkBusy}
              className="rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Tümü: Masa Hakemi
            </button>
            {bulkBusy && <span className="text-xs text-gray-500">Güncelleniyor…</span>}
            <span className="ml-auto text-xs text-gray-500">
              Şu an: {events.filter((e) => e.entryMode === 'AUTO').length} Otomatik ·{' '}
              {events.filter((e) => e.entryMode === 'TABLE').length} Masa Hakemi
            </span>
          </div>
        )}

        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Henüz kategori yok</h3>
            <p className="text-gray-600 mt-1">
              Bu yarışmaya kategori eklemek için &quot;Yeni Kategori&quot; butonunu kullan.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Kategori</th>
                  <th className="px-6 py-3 font-medium">Disiplin / Sınıf</th>
                  <th className="px-6 py-3 font-medium">Danslar</th>
                  <th className="px-6 py-3 font-medium text-center">Hakem</th>
                  <th className="px-6 py-3 font-medium">Giriş Modu</th>
                  <th className="px-6 py-3 font-medium">Durum</th>
                  <th className="px-6 py-3 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">{ev.eventName}</div>
                      <div className="text-xs text-gray-500 font-mono">{ev.eventCode}</div>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      <div>{disciplineLabels[ev.discipline]}</div>
                      <div className="text-xs text-gray-500">
                        {classLabels[ev.class]} · {genderLabels[ev.gender]} · {ev.format}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {ev.dances.map((d) => (
                          <span
                            key={d}
                            className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <Users className="w-4 h-4 text-gray-400" />
                        {ev.judgeCount}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={ev.entryMode}
                        onChange={(e) => setRowEntryMode(ev, e.target.value as EntryMode)}
                        disabled={rowBusyId === ev.id}
                        title={entryModeLabels[ev.entryMode]}
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                      >
                        <option value="AUTO">Otomatik</option>
                        <option value="TABLE">Masa Hakemi</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[ev.status]}`}
                      >
                        {statusLabels[ev.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEntryEvent(ev)}
                          className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                          title="Kayıtlar (Sırt No)"
                        >
                          <ListChecks className="w-4 h-4" />
                          Kayıtlar
                        </button>
                        <button
                          onClick={() => setAssigningEvent(ev)}
                          className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                          title="Hakem Atamaları"
                        >
                          <Gavel className="w-4 h-4" />
                          Atamalar
                        </button>
                        <button
                          onClick={() => {
                            setEditing(ev)
                            setShowForm(true)
                          }}
                          className="text-gray-500 hover:text-blue-600 p-1 rounded transition-colors"
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(ev.id)}
                          disabled={deletingId === ev.id}
                          className="text-gray-500 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-50"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Kategori oluştur / düzenle */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <EventForm
                competitionId={competitionId}
                defaultEntryMode={competition.defaultEntryMode}
                event={editing ?? undefined}
                onSuccess={closeForm}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Hakem atamaları */}
      {assigningEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Hakem Atamaları</h2>
              <button
                onClick={() => setAssigningEvent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <JudgeAssignmentManager event={assigningEvent} />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Kayıtlar (sırt no) */}
      {entryEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Kayıtlar & Sırt No</h2>
              <button
                onClick={() => setEntryEvent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <EntryManager event={entryEvent} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
