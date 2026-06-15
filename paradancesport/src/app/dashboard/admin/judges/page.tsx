'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapJudge, deleteJudge } from '@/lib/firebase/judges'
import { useAuthStore } from '@/store/auth.store'
import { JudgeForm } from '@/components/admin/JudgeForm'
import type { Judge, User } from '@/types'
import { Plus, Pencil, Trash2, X, ShieldAlert, ClipboardList, Link2 } from 'lucide-react'

export default function AdminJudgesPage() {
  const { user } = useAuthStore()
  const [judges, setJudges] = useState<Judge[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Judge | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Hakemleri dinle
  useEffect(() => {
    const q = query(collection(db, 'judges'), orderBy('familyName'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setJudges(snap.docs.map((d) => mapJudge(d.id, d.data())))
        setLoading(false)
      },
      (err) => {
        console.error('Judges listener error:', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  // Kullanıcıları dinle (bağlama için)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => d.data() as User))
    })
    return () => unsub()
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

  // Bağlanabilir kullanıcılar: hakem rolleri
  const linkableUsers = users.filter((u) =>
    ['hakem', 'bashakem', 'masa_hakemi'].includes(u.role)
  )
  const userMap = new Map(users.map((u) => [u.uid, u]))

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteJudge(id)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hakemler</h1>
          <p className="text-gray-600 mt-1">Kalıcı hakem kayıtlarını yönet</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Yeni Hakem
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Yükleniyor...</div>
      ) : judges.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Henüz hakem yok</h3>
          <p className="text-gray-600 mt-1">İlk hakemi eklemek için yukarıdaki butonu kullan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Ad Soyad</th>
                <th className="px-6 py-3 font-medium">Ülke</th>
                <th className="px-6 py-3 font-medium">Dış Kimlik</th>
                <th className="px-6 py-3 font-medium">Bağlı Kullanıcı</th>
                <th className="px-6 py-3 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((j) => {
                const linkedUser = j.userId ? userMap.get(j.userId) : undefined
                return (
                  <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {j.givenName} {j.familyName}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {j.country || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {j.externalId || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      {linkedUser ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                          <Link2 className="w-4 h-4" />
                          {linkedUser.email}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditing(j)
                            setShowForm(true)
                          }}
                          className="text-gray-500 hover:text-blue-600 p-1 rounded transition-colors"
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(j.id)}
                          disabled={deletingId === j.id}
                          className="text-gray-500 hover:text-red-600 p-1 rounded transition-colors disabled:opacity-50"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Hakemi Düzenle' : 'Yeni Hakem'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <JudgeForm
                judge={editing ?? undefined}
                linkableUsers={linkableUsers}
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
