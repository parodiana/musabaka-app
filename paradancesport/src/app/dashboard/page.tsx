'use client'

import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { t } = useI18n()

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">
          {t('dash.welcomeUser', { name: user?.displayName ?? '' })}
        </h1>
        <p className="text-blue-100">{t('dash.welcomeText')}</p>
      </div>

      {/* User Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">{t('dash.yourRole')}</p>
          <p className="text-2xl font-bold text-blue-600">{t(`role.${user?.role}`)}</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">{t('dash.email')}</p>
          <p className="text-lg font-semibold text-gray-900">{user?.email}</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">{t('dash.language')}</p>
          <p className="text-2xl font-bold text-blue-600">
            {user?.language === 'tr' ? t('lang.tr') : t('lang.en')}
          </p>
        </div>
      </div>

      {/* Quick Links - Role Based */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dash.quickAccess')}</h2>

        {user?.role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/admin/competitions" className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors">
              <p className="font-semibold text-gray-900">{t('dash.qaCompetitions')}</p>
              <p className="text-sm text-gray-600">{t('dash.qaCompetitionsDesc')}</p>
            </Link>
            <Link href="/dashboard/admin/athletes" className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors">
              <p className="font-semibold text-gray-900">{t('dash.qaAthletes')}</p>
              <p className="text-sm text-gray-600">{t('dash.qaAthletesDesc')}</p>
            </Link>
            <Link href="/dashboard/admin/judges" className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors">
              <p className="font-semibold text-gray-900">{t('dash.qaJudges')}</p>
              <p className="text-sm text-gray-600">{t('dash.qaJudgesDesc')}</p>
            </Link>
            <Link href="/dashboard/admin/users" className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors">
              <p className="font-semibold text-gray-900">{t('dash.qaUsers')}</p>
              <p className="text-sm text-gray-600">{t('dash.qaUsersDesc')}</p>
            </Link>
          </div>
        )}

        {user?.role === 'hakem' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/hakem/scoring" className="p-4 border-2 border-blue-600 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <p className="font-semibold text-blue-900">{t('dash.qaScore')}</p>
              <p className="text-sm text-blue-700">{t('dash.qaScoreDesc')}</p>
            </Link>
          </div>
        )}

        {user?.role === 'masa_hakemi' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/masa-hakemi/scoring" className="p-4 border-2 border-blue-600 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <p className="font-semibold text-blue-900">{t('dash.qaScoreEntry')}</p>
              <p className="text-sm text-blue-700">{t('dash.qaScoreEntryDesc')}</p>
            </Link>
            <Link href="/dashboard/masa-hakemi/scoreboard" className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors">
              <p className="font-semibold text-gray-900">{t('dash.qaScoreboard')}</p>
              <p className="text-sm text-gray-600">{t('dash.qaScoreboardDesc')}</p>
            </Link>
          </div>
        )}

        {user?.role === 'bashakem' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/bashakem/approval" className="p-4 border-2 border-blue-600 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <p className="font-semibold text-blue-900">{t('dash.qaApproval')}</p>
              <p className="text-sm text-blue-700">{t('dash.qaApprovalDesc')}</p>
            </Link>
            <Link href="/dashboard/bashakem/deductions" className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors">
              <p className="font-semibold text-gray-900">{t('dash.qaDeductions')}</p>
              <p className="text-sm text-gray-600">{t('dash.qaDeductionsDesc')}</p>
            </Link>
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-2">✓ {t('dash.systemStatus')}</h3>
        <p className="text-sm text-green-700">{t('dash.systemOk')}</p>
      </div>
    </div>
  )
}
