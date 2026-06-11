'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapAthlete } from '@/lib/firebase/athletes'
import {
  mapEntry,
  createEntry,
  deleteEntry,
  isBibTaken,
  nextBibNumber,
} from '@/lib/firebase/entries'
import type { Event, Athlete, Entry } from '@/types'
import { Trash2, UserPlus, Shuffle, Hash } from 'lucide-react'

const statusLabels: Record<string, string> = {
  ACTIVE: 'Aktif',
  WITHDRAWN: 'Çekildi',
  DSQ: 'Diskalifiye',
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
  DSQ: 'bg-red-100 text-red-800',
}

export function EntryManager({ event }: { event: Event }) {
  const isDuo = event.format === 'Duo' || event.format === 'Combi'

  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [competitionEntries, setCompetitionEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [athleteId, setAthleteId] = useState('')
  const [athlete2Id, setAthlete2Id] = useState('')
  const [bib, setBib] = useState<number>(1)
  const [entryClass, setEntryClass] = useState<string>(event.class)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sporcuları dinle
  useEffect(() => {
    const q = query(collection(db, 'athletes'), orderBy('familyName'))
    const unsub = onSnapshot(q, (snap) => {
      setAthletes(snap.docs.map((d) => mapAthlete(d.id, d.data())))
    })
    return () => unsub()
  }, [])

  // Yarışmadaki TÜM kayıtları dinle (sırt no çakışması için)
  useEffect(() => {
    const q = query(
      collection(db, 'entries'),
      where('competitionId', '==', event.competitionId)
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCompetitionEntries(snap.docs.map((d) => mapEntry(d.id, d.data())))
        setLoading(false)
      },
      (err) => {
        console.error('Entries listener error:', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [event.competitionId])

  // Bu kategorinin kayıtları
  const eventEntries = useMemo(
    () =>
      competitionEntries
        .filter((e) => e.eventId === event.id)
        .sort((a, b) => a.bibNumber - b.bibNumber),
    [competitionEntries, event.id]
  )

  const athleteMap = useMemo(() => new Map(athletes.map((a) => [a.id, a])), [athletes])

  // İlk önerilen sırt no
  useEffect(() => {
    if (!loading) setBib(nextBibNumber(competitionEntries))
  }, [loading, competitionEntries])

  const athleteName = (id?: string) => {
    if (!id) return ''
    const a = athleteMap.get(id)
    return a ? `${a.givenName} ${a.familyName}` : '(silinmiş)'
  }

  const handleRandomBib = () => {
    setBib(nextBibNumber(competitionEntries))
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!athleteId) {
      setError('Bir sporcu seçin')
      return
    }
    if (isDuo && !athlete2Id) {
      setError('İkinci sporcuyu seçin (Duo/Combi)')
      return
    }
    if (isDuo && athleteId === athlete2Id) {
      setError('İki sporcu farklı olmalı')
      return
    }
    if (!bib || bib < 1) {
      setError('Geçerli bir sırt no girin')
      return
    }
    if (isBibTaken(competitionEntries, bib)) {
      setError(`Sırt no ${bib} bu yarışmada zaten kullanılıyor`)
      return
    }

    setSaving(true)
    try {
      await createEntry({
        competitionId: event.competitionId,
        eventId: event.id,
        athleteId: isDuo ? undefined : athleteId,
        athlete1Id: isDuo ? athleteId : undefined,
        athlete2Id: isDuo ? athlete2Id : undefined,
        bibNumber: bib,
        entryClass,
        status: 'ACTIVE',
      })
      // Sıfırla
      setAthleteId('')
      setAthlete2Id('')
      setBib(nextBibNumber([...competitionEntries, { bibNumber: bib } as Entry]))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await deleteEntry(id)
    } catch (err) {
      console.error('Remove entry error:', err)
      alert('Kayıt silinemedi.')
    }
  }

  const bibConflict = bib >= 1 && isBibTaken(competitionEntries, bib)

  return (
    <div className="space-y-5">
      {/* Bilgi */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        <strong>{event.eventName}</strong> · Format: <strong>{event.format}</strong> · Kayıt:{' '}
        <strong>{eventEntries.length}</strong>
      </div>

      {/* Mevcut kayıtlar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Kayıtlı Sporcular</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Yükleniyor...</p>
        ) : eventEntries.length === 0 ? (
          <p className="text-sm text-gray-500">Henüz kayıt yok.</p>
        ) : (
          <div className="space-y-2">
            {eventEntries.map((en) => (
              <div
                key={en.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
              >
                <span className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {en.bibNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {en.athleteId ? athleteName(en.athleteId) : null}
                    {en.athlete1Id ? (
                      <>
                        {athleteName(en.athlete1Id)}
                        <span className="text-gray-400"> & </span>
                        {athleteName(en.athlete2Id)}
                      </>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">{en.entryClass}</div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColors[en.status]}`}
                >
                  {statusLabels[en.status]}
                </span>
                <button
                  onClick={() => handleRemove(en.id)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0"
                  title="Kaldır"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yeni kayıt formu */}
      <form onSubmit={handleAdd} className="border-t border-gray-200 pt-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Sporcu Kaydet
        </h3>

        {/* Sporcu(lar) */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            {isDuo ? '1. Sporcu' : 'Sporcu'}
          </label>
          <AthletePicker
            athletes={athletes}
            value={athleteId}
            onChange={setAthleteId}
            excludeId={athlete2Id || undefined}
            disabled={saving}
          />
        </div>

        {isDuo && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">2. Sporcu (Eş)</label>
            <AthletePicker
              athletes={athletes}
              value={athlete2Id}
              onChange={setAthlete2Id}
              excludeId={athleteId || undefined}
              disabled={saving}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Sırt no */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Sırt No</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  value={bib}
                  onChange={(e) => setBib(Number(e.target.value))}
                  className={`input pl-9 ${bibConflict ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                  min={1}
                  disabled={saving}
                />
              </div>
              <button
                type="button"
                onClick={handleRandomBib}
                disabled={saving}
                title="Boş sırt no öner"
                className="px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
            {bibConflict && (
              <p className="text-xs text-red-600">Bu sırt no kullanılıyor</p>
            )}
          </div>

          {/* Sınıf */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Sınıf</label>
            <input
              type="text"
              value={entryClass}
              onChange={(e) => setEntryClass(e.target.value)}
              className="input"
              disabled={saving}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || athletes.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? 'Ekleniyor...'
            : athletes.length === 0
              ? 'Önce sporcu eklemelisiniz'
              : 'Sporcuyu Kaydet'}
        </button>
      </form>
    </div>
  )
}

/** Aranabilir sporcu seçici — isim, kulüp veya lisans no ile filtreler */
function AthletePicker({
  athletes,
  value,
  onChange,
  excludeId,
  disabled,
}: {
  athletes: Athlete[]
  value: string
  onChange: (id: string) => void
  excludeId?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const selected = athletes.find((a) => a.id === value)
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return athletes
      .filter((a) => a.id !== excludeId)
      .filter(
        (a) =>
          !term ||
          `${a.givenName} ${a.familyName} ${a.memberOrg ?? ''} ${a.externalIds?.wasms ?? ''}`
            .toLowerCase()
            .includes(term)
      )
      .slice(0, 50)
  }, [athletes, q, excludeId])

  const selectedLabel = selected
    ? `${selected.givenName} ${selected.familyName}${selected.memberOrg ? ` (${selected.memberOrg})` : ''}`
    : ''

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? q : selectedLabel}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setQ('')
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="İsim, kulüp veya lisans no ara..."
        className="input"
        disabled={disabled}
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
          {list.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">Eşleşme yok</li>
          ) : (
            list.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(a.id)
                    setOpen(false)
                    setQ('')
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-blue-50 ${
                    a.id === value ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">
                    {a.givenName} {a.familyName}
                  </span>
                  <span className="text-gray-400">
                    {' · '}
                    {a.memberOrg ?? '—'}
                    {a.externalIds?.wasms ? ` · ${a.externalIds.wasms}` : ''}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
