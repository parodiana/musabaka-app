'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { mapEntry } from '@/lib/firebase/entries'
import { mapScore } from '@/lib/firebase/scores'
import { mapJudgeAssignment } from '@/lib/firebase/judgeAssignments'
import { mapJudge } from '@/lib/firebase/judges'
import {
  mapResult,
  calculateEventResults,
  approveEventResults,
  returnEventResults,
} from '@/lib/firebase/results'
import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'
import type {
  Competition,
  Event,
  Entry,
  Result,
  EventStatus,
  Score,
  JudgeAssignment,
  Judge,
  ScoringComponent,
} from '@/types'
import {
  ShieldAlert,
  Calculator,
  CheckCircle2,
  Undo2,
  Trophy,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

const COMPONENTS: ScoringComponent[] = ['TS', 'MCP', 'DL']
const danceKey = (d?: string) => (d && d.trim() ? d.trim() : '')

const STATUS_STYLE: Record<EventStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  AWAITING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-700',
}

export default function ApprovalPage() {
  const { user } = useAuthStore()
  const { t } = useI18n()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([])
  const [judges, setJudges] = useState<Judge[]>([])

  const [compId, setCompId] = useState('')
  const [eventId, setEventId] = useState('')

  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'approve' | 'return'>(null)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Yarışmalar
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'competitions'), orderBy('date', 'desc')), (s) =>
      setCompetitions(s.docs.map((d) => mapCompetition(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  // Hakemler (panel isimleri için)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'judges'), (s) =>
      setJudges(s.docs.map((d) => mapJudge(d.id, d.data())))
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

  // Kayıtlar + sonuçlar + ham puanlar + atamalar
  useEffect(() => {
    if (!eventId) {
      setEntries([])
      setResults([])
      setScores([])
      setAssignments([])
      setExpandedId(null)
      return
    }
    const u1 = onSnapshot(query(collection(db, 'entries'), where('eventId', '==', eventId)), (s) =>
      setEntries(s.docs.map((d) => mapEntry(d.id, d.data())))
    )
    const u2 = onSnapshot(query(collection(db, 'results'), where('eventId', '==', eventId)), (s) =>
      setResults(s.docs.map((d) => mapResult(d.id, d.data())))
    )
    const u3 = onSnapshot(query(collection(db, 'scores'), where('eventId', '==', eventId)), (s) =>
      setScores(s.docs.map((d) => mapScore(d.id, d.data())))
    )
    const u4 = onSnapshot(
      query(collection(db, 'judgeAssignments'), where('eventId', '==', eventId)),
      (s) => setAssignments(s.docs.map((d) => mapJudgeAssignment(d.id, d.data())))
    )
    return () => {
      u1()
      u2()
      u3()
      u4()
    }
  }, [eventId])

  const selectedComp = competitions.find((c) => c.id === compId)
  const selectedEvent = events.find((e) => e.id === eventId)
  const sortedResults = useMemo(
    () => [...results].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
    [results]
  )
  const multiDance = (selectedEvent?.dances.length ?? 0) > 1

  const judgeMap = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges])

  // Danslar (boşsa tek "danssız")
  const dances: (string | undefined)[] = useMemo(
    () => (selectedEvent && selectedEvent.dances.length > 0 ? selectedEvent.dances : [undefined]),
    [selectedEvent]
  )

  // Bileşen → o bileşeni puanlayan hakemler (panel harfine göre sıralı)
  const componentJudges = useMemo(() => {
    const m: Record<ScoringComponent, { label: string; judgeId: string }[]> = {
      TS: [],
      MCP: [],
      DL: [],
    }
    for (const a of assignments) {
      for (const c of a.components) m[c].push({ label: a.judgeLabel, judgeId: a.judgeId })
    }
    for (const c of COMPONENTS) m[c].sort((x, y) => x.label.localeCompare(y.label))
    return m
  }, [assignments])

  // entryId|dance|component|judgeId -> value
  const rawScoreMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scores) {
      m.set(`${s.entryId}|${danceKey(s.dance)}|${s.component}|${s.judgeId}`, s.value)
    }
    return m
  }, [scores])

  const aggMode = selectedComp?.aggregationMode ?? 'TRIMMED'

  const handleCalculate = async () => {
    if (!selectedComp || !selectedEvent) return
    setBusy(true)
    setError('')
    try {
      const n = await calculateEventResults({
        competitionId: selectedComp.id,
        eventId: selectedEvent.id,
        entries,
        aggregationMode: selectedComp.aggregationMode,
      })
      if (n === 0) {
        setError(t('appr.noScores'))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('appr.errCalc'))
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedEvent || !user) return
    setBusy(true)
    setError('')
    try {
      await approveEventResults(selectedEvent.id, user.uid)
      setConfirm(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('appr.errApprove'))
    } finally {
      setBusy(false)
    }
  }

  const handleReturn = async () => {
    if (!selectedEvent) return
    setBusy(true)
    setError('')
    try {
      await returnEventResults(selectedEvent.id)
      setConfirm(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('appr.errReturn'))
    } finally {
      setBusy(false)
    }
  }

  if (user && user.role !== 'bashakem' && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">{t('common.accessDenied')}</h2>
          <p className="text-gray-600 mt-2">{t('appr.forChair')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('appr.title')}</h1>
        <p className="text-gray-600 mt-1">{t('appr.subtitle')}</p>
      </div>

      {/* Seçimler */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">{t('common.competition')}</label>
          <select
            value={compId}
            onChange={(e) => {
              setCompId(e.target.value)
              setEventId('')
              setError('')
            }}
            className="input"
          >
            <option value="">{t('common.select')}</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">{t('common.category')}</label>
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value)
              setError('')
            }}
            className="input"
            disabled={!compId}
          >
            <option value="">{t('common.select')}</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.eventCode} · {ev.eventName} — {t(`estatus.${ev.status}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {selectedEvent && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Başlık + durum + aksiyonlar */}
          <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">
                  {selectedEvent.eventCode} · {selectedEvent.eventName}
                </p>
                <p className="text-xs text-gray-500">
                  {t('appr.aggMode')}:{' '}
                  {selectedComp?.aggregationMode === 'MEAN' ? t('common.plainMean') : t('common.trimmedMean')}
                  {selectedEvent.dances.length > 0 && ` · ${selectedEvent.dances.join(', ')}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[selectedEvent.status]}`}>
                {t(`estatus.${selectedEvent.status}`)}
              </span>
            </div>
          </div>

          {/* Aksiyon çubuğu */}
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-3">
            <button
              onClick={handleCalculate}
              disabled={busy || selectedEvent.status === 'APPROVED'}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Calculator className="w-4 h-4" />
              {results.length > 0 ? t('appr.recalculate') : t('appr.calculate')}
            </button>
            <button
              onClick={() => setConfirm('approve')}
              disabled={busy || results.length === 0 || selectedEvent.status === 'APPROVED'}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> {t('appr.approve')}
            </button>
            <button
              onClick={() => setConfirm('return')}
              disabled={busy || results.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              <Undo2 className="w-4 h-4" /> {t('appr.return')}
            </button>
          </div>

          {/* Sonuç tablosu */}
          {results.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              {t('appr.notCalculated')}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium w-10"></th>
                  <th className="px-5 py-2 font-medium w-16">{t('common.rank')}</th>
                  <th className="px-5 py-2 font-medium w-24">{t('common.bib')}</th>
                  {!multiDance && (
                    <>
                      <th className="px-5 py-2 font-medium">TS</th>
                      <th className="px-5 py-2 font-medium">MCP</th>
                      <th className="px-5 py-2 font-medium">DL</th>
                    </>
                  )}
                  <th className="px-5 py-2 font-medium">{t('common.deduction')}</th>
                  <th className="px-5 py-2 font-medium text-right">{t('common.final')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r) => {
                  const open = expandedId === r.entryId
                  const colCount = multiDance ? 5 : 8
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedId(open ? null : r.entryId)}
                      >
                        <td className="px-3 py-2 text-gray-400">
                          {open ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-5 py-2">
                          <span className="inline-flex items-center gap-1 font-bold text-gray-900">
                            {r.rank}
                            {r.tied && (
                              <span className="text-xs font-normal text-amber-600">({t('appr.tied')})</span>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-2">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-white font-bold">
                            {r.bibNumber ?? '—'}
                          </span>
                        </td>
                        {!multiDance && (
                          <>
                            <td className="px-5 py-2 tabular-nums">{r.tsValue.toFixed(3)}</td>
                            <td className="px-5 py-2 tabular-nums">{r.mcpValue.toFixed(3)}</td>
                            <td className="px-5 py-2 tabular-nums">{r.dlValue.toFixed(3)}</td>
                          </>
                        )}
                        <td className="px-5 py-2 tabular-nums text-red-600">
                          {r.deductions > 0 ? `−${r.deductions.toFixed(3)}` : '—'}
                        </td>
                        <td className="px-5 py-2 text-right font-bold tabular-nums text-gray-900">
                          {r.finalScore.toFixed(3)}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={colCount} className="px-5 py-4">
                            <JudgeDetail
                              result={r}
                              dances={dances}
                              componentJudges={componentJudges}
                              rawScoreMap={rawScoreMap}
                              judgeMap={judgeMap}
                              mode={aggMode}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Onay / İade popup */}
      {confirm && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="font-semibold text-gray-900">
                {confirm === 'approve' ? t('appr.confirmApproveTitle') : t('appr.confirmReturnTitle')}
              </h3>
              <button onClick={() => setConfirm(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-gray-600">
                {confirm === 'approve'
                  ? t('appr.confirmApproveText', { event: selectedEvent.eventName, n: results.length })
                  : t('appr.confirmReturnText', { event: selectedEvent.eventName })}
              </p>
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
                {sortedResults.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2">
                    <span className="text-gray-600">
                      #{r.rank} · {t('common.bib')} {r.bibNumber}
                    </span>
                    <span className="font-bold text-gray-900 tabular-nums">
                      {r.finalScore.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 border-t border-gray-200 px-5 py-3">
              <button
                onClick={() => setConfirm(null)}
                disabled={busy}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('appr.giveUp')}
              </button>
              {confirm === 'approve' ? (
                <button
                  onClick={handleApprove}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busy ? t('appr.approving') : t('appr.approve')}
                </button>
              ) : (
                <button
                  onClick={handleReturn}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {busy ? t('appr.returning') : t('appr.return')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Bir kaydın protokol tablosu (tek satır): tüm hakem puanları + Ort; atılan (min/maks) üzeri çizili. */
function JudgeDetail({
  result,
  dances,
  componentJudges,
  rawScoreMap,
  judgeMap,
  mode,
}: {
  result: Result
  dances: (string | undefined)[]
  componentJudges: Record<ScoringComponent, { label: string; judgeId: string }[]>
  rawScoreMap: Map<string, number>
  judgeMap: Map<string, Judge>
  mode: 'TRIMMED' | 'MEAN'
}) {
  const { t } = useI18n()
  const activeComponents = COMPONENTS.filter((c) => componentJudges[c].length > 0)

  const meanOf = (dance: string | undefined, c: ScoringComponent): number | undefined => {
    const dr = result.danceResults?.find((d) => danceKey(d.dance) === danceKey(dance))
    if (!dr) return undefined
    return c === 'TS' ? dr.tsValue : c === 'MCP' ? dr.mcpValue : dr.dlValue
  }

  const compCells = (dance: string | undefined, c: ScoringComponent) => {
    const list = componentJudges[c].map((j) => ({
      ...j,
      value: rawScoreMap.get(`${result.entryId}|${danceKey(dance)}|${c}|${j.judgeId}`),
    }))
    const present = list.filter((x) => x.value != null) as (typeof list[number] & {
      value: number
    })[]
    let minId: string | null = null
    let maxId: string | null = null
    if (mode === 'TRIMMED' && present.length >= 4) {
      const sorted = [...present].sort((a, b) => a.value - b.value)
      minId = sorted[0].judgeId
      maxId = sorted[sorted.length - 1].judgeId
    }
    return { list, minId, maxId }
  }

  return (
    <div className="space-y-4">
      {dances.map((dance) => (
        <div key={dance ?? 'single'} className="space-y-1">
          {dances.length > 1 && <p className="text-xs font-semibold text-gray-500">{dance}</p>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  {activeComponents.map((c) => (
                    <th
                      key={c}
                      colSpan={componentJudges[c].length + 1}
                      className="border border-gray-300 px-2 py-1 text-center font-semibold"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  {activeComponents.map((c) => (
                    <Fragment key={`h-${c}`}>
                      {componentJudges[c].map((j) => (
                        <th
                          key={`${c}-${j.label}`}
                          title={
                            judgeMap.get(j.judgeId)
                              ? `${judgeMap.get(j.judgeId)!.givenName} ${judgeMap.get(j.judgeId)!.familyName}`
                              : j.label
                          }
                          className="border border-gray-300 px-2 py-1 text-center font-medium w-14"
                        >
                          {j.label}
                        </th>
                      ))}
                      <th className="border border-gray-300 px-2 py-1 text-center font-semibold bg-gray-100">
                        Ort.
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {activeComponents.map((c) => {
                    const { list, minId, maxId } = compCells(dance, c)
                    const mean = meanOf(dance, c)
                    const dec = c === 'DL' ? 2 : 1
                    return (
                      <Fragment key={`row-${c}`}>
                        {list.map((j) => {
                          const dropped = j.judgeId === minId || j.judgeId === maxId
                          return (
                            <td
                              key={`${c}-${j.judgeId}`}
                              className={`border border-gray-200 px-2 py-1.5 text-center tabular-nums ${
                                dropped
                                  ? 'line-through text-red-500 decoration-red-500'
                                  : 'text-gray-800'
                              }`}
                            >
                              {j.value != null ? j.value.toFixed(dec) : '·'}
                            </td>
                          )
                        })}
                        <td className="border border-gray-200 px-2 py-1.5 text-center font-bold tabular-nums bg-gray-50">
                          {mean != null ? mean.toFixed(3) : '—'}
                        </td>
                      </Fragment>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {mode === 'MEAN' && (
        <p className="text-xs text-gray-400">{t('appr.detailMeanNote')}</p>
      )}
    </div>
  )
}
