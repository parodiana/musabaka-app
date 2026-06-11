import type { Score, Deduction, ScoringComponent } from '@/types'
import {
  computeEntryResult,
  type DanceMarks,
  type AggregationMode,
  type DanceResult,
} from './engine'
import { rankEntries } from './tie-break'

export interface EntryComputation {
  entryId: string
  danceResults: DanceResult[]
  finalScore: number
  tieBreakScore: number
  rank: number
  tied: boolean
}

const DANCE_KEY = (dance?: string) => dance ?? '__single__'

/**
 * Bir kategorinin (event) ham skor ve kesintilerini alıp
 * kayıt (entry) başına sonuç hesaplar ve sıralar.
 *
 * Gruplama: entryId → dance → component → değerler[]
 */
export function aggregateEventScores(
  scores: Score[],
  deductions: Deduction[],
  mode: AggregationMode
): EntryComputation[] {
  // entryId -> danceKey -> component -> values
  const byEntry = new Map<string, Map<string, Record<ScoringComponent, number[]>>>()
  // entryId -> danceKey -> toplam kesinti
  const dedByEntry = new Map<string, Map<string, number>>()
  // danceKey -> gerçek dans adı (gösterim için)
  const danceLabel = new Map<string, string | undefined>()

  for (const s of scores) {
    if (s.isValid === false) continue
    const dk = DANCE_KEY(s.dance)
    danceLabel.set(dk, s.dance)

    if (!byEntry.has(s.entryId)) byEntry.set(s.entryId, new Map())
    const danceMap = byEntry.get(s.entryId)!
    if (!danceMap.has(dk)) danceMap.set(dk, { TS: [], MCP: [], DL: [] })
    danceMap.get(dk)![s.component].push(s.value)
  }

  for (const d of deductions) {
    const dk = DANCE_KEY(d.dance)
    if (!dedByEntry.has(d.entryId)) dedByEntry.set(d.entryId, new Map())
    const m = dedByEntry.get(d.entryId)!
    m.set(dk, (m.get(dk) ?? 0) + d.amount)
  }

  // Her entry için DanceMarks listesi oluştur ve hesapla
  const computations: Omit<EntryComputation, 'rank' | 'tied'>[] = []

  for (const [entryId, danceMap] of byEntry) {
    const dances: DanceMarks[] = []
    for (const [dk, comps] of danceMap) {
      dances.push({
        dance: danceLabel.get(dk),
        TS: comps.TS,
        MCP: comps.MCP,
        DL: comps.DL,
        deductions: dedByEntry.get(entryId)?.get(dk) ?? 0,
      })
    }
    const result = computeEntryResult(dances, mode)
    computations.push({
      entryId,
      danceResults: result.danceResults,
      finalScore: result.finalScore,
      tieBreakScore: result.tieBreakScore,
    })
  }

  // Sırala
  const ranked = rankEntries(
    computations.map((c) => ({
      entryId: c.entryId,
      finalScore: c.finalScore,
      tieBreakScore: c.tieBreakScore,
    }))
  )
  const rankMap = new Map(ranked.map((r) => [r.entryId, r]))

  return computations
    .map((c) => {
      const r = rankMap.get(c.entryId)!
      return { ...c, rank: r.rank, tied: r.tied }
    })
    .sort((a, b) => a.rank - b.rank)
}
