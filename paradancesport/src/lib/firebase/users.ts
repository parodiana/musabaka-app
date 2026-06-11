import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from './client'
import type { UserStatus } from '@/types'

const COLLECTION = 'users'

/**
 * Kullanıcı hesabını askıya al / aktifleştir.
 * Askıdaki kullanıcı giriş yapamaz (useAuth + LoginForm engeller).
 */
export async function setUserStatus(uid: string, status: UserStatus): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { status })
}

/**
 * Kullanıcının Firestore dokümanını sil → erişimi tamamen kaldırır.
 *
 * NOT: Firebase Auth hesabının kendisi yalnızca Admin SDK ile silinebilir
 * (service account key org politikasıyla engelli). Doküman silindiğinde kullanıcı
 * kimlik doğrulasa bile rol/erişim dokümanı bulunmadığından sisteme giremez.
 */
export async function deleteUserDoc(uid: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, uid))
}
