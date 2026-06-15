'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent, updateEvent, setActiveEntry } from '@/lib/firebase/events'
import { mapJudge } from '@/lib/firebase/judges'
import { mapJudgeAssignment } from '@/lib/firebase/judgeAssignments'
import { mapEntry } from '@/lib/firebase/entries'
import { mapScore, upsertScore, deleteScore } from '@/lib/firebase/scores'
import { validateScore, scaleFor } from '@/lib/scoring/validators'
import { aggregate } from '@/lib/scoring/trimmed-mean'
import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'
import type {
  Competition,
  Event,
  Judge,
  JudgeAssignment,
  Entry,
  Score,
  ScoringComponent,
} from '@/types'
import { ShieldAlert, ClipboardList, Lock, CheckCircle2, Send, ChevronRight, Trash2 } from 'lucide-react'

const COMPONENTS: ScoringComponent[] = ['TS', 'MCP', 'DL']
const danceKey = (d?: string) => (d && d.trim() ? d.trim() : '')

export default function MasaHakemiScoringPage() {
  const { user } = useAuthStore()
  const { t } = useI18n()

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [judges, setJudges] = useState<Judge[]>([])
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [scores, setScores] = useState<Score[]>([])

  const [compId, setCompId] = useState('')
  const [eventId, setEventId] = useState('')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [selectedJudgeId, setSelectedJudgeId] = useState('')
  const [sending, setSending] = useState(false)
  const [incompleteWarning, setIncompleteWarning] = useState<
    { bib: number; missing: string[] }[] | null
  >(null)
  const [sentSuccess, setSentSuccess] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'competitions'), orderBy('date', 'desc')), (s) =>
      setCompetitions(s.docs.map((d) => mapCompetition(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'judges'), (s) =>
      setJudges(s.docs.map((d) => mapJudge(d.id, d.data())))
    )
    return () => unsub()
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
      setAssignments([])
      setEntries([])
      setScores([])
      setSelectedEntryId('')
      setSelectedJudgeId('')
      return
    }
    const u1 = onSnapshot(
      query(collection(db, 'judgeAssignments'), where('eventId', '==', eventId)),
      (s) => {
        const list = s.docs.map((d) => mapJudgeAssignment(d.id, d.data()))
        list.sort((a, b) => a.judgeLabel.localeCompare(b.judgeLabel))
        setAssignments(list)
      }
    )
    const u2 = onSnapshot(query(collection(db, 'entries'), where('eventId', '==', eventId)), (s) => {
      const list = s.docs.map((d) => mapEntry(d.id, d.data()))
      list.sort((a, b) => a.bibNumber - b.bibNumber)
      setEntries(list)
    })
    const u3 = onSnapshot(query(collection(db, 'scores'), where('eventId', '==', eventId)), (s) =>
      setScores(s.docs.map((d) => mapScore(d.id, d.data())))
    )
    return () => {
      u1()
      u2()
      u3()
    }
  }, [eventId])

  const selectedEvent = events.find((e) => e.id === eventId)
  const selectedComp = competitions.find((c) => c.id === compId)
  const selectedEntry = entries.find((e) => e.id === selectedEntryId)
  const judgeMap = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges])
  const aggMode = selectedComp?.aggregationMode ?? 'TRIMMED'
  const readOnly = selectedEvent?.status === 'APPROVED'
  const isAuto = selectedEvent?.entryMode === 'AUTO'
  // Masa hakemi (orchestrator) onaylanmamış HER kategoride manuel puan girebilir.
  // AUTO modda ayrıca "sahaya gönder" ile hakemlerin kendi cihazından girmesini sağlar (BK-3).
  // Skorlar deterministik doc ID'li olduğundan iki yol çakışmaz, üzerine yazar.
  const canEnter = !readOnly && !!selectedEvent
  const activeEntryId = selectedEvent?.activeEntryId

  const dances: (string | undefined)[] =
    selectedEvent && selectedEvent.dances.length > 0 ? selectedEvent.dances : [undefined]

  const componentJudges = useMemo(() => {
    const m: Record<ScoringComponent, { label: string; judgeId: string; assignmentId: string }[]> =
      { TS: [], MCP: [], DL: [] }
    for (const a of assignments) {
      for (const c of a.components) {
        m[c].push({ label: a.judgeLabel, judgeId: a.judgeId, assignmentId: a.id })
      }
    }
    for (const c of COMPONENTS) m[c].sort((x, y) => x.label.localeCompare(y.label))
    return m
  }, [assignments])

  const activeComponents = COMPONENTS.filter((c) => componentJudges[c].length > 0)

  const scoreMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scores) {
      m.set(`${s.entryId}|${danceKey(s.dance)}|${s.component}|${s.judgeId}`, s.value)
    }
    return m
  }, [scores])

  // entryId -> kaç farklı hakem en az bir puan girmiş
  const enteredJudgeCount = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const s of scores) {
      if (!m.has(s.entryId)) m.set(s.entryId, new Set())
      m.get(s.entryId)!.add(s.judgeId)
    }
    return m
  }, [scores])

  const compResult = (entryId: string, dance: string | undefined, comp: ScoringComponent) => {
    const list = componentJudges[comp].map((j) => ({
      ...j,
      value: scoreMap.get(`${entryId}|${danceKey(dance)}|${comp}|${j.judgeId}`),
    }))
    const present = list.filter((x) => x.value != null) as (typeof list[number] & {
      value: number
    })[]
    let minId: string | null = null
    let maxId: string | null = null
    if (aggMode === 'TRIMMED' && present.length >= 4) {
      const sorted = [...present].sort((a, b) => a.value - b.value)
      minId = sorted[0].judgeId
      maxId = sorted[sorted.length - 1].judgeId
    }
    const mean = present.length ? aggregate(present.map((p) => p.value), aggMode) : null
    return { list, minId, maxId, mean }
  }

  // Sırt no bazında eksik hakem puanlarını bul (Başhakem tek tek kontrol eder)
  const findIncompleteBibs = (): { bib: number; missing: string[] }[] => {
    const result: { bib: number; missing: string[] }[] = []
    for (const en of entries) {
      if (en.status !== 'ACTIVE') continue // çekilen/DSQ sporcular puanlanmaz
      const missing: string[] = []
      for (const a of assignments) {
        let judgeComplete = true
        for (const dance of dances) {
          for (const c of a.components) {
            if (scoreMap.get(`${en.id}|${danceKey(dance)}|${c}|${a.judgeId}`) == null) {
              judgeComplete = false
              break
            }
          }
          if (!judgeComplete) break
        }
        if (!judgeComplete) missing.push(a.judgeLabel)
      }
      if (missing.length > 0) result.push({ bib: en.bibNumber, missing })
    }
    return result.sort((a, b) => a.bib - b.bib)
  }

  const handleSendToApproval = async () => {
    if (!selectedEvent) return
    // Eksik puan varsa sırt no bazında uyar, onaya gönderme
    const missing = findIncompleteBibs()
    if (missing.length > 0) {
      setIncompleteWarning(missing)
      return
    }
    setSending(true)
    try {
      await updateEvent(selectedEvent.id, { status: 'AWAITING_APPROVAL' })
      setSentSuccess(true)
    } catch (err) {
      console.error('Onaya gönderme hatası:', err)
      alert('Onaya gönderilemedi.')
    } finally {
      setSending(false)
    }
  }

  // Bir hakemin bu sporcu için TÜM puanlarını gerçek kayıtlardan sil (dans anahtarı yeniden kurmaz)
  const deleteJudgeScoresForEntry = async (entryId: string, judgeId: string) => {
    const toDel = scores.filter((s) => s.entryId === entryId && s.judgeId === judgeId)
    await Promise.all(
      toDel.map((s) => deleteScore(s.eventId, s.entryId, s.judgeId, s.component, s.dance))
    )
  }

  if (user && user.role !== 'masa_hakemi' && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">{t('common.accessDenied')}</h2>
          <p className="text-gray-600 mt-2">{t('masa.forTable')}</p>
        </div>
      </div>
    )
  }

  const STATUS_TEXT: Record<string, string> = {
    PENDING: 'Beklemede',
    IN_PROGRESS: 'Puanlama Sürüyor',
    AWAITING_APPROVAL: 'Onay Bekliyor',
    APPROVED: 'Onaylandı',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Puan Girişi (Masa Hakemi)</h1>
        <p className="text-gray-600 mt-1">
          Sırt no seç → hakem seç → o hakemin kağıttaki puanlarını gir ve kaydet.
        </p>
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
            onChange={(e) => {
              setEventId(e.target.value)
            }}
            className="input"
            disabled={!compId}
          >
            <option value="">— Seç —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.eventCode} · {ev.eventName} — {ev.entryMode === 'AUTO' ? 'Otomatik' : 'Masa Hakemi'} ·{' '}
                {STATUS_TEXT[ev.status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 border border-green-200 flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" /> Bu kategori onaylandı — puanlar salt görünümdür.
        </div>
      )}

      {isAuto && !readOnly && (
        <div className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-800 border border-indigo-200">
          Bu kategori <strong>OTOMATİK</strong> modda — sporcuyu <strong>Hakemlere Gönder</strong>
          ile sahaya alırsanız hakemler kendi cihazından puanlar (yalnızca gönderdiğiniz sporcuyu
          görür). Dilerseniz buradan <strong>elle de</strong> (hakem seçip) puan girebilirsiniz.
        </div>
      )}
      {eventId && assignments.length === 0 && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
          Bu kategoriye henüz hakem atanmamış. Önce Admin → &quot;Atamalar&quot; ile hakem atayın.
        </div>
      )}
      {eventId && entries.length === 0 && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
          Bu kategoride kayıtlı sporcu (sırt no) yok.
        </div>
      )}

      {selectedEvent && assignments.length > 0 && entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: Sırt no listesi */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-900 text-sm">
                Yarışmacılar (Sırt No)
              </div>
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {entries.map((en) => {
                  const entered = enteredJudgeCount.get(en.id)?.size ?? 0
                  const active = en.id === selectedEntryId
                  const onField = en.id === activeEntryId
                  return (
                    <li key={en.id}>
                      <button
                        onClick={() => {
                          setSelectedEntryId(en.id)
                          setSelectedJudgeId('')
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 ${
                          active ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-white font-bold">
                            {en.bibNumber}
                          </span>
                          <span className="text-xs text-gray-500">
                            {entered}/{assignments.length} hakem
                          </span>
                          {onField && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              Sahada
                            </span>
                          )}
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-300'}`}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {!readOnly && (
              <button
                onClick={handleSendToApproval}
                disabled={sending || scores.length === 0}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Gönderiliyor…' : 'Başhakem Onayına Gönder'}
              </button>
            )}
          </div>

          {/* Sağ: Seçili sporcu paneli */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedEntry ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                Soldaki listeden bir sırt no seçin.
              </div>
            ) : (
              <>
                {/* OTOMATİK mod: sahaya gönderme kontrolü (puan girişi yok) */}
                {isAuto && !readOnly && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-900 text-white font-bold">
                        {selectedEntry.bibNumber}
                      </span>
                      <span className="font-semibold text-gray-900">
                        Sırt No {selectedEntry.bibNumber}
                      </span>
                      {activeEntryId === selectedEntry.id && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Sahada
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex gap-2">
                      {activeEntryId === selectedEntry.id ? (
                        <button
                          onClick={() => setActiveEntry(selectedEvent.id, null)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Sahadan Kaldır
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveEntry(selectedEvent.id, selectedEntry.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          <Send className="w-4 h-4" /> Hakemlere Gönder (Sahaya Al)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* MASA_HAKEMİ mod: hakem seçip puan girme */}
                {canEnter && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gray-900 text-white font-bold">
                        {selectedEntry.bibNumber}
                      </span>
                      <span className="font-semibold text-gray-900">Sırt No {selectedEntry.bibNumber} — Puan Gir</span>
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <label className="block text-xs font-medium text-gray-600">Hakem (Panel)</label>
                      <select
                        value={selectedJudgeId}
                        onChange={(e) => setSelectedJudgeId(e.target.value)}
                        className="input"
                      >
                        <option value="">— Hakem Seç —</option>
                        {assignments.map((a) => {
                          const j = judgeMap.get(a.judgeId)
                          return (
                            <option key={a.id} value={a.judgeId}>
                              {a.judgeLabel} · {j ? `${j.givenName} ${j.familyName}` : a.judgeId} (
                              {a.components.join(', ')})
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    {selectedJudgeId && (
                      <JudgeEntryForm
                        key={`${selectedEntry.id}-${selectedJudgeId}`}
                        entry={selectedEntry}
                        assignment={assignments.find((a) => a.judgeId === selectedJudgeId)!}
                        dances={dances}
                        competitionId={selectedComp!.id}
                        eventId={selectedEvent.id}
                        getValue={(dance, c) =>
                          scoreMap.get(
                            `${selectedEntry.id}|${danceKey(dance)}|${c}|${selectedJudgeId}`
                          )
                        }
                        enteredBy={user?.uid ?? 'masa'}
                        hasScores={scores.some(
                          (s) => s.entryId === selectedEntry.id && s.judgeId === selectedJudgeId
                        )}
                        onDeleteAll={() =>
                          deleteJudgeScoresForEntry(selectedEntry.id, selectedJudgeId)
                        }
                      />
                    )}
                  </div>
                )}

                {/* Protokol özeti — bu sporcu için tek satır (dans başına) */}
                {dances.map((dance) => (
                  <div
                    key={dance ?? 'single'}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-900">
                        Sırt No {selectedEntry.bibNumber}
                      </span>
                      <span className="text-xs text-gray-500">
                        · {dance ?? 'Puanlama'} ·{' '}
                        {aggMode === 'TRIMMED' ? 'Kırpılmış ortalama' : 'Düz ortalama'}
                      </span>
                    </div>
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
                              const res = compResult(selectedEntry.id, dance, c)
                              return (
                                <Fragment key={`row-${c}`}>
                                  {res.list.map((j) => {
                                    const dropped = j.judgeId === res.minId || j.judgeId === res.maxId
                                    return (
                                      <td
                                        key={`${c}-${j.judgeId}`}
                                        className={`border border-gray-200 px-2 py-1.5 text-center tabular-nums ${
                                          dropped
                                            ? 'line-through text-red-500 decoration-red-500'
                                            : 'text-gray-800'
                                        }`}
                                      >
                                        {j.value != null
                                          ? j.value.toFixed(scaleFor(c).decimals)
                                          : '·'}
                                      </td>
                                    )
                                  })}
                                  <td className="border border-gray-200 px-2 py-1.5 text-center font-bold tabular-nums bg-gray-50">
                                    {res.mean != null ? res.mean.toFixed(3) : '—'}
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Eksik puanlama uyarısı — onaya göndermeden önce */}
      {incompleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900">Eksik Puanlama</h3>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-gray-600">
              <p>
                Aşağıdaki sırt no&apos;lar için eksik hakem puanı var. Tüm puanlamalar tamamlanmadan
                sonuçlar Başhakem onayına gönderilemez.
              </p>
              <ul className="rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {incompleteWarning.map((m) => (
                  <li key={m.bib} className="flex items-center gap-3 px-4 py-2">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-white font-bold shrink-0">
                      {m.bib}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-gray-500 mr-1">Eksik hakem:</span>
                      {m.missing.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 text-amber-800 text-xs font-bold"
                        >
                          {label}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">
                Başhakem her sırt no&apos;yu tek tek kontrol eder. Lütfen eksik puanları tamamlayıp
                tekrar gönderin.
              </p>
            </div>
            <div className="border-t border-gray-200 px-5 py-3 flex justify-end">
              <button
                onClick={() => setIncompleteWarning(null)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Başarıyla onaya iletildi bilgilendirmesi */}
      {sentSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Onaya İletildi</h3>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm text-gray-600">
              <p>
                Kategori sonuçları Başhakem onayına başarıyla iletilmiştir. Başhakem puanları
                inceleyip onayladığında sonuçlar resmî olarak ilan edilecektir.
              </p>
              <p className="text-xs text-gray-500">
                Başhakem sonuçları iade ederse kategori yeniden düzenlemeye açılır ve gerekli
                düzeltmelerden sonra tekrar gönderebilirsiniz.
              </p>
            </div>
            <div className="border-t border-gray-200 px-5 py-3 flex justify-end">
              <button
                onClick={() => setSentSuccess(false)}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Seçili hakem için seçili sporcunun bileşen puanlarını girer ve kaydeder. */
function JudgeEntryForm({
  entry,
  assignment,
  dances,
  competitionId,
  eventId,
  getValue,
  enteredBy,
  hasScores,
  onDeleteAll,
}: {
  entry: Entry
  assignment: JudgeAssignment
  dances: (string | undefined)[]
  competitionId: string
  eventId: string
  getValue: (dance: string | undefined, c: ScoringComponent) => number | undefined
  enteredBy: string
  hasScores: boolean
  onDeleteAll: () => Promise<void>
}) {
  const keyOf = (dance: string | undefined, c: ScoringComponent) => `${danceKey(dance)}|${c}`
  const initial = () => {
    const t: Record<string, string> = {}
    for (const dance of dances) {
      for (const c of assignment.components) {
        const v = getValue(dance, c)
        t[keyOf(dance, c)] = v != null ? v.toFixed(scaleFor(c).decimals) : ''
      }
    }
    return t
  }

  const { t } = useI18n()
  const [texts, setTexts] = useState<Record<string, string>>(initial)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  // Bu hakemin bu sırt no için kayıtlı puanı var mı? (gerçek kayıtlara göre)
  const hasAnySaved = hasScores

  const handleSave = async () => {
    const errs: Record<string, boolean> = {}
    const toSave: { dance: string | undefined; c: ScoringComponent; val: number }[] = []
    // Boş bırakılıp eskiden değeri olan bileşenler silinir (puanı tamamen kaldırma)
    const toDelete: { dance: string | undefined; c: ScoringComponent }[] = []
    for (const dance of dances) {
      for (const c of assignment.components) {
        const raw = (texts[keyOf(dance, c)] ?? '').trim()
        if (raw === '') {
          if (getValue(dance, c) != null) toDelete.push({ dance, c })
          continue
        }
        const num = Number(raw)
        if (!validateScore(num, c).valid) {
          errs[keyOf(dance, c)] = true
        } else {
          toSave.push({ dance, c, val: num })
        }
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0 || (toSave.length === 0 && toDelete.length === 0)) return

    setSaving(true)
    try {
      await Promise.all([
        ...toSave.map((s) =>
          upsertScore({
            competitionId,
            eventId,
            entryId: entry.id,
            judgeId: assignment.judgeId,
            judgeAssignmentId: assignment.id,
            dance: s.dance,
            component: s.c,
            value: s.val,
            mode: 'TABLE',
            enteredBy,
          })
        ),
        ...toDelete.map((s) => deleteScore(eventId, entry.id, assignment.judgeId, s.c, s.dance)),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  // Bu hakemin bu sırt no için TÜM puanlarını sil (gerçek kayıtlardan)
  const handleDeleteAll = async () => {
    setDeleting(true)
    try {
      await onDeleteAll()
      // Inputları temizle
      const cleared: Record<string, string> = {}
      for (const dance of dances) for (const c of assignment.components) cleared[keyOf(dance, c)] = ''
      setTexts(cleared)
      setDeleted(true)
      setTimeout(() => setDeleted(false), 1500)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {dances.map((dance) => (
        <div key={dance ?? 'single'} className="space-y-2">
          {dances.length > 1 && <p className="text-xs font-semibold text-gray-500">{dance}</p>}
          <div className="flex flex-wrap gap-4">
            {assignment.components.map((c) => {
              const scale = scaleFor(c)
              const k = keyOf(dance, c)
              return (
                <div key={c} className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">
                    {c} <span className="text-gray-400">({scale.min.toFixed(scale.decimals)}–{scale.max.toFixed(scale.decimals)}, adım {scale.step})</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={scale.step}
                    min={scale.min}
                    max={scale.max}
                    value={texts[k] ?? ''}
                    onChange={(e) => {
                      setTexts((t) => ({ ...t, [k]: e.target.value }))
                      setErrors((er) => ({ ...er, [k]: false }))
                    }}
                    className={`w-28 rounded-lg border px-3 py-2 text-center tabular-nums focus:outline-none focus:ring-2 ${
                      errors[k]
                        ? 'border-red-400 ring-red-200'
                        : 'border-gray-300 focus:ring-blue-200'
                    }`}
                    placeholder={scale.min.toFixed(scale.decimals)}
                  />
                  {errors[k] && <p className="text-xs text-red-600">Geçersiz adım/aralık</p>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {hasAnySaved && (
          <button
            onClick={handleDeleteAll}
            disabled={saving || deleting}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? '…' : t('masa.deleteJudgeScores')}
          </button>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" /> {t('common.saved')}
          </span>
        )}
        {deleted && (
          <span className="inline-flex items-center gap-1 text-sm text-red-600">
            <Trash2 className="w-4 h-4" /> {t('masa.deleted')}
          </span>
        )}
      </div>
    </div>
  )
}
