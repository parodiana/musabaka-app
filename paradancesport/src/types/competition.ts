export type CompetitionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED'
export type EntryMode = 'AUTO' | 'TABLE'
export type AggregationMode = 'TRIMMED' | 'MEAN'
export type EventStatus = 'PENDING' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'APPROVED'
export type Discipline = 'Standard' | 'Latin' | 'Freestyle'
export type Class = 'Class1' | 'Class2' | 'Powerchair' | 'VI'
export type Gender = 'M' | 'F' | 'Mixed'

export interface Competition {
  id: string
  name: string
  code: string
  date: Date
  venue: string
  defaultEntryMode: EntryMode
  aggregationMode: AggregationMode
  status: CompetitionStatus
  createdBy: string
  createdAt: Date
}

export interface Event {
  id: string
  competitionId: string
  eventCode: string
  eventName: string
  discipline: Discipline
  gender: Gender
  class: Class
  format: 'Single' | 'Duo' | 'Combi'
  entryMode: EntryMode
  dances: string[] // ['Rumba', 'Waltz', ...]
  judgeCount: number
  status: EventStatus
  /** OTOMATİK modda o an sahada olan (hakemlere gönderilen) kayıt; hakem yalnızca bunu görür */
  activeEntryId?: string
}

export interface JudgeAssignment {
  id: string
  competitionId: string
  eventId: string
  judgeId: string
  components: ('TS' | 'MCP' | 'DL')[]
  judgeLabel: string // 'A', 'B', 'C', ...
}
