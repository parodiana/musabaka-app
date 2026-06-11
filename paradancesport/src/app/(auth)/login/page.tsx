'use client'

import { useAuth } from '@/hooks/useAuth'
import { LoginForm } from '@/components/auth/LoginForm'
import { useI18n } from '@/i18n/useI18n'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth()
  const { t } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-6 py-8 bg-white rounded-2xl shadow-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('common.appName')}</h1>
          <p className="mt-2 text-gray-600 text-sm">{t('login.subtitle')}</p>
        </div>

        {/* Welcome Text */}
        <div className="mb-8 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('login.welcome')}</h2>
          <p className="text-gray-600 text-sm">{t('login.intro')}</p>
        </div>

        {/* Login Form */}
        <LoginForm />

        {/* Footer */}
        <div className="mt-8 text-center border-t pt-6">
          <p className="text-xs text-gray-500">
            {new Date().getFullYear()} {t('common.appName')} · {t('common.appSubtitle')}
          </p>
          <p className="text-xs text-gray-500 mt-2">{t('login.rights')}</p>
        </div>
      </div>
    </div>
  )
}
