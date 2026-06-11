import { initializeApp, deleteApp, getApps } from 'firebase/app'
import {
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './client'
import type { UserRole } from '@/types'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const SECONDARY_APP_NAME = 'UserCreation'

export interface CreateUserInput {
  email: string
  password: string
  displayName: string
  role: UserRole
  createdByUid?: string
}

export interface CreatedUserResult {
  uid: string
  email: string
  displayName: string
  role: UserRole
}

/**
 * Yeni kullanıcıyı service account key OLMADAN oluşturur.
 *
 * Mantık: İkincil bir Firebase app örneği üzerinden createUserWithEmailAndPassword
 * çağrılır — böylece admin'in mevcut oturumu (birincil app) bozulmaz. Yeni kullanıcı
 * dokümanı (rol dahil) Firestore'a yazılır; rol authz'si Firestore'dan okunduğu için
 * custom claims gerekmez.
 */
export async function createUserClient(input: CreateUserInput): Promise<CreatedUserResult> {
  const { email, password, displayName, role, createdByUid } = input

  // Önceki ikincil app kaldıysa temizle (temiz başlangıç)
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME)
  if (existing) {
    await deleteApp(existing)
  }

  // İkincil app — birincil oturumu etkilememek için ayrı isimle
  const secondaryApp = initializeApp(firebaseConfig, SECONDARY_APP_NAME)
  // Bellek-içi persistence: ana app'in IndexedDB oturum kilidiyle çakışmaz (deadlock önler)
  const secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence })

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    const newUid = cred.user.uid

    // Auth profilindeki görünen adı ayarla
    await updateProfile(cred.user, { displayName })

    // Firestore kullanıcı dokümanı (rol burada) — birincil db ile (admin yetkili)
    await setDoc(doc(db, 'users', newUid), {
      uid: newUid,
      email,
      displayName,
      role,
      language: 'tr',
      createdAt: serverTimestamp(),
      createdBy: createdByUid ?? 'admin',
    })

    // İkincil oturumu kapat
    await signOut(secondaryAuth)

    return { uid: newUid, email, displayName, role }
  } finally {
    // İkincil app'i temizle
    try {
      await deleteApp(secondaryApp)
    } catch {
      // app zaten silinmiş olabilir — yoksay
    }
  }
}

/**
 * Firebase Auth hata kodlarını Türkçeleştir.
 */
export function translateAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('email-already-in-use')) return 'Bu e-posta adresi zaten kayıtlı'
  if (message.includes('invalid-email')) return 'Geçersiz e-posta adresi'
  if (message.includes('weak-password')) return 'Şifre çok zayıf (en az 6 karakter)'
  if (message.includes('network-request-failed')) return 'Ağ hatası — bağlantıyı kontrol edin'
  return message
}
