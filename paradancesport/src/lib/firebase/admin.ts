import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage, type Storage } from 'firebase-admin/storage'

/**
 * Firebase Admin SDK - lazy initialization
 * Servis hesabı anahtarı (FIREBASE_SERVICE_ACCOUNT_KEY) yalnızca gerçekten
 * kullanıldığında kontrol edilir; böylece import sırasında / build sırasında hata fırlatmaz.
 */

let cachedApp: App | null = null

function getAdminApp(): App {
  if (cachedApp) return cachedApp

  const existing = getApps()
  if (existing.length > 0) {
    cachedApp = existing[0]
    return cachedApp
  }

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!key) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY tanımlı değil. ' +
        'Firebase Console → Project Settings → Service Accounts → Generate new private key ile anahtarı alıp .env.local içine base64 olarak ekleyin.'
    )
  }

  const serviceAccount = JSON.parse(Buffer.from(key, 'base64').toString('utf-8'))

  cachedApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })

  return cachedApp
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp())
}
