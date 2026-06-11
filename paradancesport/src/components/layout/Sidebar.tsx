'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useAuthStore } from '@/store/auth.store'
import { useI18n } from '@/i18n/useI18n'
import {
  LayoutDashboard,
  Users,
  Trophy,
  ClipboardList,
  ClipboardCheck,
  MinusCircle,
  FileText,
  Settings,
  LogOut,
  X,
} from 'lucide-react'

interface NavItem {
  href: string
  labelKey: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['admin', 'bashakem', 'hakem', 'masa_hakemi'] },
  { href: '/dashboard/admin', labelKey: 'nav.administration', icon: <Settings className="w-5 h-5" />, roles: ['admin'] },
  { href: '/dashboard/admin/users', labelKey: 'nav.users', icon: <Users className="w-5 h-5" />, roles: ['admin'] },
  { href: '/dashboard/admin/competitions', labelKey: 'nav.competitions', icon: <Trophy className="w-5 h-5" />, roles: ['admin'] },
  { href: '/dashboard/admin/athletes', labelKey: 'nav.athletes', icon: <Users className="w-5 h-5" />, roles: ['admin'] },
  { href: '/dashboard/admin/judges', labelKey: 'nav.judges', icon: <Users className="w-5 h-5" />, roles: ['admin'] },
  { href: '/dashboard/admin/reports', labelKey: 'nav.reports', icon: <FileText className="w-5 h-5" />, roles: ['admin'] },
  { href: '/dashboard/hakem/scoring', labelKey: 'nav.score', icon: <ClipboardList className="w-5 h-5" />, roles: ['hakem'] },
  { href: '/dashboard/masa-hakemi/scoring', labelKey: 'nav.scoreEntry', icon: <ClipboardList className="w-5 h-5" />, roles: ['masa_hakemi', 'admin'] },
  { href: '/dashboard/masa-hakemi/scoreboard', labelKey: 'nav.scoreboard', icon: <Trophy className="w-5 h-5" />, roles: ['masa_hakemi', 'admin', 'bashakem'] },
  { href: '/dashboard/bashakem', labelKey: 'nav.bashakemPanel', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['bashakem'] },
  { href: '/dashboard/bashakem/approval', labelKey: 'nav.approval', icon: <ClipboardCheck className="w-5 h-5" />, roles: ['bashakem', 'admin'] },
  { href: '/dashboard/bashakem/deductions', labelKey: 'nav.deductions', icon: <MinusCircle className="w-5 h-5" />, roles: ['bashakem', 'admin'] },
]

export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { t } = useI18n()

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (err) {
      console.error('Logout error:', err)
    }
    logout()
    router.push('/login')
  }

  if (!user) return null

  const filteredNavItems = navItems.filter((item) => item.roles.includes(user.role))

  return (
    <>
      {/* Mobil arka plan karartması */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden print:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white h-screen flex flex-col shadow-lg transform transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-blue-700 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('common.appName')}</h1>
            <p className="text-xs text-blue-200">{t('common.appSubtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-blue-200 hover:text-white p-1"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-blue-700 bg-blue-800/50">
          <p className="text-sm font-semibold truncate">{user.displayName}</p>
          <p className="text-xs text-blue-200">{t(`role.${user.role}`)}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-2">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-700/50'
                  }`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{t(item.labelKey)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-blue-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-blue-100 hover:bg-red-600/20 transition-colors text-sm font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>{t('common.logout')}</span>
        </button>
      </div>
      </aside>
    </>
  )
}
