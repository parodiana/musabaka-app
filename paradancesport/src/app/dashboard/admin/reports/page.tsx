'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { mapEntry } from '@/lib/firebase/entries'
import { mapAthlete } from '@/lib/firebase/athletes'
import { mapJudge } from '@/lib/firebase/judges'
import { mapJudgeAssignment } from '@/lib/firebase/judgeAssignments'
import { mapScore } from '@/lib/firebase/scores'
import { mapResult } from '@/lib/firebase/results'
import { useAuthStore } from '@/store/auth.store'
import type {
  Competition,
  Event,
  Entry,
  Athlete,
  Judge,
  JudgeAssignment,
  Score,
  Result,
  ScoringComponent,
} from '@/types'
import { ShieldAlert, Printer, FileSpreadsheet, FileText } from 'lucide-react'

const COMPONENTS: ScoringComponent[] = ['TS', 'MCP', 'DL']
const danceKey = (d?: string) => (d && d.trim() ? d.trim() : '')

export default function ReportsPage() {
  const { user } = useAuthStore()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [judges, setJudges] = useState<Judge[]>([])
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([])
  const [scores, setScores] = useState<Score[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [usersList, setUsersList] = useState<{ uid: string; displayName: string }[]>([])

  const [compId, setCompId] = useState('')
  const [eventId, setEventId] = useState('')

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'competitions'), orderBy('date', 'desc')), (s) =>
      setCompetitions(s.docs.map((d) => mapCompetition(d.id, d.data())))
    )
    const u2 = onSnapshot(collection(db, 'athletes'), (s) =>
      setAthletes(s.docs.map((d) => mapAthlete(d.id, d.data())))
    )
    const u3 = onSnapshot(collection(db, 'judges'), (s) =>
      setJudges(s.docs.map((d) => mapJudge(d.id, d.data())))
    )
    const u4 = onSnapshot(collection(db, 'users'), (s) =>
      setUsersList(
        s.docs.map((d) => ({ uid: d.id, displayName: (d.data().displayName as string) ?? '' }))
      )
    )
    return () => {
      u1()
      u2()
      u3()
      u4()
    }
  }, [])

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

  useEffect(() => {
    if (!eventId) {
      setEntries([])
      setAssignments([])
      setScores([])
      setResults([])
      return
    }
    const u1 = onSnapshot(query(collection(db, 'entries'), where('eventId', '==', eventId)), (s) =>
      setEntries(s.docs.map((d) => mapEntry(d.id, d.data())))
    )
    const u2 = onSnapshot(
      query(collection(db, 'judgeAssignments'), where('eventId', '==', eventId)),
      (s) => setAssignments(s.docs.map((d) => mapJudgeAssignment(d.id, d.data())))
    )
    const u3 = onSnapshot(query(collection(db, 'scores'), where('eventId', '==', eventId)), (s) =>
      setScores(s.docs.map((d) => mapScore(d.id, d.data())))
    )
    const u4 = onSnapshot(query(collection(db, 'results'), where('eventId', '==', eventId)), (s) =>
      setResults(s.docs.map((d) => mapResult(d.id, d.data())))
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

  const athleteMap = useMemo(() => new Map(athletes.map((a) => [a.id, a])), [athletes])
  const judgeMap = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges])
  const entryMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  const resultByEntry = useMemo(() => new Map(results.map((r) => [r.entryId, r])), [results])

  // Sıralı sonuçlar (rank)
  const ranked = useMemo(
    () => [...results].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
    [results]
  )

  // Danslar
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
      for (const c of a.components) {
        m[c].push({ label: a.judgeLabel, judgeId: a.judgeId })
      }
    }
    for (const c of COMPONENTS) m[c].sort((x, y) => x.label.localeCompare(y.label))
    return m
  }, [assignments])

  // Ham puan haritası: entryId|dance|component|judgeId -> value
  const rawScoreMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scores) {
      m.set(`${s.entryId}|${danceKey(s.dance)}|${s.component}|${s.judgeId}`, s.value)
    }
    return m
  }, [scores])

  // Yardımcılar
  const athleteName = (entry?: Entry): string => {
    if (!entry) return '—'
    if (entry.athleteId) {
      const a = athleteMap.get(entry.athleteId)
      return a ? `${a.givenName} ${a.familyName}` : '—'
    }
    const names = [entry.athlete1Id, entry.athlete2Id]
      .map((id) => (id ? athleteMap.get(id) : undefined))
      .filter(Boolean)
      .map((a) => `${a!.givenName} ${a!.familyName}`)
    return names.length ? names.join(' / ') : '—'
  }

  const countryOf = (entry?: Entry): string => {
    if (!entry) return '—'
    const primaryId = entry.athleteId ?? entry.athlete1Id
    const a = primaryId ? athleteMap.get(primaryId) : undefined
    return a?.memberOrg || a?.region || '—'
  }

  // Bir entry'nin belirli dansındaki sonucu (stored results)
  const danceResultOf = (entryId: string, dance?: string) => {
    const r = resultByEntry.get(entryId)
    if (!r || !r.danceResults) return undefined
    return r.danceResults.find((dr) => danceKey(dr.dance) === danceKey(dance))
  }

  // CoA (Başhakem) — onaylayan kullanıcının adı
  const coaName = useMemo(() => {
    const approver = results.find((r) => r.approvedBy)?.approvedBy
    if (!approver) return '—'
    return usersList.find((u) => u.uid === approver)?.displayName ?? '—'
  }, [results, usersList])

  const fmtDate = (d?: Date) =>
    d ? d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

  const hasResults = results.length > 0

  // ---- Excel export ----
  const exportExcel = () => {
    if (!selectedEvent || !selectedComp) return
    const wb = XLSX.utils.book_new()

    // Özet sayfası
    const summary = ranked.map((r) => {
      const e = entryMap.get(r.entryId)
      return {
        Sıra: r.rank,
        'Sırt No': r.bibNumber ?? e?.bibNumber ?? '',
        Sporcu: athleteName(e),
        Ülke: countryOf(e),
        Kesinti: Number(r.deductions.toFixed(3)),
        Toplam: Number(r.finalScore.toFixed(3)),
      }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Özet')

    // Her dans için detay sayfası
    for (const dance of dances) {
      const rows = ranked.map((r) => {
        const e = entryMap.get(r.entryId)
        const dr = danceResultOf(r.entryId, dance)
        const total = dr ? (dr.tsValue + dr.mcpValue) * dr.dlValue : 0
        return {
          'Sırt No': r.bibNumber ?? e?.bibNumber ?? '',
          Sporcu: athleteName(e),
          Ülke: countryOf(e),
          TS: dr ? Number(dr.tsValue.toFixed(3)) : '',
          MCP: dr ? Number(dr.mcpValue.toFixed(3)) : '',
          DL: dr ? Number(dr.dlValue.toFixed(3)) : '',
          Total: Number(total.toFixed(3)),
          Kesinti: dr ? Number(dr.deductions.toFixed(3)) : 0,
          Sonuç: dr ? Number(dr.danceScore.toFixed(3)) : '',
          Sıra: r.rank,
        }
      })
      const sheetName = (dance ?? 'Sonuç').substring(0, 28)
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
    }

    const safe = `${selectedComp.name}_${selectedEvent.eventCode || selectedEvent.eventName}`.replace(
      /[^\w\-]+/g,
      '_'
    )
    // Blob tabanlı indirme — XLSX.writeFile bazı tarayıcı/bundler kurulumlarında çalışmaz
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
          <p className="text-gray-600 mt-2">Sonuç raporu yalnızca yöneticiler içindir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Kontroller (yazdırmada gizli) */}
      <div className="no-print space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sonuç Raporu (Protokol)</h1>
          <p className="text-gray-600 mt-1">
            Resmi protokol formatında çıktı: özet sıralama, dans sonucu ve hakem detayları.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="flex items-end gap-2">
            <button
              onClick={() => window.print()}
              disabled={!hasResults}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> Yazdır / PDF
            </button>
            <button
              onClick={exportExcel}
              disabled={!hasResults}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel İndir
            </button>
          </div>
        </div>

        {eventId && !hasResults && (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
            Bu kategori için hesaplanmış sonuç yok. Başhakem → Onay Kapısı&apos;ndan
            &quot;Sonuçları Hesapla&quot; ile sonuç üretin.
          </div>
        )}
      </div>

      {/* RAPOR GÖVDESİ */}
      {selectedEvent && hasResults && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-10 text-gray-900">
          {/* Bölüm 1 — Özet */}
          <section className="report-section space-y-4">
            <ReportHeader
              competitionName={selectedComp?.name ?? ''}
              eventName={selectedEvent.eventName}
              count={ranked.length}
              date={fmtDate(selectedComp?.date)}
            />
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <Th>Sıra</Th>
                  <Th>Sırt No</Th>
                  <Th>Sporcu</Th>
                  <Th>Ülke</Th>
                  <Th className="text-right">Ded</Th>
                  <Th className="text-right">Toplam</Th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const e = entryMap.get(r.entryId)
                  return (
                    <tr key={r.id} className="border-b border-gray-200">
                      <Td className="font-bold">
                        {r.rank}
                        {r.tied && <span className="ml-1 text-xs text-amber-600">eş</span>}
                      </Td>
                      <Td>{r.bibNumber ?? e?.bibNumber ?? '—'}</Td>
                      <Td>{athleteName(e)}</Td>
                      <Td>{countryOf(e)}</Td>
                      <Td className="text-right">{r.deductions.toFixed(3)}</Td>
                      <Td className="text-right font-bold">{r.finalScore.toFixed(3)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {/* Bölüm 2 — Dans sonucu */}
          {dances.map((dance) => (
            <section key={`res-${dance ?? 'single'}`} className="report-section space-y-3">
              <h3 className="text-base font-semibold">
                Dans: {dance ?? selectedEvent.discipline}
              </h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <Th>Sırt No</Th>
                    <Th>Sporcu</Th>
                    <Th>Ülke</Th>
                    <Th className="text-right">TS</Th>
                    <Th className="text-right">MCP</Th>
                    <Th className="text-right">DL</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Ded</Th>
                    <Th className="text-right">Result</Th>
                    <Th>Sıra</Th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => {
                    const e = entryMap.get(r.entryId)
                    const dr = danceResultOf(r.entryId, dance)
                    const total = dr ? (dr.tsValue + dr.mcpValue) * dr.dlValue : 0
                    return (
                      <tr key={r.id} className="border-b border-gray-200">
                        <Td>{r.bibNumber ?? e?.bibNumber ?? '—'}</Td>
                        <Td>{athleteName(e)}</Td>
                        <Td>{countryOf(e)}</Td>
                        <Td className="text-right">{dr ? dr.tsValue.toFixed(3) : '—'}</Td>
                        <Td className="text-right">{dr ? dr.mcpValue.toFixed(3) : '—'}</Td>
                        <Td className="text-right">{dr ? dr.dlValue.toFixed(3) : '—'}</Td>
                        <Td className="text-right">{total.toFixed(3)}</Td>
                        <Td className="text-right">{dr ? dr.deductions.toFixed(3) : '0.000'}</Td>
                        <Td className="text-right font-bold">{dr ? dr.danceScore.toFixed(3) : '—'}</Td>
                        <Td className="font-bold">{r.rank}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          ))}

          {/* Bölüm 3 — Hakem detay protokolü */}
          {dances.map((dance) => (
            <section
              key={`det-${dance ?? 'single'}`}
              className="report-section report-page-break space-y-3"
            >
              <h3 className="text-base font-semibold">
                Hakem Detayı — Dans: {dance ?? selectedEvent.discipline}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <Th rowSpan={2}>Sırt No</Th>
                      {COMPONENTS.map((c) => (
                        <th
                          key={c}
                          colSpan={componentJudges[c].length + 1}
                          className="border border-gray-300 px-2 py-1 text-center font-semibold"
                        >
                          {c}
                        </th>
                      ))}
                      <Th rowSpan={2} className="text-right">
                        Kesinti
                      </Th>
                      <Th rowSpan={2} className="text-right">
                        Sonuç
                      </Th>
                    </tr>
                    <tr className="bg-gray-50">
                      {COMPONENTS.map((c) => (
                        <Fragment key={`hdr-${c}`}>
                          {componentJudges[c].map((j) => (
                            <th
                              key={`${c}-${j.label}`}
                              className="border border-gray-300 px-2 py-1 text-center font-medium"
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
                    {ranked.map((r) => {
                      const dr = danceResultOf(r.entryId, dance)
                      const trimmed: Record<ScoringComponent, number | undefined> = {
                        TS: dr?.tsValue,
                        MCP: dr?.mcpValue,
                        DL: dr?.dlValue,
                      }
                      return (
                        <tr key={r.id} className="border-b border-gray-200">
                          <Td className="font-bold text-center">
                            {r.bibNumber ?? entryMap.get(r.entryId)?.bibNumber ?? '—'}
                          </Td>
                          {COMPONENTS.map((c) => (
                            <Fragment key={`${r.id}-${c}`}>
                              {componentJudges[c].map((j) => {
                                const v = rawScoreMap.get(
                                  `${r.entryId}|${danceKey(dance)}|${c}|${j.judgeId}`
                                )
                                return (
                                  <td
                                    key={`${r.id}-${c}-${j.label}`}
                                    className="border border-gray-200 px-2 py-1 text-center tabular-nums"
                                  >
                                    {v != null ? v.toFixed(c === 'DL' ? 2 : 1) : '·'}
                                  </td>
                                )
                              })}
                              <td className="border border-gray-200 px-2 py-1 text-center font-bold tabular-nums bg-gray-50">
                                {trimmed[c] != null ? trimmed[c]!.toFixed(3) : '—'}
                              </td>
                            </Fragment>
                          ))}
                          <Td className="text-right tabular-nums text-red-600">
                            {dr && dr.deductions > 0 ? `−${dr.deductions.toFixed(3)}` : '0.000'}
                          </Td>
                          <Td className="text-right font-bold tabular-nums">
                            {dr ? dr.danceScore.toFixed(3) : '—'}
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {/* Hakem listesi + Başhakem */}
          <section className="report-section space-y-2 text-sm border-t border-gray-300 pt-4">
            <p className="font-semibold">Hakemler (Adjudicators):</p>
            <p className="leading-relaxed">
              {[...assignments]
                .sort((a, b) => a.judgeLabel.localeCompare(b.judgeLabel))
                .map((a) => {
                  const j = judgeMap.get(a.judgeId)
                  const name = j ? `${j.givenName} ${j.familyName}` : a.judgeId
                  const country = j?.country ? ` (${j.country})` : ''
                  return `${a.judgeLabel}: ${name}${country}`
                })
                .join('   ')}
            </p>
            <p className="font-semibold pt-2">Başhakem (Chairperson of Adjudicators): {coaName}</p>
          </section>
        </div>
      )}
    </div>
  )
}

function ReportHeader({
  competitionName,
  eventName,
  count,
  date,
}: {
  competitionName: string
  eventName: string
  count: number
  date: string
}) {
  return (
    <div className="space-y-1 border-b border-gray-300 pb-4">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-600 no-print" />
        <h2 className="text-lg font-bold">{competitionName}</h2>
      </div>
      <p className="text-sm">
        <span className="font-semibold">Kategori:</span> {eventName}, {count} yarışmacı
      </p>
      <p className="text-sm">
        <span className="font-semibold">Tarih:</span> {date}
      </p>
    </div>
  )
}

function Th({
  children,
  className = '',
  colSpan,
  rowSpan,
}: {
  children?: React.ReactNode
  className?: string
  colSpan?: number
  rowSpan?: number
}) {
  return (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={`border border-gray-300 px-3 py-2 font-semibold ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border border-gray-200 px-3 py-1.5 ${className}`}>{children}</td>
}
