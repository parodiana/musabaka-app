import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './client'
import type { Judge } from '@/types'

const COLLECTION = 'judges'

export interface JudgeInput {
  givenName: string
  familyName: string
  externalId?: string
  userId?: string
}

/**
 * Yeni hakem oluştur.
 */
export async function createJudge(input: JudgeInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    givenName: input.givenName,
    familyName: input.familyName,
    externalId: input.externalId ?? null,
    userId: input.userId ?? null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Hakemi güncelle.
 */
export async function updateJudge(id: string, input: JudgeInput): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    givenName: input.givenName,
    familyName: input.familyName,
    externalId: input.externalId ?? null,
    userId: input.userId ?? null,
  })
}

/**
 * Hakemi sil.
 */
export async function deleteJudge(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

/**
 * Firestore dokümanını Judge tipine çevir.
 */
export function mapJudge(id: string, data: Record<string, unknown>): Judge {
  return {
    id,
    givenName: (data.givenName as string) ?? '',
    familyName: (data.familyName as string) ?? '',
    externalId: (data.externalId as string) ?? undefined,
    userId: (data.userId as string) ?? undefined,
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  }
}
