import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './client'
import type { Athlete } from '@/types'

const COLLECTION = 'athletes'

export interface AthleteInput {
  givenName: string
  familyName: string
  dob: Date
  gender: 'M' | 'F'
  memberOrg?: string
  region?: string
  wasms?: string
  classifications: string[]
  categories?: string[]
}

/**
 * Yeni sporcu oluştur.
 */
export async function createAthlete(input: AthleteInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    givenName: input.givenName,
    familyName: input.familyName,
    dob: Timestamp.fromDate(input.dob),
    gender: input.gender,
    memberOrg: input.memberOrg ?? null,
    region: input.region ?? null,
    externalIds: { wasms: input.wasms ?? null },
    classifications: input.classifications,
    categories: input.categories ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Birden çok sporcuyu tek seferde (batch) oluştur. Excel import için.
 * Firestore batch limiti 500; daha fazlası için parçalara böler.
 */
export async function createAthletesBatch(inputs: AthleteInput[]): Promise<number> {
  let created = 0
  const CHUNK = 450
  for (let i = 0; i < inputs.length; i += CHUNK) {
    const slice = inputs.slice(i, i + CHUNK)
    const batch = writeBatch(db)
    for (const input of slice) {
      const ref = doc(collection(db, COLLECTION))
      batch.set(ref, {
        givenName: input.givenName,
        familyName: input.familyName,
        dob: Timestamp.fromDate(input.dob),
        gender: input.gender,
        memberOrg: input.memberOrg ?? null,
        region: input.region ?? null,
        externalIds: { wasms: input.wasms ?? null },
        classifications: input.classifications,
        categories: input.categories ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    created += slice.length
  }
  return created
}

/**
 * Sporcuyu güncelle.
 */
export async function updateAthlete(id: string, input: AthleteInput): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    givenName: input.givenName,
    familyName: input.familyName,
    dob: Timestamp.fromDate(input.dob),
    gender: input.gender,
    memberOrg: input.memberOrg ?? null,
    region: input.region ?? null,
    externalIds: { wasms: input.wasms ?? null },
    classifications: input.classifications,
    categories: input.categories ?? [],
    updatedAt: serverTimestamp(),
  })
}

/**
 * Sporcuyu sil.
 */
export async function deleteAthlete(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}

/**
 * Firestore dokümanını Athlete tipine çevir.
 */
export function mapAthlete(id: string, data: Record<string, unknown>): Athlete {
  const externalIds = (data.externalIds as { wasms?: string } | undefined) ?? undefined
  return {
    id,
    givenName: (data.givenName as string) ?? '',
    familyName: (data.familyName as string) ?? '',
    dob: data.dob instanceof Timestamp ? data.dob.toDate() : new Date(),
    gender: (data.gender as 'M' | 'F') ?? 'M',
    memberOrg: (data.memberOrg as string) ?? undefined,
    region: (data.region as string) ?? undefined,
    externalIds: externalIds?.wasms ? { wasms: externalIds.wasms } : undefined,
    classifications: (data.classifications as string[]) ?? [],
    categories: (data.categories as string[]) ?? [],
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  }
}
