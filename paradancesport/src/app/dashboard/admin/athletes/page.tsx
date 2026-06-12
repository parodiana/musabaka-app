'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapAthlete, deleteAthlete } from '@/lib/firebase/athletes'
import { useAuthStore } from '@/store/auth.store'
import { AthleteForm } from '@/components/admin/AthleteForm'
import type { Athlete } from '@/types'
import { Plus, Pencil, Trash2, X, ShieldAlert, Users, Search, FileSpreadsheet } from 'lucide-react'

export default function AdminAthletesPage() {
  const { user } = useAuthStore()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Athlete | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'athletes'), orderBy('familyName'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAthletes(snap.docs.map((d) => mapAthlete(d.id, d.data())))
        setLoading(false)
      },
      (err) => {
        console.error('Athletes listener error:', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return athletes
    return athletes.filter((a) =>
      `${a.givenName} ${a.familyName} ${a.memberOrg ?? ''} ${a.externalIds?.wasms ?? ''}`
        .toLowerCase()
        .includes(term)
    )
  }, [athletes, search])

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

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteAthlete(id)
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
          <h1 className="text-2xl font-bold text-gray-900">Sporcular</h1>
          <p className="text-gray-600 mt-1">Kalıcı sporcu kayıtlarını yönet</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin/athletes/import"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Excel İçe Aktar
          </Link>
          <button
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Yeni Sporcu
          </button>
        </div>
      </div>

      {/* Arama */}
      {athletes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, kulüp veya lisans no ara..."
            className="input pl-9"
          />
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Yükleniyor...</div>
      ) : athletes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Henüz sporcu yok</h3>
          <p className="text-gray-600 mt-1">İlk sporcuyu eklemek için yukarıdaki butonu kullan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Ad Soyad</th>
                <th className="px-6 py-3 font-medium">Doğum / Cinsiyet</th>
                <th className="px-6 py-3 font-medium">Kulüp</th>
                <th className="px-6 py-3 font-medium">Kategoriler</th>
                <th className="px-6 py-3 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="font-medium text-gray-900">
                      {a.givenName} {a.familyName}
                    </div>
                    {a.externalIds?.wasms && (
                      <div className="text-xs text-gray-500 font-mono">{a.externalIds.wasms}</div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {a.dob.toLocaleDateString('tr-TR')} · {a.gender === 'M' ? 'Erkek' : 'Kadın'}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {a.memberOrg || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(a.categories ?? []).length > 0 ? (
                        (a.categories ?? []).map((c) => (
                          <span
                            key={c}
                            className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditing(a)
                          setShowForm(true)
                        }}
                        className="text-gray-500 hover:text-blue-600 p-1 rounded transition-colors"
                        title="Düzenle"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
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
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              Aramanızla eşleşen sporcu yok.
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Sporcuyu Düzenle' : 'Yeni Sporcu'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <AthleteForm
                athlete={editing ?? undefined}
                onSuccess={closeForm}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
