import { create } from 'zustand'
import { User, UserRole } from '@/types'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  language: 'tr' | 'en'

  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setLanguage: (lang: 'tr' | 'en') => void
  logout: () => void
  hasRole: (role: UserRole | UserRole[]) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  language: 'tr',

  setUser: (user) => {
    set({
      user,
      isAuthenticated: !!user,
      error: null,
      loading: false,
    })
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setLanguage: (lang) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('language', lang)
      } catch {
        // localStorage erişilemiyor olabilir — yoksay
      }
    }
    set({ language: lang })
  },

  logout: () => {
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    })
  },

  hasRole: (role) => {
    const { user } = get()
    if (!user) return false

    if (typeof role === 'string') {
      return user.role === role
    }

    return role.includes(user.role)
  },
}))
