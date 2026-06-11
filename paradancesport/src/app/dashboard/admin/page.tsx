'use client'

import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { Users, Trophy, UserCog, ClipboardList, ShieldAlert } from 'lucide-react'

const adminSections = [
  {
    href: '/dashboard/admin/users',
    label: 'Kullanıcılar',
    description: 'Sistem kullanıcılarını oluştur ve yönet',
    icon: Users,
    color: 'bg-blue-500',
    ready: true,
  },
  {
    href: '/dashboard/admin/competitions',
    label: 'Yarışmalar',
    description: 'Yarışma ve kategori yönetimi',
    icon: Trophy,
    color: 'bg-purple-500',
    ready: false,
  },
  {
    href: '/dashboard/admin/athletes',
    label: 'Sporcular',
    description: 'Sporcu kayıtları ve Excel içe aktarma',
    icon: UserCog,
    color: 'bg-yellow-500',
    ready: false,
  },
  {
    href: '/dashboard/admin/judges',
    label: 'Hakemler',
    description: 'Hakem kayıtları ve atamalar',
    icon: ClipboardList,
    color: 'bg-green-500',
    ready: false,
  },
]

export default function AdminDashboardPage() {
  const { user } = useAuthStore()

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
          <p className="text-gray-600 mt-2">Bu sayfaya yalnızca yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Yönetim Paneli</h1>
        <p className="text-gray-600 mt-1">Sistem yönetimi için bölümleri seçin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminSections.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.href}
              href={section.href}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-6 flex items-start gap-4 group"
            >
              <div
                className={`${section.color} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{section.label}</h3>
                  {!section.ready && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Yakında
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{section.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
