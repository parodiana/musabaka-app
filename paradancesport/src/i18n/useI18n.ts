'use client'

import { useAuthStore } from '@/store/auth.store'
import { translations, type Locale } from './translations'

/**
 * Basit, store tabanlı i18n hook'u.
 * `t('namespace.key')` ile çeviri döner; {name} gibi değişkenleri yerleştirir.
 * Dil auth.store'daki `language`'tan okunur (TR/EN butonu anında günceller).
 */
export function useI18n() {
  const language = useAuthStore((s) => s.language) as Locale

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = translations[language]?.[key] ?? translations.tr[key] ?? key
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]))
      }
    }
    return str
  }

  return { t, language }
}
