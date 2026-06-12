'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapJudge } from '@/lib/firebase/judges'
import {
  mapJudgeAssignment,
  createJudgeAssignment,
  deleteJudgeAssignment,
  nextJudgeLabel,
} from '@/lib/firebase/judgeAssignments'
import type { Event, Judge, JudgeAssignment, ScoringComponent } from '@/types'
import { Trash2, UserPlus } from 'lucide-react'

const ALL_COMPONENTS: { value: ScoringComponent; label: string }[] = [
  { value: 'TS', label: 'TS (Teknik)' },
  { value: 'MCP', label: 'MCP (Müzik/Koreografi)' },
  { value: 'DL', label: 'DL (Zorluk)' },
]

export function JudgeAssignmentManager({ event }: { event: Event }) {
  const [judges, setJudges] = useState<Judge[]>([])
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([])
  const [loading, setLoading] = useState(true)

  // Ekleme formu state
  const [selectedJudgeId, setSelectedJudgeId] = useState('')
  const [label, setLabel] = useState('')
  const [components, setComponents] = useState<ScoringComponent[]>(['TS', 'MCP', 'DL'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hakemleri dinle
  useEffect(() => {
    const q = query(collection(db, 'judges'), orderBy('familyName'))
    const unsub = onSnapshot(q, (snap) => {
      setJudges(snap.docs.map((d) => mapJudge(d.id, d.data())))
    })
    return () => unsub()
  }, [])

  // Bu kategoriye ait atamaları dinle
  useEffect(() => {
    const q = query(collection(db, 'judgeAssignments'), where('eventId', '==', event.id))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => mapJudgeAssignment(d.id, d.data()))
        list.sort((a, b) => a.judgeLabel.localeCompare(b.judgeLabel))
        setAssignments(list)
        setLoading(false)
      },
      (err) => {
        console.error('Assignments listener error:', err)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [event.id])

  // Önerilen sıradaki harf
  const suggestedLabel = useMemo(() => nextJudgeLabel(assignments), [assignments])
  useEffect(() => {
    setLabel(suggestedLabel)
  }, [suggestedLabel])

  const judgeMap = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges])
  const assignedJudgeIds = new Set(assignments.map((a) => a.judgeId))
  const availableJudges = judges.filter((j) => !assignedJudgeIds.has(j.id))

  const toggleComponent = (c: ScoringComponent) => {
    setComponents((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedJudgeId) {
      setError('Bir hakem seçin')
      return
    }
    if (!label.trim()) {
      setError('Panel harfi girin')
      return
    }
    if (components.length === 0) {
      setError('En az bir bileşen seçin')
      return
    }
    if (assignments.some((a) => a.judgeLabel === label.trim().toUpperCase())) {
      setError(`"${label.toUpperCase()}" harfi zaten kullanılıyor`)
      return
    }

    setSaving(true)
    try {
      await createJudgeAssignment({
        competitionId: event.competitionId,
        eventId: event.id,
        judgeId: selectedJudgeId,
        components,
        judgeLabel: label.trim().toUpperCase(),
      })
      // Formu sıfırla
      setSelectedJudgeId('')
      setComponents(['TS', 'MCP', 'DL'])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atama eklenemedi')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await deleteJudgeAssignment(id)
    } catch (err) {
      console.error('Remove assignment error:', err)
      alert('Atama silinemedi.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Bilgi */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        <strong>{event.eventName}</strong> · Hedeflenen hakem sayısı:{' '}
        <strong>{event.judgeCount}</strong> · Atanan: <strong>{assignments.length}</strong>
      </div>

      {/* Mevcut atamalar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Atanmış Hakemler</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Yükleniyor...</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-gray-500">Henüz hakem atanmadı.</p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => {
              const j = judgeMap.get(a.judgeId)
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {a.judgeLabel}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {j ? `${j.givenName} ${j.familyName}` : '(silinmiş hakem)'}
                    </div>
                    <div className="flex gap-1 mt-0.5">
                      {a.components.map((c) => (
                        <span
                          key={c}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(a.id)}
                    className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors flex-shrink-0"
                    title="Kaldır"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Yeni atama formu */}
      <form onSubmit={handleAdd} className="border-t border-gray-200 pt-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Hakem Ata
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Hakem seç */}
          <div className="sm:col-span-2 space-y-1">
            <label className="block text-xs font-medium text-gray-600">Hakem</label>
            <select
              value={selectedJudgeId}
              onChange={(e) => setSelectedJudgeId(e.target.value)}
              className="input"
              disabled={saving}
            >
              <option value="">— Seç —</option>
              {availableJudges.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.givenName} {j.familyName}
                </option>
              ))}
            </select>
          </div>

          {/* Panel harfi */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Panel Harfi</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value.toUpperCase())}
              className="input uppercase text-center"
              maxLength={2}
              disabled={saving}
            />
          </div>
        </div>

        {/* Bileşenler */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Puanlayacağı Bileşenler</label>
          <div className="flex flex-wrap gap-2">
            {ALL_COMPONENTS.map((c) => {
              const selected = components.includes(c.value)
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleComponent(c.value)}
                  disabled={saving}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || availableJudges.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? 'Ekleniyor...'
            : availableJudges.length === 0
              ? 'Atanacak başka hakem yok'
              : 'Hakem Ata'}
        </button>
      </form>
    </div>
  )
}
