'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { canAccessPath, homePathForRole } from '@/lib/auth/access'
import { ShieldAlert } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, loading, router])

  // Sayfa değişince mobil menüyü kapat
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  // Merkezi rol bazlı erişim kontrolü (RBAC) — spec 2.4 & 8.2.
  // Yetkisizse alt sayfa HİÇ mount edilmez; böylece veri listener'ları da çalışmaz.
  const allowed = canAccessPath(pathname, user.role)

  return (
    <div className="flex h-screen bg-gray-50 print:block print:h-auto">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden print:block print:overflow-visible">
        {/* Header */}
        <Header onMenuClick={() => setMobileOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto print:overflow-visible print:h-auto">
          <div className="p-4 sm:p-6 min-w-0">
            {allowed ? (
              children
            ) : (
              <div className="flex items-center justify-center min-h-[70vh]">
                <div className="text-center max-w-md">
                  <ShieldAlert className="w-14 h-14 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-gray-900">Erişim Engellendi</h2>
                  <p className="text-gray-600 mt-2">
                    Bu sayfayı görüntüleme yetkiniz yok. Yalnızca rolünüze atanmış ekranlara
                    erişebilirsiniz.
                  </p>
                  <Link
                    href={homePathForRole(user.role)}
                    className="inline-block mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Ana Ekranıma Dön
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
