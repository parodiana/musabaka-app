'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapEvent } from '@/lib/firebase/events'
import { mapJudge } from '@/lib/firebase/judges'
import { mapJudgeAssignment } from '@/lib/firebase/judgeAssignments'
import { mapEntry } from '@/lib/firebase/entries'
import { mapScore, upsertScore } from '@/lib/firebase/scores'
import { validateScore, scaleFor } from '@/lib/scoring/validators'
import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'
import type {
  Event,
  Judge,
  JudgeAssignment,
  Entry,
  Score,
  ScoringComponent,
} from '@/types'
import { ShieldAlert, ClipboardList, CheckCircle2, X, Trophy, Hourglass, Lock } from 'lucide-react'

export default function HakemScoringPage() {
  const { user } = useAuthStore()
  const { t } = useI18n()

  const [judges, setJudges] = useState<Judge[]>([])
  const [myAssignments, setMyAssignments] = useState<JudgeAssignment[]>([])
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [scores, setScores] = useState<Score[]>([])

  // Giriş yapan kullanıcının hakem kaydı (judgeId)
  const myJudgeId = useMemo(() => {
    if (!user) return ''
    if (user.judgeId) return user.judgeId
    return judges.find((j) => j.userId === user.uid)?.id ?? ''
  }, [user, judges])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'judges'), (s) =>
      setJudges(s.docs.map((d) => mapJudge(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  // Tüm kategoriler (atandıklarım + aktif sporcu takibi için)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'events'), (s) =>
      setAllEvents(s.docs.map((d) => mapEvent(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  // Yalnızca bu hakeme ait atamalar
  useEffect(() => {
    if (!myJudgeId) {
      setMyAssignments([])
      return
    }
    const unsub = onSnapshot(
      query(collection(db, 'judgeAssignments'), where('judgeId', '==', myJudgeId)),
      (s) => setMyAssignments(s.docs.map((d) => mapJudgeAssignment(d.id, d.data())))
    )
    return () => unsub()
  }, [myJudgeId])

  const eventById = useMemo(() => new Map(allEvents.map((e) => [e.id, e])), [allEvents])

  // Sahada (aktif) sporcusu olan, bana atanmış kategoriyi bul
  const activeAssignment = useMemo(() => {
    return myAssignments.find((a) => {
      const ev = eventById.get(a.eventId)
      return ev && ev.activeEntryId && ev.status !== 'APPROVED'
    })
  }, [myAssignments, eventById])

  const activeEvent = activeAssignment ? eventById.get(activeAssignment.eventId) : undefined

  // Aktif kategorinin kayıt + skorları
  useEffect(() => {
    if (!activeEvent?.id) {
      setEntries([])
      setScores([])
      return
    }
    const u1 = onSnapshot(
      query(collection(db, 'entries'), where('eventId', '==', activeEvent.id)),
      (s) => setEntries(s.docs.map((d) => mapEntry(d.id, d.data())))
    )
    const u2 = onSnapshot(
      query(collection(db, 'scores'), where('eventId', '==', activeEvent.id)),
      (s) => setScores(s.docs.map((d) => mapScore(d.id, d.data())))
    )
    return () => {
      u1()
      u2()
    }
  }, [activeEvent?.id])

  const activeEntry = entries.find((e) => e.id === activeEvent?.activeEntryId)

  const dances: (string | undefined)[] =
    activeEvent && activeEvent.dances.length > 0 ? activeEvent.dances : [undefined]

  // entryId|dance|component -> value (yalnızca benim skorlarım)
  const scoreMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of scores) {
      if (s.judgeId !== myJudgeId) continue
      m.set(`${s.entryId}|${s.dance ?? ''}|${s.component}`, s.value)
    }
    return m
  }, [scores, myJudgeId])

  if (user && user.role !== 'hakem' && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">{t('common.accessDenied')}</h2>
          <p className="text-gray-600 mt-2">{t('hakem.forJudges')}</p>
        </div>
      </div>
    )
  }

  if (user && user.role === 'hakem' && judges.length > 0 && !myJudgeId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">{t('hakem.notLinkedTitle')}</h2>
          <p className="text-gray-600 mt-2">{t('hakem.notLinkedText')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!activeAssignment || !activeEvent || !activeEntry ? (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-10 text-center">
          <Hourglass className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-blue-900">{t('hakem.noActiveTitle')}</h2>
          <p className="text-blue-700 mt-2 max-w-md mx-auto">{t('hakem.noActiveText')}</p>
          {myAssignments.length === 0 && myJudgeId && (
            <p className="text-xs text-blue-500 mt-4">{t('hakem.noAssignmentHint')}</p>
          )}
        </div>
      ) : (
        <>
          {/* Yalnızca kategori adı */}
          <div className="rounded-lg bg-white border border-gray-200 shadow-sm p-5 flex items-center gap-3">
            <Trophy className="w-6 h-6 text-blue-600" />
            <p className="text-lg font-semibold text-gray-900">{activeEvent.eventName}</p>
          </div>

          {/* Sahadaki sporcu — puanlama */}
          <div className="space-y-6">
            {dances.map((dance) => (
              <div
                key={dance ?? 'single'}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">{dance ?? t('common.scoring')}</span>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-5 py-2 font-medium w-24">{t('common.bib')}</th>
                      {activeAssignment.components.map((c) => (
                        <th key={c} className="px-5 py-2 font-medium">
                          {c}
                        </th>
                      ))}
                      <th className="px-5 py-2 font-medium w-32 text-right">{t('common.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ScoreRow
                      key={activeEntry.id}
                      bibNumber={activeEntry.bibNumber}
                      components={activeAssignment.components}
                      dance={dance}
                      savedValues={(c) => scoreMap.get(`${activeEntry.id}|${dance ?? ''}|${c}`)}
                      onConfirm={(values) =>
                        Promise.all(
                          values.map(({ component, value }) =>
                            upsertScore({
                              competitionId: activeEvent.competitionId,
                              eventId: activeEvent.id,
                              entryId: activeEntry.id,
                              judgeId: activeAssignment.judgeId,
                              judgeAssignmentId: activeAssignment.id,
                              dance,
                              component,
                              value,
                              mode: 'AUTO',
                              enteredBy: user?.uid ?? 'hakem',
                            })
                          )
                        ).then(() => undefined)
                      }
                    />
                  </tbody>
                </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ScoreRow({
  bibNumber,
  components,
  dance,
  savedValues,
  onConfirm,
}: {
  bibNumber: number
  components: ScoringComponent[]
  dance?: string
  savedValues: (c: ScoringComponent) => number | undefined
  onConfirm: (values: { component: ScoringComponent; value: number }[]) => Promise<void>
}) {
  const { t } = useI18n()
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Kaydedilmiş değerleri inputlara yükle / realtime senkron
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const c of components) {
      const v = savedValues(c)
      next[c] = v != null ? v.toFixed(scaleFor(c).decimals) : ''
    }
    setTexts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bibNumber, dance, ...components.map((c) => savedValues(c))])

  const setText = (c: string, val: string) => {
    setTexts((t) => ({ ...t, [c]: val }))
    setErrors((e) => ({ ...e, [c]: false }))
    setSaved(false)
  }

  // Onay popup'ını açmadan önce doğrula
  const tryConfirm = () => {
    const errs: Record<string, boolean> = {}
    let anyFilled = false
    for (const c of components) {
      const raw = (texts[c] ?? '').trim()
      if (raw === '') continue
      anyFilled = true
      const v = validateScore(Number(raw), c)
      if (!v.valid) errs[c] = true
    }
    setErrors(errs)
    if (!anyFilled || Object.keys(errs).length > 0) return
    setConfirming(true)
  }

  const filledValues = components
    .filter((c) => (texts[c] ?? '').trim() !== '')
    .map((c) => ({ component: c, value: Number(texts[c]) }))

  const doSave = async () => {
    setBusy(true)
    try {
      await onConfirm(filledValues)
      setSaved(true)
      setConfirming(false)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setBusy(false)
    }
  }

  // Tüm bileşenler gönderildiyse satır kilitlenir — hakem gönderdikten sonra değiştiremez
  const locked = components.length > 0 && components.every((c) => savedValues(c) != null)

  return (
    <tr className={`border-b border-gray-100 ${saved ? 'bg-green-50' : locked ? 'bg-gray-50' : ''}`}>
      <td className="px-5 py-2">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-white font-bold">
          {bibNumber}
        </span>
      </td>
      {components.map((c) => {
        const scale = scaleFor(c)
        const v = savedValues(c)
        return (
          <td key={c} className="px-5 py-2">
            {locked ? (
              <span className="inline-block w-24 text-center font-semibold text-gray-800 tabular-nums">
                {v != null ? v.toFixed(scale.decimals) : '—'}
              </span>
            ) : (
              <input
                type="number"
                inputMode="decimal"
                step={scale.step}
                min={scale.min}
                max={scale.max}
                value={texts[c] ?? ''}
                onChange={(e) => setText(c, e.target.value)}
                className={`w-24 rounded-lg border px-3 py-1.5 text-center focus:outline-none focus:ring-2 ${
                  errors[c]
                    ? 'border-red-400 ring-red-200'
                    : 'border-gray-300 focus:ring-blue-200'
                }`}
                placeholder={`${scale.min.toFixed(scale.decimals)}–${scale.max.toFixed(scale.decimals)}`}
              />
            )}
          </td>
        )
      })}
      <td className="px-5 py-2 text-right">
        {locked ? (
          <span
            className="inline-flex items-center gap-1 text-sm text-gray-500"
            title={t('hakem.lockedHint')}
          >
            <Lock className="w-4 h-4" /> {t('hakem.locked')}
          </span>
        ) : saved ? (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" /> {t('common.saved')}
          </span>
        ) : (
          <button
            onClick={tryConfirm}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('common.save')}
          </button>
        )}
      </td>

      {confirming && !locked && (
        <td className="p-0">
          <ConfirmDialog
            bibNumber={bibNumber}
            dance={dance}
            values={filledValues}
            busy={busy}
            onCancel={() => setConfirming(false)}
            onConfirm={doSave}
          />
        </td>
      )}
    </tr>
  )
}

/** Kaydetmeden önce hakeme özet gösteren onay popup'ı (BK: anonim — yalnızca sırt no) */
function ConfirmDialog({
  bibNumber,
  dance,
  values,
  busy,
  onCancel,
  onConfirm,
}: {
  bibNumber: number
  dance?: string
  values: { component: ScoringComponent; value: number }[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="font-semibold text-gray-900">{t('hakem.confirmTitle')}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gray-900 text-white text-lg font-bold">
              {bibNumber}
            </span>
            <div>
              <p className="text-sm text-gray-500">{t('common.bib')}</p>
              {dance && <p className="text-xs text-gray-400">{dance}</p>}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {values.map(({ component, value }) => (
              <div key={component} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-medium text-gray-600">{component}</span>
                <span className="font-bold text-gray-900">
                  {value.toFixed(scaleFor(component).decimals)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">{t('hakem.confirmNote')}</p>
        </div>
        <div className="flex gap-3 border-t border-gray-200 px-5 py-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? t('common.saving') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
