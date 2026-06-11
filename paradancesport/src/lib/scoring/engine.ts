import { aggregate, plainMean } from './trimmed-mean'

/**
 * Para Dance Sport – ana puanlama motoru
 * Formül: danceScore = (TS + MCP) × DL − Deductions
 * finalScore = Σ danceScore (çok danslı program)
 */

export type AggregationMode = 'TRIMMED' | 'MEAN'

/** Bir dans için hakem notları (bileşen başına dizi) */
export interface DanceMarks {
  dance?: string
  TS: number[]
  MCP: number[]
  DL: number[]
  deductions?: number
}

export interface DanceResult {
  dance?: string
  tsValue: number
  mcpValue: number
  dlValue: number
  deductions: number
  danceScore: number
}

export interface EntryResult {
  danceResults: DanceResult[]
  finalScore: number
  /** Eşitlik bozma skoru: tüm notlar kabul (trim yok) */
  tieBreakScore: number
}

/** Bir dansın sonucu (seçili toplama moduyla) */
export function computeDanceResult(marks: DanceMarks, mode: AggregationMode): DanceResult {
  const tsValue = aggregate(marks.TS, mode)
  const mcpValue = aggregate(marks.MCP, mode)
  const dlValue = aggregate(marks.DL, mode)
  const deductions = marks.deductions ?? 0

  const raw = (tsValue + mcpValue) * dlValue - deductions
  const danceScore = Math.max(0, raw)

  return { dance: marks.dance, tsValue, mcpValue, dlValue, deductions, danceScore }
}

/** Eşitlik bozma için dans skoru: TÜM notların düz ortalaması (trim yok) */
export function computeDanceTieBreak(marks: DanceMarks): number {
  const ts = plainMean(marks.TS)
  const mcp = plainMean(marks.MCP)
  const dl = plainMean(marks.DL)
  const deductions = marks.deductions ?? 0
  return Math.max(0, (ts + mcp) * dl - deductions)
}

/** Bir kaydın (entry) tüm dansları için sonuç + final + tie-break */
export function computeEntryResult(dances: DanceMarks[], mode: AggregationMode): EntryResult {
  const danceResults = dances.map((d) => computeDanceResult(d, mode))
  const finalScore = danceResults.reduce((sum, d) => sum + d.danceScore, 0)
  const tieBreakScore = dances.reduce((sum, d) => sum + computeDanceTieBreak(d), 0)
  return { danceResults, finalScore, tieBreakScore }
}

/** Tek dans, hazır toplanmış değerlerden hızlı hesap (yardımcı) */
export function danceScoreFromValues(
  tsValue: number,
  mcpValue: number,
  dlValue: number,
  deductions = 0
): number {
  return Math.max(0, (tsValue + mcpValue) * dlValue - deductions)
}
