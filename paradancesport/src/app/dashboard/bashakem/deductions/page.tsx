'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { mapEntry } from '@/lib/firebase/entries'
import { mapDeduction, createDeduction, deleteDeduction } from '@/lib/firebase/deductions'
import { useAuthStore } from '@/store/auth.store'
import type { Competition, Event, Entry, Deduction, DeductionType } from '@/types'
import { ShieldAlert, MinusCircle, Trash2 } from 'lucide-react'

const DEDUCTION_LABELS: Record<DeductionType, string> = {
  FALL: 'Düşme',
  FLOOR_DANCE: 'Yerde Dans',
  ACCESSORY: 'Aksesuar İhlali',
  TIME_LIMIT: 'Süre Aşımı',
  DRESS_CODE: 'Kıyafet İhlali',
  EXCESS_LIFT: 'Fazla Kaldırma',
  DSQ: 'Diskalifiye',
}

const DEDUCTION_TYPES = Object.keys(DEDUCTION_LABELS) as DeductionType[]

export default function DeductionsPage() {
  const { user } = useAuthStore()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [deductions, setDeductions] = useState<Deduction[]>([])

  const [compId, setCompId] = useState('')
  const [eventId, setEventId] = useState('')
  const [entryId, setEntryId] = useState('')
  const [dance, setDance] = useState('')
  const [type, setType] = useState<DeductionType>('FALL')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Yarışmalar
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'competitions'), orderBy('date', 'desc')), (s) =>
      setCompetitions(s.docs.map((d) => mapCompetition(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  // Kategoriler
  useEffect(() => {
    if (!compId) {
      setEvents([])
      return
    }
    const unsub = onSnapshot(
      query(collection(db, 'events'), where('competitionId', '==', compId)),
      (s) => {
        const list = s.docs.map((d) => mapEvent(d.id, d.data()))
        list.sort((a, b) => a.eventCode.localeCompare(b.eventCode))
        setEvents(list)
      }
    )
    return () => unsub()
  }, [compId])

  // Kayıtlar + kesintiler
  useEffect(() => {
    if (!eventId) {
      setEntries([])
      setDeductions([])
      return
    }
    const u1 = onSnapshot(query(collection(db, 'entries'), where('eventId', '==', eventId)), (s) => {
      const list = s.docs.map((d) => mapEntry(d.id, d.data()))
      list.sort((a, b) => a.bibNumber - b.bibNumber)
      setEntries(list)
    })
    const u2 = onSnapshot(query(collection(db, 'deductions'), where('eventId', '==', eventId)), (s) =>
      setDeductions(s.docs.map((d) => mapDeduction(d.id, d.data())))
    )
    return () => {
      u1()
      u2()
    }
  }, [eventId])

  const selectedComp = competitions.find((c) => c.id === compId)
  const selectedEvent = events.find((e) => e.id === eventId)
  const bibByEntry = useMemo(() => new Map(entries.map((e) => [e.id, e.bibNumber])), [entries])

  // Kategori dans içeriyorsa ilk dansı otomatik seç (tek dansta zaten o seçili gelir)
  useEffect(() => {
    const ev = events.find((e) => e.id === eventId)
    setDance(ev && ev.dances.length > 0 ? ev.dances[0] : '')
  }, [eventId, events])

  const resetForm = () => {
    setEntryId('')
    // dans seçimi korunur — aynı dans için arka arkaya kesinti girilebilsin;
    // kategori/yarışma değişince useEffect dansı yeniden ayarlar
    setType('FALL')
    setAmount('')
    setReason('')
  }

  const handleSubmit = async () => {
    setError('')
    if (!selectedComp || !selectedEvent || !entryId) {
      setError('Yarışma, kategori ve sırt no seçin.')
      return
    }
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Geçerli bir kesinti miktarı girin (0’dan büyük).')
      return
    }
    setBusy(true)
    try {
      await createDeduction({
        competitionId: selectedComp.id,
        eventId: selectedEvent.id,
        entryId,
        dance: dance || undefined,
        type,
        amount: amt,
        reason: reason.trim(),
        enteredBy: user?.uid ?? '',
      })
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kesinti kaydedilemedi')
    } finally {
      setBusy(false)
    }
  }

  if (user && user.role !== 'bashakem' && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
          <p className="text-gray-600 mt-2">Bu sayfa Başhakem/Admin içindir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kesinti Girişi</h1>
        <p className="text-gray-600 mt-1">
          Kesintileri doğrudan Başhakem/Admin girer (kolektif oylama yok). Sonuç hesaplanırken düşülür.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Yarışma</label>
            <select
              value={compId}
              onChange={(e) => {
                setCompId(e.target.value)
                setEventId('')
                resetForm()
              }}
              className="input"
            >
              <option value="">— Seç —</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Kategori</label>
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value)
                resetForm()
              }}
              className="input"
              disabled={!compId}
            >
              <option value="">— Seç —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.eventCode} · {ev.eventName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Sırt No</label>
            <select
              value={entryId}
              onChange={(e) => setEntryId(e.target.value)}
              className="input"
              disabled={!eventId}
            >
              <option value="">— Seç —</option>
              {entries.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.bibNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Dans</label>
            <select
              value={dance}
              onChange={(e) => setDance(e.target.value)}
              className="input"
              disabled={!eventId || (selectedEvent?.dances.length ?? 0) <= 1}
            >
              {selectedEvent && selectedEvent.dances.length > 0 ? (
                selectedEvent.dances.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))
              ) : (
                <option value="">Tüm program (danssız)</option>
              )}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Kesinti Türü</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeductionType)}
              className="input"
              disabled={!eventId}
            >
              {DEDUCTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEDUCTION_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Miktar (puan)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
              placeholder="örn. 1.0"
              disabled={!eventId}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="block text-xs font-medium text-gray-600">Gerekçe (opsiyonel)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              placeholder="örn. İkinci turda düşme"
              disabled={!eventId}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={busy || !entryId}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <MinusCircle className="w-4 h-4" />
            {busy ? 'Kaydediliyor…' : 'Kesinti Ekle'}
          </button>
        </div>
      </div>

      {/* Mevcut kesintiler */}
      {eventId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Bu Kategorideki Kesintiler</span>
            <span className="ml-2 text-xs text-gray-500">({deductions.length})</span>
          </div>
          {deductions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-500">Henüz kesinti yok.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-5 py-2 font-medium">Sırt No</th>
                  <th className="px-5 py-2 font-medium">Dans</th>
                  <th className="px-5 py-2 font-medium">Tür</th>
                  <th className="px-5 py-2 font-medium">Gerekçe</th>
                  <th className="px-5 py-2 font-medium text-right">Miktar</th>
                  <th className="px-5 py-2 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100">
                    <td className="px-5 py-2 font-bold text-gray-900">
                      {bibByEntry.get(d.entryId) ?? '—'}
                    </td>
                    <td className="px-5 py-2 text-gray-600">{d.dance || 'Tüm program'}</td>
                    <td className="px-5 py-2 text-gray-600">{DEDUCTION_LABELS[d.type]}</td>
                    <td className="px-5 py-2 text-gray-500">{d.reason || '—'}</td>
                    <td className="px-5 py-2 text-right font-bold text-red-600 tabular-nums">
                      −{d.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={() => deleteDeduction(d.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
