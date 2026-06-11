import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './client'
import type { JudgeAssignment, ScoringComponent } from '@/types'

const COLLECTION = 'judgeAssignments'

export interface JudgeAssignmentInput {
  competitionId: string
  eventId: string
  judgeId: string
  components: ScoringComponent[]
  judgeLabel: string
}

/**
 * Yeni hakem ataması oluştur.
 */
export async function createJudgeAssignment(input: JudgeAssignmentInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Atamayı güncelle.
 */
export async function updateJudgeAssignment(
  id: string,
  input: Partial<JudgeAssignmentInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...input })
}

/**
 * Atamayı sil.
 */
export async function deleteJudgeAssignment(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

/**
 * Firestore dokümanını JudgeAssignment tipine çevir.
 */
export function mapJudgeAssignment(id: string, data: Record<string, unknown>): JudgeAssignment {
  return {
    id,
    competitionId: (data.competitionId as string) ?? '',
    eventId: (data.eventId as string) ?? '',
    judgeId: (data.judgeId as string) ?? '',
    components: (data.components as ScoringComponent[]) ?? [],
    judgeLabel: (data.judgeLabel as string) ?? '',
  }
}

/** Sıradaki panel harfini öner (A, B, C, ...) */
export function nextJudgeLabel(existing: JudgeAssignment[]): string {
  const used = new Set(existing.map((a) => a.judgeLabel))
  for (let i = 0; i < 26; i++) {
    const label = String.fromCharCode(65 + i) // A-Z
    if (!used.has(label)) return label
  }
  return ''
}
