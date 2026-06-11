'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapCompetition } from '@/lib/firebase/competitions'
import { mapEvent } from '@/lib/firebase/events'
import { useAuthStore } from '@/store/auth.store'
import type { Competition, Event } from '@/types'
import { ShieldAlert, ClipboardCheck, MinusCircle, Clock } from 'lucide-react'

export default function BashakemDashboard() {
  const { user } = useAuthStore()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [awaiting, setAwaiting] = useState<Event[]>([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'competitions'), (s) =>
      setCompetitions(s.docs.map((d) => mapCompetition(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  // Onay bekleyen kategoriler (tüm yarışmalar)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'events'), where('status', '==', 'AWAITING_APPROVAL')),
      (s) => setAwaiting(s.docs.map((d) => mapEvent(d.id, d.data())))
    )
    return () => unsub()
  }, [])

  const compName = useMemo(
    () => new Map(competitions.map((c) => [c.id, c.name])),
    [competitions]
  )

  if (user && user.role !== 'bashakem' && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
          <p className="text-gray-600 mt-2">Bu sayfa Başhakem içindir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Başhakem Paneli</h1>
        <p className="text-blue-100">Sonuç onayları ve kesinti yönetimi</p>
      </div>

      {/* Hızlı erişim */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/bashakem/approval"
          className="flex items-center gap-4 p-5 bg-white border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <ClipboardCheck className="w-8 h-8 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">Onay Kapısı</p>
            <p className="text-sm text-blue-700">Sonuçları hesapla, incele, onayla / iade et</p>
          </div>
        </Link>
        <Link
          href="/dashboard/bashakem/deductions"
          className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <MinusCircle className="w-8 h-8 text-gray-600" />
          <div>
            <p className="font-semibold text-gray-900">Kesintiler</p>
            <p className="text-sm text-gray-600">Kesinti gir ve yönet</p>
          </div>
        </Link>
      </div>

      {/* Onay bekleyenler */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-gray-900">Onay Bekleyen Kategoriler</span>
          <span className="ml-auto rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-medium">
            {awaiting.length}
          </span>
        </div>
        {awaiting.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            Şu anda onay bekleyen kategori yok.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {awaiting.map((ev) => (
              <li key={ev.id}>
                <Link
                  href="/dashboard/bashakem/approval"
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {ev.eventCode} · {ev.eventName}
                    </p>
                    <p className="text-xs text-gray-500">{compName.get(ev.competitionId) ?? ''}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium">
                    Onay Bekliyor
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
