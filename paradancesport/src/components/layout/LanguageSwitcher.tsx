'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
  const { language, setLanguage } = useAuthStore()

  // Sayfa yüklendiğinde kayıtlı dil tercihini geri yükle (hidrasyon güvenli)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem('language')
      if ((saved === 'tr' || saved === 'en') && saved !== language) {
        setLanguage(saved)
      }
    } catch {
      // bazı mobil tarayıcılarda (gizli mod) localStorage erişilemez — yoksay
    }
    // yalnızca ilk mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => setLanguage('tr')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          language === 'tr'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="Türkçe"
      >
        <Globe className="w-4 h-4" />
        TR
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          language === 'en'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        title="English"
      >
        <Globe className="w-4 h-4" />
        EN
      </button>
    </div>
  )
}
