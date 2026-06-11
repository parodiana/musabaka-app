'use client'

import { useState } from 'react'
import { createAthlete, updateAthlete, type AthleteInput } from '@/lib/firebase/athletes'
import type { Athlete } from '@/types'

interface AthleteFormProps {
  athlete?: Athlete
  onSuccess?: () => void
  onCancel?: () => void
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function AthleteForm({ athlete, onSuccess, onCancel }: AthleteFormProps) {
  const isEdit = !!athlete

  const [givenName, setGivenName] = useState(athlete?.givenName ?? '')
  const [familyName, setFamilyName] = useState(athlete?.familyName ?? '')
  const [dob, setDob] = useState(athlete ? toDateInputValue(athlete.dob) : '')
  const [gender, setGender] = useState<'M' | 'F'>(athlete?.gender ?? 'M')
  const [memberOrg, setMemberOrg] = useState(athlete?.memberOrg ?? '')
  const [region, setRegion] = useState(athlete?.region ?? '')
  const [wasms, setWasms] = useState(athlete?.externalIds?.wasms ?? '')
  const [categories, setCategories] = useState((athlete?.categories ?? []).join(', '))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!dob) {
      setError('Doğum tarihi gerekli')
      return
    }

    setLoading(true)
    try {
      const input: AthleteInput = {
        givenName: givenName.trim(),
        familyName: familyName.trim(),
        dob: new Date(dob + 'T00:00:00'),
        gender,
        memberOrg: memberOrg.trim() || undefined,
        region: region.trim() || undefined,
        wasms: wasms.trim() || undefined,
        // Sınıflandırma değerini koru (UI'da gösterilmez), kategori düzenlenir
        classifications: athlete?.classifications ?? [],
        categories: categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      }

      if (isEdit && athlete) {
        await updateAthlete(athlete.id, input)
      } else {
        await createAthlete(input)
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
            placeholder="Ayşe"
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
            placeholder="Demir"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Doğum tarihi */}
        <div className="space-y-2">
          <label htmlFor="dob" className="block text-sm font-medium text-gray-700">
            Doğum Tarihi
          </label>
          <input
            id="dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="input"
            required
            disabled={loading}
          />
        </div>

        {/* Cinsiyet */}
        <div className="space-y-2">
          <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
            Cinsiyet
          </label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as 'M' | 'F')}
            className="input"
            disabled={loading}
          >
            <option value="M">Erkek</option>
            <option value="F">Kadın</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Kulüp/Organizasyon */}
        <div className="space-y-2">
          <label htmlFor="memberOrg" className="block text-sm font-medium text-gray-700">
            Kulüp / Organizasyon
          </label>
          <input
            id="memberOrg"
            type="text"
            value={memberOrg}
            onChange={(e) => setMemberOrg(e.target.value)}
            className="input"
            placeholder="Örn: TUR, Ankara DSK"
            required
            disabled={loading}
          />
        </div>

        {/* Bölge */}
        <div className="space-y-2">
          <label htmlFor="region" className="block text-sm font-medium text-gray-700">
            Bölge
          </label>
          <input
            id="region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="input"
            placeholder="Örn: EUR, İç Anadolu"
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* WASMS / Lisans No */}
      <div className="space-y-2">
        <label htmlFor="wasms" className="block text-sm font-medium text-gray-700">
          WASMS / Lisans No
        </label>
        <input
          id="wasms"
          type="text"
          value={wasms}
          onChange={(e) => setWasms(e.target.value)}
          className="input"
          placeholder="Örn: 50915"
          required
          disabled={loading}
        />
      </div>

      {/* Kategoriler */}
      <div className="space-y-2">
        <label htmlFor="categories" className="block text-sm font-medium text-gray-700">
          Kategoriler <span className="text-gray-400 font-normal">(virgülle ayır)</span>
        </label>
        <input
          id="categories"
          type="text"
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          className="input"
          placeholder="Örn: Men's Single Freestyle Class 1"
          disabled={loading}
        />
        <p className="text-xs text-gray-400">
          Excel içe aktarımında otomatik dolar; elle de düzenleyebilirsiniz.
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
          {loading ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Sporcu Oluştur'}
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
