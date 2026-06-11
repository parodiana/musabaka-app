import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './client'
import type { Deduction, DeductionType } from '@/types'

const COLLECTION = 'deductions'

export interface DeductionInput {
  competitionId: string
  eventId: string
  entryId: string
  dance?: string
  type: DeductionType
  amount: number
  reason: string
  enteredBy: string
}

export async function createDeduction(input: DeductionInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    dance: input.dance ?? null,
    timestamp: serverTimestamp(),
  })
  return ref.id
}

export async function deleteDeduction(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

export function mapDeduction(id: string, data: Record<string, unknown>): Deduction {
  return {
    id,
    competitionId: (data.competitionId as string) ?? '',
    eventId: (data.eventId as string) ?? '',
    entryId: (data.entryId as string) ?? '',
    dance: (data.dance as string) ?? undefined,
    type: (data.type as DeductionType) ?? 'FALL',
    amount: (data.amount as number) ?? 0,
    reason: (data.reason as string) ?? '',
    enteredBy: (data.enteredBy as string) ?? '',
    timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(),
  }
}
