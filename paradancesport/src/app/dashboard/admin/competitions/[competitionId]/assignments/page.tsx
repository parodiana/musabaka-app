'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { doc, collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { mapJudge } from '@/lib/firebase/judges'
import { mapJudgeAssignment } from '@/lib/firebase/judgeAssignments'
import { useAuthStore } from '@/store/auth.store'
import type { Competition, Event, Judge, JudgeAssignment } from '@/types'
import { ArrowLeft, Printer, ShieldAlert } from 'lucide-react'

export default function JudgeAssignmentsListPage() {
  const params = useParams()
  const competitionId = params.competitionId as string
  const { user } = useAuthStore()

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [judges, setJudges] = useState<Judge[]>([])
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([])

  useEffect(() => {
    const u0 = onSnapshot(doc(db, 'competitions', competitionId), (s) =>
      setCompetition(s.exists() ? mapCompetition(s.id, s.data()) : null)
    )
    const u1 = onSnapshot(
      query(collection(db, 'events'), where('competitionId', '==', competitionId)),
      (s) => setEvents(s.docs.map((d) => mapEvent(d.id, d.data())))
    )
    const u2 = onSnapshot(collection(db, 'judges'), (s) =>
      setJudges(s.docs.map((d) => mapJudge(d.id, d.data())))
    )
    const u3 = onSnapshot(
      query(collection(db, 'judgeAssignments'), where('competitionId', '==', competitionId)),
      (s) => setAssignments(s.docs.map((d) => mapJudgeAssignment(d.id, d.data())))
    )
    return () => {
      u0()
      u1()
      u2()
      u3()
    }
  }, [competitionId])

  const eventName = useMemo(() => new Map(events.map((e) => [e.id, e.eventName])), [events])
  const judgeMap = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges])

  // Hakem adına, sonra kategori adına göre sırala
  const rows = useMemo(() => {
    return [...assignments]
      .map((a) => {
        const j = judgeMap.get(a.judgeId)
        return {
          id: a.id,
          judgeName: j ? `${j.givenName} ${j.familyName}` : a.judgeId,
          country: j?.country ?? '—',
          category: eventName.get(a.eventId) ?? '—',
          label: a.judgeLabel,
          components: a.components.join(', '),
        }
      })
      .sort(
        (x, y) => x.judgeName.localeCompare(y.judgeName) || x.category.localeCompare(y.category)
      )
  }, [assignments, judgeMap, eventName])

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
          <p className="text-gray-600 mt-2">Bu sayfaya yalnızca yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  const fmtDate = (d?: Date) =>
    d ? d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

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
      <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6 text-gray-900">
        <div className="border-b border-gray-300 pb-4">
          <h1 className="text-xl font-bold">{competition?.name ?? '—'}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Hakem Görev Listesi
            {competition?.date && ` · ${fmtDate(competition.date)}`}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">Bu yarışmada hakem ataması yok.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border border-gray-300 px-3 py-2 font-semibold">Hakem</th>
                <th className="border border-gray-300 px-3 py-2 font-semibold w-24">Ülke</th>
                <th className="border border-gray-300 px-3 py-2 font-semibold">Kategori</th>
                <th className="border border-gray-300 px-3 py-2 font-semibold w-20 text-center">
                  Panel
                </th>
                <th className="border border-gray-300 px-3 py-2 font-semibold w-32">Bileşenler</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-200">
                  <td className="border border-gray-200 px-3 py-1.5 font-medium">{r.judgeName}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-gray-600">{r.country}</td>
                  <td className="border border-gray-200 px-3 py-1.5">{r.category}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-center font-bold">
                    {r.label}
                  </td>
                  <td className="border border-gray-200 px-3 py-1.5 tabular-nums">{r.components}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
