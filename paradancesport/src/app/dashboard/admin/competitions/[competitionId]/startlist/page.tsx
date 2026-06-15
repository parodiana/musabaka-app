'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { doc, collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { mapEntry } from '@/lib/firebase/entries'
import { mapAthlete } from '@/lib/firebase/athletes'
import { useAuthStore } from '@/store/auth.store'
import type { Competition, Event, Entry, Athlete } from '@/types'
import { ArrowLeft, Printer, ShieldAlert } from 'lucide-react'

export default function StartListPage() {
  const params = useParams()
  const competitionId = params.competitionId as string
  const { user } = useAuthStore()

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])

  useEffect(() => {
    const u0 = onSnapshot(doc(db, 'competitions', competitionId), (s) =>
      setCompetition(s.exists() ? mapCompetition(s.id, s.data()) : null)
    )
    const u1 = onSnapshot(query(collection(db, 'events'), where('competitionId', '==', competitionId)), (s) => {
      const list = s.docs.map((d) => mapEvent(d.id, d.data()))
      list.sort((a, b) => a.eventCode.localeCompare(b.eventCode) || a.eventName.localeCompare(b.eventName))
      setEvents(list)
    })
    const u2 = onSnapshot(query(collection(db, 'entries'), where('competitionId', '==', competitionId)), (s) =>
      setEntries(s.docs.map((d) => mapEntry(d.id, d.data())))
    )
    const u3 = onSnapshot(collection(db, 'athletes'), (s) =>
      setAthletes(s.docs.map((d) => mapAthlete(d.id, d.data())))
    )
    return () => {
      u0()
      u1()
      u2()
      u3()
    }
  }, [competitionId])

  const athleteMap = useMemo(() => new Map(athletes.map((a) => [a.id, a])), [athletes])

  const countryOf = (en: Entry): string => {
    const id = en.athleteId ?? en.athlete1Id
    const a = id ? athleteMap.get(id) : undefined
    return a?.memberOrg || a?.region || '—'
  }

  const athleteName = (en: Entry): string => {
    if (en.athleteId) {
      const a = athleteMap.get(en.athleteId)
      return a ? `${a.givenName} ${a.familyName}` : '—'
    }
    const names = [en.athlete1Id, en.athlete2Id]
      .map((id) => (id ? athleteMap.get(id) : undefined))
      .filter(Boolean)
      .map((a) => `${a!.givenName} ${a!.familyName}`)
    return names.length ? names.join(' / ') : '—'
  }

  const entriesByEvent = useMemo(() => {
    const m = new Map<string, Entry[]>()
    for (const en of entries) {
      if (!m.has(en.eventId)) m.set(en.eventId, [])
      m.get(en.eventId)!.push(en)
    }
    for (const list of m.values()) list.sort((a, b) => a.bibNumber - b.bibNumber)
    return m
  }, [entries])

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
        </div>
      </div>
    )
  }

  const eventsWithEntries = events.filter((e) => (entriesByEvent.get(e.id)?.length ?? 0) > 0)

  return (
    <div className="space-y-6">
      {/* Kontroller (yazdırmada gizli) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/admin/competitions/${competitionId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Yarışmaya dön
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="w-4 h-4" /> Yazdır / PDF
        </button>
      </div>

      {/* Liste gövdesi */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-8 text-gray-900">
        <div className="border-b border-gray-300 pb-4">
          <h1 className="text-xl font-bold">{competition?.name ?? '—'}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Yarışmacı Sırt No Listesi
            {competition?.date &&
              ` · ${competition.date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
          </p>
        </div>

        {eventsWithEntries.length === 0 ? (
          <p className="text-sm text-gray-500">Bu yarışmada kayıtlı sporcu (sırt no) yok.</p>
        ) : (
          eventsWithEntries.map((ev) => {
            const list = entriesByEvent.get(ev.id) ?? []
            return (
              <section key={ev.id} className="report-section space-y-2">
                <h3 className="text-base font-semibold">
                  {ev.eventName}
                  <span className="ml-2 text-sm font-normal text-gray-500">({list.length})</span>
                </h3>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="border border-gray-300 px-3 py-2 font-semibold w-24">Sırt No</th>
                      <th className="border border-gray-300 px-3 py-2 font-semibold">Sporcu</th>
                      <th className="border border-gray-300 px-3 py-2 font-semibold w-28">Ülke</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((en) => (
                      <tr key={en.id} className="border-b border-gray-200">
                        <td className="border border-gray-200 px-3 py-1.5 font-bold tabular-nums">
                          {en.bibNumber}
                        </td>
                        <td className="border border-gray-200 px-3 py-1.5">{athleteName(en)}</td>
                        <td className="border border-gray-200 px-3 py-1.5 text-gray-600">
                          {countryOf(en)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
