import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './client'
import type {
  Event,
  Discipline,
  Gender,
  Class,
  EntryMode,
  EventStatus,
} from '@/types'

const COLLECTION = 'events'

export interface EventInput {
  competitionId: string
  eventCode: string
  eventName: string
  discipline: Discipline
  gender: Gender
  class: Class
  format: 'Single' | 'Duo' | 'Combi'
  entryMode: EntryMode
  dances: string[]
  judgeCount: number
  status: EventStatus
}

/**
 * Yeni kategori (event) oluştur.
 */
export async function createEvent(input: EventInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Kategoriyi güncelle.
 */
export async function updateEvent(id: string, input: Partial<EventInput>): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...input })
}

/**
 * Kategoriyi sil.
 */
export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

/**
 * OTOMATİK modda "sahadaki" kaydı ayarla (hakemlere gönder) veya kaldır (null).
 * Hakem ekranı yalnızca bu kaydı gösterir.
 */
export async function setActiveEntry(eventId: string, entryId: string | null): Promise<void> {
  await updateDoc(doc(db, COLLECTION, eventId), { activeEntryId: entryId })
}

/**
 * Firestore dokümanını Event tipine çevir.
 */
export function mapEvent(id: string, data: Record<string, unknown>): Event {
  return {
    id,
    competitionId: (data.competitionId as string) ?? '',
    eventCode: (data.eventCode as string) ?? '',
    eventName: (data.eventName as string) ?? '',
    discipline: (data.discipline as Discipline) ?? 'Standard',
    gender: (data.gender as Gender) ?? 'Mixed',
    class: (data.class as Class) ?? 'Class1',
    format: (data.format as 'Single' | 'Duo' | 'Combi') ?? 'Single',
    entryMode: (data.entryMode as EntryMode) ?? 'AUTO',
    dances: (data.dances as string[]) ?? [],
    judgeCount: (data.judgeCount as number) ?? 0,
    status: (data.status as EventStatus) ?? 'PENDING',
    activeEntryId: (data.activeEntryId as string) ?? undefined,
  }
}

/** Disipline göre standart dans önerileri (hızlı seçim için) */
export const DANCE_PRESETS: Record<Discipline, string[]> = {
  Standard: ['Waltz', 'Tango', 'Viennese Waltz', 'Slow Foxtrot', 'Quickstep'],
  Latin: ['Samba', 'Cha Cha', 'Rumba', 'Paso Doble', 'Jive'],
  Freestyle: ['Freestyle'],
}
