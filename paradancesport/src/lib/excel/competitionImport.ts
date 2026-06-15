import type { Athlete, Discipline, Gender, Class } from '@/types'
import { createAthlete, type AthleteInput } from '@/lib/firebase/athletes'
import { createEvent, DANCE_PRESETS, type EventInput } from '@/lib/firebase/events'
import { createCompetition } from '@/lib/firebase/competitions'
import { createEntry } from '@/lib/firebase/entries'
import {
  ATHLETE_FIELDS,
  mapRow,
  findDuplicate,
  type AthleteField,
  type ColumnMapping,
  type FieldDef,
} from './athleteImport'

/** Yarışma metadata bloğundan çıkarılan bilgiler */
export interface CompetitionMeta {
  code: string
  name: string
  sport?: string
  date?: Date
  venue?: string
}

/** Metadata satırlarından (key-value) yarışma bilgisini çıkar */
export function extractCompetitionMeta(metaRows: string[][]): CompetitionMeta {
  let code = ''
  let name = ''
  let sport = ''
  for (const row of metaRows) {
    const key = (row[0] ?? '').toLowerCase().trim()
    const value = (row[1] ?? '').trim()
    if (!value) continue
    if (key === 'code') code = value
    else if (key === 'competition') name = value
    else if (key === 'sport') sport = value
  }
  return { code, name, sport: sport || undefined }
}

// Athlete alanlarına ek olarak entry/event alanları
export type ImportField = AthleteField | 'eventCode' | 'eventName' | 'eligibleClasses' | 'entryClass'

export const EVENT_ENTRY_FIELDS: FieldDef[] = [
  { key: 'eventCode' as AthleteField, label: 'Kategori Kodu', required: false, hints: ['event code', 'eventcode', 'kategori kodu'] },
  { key: 'eventName' as AthleteField, label: 'Kategori Adı', required: true, hints: ['event name', 'eventname', 'kategori adı', 'kategori'] },
  { key: 'eligibleClasses' as AthleteField, label: 'Uygun Sınıflar', required: false, hints: ['eligible classes', 'eligible', 'uygun sınıf'] },
  { key: 'entryClass' as AthleteField, label: 'Kayıt Sınıfı', required: false, hints: ['entry class', 'entryclass', 'kayıt sınıfı'] },
]

/** Athlete + event/entry alanlarının tümü (tam import mapping için) */
export const FULL_IMPORT_FIELDS: FieldDef[] = [...ATHLETE_FIELDS, ...EVENT_ENTRY_FIELDS]

export interface DerivedEvent extends EventInput {
  eligibleClasses?: string
}

/** Kategori adı + kodundan disiplin/cinsiyet/sınıf/format türet */
export function deriveEvent(
  competitionId: string,
  eventCode: string,
  eventName: string,
  eligibleClasses: string
): DerivedEvent {
  const n = eventName.toLowerCase()

  // Format
  let format: 'Single' | 'Duo' | 'Combi' = 'Single'
  if (n.includes('combi')) format = 'Combi'
  else if (n.includes('duo')) format = 'Duo'
  else if (n.includes('single')) format = 'Single'

  // Cinsiyet — "women" önce kontrol (içinde "men" geçer)
  let gender: Gender = 'Mixed'
  if (n.includes('women') || n.includes("women's") || n.includes('ladies') || n.includes('kadın')) {
    gender = 'F'
  } else if (n.includes('men') || n.includes("men's") || n.includes('erkek')) {
    gender = 'M'
  } else if (format === 'Combi' || n.includes('mixed')) {
    gender = 'Mixed'
  }

  // Disiplin
  let discipline: Discipline = 'Freestyle'
  if (n.includes('freestyle')) discipline = 'Freestyle'
  else if (n.includes('latin')) discipline = 'Latin'
  else if (n.includes('standard') || n.includes('ballroom')) discipline = 'Standard'

  // Sınıf
  let klass: Class = 'Class1'
  const ec = eligibleClasses.toLowerCase()
  if (n.includes('powerchair') || ec.includes('powerchair')) klass = 'Powerchair'
  else if (n.includes('vi') || ec.includes('vi')) klass = 'VI'
  else if (n.includes('class 2') || n.includes('class2') || ec.includes('2')) klass = 'Class2'
  else if (n.includes('class 1') || n.includes('class1') || ec.includes('1')) klass = 'Class1'

  return {
    competitionId,
    eventCode,
    eventName,
    discipline,
    gender,
    class: klass,
    format,
    entryMode: 'AUTO',
    dances: DANCE_PRESETS[discipline],
    judgeCount: 5,
    status: 'PENDING',
    eligibleClasses: eligibleClasses || undefined,
  }
}

export interface PlanAthlete {
  key: string
  input: AthleteInput
  existingId?: string // mevcut sporcuyla eşleşti
  bib: number
}

export interface PlanEntry {
  rowIndex: number
  athleteKey: string
  eventCode: string
  entryClass: string
}

export interface ImportPlan {
  meta: CompetitionMeta
  events: DerivedEvent[]
  athletes: PlanAthlete[]
  entries: PlanEntry[]
  errors: { rowIndex: number; errors: string[] }[]
}

function dedupKey(input: AthleteInput): string {
  if (input.wasms) return 'w:' + input.wasms
  return 'n:' + input.givenName.toLowerCase() + '|' + input.familyName.toLowerCase() + '|' + input.dob.toISOString().slice(0, 10)
}

/**
 * Excel satırlarından tam import planı oluştur.
 */
export function buildImportPlan(
  meta: CompetitionMeta,
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existingAthletes: Athlete[]
): ImportPlan {
  const eventsByCode = new Map<string, DerivedEvent>()
  const athletesByKey = new Map<string, PlanAthlete>()
  const categoriesByKey = new Map<string, Set<string>>()
  const entries: PlanEntry[] = []
  const errors: { rowIndex: number; errors: string[] }[] = []

  let nextBib = 1

  const getCol = (row: Record<string, string>, field: ImportField): string => {
    const header = (mapping as Record<string, string | undefined>)[field]
    return header ? (row[header] ?? '').trim() : ''
  }

  rows.forEach((row, idx) => {
    // Athlete kısmı (mevcut mapRow ile validasyon)
    const mapped = mapRow(row, mapping, idx)
    if (mapped.errors.length > 0 || !mapped.input) {
      errors.push({ rowIndex: idx, errors: mapped.errors })
      return
    }
    const input = mapped.input

    // Event kısmı — Kategori Adı zorunlu; Kategori Kodu opsiyonel (yoksa ad anahtar olur)
    const eventCode = getCol(row, 'eventCode')
    const eventName = getCol(row, 'eventName')
    if (!eventName) {
      errors.push({ rowIndex: idx, errors: ['Kategori adı boş'] })
      return
    }
    const eventKey = eventCode || eventName
    if (!eventsByCode.has(eventKey)) {
      eventsByCode.set(
        eventKey,
        deriveEvent('', eventCode, eventName, getCol(row, 'eligibleClasses'))
      )
    }

    // Athlete dedup
    const key = dedupKey(input)
    if (!athletesByKey.has(key)) {
      const existing = findDuplicate(input, existingAthletes)
      athletesByKey.set(key, {
        key,
        input,
        existingId: existing?.id,
        bib: nextBib++,
      })
    }
    // Sporcunun kategorilerini (event adları) topla
    if (!categoriesByKey.has(key)) categoriesByKey.set(key, new Set())
    categoriesByKey.get(key)!.add(eventName)

    // Entry (eventKey = kod varsa kod, yoksa ad)
    entries.push({
      rowIndex: idx,
      athleteKey: key,
      eventCode: eventKey,
      entryClass: getCol(row, 'entryClass') || input.classifications[0] || '',
    })
  })

  // Toplanan kategorileri sporcu input'larına yaz
  for (const a of athletesByKey.values()) {
    a.input.categories = Array.from(categoriesByKey.get(a.key) ?? [])
  }

  return {
    meta,
    events: Array.from(eventsByCode.values()),
    athletes: Array.from(athletesByKey.values()),
    entries,
    errors,
  }
}

export interface ImportResult {
  competitionId: string
  eventsCreated: number
  athletesCreated: number
  athletesReused: number
  entriesCreated: number
}

/**
 * Planı Firestore'a yazar: Yarışma → Kategoriler → Sporcular → Kayıtlar.
 */
export async function runCompetitionImport(
  plan: ImportPlan,
  createdByUid: string
): Promise<ImportResult> {
  // 1) Yarışma
  const competitionId = await createCompetition(
    {
      name: plan.meta.name || 'İsimsiz Yarışma',
      code: plan.meta.code || 'IMPORT',
      date: plan.meta.date ?? new Date(),
      venue: plan.meta.venue ?? '',
      defaultEntryMode: 'AUTO',
      aggregationMode: 'TRIMMED',
      status: 'DRAFT',
    },
    createdByUid
  )

  // 2) Kategoriler
  const eventIdByCode = new Map<string, string>()
  for (const ev of plan.events) {
    const { eligibleClasses: _eligible, ...eventInput } = ev
    void _eligible
    const id = await createEvent({ ...eventInput, competitionId })
    // PlanEntry.eventCode ile aynı anahtar: kod varsa kod, yoksa ad
    eventIdByCode.set(ev.eventCode || ev.eventName, id)
  }

  // 3) Sporcular (yeni olanlar oluşturulur, mevcutlar yeniden kullanılır)
  const athleteIdByKey = new Map<string, string>()
  let athletesCreated = 0
  let athletesReused = 0
  for (const a of plan.athletes) {
    if (a.existingId) {
      athleteIdByKey.set(a.key, a.existingId)
      athletesReused++
    } else {
      const id = await createAthlete(a.input)
      athleteIdByKey.set(a.key, id)
      athletesCreated++
    }
  }

  // 4) Kayıtlar (sırt no = sporcunun bib'i)
  const bibByKey = new Map(plan.athletes.map((a) => [a.key, a.bib]))
  let entriesCreated = 0
  for (const en of plan.entries) {
    const athleteId = athleteIdByKey.get(en.athleteKey)
    const eventId = eventIdByCode.get(en.eventCode)
    if (!athleteId || !eventId) continue
    await createEntry({
      competitionId,
      eventId,
      athleteId,
      bibNumber: bibByKey.get(en.athleteKey) ?? 0,
      entryClass: en.entryClass,
      status: 'ACTIVE',
    })
    entriesCreated++
  }

  return {
    competitionId,
    eventsCreated: plan.events.length,
    athletesCreated,
    athletesReused,
    entriesCreated,
  }
}
