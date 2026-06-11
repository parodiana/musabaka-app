'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'
import { useRouter } from 'next/navigation'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const { t } = useI18n()
  const setAuthError = useAuthStore((state) => state.setError)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signInWithEmailAndPassword(auth, email, password)

      if (result.user) {
        // Erişim kontrolü: dokümanı olmayan veya askıdaki hesapları engelle (anında geri bildirim).
        const snap = await getDoc(doc(db, 'users', result.user.uid))
        if (!snap.exists()) {
          await signOut(auth)
          setError(t('login.errNoAccount'))
          return
        }
        if (snap.data().status === 'suspended') {
          await signOut(auth)
          setError(t('login.errSuspended'))
          return
        }
        // Rolü ve kullanıcı bilgisini useAuth hook'u Firestore'dan okuyup set edecek.
        // Burada elle set ETMİYORUZ — tek doğru kaynak Firestore.
        router.push('/dashboard')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''

      let friendly = t('login.errWrongPassword')
      if (message.includes('user-not-found')) friendly = t('login.errUserNotFound')
      else if (message.includes('wrong-password') || message.includes('invalid-credential'))
        friendly = t('login.errWrongPassword')
      else if (message.includes('invalid-email')) friendly = t('login.errInvalidEmail')
      else if (message.includes('too-many-requests')) friendly = t('login.errTooMany')

      setError(friendly)
      setAuthError(friendly)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          {t('login.email')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="ornek@email.com"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          {t('login.password')}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? t('login.submitting') : t('login.submit')}
      </button>
    </form>
  )
}
