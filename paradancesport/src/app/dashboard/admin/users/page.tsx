'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { setUserStatus, deleteUserDoc } from '@/lib/firebase/users'
import { useAuthStore } from '@/store/auth.store'
import { UserCreateForm } from '@/components/admin/UserCreateForm'
import type { User } from '@/types'
import { UserPlus, Users as UsersIcon, ShieldAlert, Ban, CheckCircle2, Trash2 } from 'lucide-react'

const roleLabels: Record<string, string> = {
  admin: 'Yönetici',
  bashakem: 'Başhakem',
  hakem: 'Hakem',
  masa_hakemi: 'Masa Hakemi',
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  bashakem: 'bg-purple-100 text-purple-800',
  hakem: 'bg-blue-100 text-blue-800',
  masa_hakemi: 'bg-green-100 text-green-800',
}

export default function AdminUsersPage() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('email'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => doc.data() as User)
        setUsers(list)
        setLoading(false)
      },
      (err) => {
        console.error('Users listener error:', err)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)
  const [busyUid, setBusyUid] = useState('')

  const toggleStatus = async (u: User) => {
    setBusyUid(u.uid)
    try {
      await setUserStatus(u.uid, u.status === 'suspended' ? 'active' : 'suspended')
    } catch (err) {
      console.error('Durum güncellenemedi:', err)
    } finally {
      setBusyUid('')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setBusyUid(confirmDelete.uid)
    try {
      await deleteUserDoc(confirmDelete.uid)
      setConfirmDelete(null)
    } catch (err) {
      console.error('Kullanıcı silinemedi:', err)
    } finally {
      setBusyUid('')
    }
  }

  // Sadece admin erişebilir
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

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
        <p className="text-gray-600 mt-1">Sistem kullanıcılarını oluştur ve yönet</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Kullanıcı oluşturma formu */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <UserPlus className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Yeni Kullanıcı</h2>
            </div>
            <UserCreateForm />
          </div>
        </div>

        {/* Sağ: Kullanıcı listesi */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Kullanıcılar</h2>
              </div>
              <span className="text-sm text-gray-500">{users.length} kullanıcı</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500">Yükleniyor...</div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-gray-500">Henüz kullanıcı yok.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-6 py-3 font-medium">Ad Soyad</th>
                      <th className="px-6 py-3 font-medium">E-posta</th>
                      <th className="px-6 py-3 font-medium">Rol</th>
                      <th className="px-6 py-3 font-medium">Durum</th>
                      <th className="px-6 py-3 font-medium text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const suspended = u.status === 'suspended'
                      const isSelf = u.uid === user?.uid
                      const busy = busyUid === u.uid
                      return (
                        <tr key={u.uid} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {u.displayName}
                            {isSelf && <span className="ml-2 text-xs text-gray-400">(siz)</span>}
                          </td>
                          <td className="px-6 py-3 text-gray-600">{u.email}</td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                                roleColors[u.role] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {roleLabels[u.role] || u.role}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                                suspended ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {suspended ? 'Askıda' : 'Aktif'}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => toggleStatus(u)}
                                disabled={busy || isSelf}
                                title={isSelf ? 'Kendi hesabınızı değiştiremezsiniz' : suspended ? 'Aktifleştir' : 'Askıya al'}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                                  suspended
                                    ? 'text-green-700 hover:bg-green-50'
                                    : 'text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                {suspended ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                {suspended ? 'Aktifleştir' : 'Askıya Al'}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(u)}
                                disabled={busy || isSelf}
                                title={isSelf ? 'Kendi hesabınızı silemezsiniz' : 'Sil'}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" /> Sil
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
          </div>
        </div>
      </div>

      {/* Silme onayı */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Kullanıcıyı Sil</h3>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-600">
              <p>
                <strong>{confirmDelete.displayName}</strong> ({confirmDelete.email}) kullanıcısının
                erişim kaydı kalıcı olarak silinecek. Kullanıcı bir daha sisteme giriş yapamaz.
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Not: Yalnızca erişim kaydı silinir. Hesabı geçici olarak engellemek isterseniz
                bunun yerine &quot;Askıya Al&quot; seçeneğini kullanabilirsiniz (geri alınabilir).
              </p>
            </div>
            <div className="flex gap-3 border-t border-gray-200 px-5 py-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={busyUid === confirmDelete.uid}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                onClick={handleDelete}
                disabled={busyUid === confirmDelete.uid}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busyUid === confirmDelete.uid ? 'Siliniyor…' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
