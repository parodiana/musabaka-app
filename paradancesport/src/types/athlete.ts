export interface Athlete {
  id: string
  givenName: string
  familyName: string
  dob: Date
  gender: 'M' | 'F'
  memberOrg?: string
  region?: string
  externalIds?: {
    wasms?: string
  }
  classifications?: string[] // ['SD1', 'L&F1', ...] (eligibility — UI'da gösterilmez)
  categories?: string[] // Excel'den gelen kategori adları ['Men's Single Freestyle Class 1', ...]
  createdAt: Date
  updatedAt: Date
}

export interface Judge {
  id: string
  givenName: string
  familyName: string
  externalId?: string
  userId?: string
  createdAt: Date
}

export type EntryFormat = 'Single' | 'Duo' | 'Combi'
export type EntryStatus = 'ACTIVE' | 'WITHDRAWN' | 'DSQ'

export interface Entry {
  id: string
  competitionId: string
  eventId: string
  athleteId?: string // Single
  athlete1Id?: string // Duo/Combi
  athlete2Id?: string // Duo/Combi
  bibNumber: number
  entryClass: string
  status: EntryStatus
  createdAt: Date
}
