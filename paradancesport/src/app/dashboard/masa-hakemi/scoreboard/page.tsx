'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { mapEntry } from '@/lib/firebase/entries'
import { mapScore } from '@/lib/firebase/scores'
import { mapDeduction } from '@/lib/firebase/deductions'
import { aggregateEventScores, type EntryComputation } from '@/lib/scoring/aggregator'
import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'
import type { Competition, Event, Entry, Score, Deduction } from '@/types'
import { Trophy, ShieldAlert, Radio, MonitorPlay } from 'lucide-react'

export default function ScoreBoardPage() {
  const { user } = useAuthStore()
  const { t } = useI18n()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [deductions, setDeductions] = useState<Deduction[]>([])

  const [compId, setCompId] = useState('')
  const [eventId, setEventId] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'competitions'), orderBy('date', 'desc')), (s) =>
      setCompetitions(s.docs.map((d) => mapCompetition(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!compId) {
      setEvents([])
      return
    }
    const unsub = onSnapshot(query(collection(db, 'events'), where('competitionId', '==', compId)), (s) => {
      const list = s.docs.map((d) => mapEvent(d.id, d.data()))
      list.sort((a, b) => a.eventCode.localeCompare(b.eventCode))
      setEvents(list)
    })
    return () => unsub()
  }, [compId])

  useEffect(() => {
    if (!eventId) {
      setEntries([])
      setScores([])
      setDeductions([])
      return
    }
    const u1 = onSnapshot(query(collection(db, 'entries'), where('eventId', '==', eventId)), (s) =>
      setEntries(s.docs.map((d) => mapEntry(d.id, d.data())))
    )
    const u2 = onSnapshot(query(collection(db, 'scores'), where('eventId', '==', eventId)), (s) =>
      setScores(s.docs.map((d) => mapScore(d.id, d.data())))
    )
    const u3 = onSnapshot(query(collection(db, 'deductions'), where('eventId', '==', eventId)), (s) =>
      setDeductions(s.docs.map((d) => mapDeduction(d.id, d.data())))
    )
    return () => {
      u1()
      u2()
      u3()
    }
  }, [eventId])

  const selectedComp = competitions.find((c) => c.id === compId)
  const selectedEvent = events.find((e) => e.id === eventId)
  const mode = selectedComp?.aggregationMode ?? 'TRIMMED'
  const singleDance = !selectedEvent || selectedEvent.dances.length <= 1

  const bibMap = useMemo(() => new Map(entries.map((e) => [e.id, e.bibNumber])), [entries])

  const results: EntryComputation[] = useMemo(() => {
    if (!eventId || scores.length === 0) return []
    return aggregateEventScores(scores, deductions, mode)
  }, [scores, deductions, mode, eventId])

  if (user && !['masa_hakemi', 'admin', 'bashakem'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t('scoreboard.title')}</h1>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-600">
          <Radio className="w-3 h-3" /> {t('scoreboard.live')}
        </span>
        {eventId && (
          <button
            onClick={() =>
              window.open(
                `/present/scoreboard?c=${encodeURIComponent(compId)}&e=${encodeURIComponent(eventId)}`,
                'pdsScoreboard',
                'width=1280,height=800'
              )
            }
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <MonitorPlay className="w-4 h-4" /> {t('scoreboard.present')}
          </button>
        )}
      </div>

      {/* Seçimler */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Yarışma</label>
          <select
            value={compId}
            onChange={(e) => {
              setCompId(e.target.value)
              setEventId('')
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
            onChange={(e) => setEventId(e.target.value)}
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

      {/* Tablo */}
      {eventId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">{selectedEvent?.eventName}</span>
            </div>
            <span className="text-xs text-gray-500">
              {mode === 'TRIMMED' ? 'Trimmed Mean' : 'Düz Ortalama'} · {results.length} yarışmacı
            </span>
          </div>

          {results.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              Henüz puan girilmedi. Masa hakemi puan girişi yapınca burada canlı sıralama belirir.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-5 py-2 font-medium w-16">Sıra</th>
                  <th className="px-5 py-2 font-medium">Sırt No</th>
                  {singleDance && (
                    <>
                      <th className="px-5 py-2 font-medium text-right">TS</th>
                      <th className="px-5 py-2 font-medium text-right">MCP</th>
                      <th className="px-5 py-2 font-medium text-right">DL</th>
                      <th className="px-5 py-2 font-medium text-right">Kesinti</th>
                    </>
                  )}
                  {!singleDance && <th className="px-5 py-2 font-medium text-center">Dans</th>}
                  <th className="px-5 py-2 font-medium text-right">Final</th>
                  <th className="px-5 py-2 font-medium text-right">Tie-break</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const d0 = r.danceResults[0]
                  return (
                    <tr key={r.entryId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-2">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                            r.rank === 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : r.rank === 2
                                ? 'bg-gray-200 text-gray-700'
                                : r.rank === 3
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          {r.rank}
                        </span>
                        {r.tied && <span className="ml-1 text-xs text-amber-600">eşit</span>}
                      </td>
                      <td className="px-5 py-2">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-white font-bold">
                          {bibMap.get(r.entryId) ?? '?'}
                        </span>
                      </td>
                      {singleDance && d0 && (
                        <>
                          <td className="px-5 py-2 text-right tabular-nums">{d0.tsValue.toFixed(3)}</td>
                          <td className="px-5 py-2 text-right tabular-nums">{d0.mcpValue.toFixed(3)}</td>
                          <td className="px-5 py-2 text-right tabular-nums">{d0.dlValue.toFixed(3)}</td>
                          <td className="px-5 py-2 text-right tabular-nums text-red-600">
                            {d0.deductions > 0 ? `−${d0.deductions.toFixed(3)}` : '—'}
                          </td>
                        </>
                      )}
                      {!singleDance && (
                        <td className="px-5 py-2 text-center text-gray-500">{r.danceResults.length}</td>
                      )}
                      <td className="px-5 py-2 text-right font-bold text-gray-900 tabular-nums">
                        {r.finalScore.toFixed(3)}
                      </td>
                      <td className="px-5 py-2 text-right text-gray-400 tabular-nums">
                        {r.tieBreakScore.toFixed(3)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
