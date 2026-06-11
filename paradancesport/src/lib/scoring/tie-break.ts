/**
 * Sıralama ve eşitlik bozma (tie-break)
 * - Önce finalScore (yüksek = iyi)
 * - Eşitlikte tieBreakScore (tüm notlar kabul yöntemi)
 * - Hâlâ eşitse paylaşılan sıra (aynı rank)
 */

export interface RankableEntry {
  entryId: string
  finalScore: number
  tieBreakScore: number
}

export interface RankedEntry extends RankableEntry {
  rank: number
  /** Bu sıra başka kayıtla paylaşılıyor mu? */
  tied: boolean
}

const EPS = 1e-9

function eq(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS
}

/**
 * Kayıtları sırala ve rank ata.
 * finalScore eşitse tieBreakScore ile çözülür; ikisi de eşitse aynı rank paylaşılır.
 * Sıralama "standard competition ranking" (1,2,2,4) mantığındadır.
 */
export function rankEntries(entries: RankableEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (!eq(a.finalScore, b.finalScore)) return b.finalScore - a.finalScore
    if (!eq(a.tieBreakScore, b.tieBreakScore)) return b.tieBreakScore - a.tieBreakScore
    return 0
  })

  const result: RankedEntry[] = []
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]
    let rank: number
    const prev = i > 0 ? sorted[i - 1] : null
    // Bir önceki ile tamamen eşitse (final + tiebreak) aynı rank
    if (prev && eq(prev.finalScore, e.finalScore) && eq(prev.tieBreakScore, e.tieBreakScore)) {
      rank = result[i - 1].rank
    } else {
      rank = i + 1
    }
    result.push({ ...e, rank, tied: false })
  }

  // Paylaşılan sıraları işaretle
  const rankCounts = new Map<number, number>()
  for (const r of result) {
    rankCounts.set(r.rank, (rankCounts.get(r.rank) ?? 0) + 1)
  }
  for (const r of result) {
    r.tied = (rankCounts.get(r.rank) ?? 0) > 1
  }

  return result
}
