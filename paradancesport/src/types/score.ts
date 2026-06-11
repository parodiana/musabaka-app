export type ScoringComponent = 'TS' | 'MCP' | 'DL'
export type ScoreMode = 'AUTO' | 'TABLE'
export type ResultStatus = 'CALCULATED' | 'APPROVED' | 'RETURNED'
export type DeductionType = 'FALL' | 'FLOOR_DANCE' | 'ACCESSORY' | 'TIME_LIMIT' | 'DRESS_CODE' | 'EXCESS_LIFT' | 'DSQ'

export interface Score {
  id: string
  competitionId: string
  eventId: string
  entryId: string
  judgeId: string
  judgeAssignmentId: string
  dance?: string
  component: ScoringComponent
  value: number // Full precision, no rounding
  mode: ScoreMode
  enteredBy: string // uid
  timestamp: Date
  isValid: boolean
}

export interface Deduction {
  id: string
  competitionId: string
  eventId: string
  entryId: string
  dance?: string
  type: DeductionType
  amount: number
  reason: string
  enteredBy: string
  timestamp: Date
}

/** Bir dansın hesaplanmış sonucu (çok danslı program için kırılım) */
export interface ResultDanceBreakdown {
  dance?: string
  tsValue: number
  mcpValue: number
  dlValue: number
  deductions: number
  danceScore: number
}

export interface Result {
  id: string
  competitionId: string
  eventId: string
  entryId: string
  dance?: string
  tsValue: number
  mcpValue: number
  dlValue: number
  deductions: number
  finalScore: number
  rank?: number
  tieBreakScore?: number
  tied?: boolean
  /** Gösterim için denormalize sırt no (anonimliği bozmaz — isim değil) */
  bibNumber?: number
  /** Çok danslı programda her dansın kırılımı */
  danceResults?: ResultDanceBreakdown[]
  calculatedAt?: Date
  approvedBy?: string
  approvedAt?: Date
  status: ResultStatus
}

export interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string
  userRole: string
  details: Record<string, unknown>
  timestamp: Date
}
