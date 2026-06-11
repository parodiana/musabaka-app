'use client'

import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Menu } from 'lucide-react'

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuthStore()
  const { t } = useI18n()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        {/* Left: Hamburger (mobil) + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Menü"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">{t('common.appName')}</h2>
        </div>

        {/* Right: Language switcher + user info */}
        <div className="flex items-center gap-2 sm:gap-6">
          <LanguageSwitcher />

          {user && (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                <p className="text-xs text-gray-500">{t(`role.${user.role}`)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
