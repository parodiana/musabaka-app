'use client'

import { useState } from 'react'
import { createEvent, updateEvent, DANCE_PRESETS, type EventInput } from '@/lib/firebase/events'
import type { Event, Discipline, Gender, Class, EntryMode, EventStatus } from '@/types'

interface EventFormProps {
  competitionId: string
  defaultEntryMode?: EntryMode
  event?: Event
  onSuccess?: () => void
  onCancel?: () => void
}

export function EventForm({
  competitionId,
  defaultEntryMode = 'AUTO',
  event,
  onSuccess,
  onCancel,
}: EventFormProps) {
  const isEdit = !!event

  const [eventName, setEventName] = useState(event?.eventName ?? '')
  const [eventCode, setEventCode] = useState(event?.eventCode ?? '')
  const [discipline, setDiscipline] = useState<Discipline>(event?.discipline ?? 'Standard')
  const [gender, setGender] = useState<Gender>(event?.gender ?? 'Mixed')
  const [klass, setKlass] = useState<Class>(event?.class ?? 'Class1')
  const [format, setFormat] = useState<'Single' | 'Duo' | 'Combi'>(event?.format ?? 'Single')
  const [entryMode, setEntryMode] = useState<EntryMode>(event?.entryMode ?? defaultEntryMode)
  const [dances, setDances] = useState<string[]>(event?.dances ?? [])
  const [judgeCount, setJudgeCount] = useState<number>(event?.judgeCount ?? 5)
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'PENDING')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableDances = DANCE_PRESETS[discipline]

  const toggleDance = (dance: string) => {
    setDances((prev) =>
      prev.includes(dance) ? prev.filter((d) => d !== dance) : [...prev, dance]
    )
  }

  const handleDisciplineChange = (d: Discipline) => {
    setDiscipline(d)
    // Yeni disiplinde geçerli olmayan dansları temizle
    setDances((prev) => prev.filter((dance) => DANCE_PRESETS[d].includes(dance)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (dances.length === 0) {
      setError('En az bir dans seçmelisiniz')
      return
    }

    setLoading(true)
    try {
      const input: EventInput = {
        competitionId,
        eventCode: eventCode.trim().toUpperCase(),
        eventName: eventName.trim(),
        discipline,
        gender,
        class: klass,
        format,
        entryMode,
        dances,
        judgeCount,
        status,
      }

      if (isEdit && event) {
        await updateEvent(event.id, input)
      } else {
        await createEvent(input)
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
      {/* Kategori adı */}
      <div className="space-y-2">
        <label htmlFor="eventName" className="block text-sm font-medium text-gray-700">
          Kategori Adı
        </label>
        <input
          id="eventName"
          type="text"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          className="input"
          placeholder="Örn: Men's Single Freestyle Class 1"
          required
          minLength={3}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Kod */}
        <div className="space-y-2">
          <label htmlFor="eventCode" className="block text-sm font-medium text-gray-700">
            Kategori Kodu
          </label>
          <input
            id="eventCode"
            type="text"
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value)}
            className="input uppercase"
            placeholder="MSF-C1"
            required
            disabled={loading}
          />
        </div>

        {/* Hakem sayısı */}
        <div className="space-y-2">
          <label htmlFor="judgeCount" className="block text-sm font-medium text-gray-700">
            Hakem Sayısı
          </label>
          <input
            id="judgeCount"
            type="number"
            value={judgeCount}
            onChange={(e) => setJudgeCount(Number(e.target.value))}
            className="input"
            min={1}
            max={12}
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Disiplin */}
        <div className="space-y-2">
          <label htmlFor="discipline" className="block text-sm font-medium text-gray-700">
            Disiplin
          </label>
          <select
            id="discipline"
            value={discipline}
            onChange={(e) => handleDisciplineChange(e.target.value as Discipline)}
            className="input"
            disabled={loading}
          >
            <option value="Standard">Standart</option>
            <option value="Latin">Latin</option>
            <option value="Freestyle">Freestyle</option>
          </select>
        </div>

        {/* Format */}
        <div className="space-y-2">
          <label htmlFor="format" className="block text-sm font-medium text-gray-700">
            Format
          </label>
          <select
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value as 'Single' | 'Duo' | 'Combi')}
            className="input"
            disabled={loading}
          >
            <option value="Single">Single (Tek)</option>
            <option value="Duo">Duo (Çift)</option>
            <option value="Combi">Combi</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cinsiyet */}
        <div className="space-y-2">
          <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
            Cinsiyet
          </label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
            className="input"
            disabled={loading}
          >
            <option value="M">Erkek</option>
            <option value="F">Kadın</option>
            <option value="Mixed">Karışık</option>
          </select>
        </div>

        {/* Sınıf */}
        <div className="space-y-2">
          <label htmlFor="klass" className="block text-sm font-medium text-gray-700">
            Sınıf
          </label>
          <select
            id="klass"
            value={klass}
            onChange={(e) => setKlass(e.target.value as Class)}
            className="input"
            disabled={loading}
          >
            <option value="Class1">Class 1</option>
            <option value="Class2">Class 2</option>
            <option value="Powerchair">Powerchair</option>
            <option value="VI">VI (Görme Engelli)</option>
          </select>
        </div>
      </div>

      {/* Giriş modu */}
      <div className="space-y-2">
        <label htmlFor="entryMode" className="block text-sm font-medium text-gray-700">
          Giriş Modu
        </label>
        <select
          id="entryMode"
          value={entryMode}
          onChange={(e) => setEntryMode(e.target.value as EntryMode)}
          className="input"
          disabled={loading}
        >
          <option value="AUTO">Otomatik (Hakem tablet)</option>
          <option value="TABLE">Masa (Kağıttan giriş)</option>
        </select>
      </div>

      {/* Danslar */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Danslar</label>
        <div className="flex flex-wrap gap-2">
          {availableDances.map((dance) => {
            const selected = dances.includes(dance)
            return (
              <button
                key={dance}
                type="button"
                onClick={() => toggleDance(dance)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {dance}
              </button>
            )
          })}
        </div>
        {dances.length > 0 && (
          <p className="text-xs text-gray-500">{dances.length} dans seçildi</p>
        )}
      </div>

      {/* Durum */}
      <div className="space-y-2">
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Durum
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as EventStatus)}
          className="input"
          disabled={loading}
        >
          <option value="PENDING">Beklemede</option>
          <option value="IN_PROGRESS">Devam Ediyor</option>
          <option value="AWAITING_APPROVAL">Onay Bekliyor</option>
          <option value="APPROVED">Onaylandı</option>
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
          {loading ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Kategori Oluştur'}
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
