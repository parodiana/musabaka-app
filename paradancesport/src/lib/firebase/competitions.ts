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
import type { Competition, CompetitionStatus, EntryMode, AggregationMode } from '@/types'

const COLLECTION = 'competitions'

export interface CompetitionInput {
  name: string
  code: string
  date: Date
  venue: string
  defaultEntryMode: EntryMode
  aggregationMode: AggregationMode
  status: CompetitionStatus
}

/**
 * Yeni yarışma oluştur.
 */
export async function createCompetition(
  input: CompetitionInput,
  createdByUid: string
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    date: Timestamp.fromDate(input.date),
    createdBy: createdByUid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Yarışmayı güncelle.
 */
export async function updateCompetition(
  id: string,
  input: Partial<CompetitionInput>
): Promise<void> {
  const data: Record<string, unknown> = { ...input }
  if (input.date) {
    data.date = Timestamp.fromDate(input.date)
  }
  await updateDoc(doc(db, COLLECTION, id), data)
}

/**
 * Yarışmayı sil.
 */
export async function deleteCompetition(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

/**
 * Firestore dokümanını Competition tipine çevir.
 */
export function mapCompetition(id: string, data: Record<string, unknown>): Competition {
  const rawDate = data.date
  let date: Date
  if (rawDate instanceof Timestamp) {
    date = rawDate.toDate()
  } else if (rawDate instanceof Date) {
    date = rawDate
  } else {
    date = new Date()
  }

  return {
    id,
    name: (data.name as string) ?? '',
    code: (data.code as string) ?? '',
    date,
    venue: (data.venue as string) ?? '',
    defaultEntryMode: (data.defaultEntryMode as EntryMode) ?? 'AUTO',
    aggregationMode: (data.aggregationMode as AggregationMode) ?? 'TRIMMED',
    status: (data.status as CompetitionStatus) ?? 'DRAFT',
    createdBy: (data.createdBy as string) ?? '',
    createdAt:
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  }
}
