'use client'

import { useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useAuthStore } from '@/store/auth.store'
import { User } from '@/types'

export function useAuth() {
  const { user, isAuthenticated, loading, setUser, setLoading, setError, logout } = useAuthStore()

  useEffect(() => {
    setLoading(true)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        // Get user document from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid)
        const userDoc = await getDoc(userDocRef)

        // Spec: Kayıt ekranı yok; kullanıcıları yalnızca admin oluşturur.
        // Dokümanı olmayan (oluşturulmamış veya silinmiş) hesaplar erişemez.
        if (!userDoc.exists()) {
          await signOut(auth)
          setError('Hesabınız bulunamadı veya erişiminiz kaldırılmış. Lütfen admin ile iletişime geçin.')
          setUser(null)
          setLoading(false)
          return
        }

        const userData = userDoc.data() as User

        // Askıya alınmış hesaplar giriş yapamaz.
        if (userData.status === 'suspended') {
          await signOut(auth)
          setError('Giriş izniniz bulunmamakta. Lütfen admin ile iletişime geçin.')
          setUser(null)
          setLoading(false)
          return
        }

        setUser({
          ...userData,
          uid: firebaseUser.uid,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Auth hatası'
        console.error('Auth error:', message)
        setError(message)
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setLoading, setError])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      logout()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Çıkış hatası'
      setError(message)
    }
  }

  return {
    user,
    isAuthenticated,
    loading,
    logout: handleLogout,
  }
}
