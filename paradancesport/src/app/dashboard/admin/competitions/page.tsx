'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition, deleteCompetition } from '@/lib/firebase/competitions'
import { useAuthStore } from '@/store/auth.store'
import { CompetitionForm } from '@/components/admin/CompetitionForm'
import type { Competition } from '@/types'
import { Trophy, Plus, Pencil, Trash2, X, ShieldAlert, MapPin, Calendar, Layers, FileSpreadsheet, AlertTriangle } from 'lucide-react'

const statusLabels: Record<string, string> = {
  DRAFT: 'Taslak',
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
}

const entryModeLabels: Record<string, string> = {
  AUTO: 'Otomatik',
  TABLE: 'Masa',
}

export default function AdminCompetitionsPage() {
  const { user } = useAuthStore()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Competition | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Competition | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'competitions'), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCompetitions(snapshot.docs.map((d) => mapCompetition(d.id, d.data())))
        setLoading(false)
      },
      (err) => {
        console.error('Competitions listener error:', err)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

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

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (c: Competition) => {
    setEditing(c)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeletingId(confirmDelete.id)
    try {
      await deleteCompetition(confirmDelete.id)
      setConfirmDelete(null)
    } catch (err) {
      console.error('Delete error:', err)
      alert('Silme işlemi başarısız oldu.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yarışmalar</h1>
          <p className="text-gray-600 mt-1">Yarışmaları oluştur ve yönet</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin/competitions/import"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Excel&apos;den İçe Aktar
          </Link>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Yeni Yarışma
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Yükleniyor...</div>
      ) : competitions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Henüz yarışma yok</h3>
          <p className="text-gray-600 mt-1">İlk yarışmanı oluşturmak için yukarıdaki butonu kullan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitions.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 leading-tight">{c.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{c.code}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[c.status]}`}
                >
                  {statusLabels[c.status]}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600 flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {c.date.toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {c.venue}
                </div>
                <div className="text-xs text-gray-500">
                  Giriş: {entryModeLabels[c.defaultEntryMode]} ·{' '}
                  {c.aggregationMode === 'TRIMMED' ? 'Trimmed Mean' : 'Düz Ortalama'}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-1">
                <Link
                  href={`/dashboard/admin/competitions/${c.id}`}
                  className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  Kategoriler
                </Link>
                <div className="flex-1" />
                <button
                  onClick={() => openEdit(c)}
                  className="text-gray-500 hover:text-blue-600 p-1.5 rounded transition-colors"
                  title="Düzenle"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(c)}
                  disabled={deletingId === c.id}
                  className="text-gray-500 hover:text-red-600 p-1.5 rounded transition-colors disabled:opacity-50"
                  title="Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Oluştur / Düzenle */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Yarışmayı Düzenle' : 'Yeni Yarışma'}
              </h2>
              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <CompetitionForm
                competition={editing ?? undefined}
                onSuccess={closeForm}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {/* Yarışma silme onayı */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">Yarışmayı Sil</h2>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-600">
              <p>
                <strong>{confirmDelete.name}</strong> yarışmasını silmek üzeresiniz. Bu işlem geri
                alınamaz.
              </p>
              <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-xs">
                Yarışmaya ait <strong>kategoriler, kayıtlar (sırt no), puanlar ve sonuçlar</strong>{' '}
                sistemde kalsa da yarışma listeden kaldırılır ve erişilemez hale gelir. Devam etmek
                istediğinizden emin misiniz?
              </p>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingId === confirmDelete.id}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId === confirmDelete.id ? 'Siliniyor…' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
