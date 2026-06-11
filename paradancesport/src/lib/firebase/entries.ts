import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './client'
import type { Entry, EntryStatus } from '@/types'

const COLLECTION = 'entries'

export interface EntryInput {
  competitionId: string
  eventId: string
  athleteId?: string
  athlete1Id?: string
  athlete2Id?: string
  bibNumber: number
  entryClass: string
  status: EntryStatus
}

/**
 * Yeni kayıt oluştur.
 */
export async function createEntry(input: EntryInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    competitionId: input.competitionId,
    eventId: input.eventId,
    athleteId: input.athleteId ?? null,
    athlete1Id: input.athlete1Id ?? null,
    athlete2Id: input.athlete2Id ?? null,
    bibNumber: input.bibNumber,
    entryClass: input.entryClass,
    status: input.status,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Kaydı güncelle.
 */
export async function updateEntry(id: string, input: Partial<EntryInput>): Promise<void> {
  const data: Record<string, unknown> = { ...input }
  if ('athleteId' in input) data.athleteId = input.athleteId ?? null
  if ('athlete1Id' in input) data.athlete1Id = input.athlete1Id ?? null
  if ('athlete2Id' in input) data.athlete2Id = input.athlete2Id ?? null
  await updateDoc(doc(db, COLLECTION, id), data)
}

/**
 * Kaydı sil.
 */
export async function deleteEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

/**
 * Firestore dokümanını Entry tipine çevir.
 */
export function mapEntry(id: string, data: Record<string, unknown>): Entry {
  return {
    id,
    competitionId: (data.competitionId as string) ?? '',
    eventId: (data.eventId as string) ?? '',
    athleteId: (data.athleteId as string) ?? undefined,
    athlete1Id: (data.athlete1Id as string) ?? undefined,
    athlete2Id: (data.athlete2Id as string) ?? undefined,
    bibNumber: (data.bibNumber as number) ?? 0,
    entryClass: (data.entryClass as string) ?? '',
    status: (data.status as EntryStatus) ?? 'ACTIVE',
    createdAt: new Date(),
  }
}

/**
 * Sırt no yarışma içinde kullanılıyor mu? (kendisi hariç)
 */
export function isBibTaken(
  competitionEntries: Entry[],
  bib: number,
  exceptEntryId?: string
): boolean {
  return competitionEntries.some(
    (e) => e.bibNumber === bib && e.id !== exceptEntryId
  )
}

/**
 * Yarışmada kullanılmayan en küçük sırt no'yu öner.
 */
export function nextBibNumber(competitionEntries: Entry[]): number {
  const used = new Set(competitionEntries.map((e) => e.bibNumber))
  let n = 1
  while (used.has(n)) n++
  return n
}
