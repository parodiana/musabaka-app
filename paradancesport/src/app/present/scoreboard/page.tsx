'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { doc, collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/useAuth'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { mapEntry } from '@/lib/firebase/entries'
import { mapScore } from '@/lib/firebase/scores'
import { mapDeduction } from '@/lib/firebase/deductions'
import { aggregateEventScores, type EntryComputation } from '@/lib/scoring/aggregator'
import { useI18n } from '@/i18n/useI18n'
import type { Competition, Event, Entry, Score, Deduction } from '@/types'
import { Radio, Maximize2, Minimize2, Trophy } from 'lucide-react'

export default function PresentScoreboardPage() {
  return (
    <Suspense fallback={null}>
      <PresentScoreboard />
    </Suspense>
  )
}

function PresentScoreboard() {
  const params = useSearchParams()
  const compId = params.get('c') ?? ''
  const eventId = params.get('e') ?? ''
  const { isAuthenticated, loading } = useAuth()
  const { t } = useI18n()

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [deductions, setDeductions] = useState<Deduction[]>([])
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!compId || !eventId || !isAuthenticated) return
    const u0 = onSnapshot(doc(db, 'competitions', compId), (s) =>
      setCompetition(s.exists() ? mapCompetition(s.id, s.data()) : null)
    )
    const u1 = onSnapshot(doc(db, 'events', eventId), (s) =>
      setEvent(s.exists() ? mapEvent(s.id, s.data()) : null)
    )
    const u2 = onSnapshot(query(collection(db, 'entries'), where('eventId', '==', eventId)), (s) =>
      setEntries(s.docs.map((d) => mapEntry(d.id, d.data())))
    )
    const u3 = onSnapshot(query(collection(db, 'scores'), where('eventId', '==', eventId)), (s) =>
      setScores(s.docs.map((d) => mapScore(d.id, d.data())))
    )
    const u4 = onSnapshot(query(collection(db, 'deductions'), where('eventId', '==', eventId)), (s) =>
      setDeductions(s.docs.map((d) => mapDeduction(d.id, d.data())))
    )
    return () => {
      u0()
      u1()
      u2()
      u3()
      u4()
    }
  }, [compId, eventId, isAuthenticated])

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  const mode = competition?.aggregationMode ?? 'TRIMMED'
  const singleDance = !event || event.dances.length <= 1
  const bibMap = useMemo(() => new Map(entries.map((e) => [e.id, e.bibNumber])), [entries])

  const results: EntryComputation[] = useMemo(() => {
    if (!eventId || scores.length === 0) return []
    return aggregateEventScores(scores, deductions, mode)
  }, [scores, deductions, mode, eventId])

  if (!loading && !isAuthenticated) {
    return (
      <Centered>
        <p className="text-2xl text-gray-300">{t('present.signIn')}</p>
      </Centered>
    )
  }

  if (!compId || !eventId) {
    return (
      <Centered>
        <p className="text-2xl text-gray-300">{t('present.noSelection')}</p>
      </Centered>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      {/* Üst bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Trophy className="w-9 h-9 text-yellow-400" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              {event?.eventName ?? '—'}
            </h1>
            <p className="text-sm text-slate-300">
              {competition?.name}
              {results.length > 0 && ` · ${results.length} ${t('present.competitors')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-red-500/20 text-red-300 px-3 py-1 text-sm font-semibold">
            <Radio className="w-4 h-4 animate-pulse" /> {t('scoreboard.live')}
          </span>
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm"
            title={fullscreen ? t('present.exitFullscreen') : t('present.fullscreen')}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {fullscreen ? t('present.exitFullscreen') : t('present.fullscreen')}
          </button>
        </div>
      </div>

      {/* Tablo */}
      {results.length === 0 ? (
        <Centered>
          <Radio className="w-12 h-12 text-slate-500 mb-4 animate-pulse" />
          <p className="text-3xl text-slate-400">{t('present.waiting')}</p>
        </Centered>
      ) : (
        <div className="px-8 py-6">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xl border-b border-white/10">
                <th className="py-4 w-28">{t('present.rank')}</th>
                <th className="py-4 w-40">{t('present.bib')}</th>
                {singleDance && (
                  <>
                    <th className="py-4 text-right">TS</th>
                    <th className="py-4 text-right">MCP</th>
                    <th className="py-4 text-right">DL</th>
                  </>
                )}
                <th className="py-4 text-right">{t('present.final')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const d0 = r.danceResults[0]
                const medal =
                  r.rank === 1
                    ? 'text-yellow-400'
                    : r.rank === 2
                      ? 'text-slate-300'
                      : r.rank === 3
                        ? 'text-orange-400'
                        : 'text-slate-500'
                return (
                  <tr key={r.entryId} className="border-b border-white/5">
                    <td className="py-5">
                      <span className={`text-4xl font-black ${medal}`}>{r.rank}</span>
                      {r.tied && <span className="ml-2 text-sm text-amber-400 align-top">=</span>}
                    </td>
                    <td className="py-5">
                      <span className="inline-flex items-center justify-center min-w-[3.5rem] h-14 px-3 rounded-xl bg-white text-slate-900 text-3xl font-black">
                        {bibMap.get(r.entryId) ?? '?'}
                      </span>
                    </td>
                    {singleDance && d0 && (
                      <>
                        <td className="py-5 text-right text-2xl tabular-nums text-slate-200">
                          {d0.tsValue.toFixed(3)}
                        </td>
                        <td className="py-5 text-right text-2xl tabular-nums text-slate-200">
                          {d0.mcpValue.toFixed(3)}
                        </td>
                        <td className="py-5 text-right text-2xl tabular-nums text-slate-200">
                          {d0.dlValue.toFixed(3)}
                        </td>
                      </>
                    )}
                    <td className="py-5 text-right">
                      <span className="text-4xl font-black tabular-nums">
                        {r.finalScore.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center text-center p-8">
      {children}
    </div>
  )
}
