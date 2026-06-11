import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './client'
import { mapScore } from './scores'
import { mapDeduction } from './deductions'
import { updateEvent } from './events'
import { aggregateEventScores } from '@/lib/scoring/aggregator'
import type { Result, ResultStatus, ResultDanceBreakdown, Entry } from '@/types'
import type { AggregationMode } from '@/lib/scoring/engine'

const COLLECTION = 'results'

/** (event × entry) başına deterministik sonuç doc ID — tekrar hesaplama üzerine yazar */
export function resultDocId(eventId: string, entryId: string): string {
  return `${eventId}__${entryId}`
}

/**
 * Bir kategorinin (event) sonuçlarını ham skor + kesintilerden hesaplar,
 * `results` koleksiyonuna CALCULATED durumuyla yazar ve event'i AWAITING_APPROVAL yapar.
 * Client-side: motoru (lib/scoring) tarayıcıda çalıştırır.
 */
export async function calculateEventResults(params: {
  competitionId: string
  eventId: string
  entries: Entry[]
  aggregationMode: AggregationMode
}): Promise<number> {
  const { competitionId, eventId, entries, aggregationMode } = params

  // Ham skorları ve kesintileri çek
  const [scoresSnap, dedSnap] = await Promise.all([
    getDocs(query(collection(db, 'scores'), where('eventId', '==', eventId))),
    getDocs(query(collection(db, 'deductions'), where('eventId', '==', eventId))),
  ])
  const scores = scoresSnap.docs.map((d) => mapScore(d.id, d.data()))
  const deductions = dedSnap.docs.map((d) => mapDeduction(d.id, d.data()))

  const computations = aggregateEventScores(scores, deductions, aggregationMode)
  const bibByEntry = new Map(entries.map((e) => [e.id, e.bibNumber]))

  const batch = writeBatch(db)
  for (const c of computations) {
    const single = c.danceResults.length === 1 ? c.danceResults[0] : null
    const totalDeductions = c.danceResults.reduce((s, d) => s + d.deductions, 0)
    const breakdown: ResultDanceBreakdown[] = c.danceResults.map((d) => ({
      dance: d.dance ?? null,
      tsValue: d.tsValue,
      mcpValue: d.mcpValue,
      dlValue: d.dlValue,
      deductions: d.deductions,
      danceScore: d.danceScore,
    })) as ResultDanceBreakdown[]

    const ref = doc(db, COLLECTION, resultDocId(eventId, c.entryId))
    batch.set(ref, {
      competitionId,
      eventId,
      entryId: c.entryId,
      dance: null,
      tsValue: single ? single.tsValue : 0,
      mcpValue: single ? single.mcpValue : 0,
      dlValue: single ? single.dlValue : 0,
      deductions: totalDeductions,
      finalScore: c.finalScore,
      tieBreakScore: c.tieBreakScore,
      rank: c.rank,
      tied: c.tied,
      bibNumber: bibByEntry.get(c.entryId) ?? null,
      danceResults: breakdown,
      calculatedAt: serverTimestamp(),
      approvedBy: null,
      approvedAt: null,
      status: 'CALCULATED' as ResultStatus,
    })
  }
  await batch.commit()

  await updateEvent(eventId, { status: 'AWAITING_APPROVAL' })
  return computations.length
}

/**
 * Başhakem onayı: tüm event sonuçlarını APPROVED yapar, event'i APPROVED'a alır.
 */
export async function approveEventResults(
  eventId: string,
  approvedByUid: string
): Promise<void> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('eventId', '==', eventId)))
  const batch = writeBatch(db)
  for (const d of snap.docs) {
    batch.update(d.ref, {
      status: 'APPROVED' as ResultStatus,
      approvedBy: approvedByUid,
      approvedAt: serverTimestamp(),
    })
  }
  await batch.commit()
  await updateEvent(eventId, { status: 'APPROVED' })
}

/**
 * Başhakem iadesi: sonuçları RETURNED yapar, event'i düzeltme için IN_PROGRESS'e döndürür.
 */
export async function returnEventResults(eventId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, COLLECTION), where('eventId', '==', eventId)))
  const batch = writeBatch(db)
  for (const d of snap.docs) {
    batch.update(d.ref, { status: 'RETURNED' as ResultStatus })
  }
  await batch.commit()
  await updateEvent(eventId, { status: 'IN_PROGRESS' })
}

/** Firestore dokümanını Result tipine çevir */
export function mapResult(id: string, data: Record<string, unknown>): Result {
  const rawBreakdown = (data.danceResults as Record<string, unknown>[]) ?? []
  return {
    id,
    competitionId: (data.competitionId as string) ?? '',
    eventId: (data.eventId as string) ?? '',
    entryId: (data.entryId as string) ?? '',
    dance: (data.dance as string) ?? undefined,
    tsValue: (data.tsValue as number) ?? 0,
    mcpValue: (data.mcpValue as number) ?? 0,
    dlValue: (data.dlValue as number) ?? 0,
    deductions: (data.deductions as number) ?? 0,
    finalScore: (data.finalScore as number) ?? 0,
    rank: (data.rank as number) ?? undefined,
    tieBreakScore: (data.tieBreakScore as number) ?? undefined,
    tied: (data.tied as boolean) ?? undefined,
    bibNumber: (data.bibNumber as number) ?? undefined,
    danceResults: rawBreakdown.map((b) => ({
      dance: (b.dance as string) ?? undefined,
      tsValue: (b.tsValue as number) ?? 0,
      mcpValue: (b.mcpValue as number) ?? 0,
      dlValue: (b.dlValue as number) ?? 0,
      deductions: (b.deductions as number) ?? 0,
      danceScore: (b.danceScore as number) ?? 0,
    })),
    calculatedAt:
      data.calculatedAt instanceof Timestamp ? data.calculatedAt.toDate() : undefined,
    approvedBy: (data.approvedBy as string) ?? undefined,
    approvedAt: data.approvedAt instanceof Timestamp ? data.approvedAt.toDate() : undefined,
    status: (data.status as ResultStatus) ?? 'CALCULATED',
  }
}
