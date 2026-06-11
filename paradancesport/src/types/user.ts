export type UserRole = 'admin' | 'bashakem' | 'hakem' | 'masa_hakemi'

/** Hesap durumu: aktif = giriş yapabilir, suspended = askıda (giriş engellenir) */
export type UserStatus = 'active' | 'suspended'

export interface User {
  uid: string
  email: string
  role: UserRole
  displayName: string
  judgeId?: string
  status?: UserStatus // tanımsız = 'active' (geriye dönük uyumluluk)
  language: 'tr' | 'en'
  createdAt: Date
  createdBy?: string
}

export interface UserCredentials {
  email: string
  password: string
}

export interface CreateUserRequest {
  email: string
  displayName: string
  role: UserRole
  judgeId?: string
}
