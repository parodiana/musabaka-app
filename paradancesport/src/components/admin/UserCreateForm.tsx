'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { createUserClient, translateAuthError } from '@/lib/firebase/createUserClient'
import type { UserRole } from '@/types'

interface CreatedUser {
  uid: string
  email: string
  displayName: string
  role: string
}

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Yönetici' },
  { value: 'bashakem', label: 'Başhakem' },
  { value: 'hakem', label: 'Hakem' },
  { value: 'masa_hakemi', label: 'Masa Hakemi' },
]

export function UserCreateForm({ onCreated }: { onCreated?: (user: CreatedUser) => void }) {
  const currentUser = useAuthStore((state) => state.user)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('hakem')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const created = await createUserClient({
        email,
        password,
        displayName,
        role,
        createdByUid: currentUser?.uid,
      })

      setSuccess(`${created.displayName} kullanıcısı başarıyla oluşturuldu`)
      onCreated?.(created)

      // Reset form
      setEmail('')
      setDisplayName('')
      setRole('hakem')
      setPassword('')
    } catch (err) {
      setError(translateAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Ad Soyad */}
      <div className="space-y-2">
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
          Ad Soyad
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="input"
          placeholder="Örn: Ahmet Yılmaz"
          required
          minLength={2}
          disabled={loading}
        />
      </div>

      {/* E-posta */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          E-posta Adresi
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="ornek@email.com"
          required
          disabled={loading}
        />
      </div>

      {/* Rol */}
      <div className="space-y-2">
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Rol
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="input"
          required
          disabled={loading}
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Şifre */}
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Geçici Şifre
        </label>
        <input
          id="password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="En az 8 karakter"
          required
          minLength={8}
          disabled={loading}
        />
        <p className="text-xs text-gray-500">
          Kullanıcıya iletilecek geçici şifre. Şifreyi yalnızca admin sıfırlayabilir.
        </p>
      </div>

      {/* Hata */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Başarı */}
      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 border border-green-200">
          ✓ {success}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !displayName || !password}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
      </button>
    </form>
  )
}
