import type { UserRole } from '@/types'

/**
 * Rol bazlı route erişim haritası (RBAC).
 * Spesifikasyon 2.4 & 8.2: her kullanıcı yalnızca kendisine atanmış ekranları görür.
 *
 * Eşleştirme: pathname ile başlayan EN UZUN prefix kazanır (spesifikten genele).
 * Admin tüm verilere erişebilir (spec Bölüm 2 — "tüm verileri görme").
 */
interface RouteAccess {
  prefix: string
  roles: UserRole[]
}

const ROUTE_ACCESS: RouteAccess[] = [
  { prefix: '/dashboard/admin', roles: ['admin'] },
  { prefix: '/dashboard/bashakem', roles: ['admin', 'bashakem'] },
  { prefix: '/dashboard/hakem', roles: ['admin', 'hakem'] },
  // Skor tablosu: masa hakemi her iki modda izler; başhakem inceler. Hakem göremez.
  { prefix: '/dashboard/masa-hakemi/scoreboard', roles: ['admin', 'bashakem', 'masa_hakemi'] },
  { prefix: '/dashboard/masa-hakemi', roles: ['admin', 'masa_hakemi'] },
  // Genel dashboard girişi: tüm roller
  { prefix: '/dashboard', roles: ['admin', 'bashakem', 'hakem', 'masa_hakemi'] },
]

function matchRoute(pathname: string): RouteAccess | undefined {
  return ROUTE_ACCESS
    .filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
}

/** Verilen rol, bu path'e erişebilir mi? */
export function canAccessPath(pathname: string, role: UserRole): boolean {
  const match = matchRoute(pathname)
  // Haritada olmayan /dashboard altı yollar varsayılan olarak tüm rollere açık değil:
  // güvenli taraf — yalnızca eşleşen kurala göre.
  if (!match) return true // /dashboard dışı (ör. kök) — layout zaten korur
  return match.roles.includes(role)
}

/** Rolün varsayılan açılış sayfası (yetkisiz erişimde yönlendirme için) */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/dashboard/admin'
    case 'bashakem':
      return '/dashboard/bashakem'
    case 'hakem':
      return '/dashboard/hakem/scoring'
    case 'masa_hakemi':
      return '/dashboard/masa-hakemi/scoring'
    default:
      return '/dashboard'
  }
}
