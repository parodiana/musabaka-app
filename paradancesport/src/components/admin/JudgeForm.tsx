'use client'

import { useState } from 'react'
import { createJudge, updateJudge, type JudgeInput } from '@/lib/firebase/judges'
import type { Judge, User } from '@/types'

interface JudgeFormProps {
  judge?: Judge
  /** Hakemi bağlamak için seçilebilecek kullanıcı hesapları */
  linkableUsers?: User[]
  onSuccess?: () => void
  onCancel?: () => void
}

export function JudgeForm({ judge, linkableUsers = [], onSuccess, onCancel }: JudgeFormProps) {
  const isEdit = !!judge

  const [givenName, setGivenName] = useState(judge?.givenName ?? '')
  const [familyName, setFamilyName] = useState(judge?.familyName ?? '')
  const [country, setCountry] = useState(judge?.country ?? '')
  const [externalId, setExternalId] = useState(judge?.externalId ?? '')
  const [userId, setUserId] = useState(judge?.userId ?? '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const input: JudgeInput = {
        givenName: givenName.trim(),
        familyName: familyName.trim(),
        country: country.trim().toUpperCase() || undefined,
        externalId: externalId.trim() || undefined,
        userId: userId || undefined,
      }

      if (isEdit && judge) {
        await updateJudge(judge.id, input)
      } else {
        await createJudge(input)
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bir hata oluştu'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Ad */}
        <div className="space-y-2">
          <label htmlFor="givenName" className="block text-sm font-medium text-gray-700">
            Ad
          </label>
          <input
            id="givenName"
            type="text"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            className="input"
            placeholder="Ahmet"
            required
            disabled={loading}
          />
        </div>

        {/* Soyad */}
        <div className="space-y-2">
          <label htmlFor="familyName" className="block text-sm font-medium text-gray-700">
            Soyad
          </label>
          <input
            id="familyName"
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="input"
            placeholder="Yılmaz"
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* Ülke */}
      <div className="space-y-2">
        <label htmlFor="country" className="block text-sm font-medium text-gray-700">
          Ülke
        </label>
        <input
          id="country"
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="input uppercase"
          placeholder="Örn: TUR"
          maxLength={3}
          disabled={loading}
        />
      </div>

      {/* Dış kimlik */}
      <div className="space-y-2">
        <label htmlFor="externalId" className="block text-sm font-medium text-gray-700">
          Dış Kimlik No <span className="text-gray-400 font-normal">(opsiyonel)</span>
        </label>
        <input
          id="externalId"
          type="text"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          className="input"
          placeholder="Örn: WPDS lisans no"
          disabled={loading}
        />
      </div>

      {/* Kullanıcı hesabına bağla */}
      <div className="space-y-2">
        <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
          Kullanıcı Hesabı <span className="text-gray-400 font-normal">(opsiyonel)</span>
        </label>
        <select
          id="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="input"
          disabled={loading}
        >
          <option value="">— Bağlı değil —</option>
          {linkableUsers.map((u) => (
            <option key={u.uid} value={u.uid}>
              {u.displayName} ({u.email})
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          Hakem giriş yaptığında puanlamada bu kayıtla eşleşir.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Hakem Oluştur'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            İptal
          </button>
        )}
      </div>
    </form>
  )
}
