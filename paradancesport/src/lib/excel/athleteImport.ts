import type { Athlete } from '@/types'
import type { AthleteInput } from '@/lib/firebase/athletes'

/** İçe aktarımda hedef sporcu alanları */
export type AthleteField =
  | 'givenName'
  | 'familyName'
  | 'dob'
  | 'gender'
  | 'memberOrg'
  | 'region'
  | 'wasms'
  | 'classifications'

export interface FieldDef {
  key: AthleteField
  label: string
  required: boolean
  /** Otomatik eşleştirme için başlık ipuçları (küçük harf) */
  hints: string[]
}

export const ATHLETE_FIELDS: FieldDef[] = [
  { key: 'givenName', label: 'Ad', required: true, hints: ['given name', 'given', 'first name', 'firstname', 'first', 'adı', 'ad', 'isim'] },
  { key: 'familyName', label: 'Soyad', required: true, hints: ['family name', 'family', 'last name', 'surname', 'lastname', 'soyadı', 'soyad', 'soyisim'] },
  { key: 'dob', label: 'Doğum Tarihi', required: true, hints: ['date of birth', 'doğum tarihi', 'birthdate', 'doğum', 'dogum', 'dob', 'birth'] },
  { key: 'gender', label: 'Cinsiyet', required: true, hints: ['gender', 'cinsiyet', 'sex', 'cins'] },
  { key: 'memberOrg', label: 'Kulüp', required: false, hints: ['member organisation', 'member organization', 'organisation', 'organization', 'kulüp', 'kulup', 'club', 'takım', 'takim'] },
  { key: 'region', label: 'Bölge', required: false, hints: ['region', 'bölge', 'bolge', 'şehir', 'sehir', 'city'] },
  { key: 'wasms', label: 'WASMS / Lisans', required: false, hints: ['wasms id', 'wasms', 'lisans', 'license', 'licence', 'kimlik'] },
  { key: 'classifications', label: 'Sınıflandırma', required: false, hints: ["athlete's classification", 'classification', 'sınıflandırma', 'sınıf', 'sinif', 'class'] },
]

export type ColumnMapping = Partial<Record<AthleteField, string>>

/** Bir başlığın bir alana uyum skoru (yüksek = daha iyi). 0 = eşleşme yok. */
function scoreHeader(header: string, hints: string[]): number {
  const lower = header.toLowerCase().trim()
  let best = 0
  for (const hint of hints) {
    if (lower === hint) {
      best = Math.max(best, 1000)
    } else if (lower.startsWith(hint) || lower.endsWith(hint)) {
      best = Math.max(best, 500 + hint.length)
    } else if (hint.length >= 3 && lower.includes(hint)) {
      // Uzun ipucu daha spesifik → daha yüksek skor
      best = Math.max(best, 100 + hint.length)
    }
  }
  return best
}

/**
 * Başlıklara göre otomatik kolon eşleştirme önerisi üret (puanlama tabanlı).
 * Varsayılan athlete alanları; tam import için fields parametresi geçilir.
 */
export function autoMap(headers: string[], fields: FieldDef[] = ATHLETE_FIELDS): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedHeaders = new Set<string>()

  for (const field of fields) {
    let bestHeader: string | undefined
    let bestScore = 0
    for (const h of headers) {
      if (usedHeaders.has(h)) continue
      const score = scoreHeader(h, field.hints)
      if (score > bestScore) {
        bestScore = score
        bestHeader = h
      }
    }
    if (bestHeader) {
      mapping[field.key] = bestHeader
      usedHeaders.add(bestHeader)
    }
  }

  return mapping
}

/** Cinsiyeti normalize et: M | F | null */
export function normalizeGender(value: string): 'M' | 'F' | null {
  const v = value.trim().toLowerCase()
  if (!v) return null
  if (['m', 'e', 'male', 'erkek', 'bay', 'man', '1'].includes(v)) return 'M'
  if (['f', 'k', 'w', 'female', 'kadın', 'kadin', 'bayan', 'woman', '2'].includes(v)) return 'F'
  // İlk harf
  if (v.startsWith('e') || v.startsWith('m')) return 'M'
  if (v.startsWith('k') || v.startsWith('f') || v.startsWith('w')) return 'F'
  return null
}

/** Esnek tarih ayrıştırma: ISO, DD.MM.YYYY, DD/MM/YYYY, Excel seri no */
export function parseDate(value: string): Date | null {
  const v = value.trim()
  if (!v) return null

  // ISO: YYYY-MM-DD
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return isValidDate(d) ? d : null
  }

  // DD.MM.YYYY veya DD/MM/YYYY
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    return isValidDate(d) ? d : null
  }

  // Excel seri numarası (gün sayısı, 1900 epoch)
  if (/^\d+(\.\d+)?$/.test(v)) {
    const serial = Number(v)
    if (serial > 0 && serial < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      return isValidDate(d) ? d : null
    }
  }

  // Son çare: Date.parse
  const fallback = new Date(v)
  return isValidDate(fallback) ? fallback : null
}

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100
}

export interface MappedRow {
  rowIndex: number
  input?: AthleteInput
  errors: string[]
  /** Mevcut sporcuyla eşleşme (dedup) */
  duplicateOf?: Athlete
}

/**
 * Tek satırı eşlemeye göre AthleteInput'a çevir + doğrula.
 */
export function mapRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  rowIndex: number
): MappedRow {
  const errors: string[] = []
  const get = (field: AthleteField) => {
    const header = mapping[field]
    return header ? (row[header] ?? '').trim() : ''
  }

  const givenName = get('givenName')
  const familyName = get('familyName')
  const dobRaw = get('dob')
  const genderRaw = get('gender')

  if (!givenName) errors.push('Ad boş')
  if (!familyName) errors.push('Soyad boş')

  const dob = parseDate(dobRaw)
  if (!dob) errors.push(`Doğum tarihi geçersiz: "${dobRaw}"`)

  const gender = normalizeGender(genderRaw)
  if (!gender) errors.push(`Cinsiyet tanınmadı: "${genderRaw}"`)

  if (errors.length > 0) {
    return { rowIndex, errors }
  }

  const classificationsRaw = get('classifications')
  const classifications = classificationsRaw
    ? classificationsRaw
        .split(/[,;|]/)
        .map((c) => c.trim())
        .filter(Boolean)
    : []

  const input: AthleteInput = {
    givenName,
    familyName,
    dob: dob!,
    gender: gender!,
    memberOrg: get('memberOrg') || undefined,
    region: get('region') || undefined,
    wasms: get('wasms') || undefined,
    classifications,
  }

  return { rowIndex, input, errors: [] }
}

/**
 * Dedup: önce WASMS ID, sonra ad+soyad+doğum tarihi.
 */
export function findDuplicate(input: AthleteInput, existing: Athlete[]): Athlete | undefined {
  // 1) WASMS ID
  if (input.wasms) {
    const byWasms = existing.find((a) => a.externalIds?.wasms && a.externalIds.wasms === input.wasms)
    if (byWasms) return byWasms
  }

  // 2) Ad + Soyad + Doğum tarihi
  const key = (g: string, f: string, d: Date) =>
    `${g.toLowerCase()}|${f.toLowerCase()}|${d.toISOString().slice(0, 10)}`
  const target = key(input.givenName, input.familyName, input.dob)
  return existing.find((a) => key(a.givenName, a.familyName, a.dob) === target)
}
