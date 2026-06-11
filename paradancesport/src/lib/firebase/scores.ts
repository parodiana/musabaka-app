import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './client'
import type { Score, ScoringComponent, ScoreMode } from '@/types'

const COLLECTION = 'scores'

export interface ScoreInput {
  competitionId: string
  eventId: string
  entryId: string
  judgeId: string
  judgeAssignmentId: string
  dance?: string
  component: ScoringComponent
  value: number
  mode: ScoreMode
  enteredBy: string
}

/**
 * Deterministik doc ID — (judge × entry × bileşen × dans) benzersizliğini garanti eder (BK-2).
 * Aynı kombinasyon tekrar yazılırsa üzerine yazar (çift giriş engellenir).
 */
export function scoreDocId(
  eventId: string,
  entryId: string,
  judgeId: string,
  component: ScoringComponent,
  dance?: string
): string {
  const danceKey = dance && dance.trim() ? dance.trim() : 'single'
  return `${eventId}__${entryId}__${judgeId}__${component}__${danceKey}`
}

/**
 * Skoru ekle/güncelle (upsert). Deterministik ID sayesinde çift giriş olmaz.
 */
export async function upsertScore(input: ScoreInput): Promise<void> {
  const id = scoreDocId(input.eventId, input.entryId, input.judgeId, input.component, input.dance)
  await setDoc(doc(db, COLLECTION, id), {
    competitionId: input.competitionId,
    eventId: input.eventId,
    entryId: input.entryId,
    judgeId: input.judgeId,
    judgeAssignmentId: input.judgeAssignmentId,
    dance: input.dance ?? null,
    component: input.component,
    value: input.value,
    mode: input.mode,
    enteredBy: input.enteredBy,
    timestamp: serverTimestamp(),
    isValid: true,
  })
}

/** Bir skoru sil */
export async function deleteScore(
  eventId: string,
  entryId: string,
  judgeId: string,
  component: ScoringComponent,
  dance?: string
): Promise<void> {
  const id = scoreDocId(eventId, entryId, judgeId, component, dance)
  await deleteDoc(doc(db, COLLECTION, id))
}

/** Firestore dokümanını Score tipine çevir */
export function mapScore(id: string, data: Record<string, unknown>): Score {
  return {
    id,
    competitionId: (data.competitionId as string) ?? '',
    eventId: (data.eventId as string) ?? '',
    entryId: (data.entryId as string) ?? '',
    judgeId: (data.judgeId as string) ?? '',
    judgeAssignmentId: (data.judgeAssignmentId as string) ?? '',
    dance: (data.dance as string) ?? undefined,
    component: (data.component as ScoringComponent) ?? 'TS',
    value: (data.value as number) ?? 0,
    mode: (data.mode as ScoreMode) ?? 'TABLE',
    enteredBy: (data.enteredBy as string) ?? '',
    timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(),
    isValid: (data.isValid as boolean) ?? true,
  }
}
