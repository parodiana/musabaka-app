'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import {
  createCompetition,
  updateCompetition,
  type CompetitionInput,
} from '@/lib/firebase/competitions'
import type { Competition, EntryMode, AggregationMode, CompetitionStatus } from '@/types'

interface CompetitionFormProps {
  /** Düzenleme modunda mevcut yarışma; yoksa oluşturma modu */
  competition?: Competition
  onSuccess?: () => void
  onCancel?: () => void
}

function toDateInputValue(date: Date): string {
  // YYYY-MM-DD (yerel)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function CompetitionForm({ competition, onSuccess, onCancel }: CompetitionFormProps) {
  const currentUser = useAuthStore((state) => state.user)
  const isEdit = !!competition

  const [name, setName] = useState(competition?.name ?? '')
  const [code, setCode] = useState(competition?.code ?? '')
  const [date, setDate] = useState(
    competition ? toDateInputValue(competition.date) : toDateInputValue(new Date())
  )
  const [venue, setVenue] = useState(competition?.venue ?? '')
  const [defaultEntryMode, setDefaultEntryMode] = useState<EntryMode>(
    competition?.defaultEntryMode ?? 'AUTO'
  )
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>(
    competition?.aggregationMode ?? 'TRIMMED'
  )
  const [status, setStatus] = useState<CompetitionStatus>(competition?.status ?? 'DRAFT')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const input: CompetitionInput = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        date: new Date(date + 'T00:00:00'),
        venue: venue.trim(),
        defaultEntryMode,
        aggregationMode,
        status,
      }

      if (isEdit && competition) {
        await updateCompetition(competition.id, input)
      } else {
        await createCompetition(input, currentUser?.uid ?? 'admin')
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
      {/* Yarışma adı */}
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Yarışma Adı
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="Örn: 2026 Türkiye Şampiyonası"
          required
          minLength={3}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Kod */}
        <div className="space-y-2">
          <label htmlFor="code" className="block text-sm font-medium text-gray-700">
            Yarışma Kodu
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input uppercase"
            placeholder="TR2026"
            required
            disabled={loading}
          />
        </div>

        {/* Tarih */}
        <div className="space-y-2">
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Tarih
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* Mekan */}
      <div className="space-y-2">
        <label htmlFor="venue" className="block text-sm font-medium text-gray-700">
          Mekan
        </label>
        <input
          id="venue"
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="input"
          placeholder="Örn: Ankara Büyükşehir Spor Salonu"
          required
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Varsayılan giriş modu */}
        <div className="space-y-2">
          <label htmlFor="entryMode" className="block text-sm font-medium text-gray-700">
            Varsayılan Giriş Modu
          </label>
          <select
            id="entryMode"
            value={defaultEntryMode}
            onChange={(e) => setDefaultEntryMode(e.target.value as EntryMode)}
            className="input"
            disabled={loading}
          >
            <option value="AUTO">Otomatik (Hakem tablet)</option>
            <option value="TABLE">Masa (Kağıttan giriş)</option>
          </select>
        </div>

        {/* Toplama modu */}
        <div className="space-y-2">
          <label htmlFor="aggMode" className="block text-sm font-medium text-gray-700">
            Puan Toplama
          </label>
          <select
            id="aggMode"
            value={aggregationMode}
            onChange={(e) => setAggregationMode(e.target.value as AggregationMode)}
            className="input"
            disabled={loading}
          >
            <option value="TRIMMED">Trimmed Mean (min+max at)</option>
            <option value="MEAN">Düz Ortalama</option>
          </select>
        </div>
      </div>

      {/* Durum */}
      <div className="space-y-2">
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Durum
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as CompetitionStatus)}
          className="input"
          disabled={loading}
        >
          <option value="DRAFT">Taslak</option>
          <option value="ACTIVE">Aktif</option>
          <option value="COMPLETED">Tamamlandı</option>
        </select>
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
          {loading ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Yarışma Oluştur'}
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
