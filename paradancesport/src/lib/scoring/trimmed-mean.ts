/**
 * Trimmed mean calculation: remove min + max, average the rest
 * If n < 4, use simple average
 */

export function calculateTrimmedMean(values: number[]): number {
  if (values.length === 0) return 0
  if (values.length < 4) {
    // Simple average for small panels
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  const sorted = [...values].sort((a, b) => a - b)
  const trimmed = sorted.slice(1, -1) // Remove first (min) and last (max)

  const sum = trimmed.reduce((acc, val) => acc + val, 0)
  return sum / trimmed.length
}

/** Düz (aritmetik) ortalama */
export function plainMean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/** Toplama moduna göre değer üret: TRIMMED veya MEAN */
export function aggregate(values: number[], mode: 'TRIMMED' | 'MEAN'): number {
  return mode === 'MEAN' ? plainMean(values) : calculateTrimmedMean(values)
}

export function calculateTrimmedMeanWithDetails(
  values: number[]
): { value: number; count: number; removed: { min: number; max: number } } {
  if (values.length === 0) return { value: 0, count: 0, removed: { min: 0, max: 0 } }

  const sorted = [...values].sort((a, b) => a - b)

  if (values.length < 4) {
    const sum = sorted.reduce((acc, val) => acc + val, 0)
    return {
      value: sum / sorted.length,
      count: sorted.length,
      removed: { min: 0, max: 0 },
    }
  }

  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const trimmed = sorted.slice(1, -1)
  const sum = trimmed.reduce((acc, val) => acc + val, 0)

  return {
    value: sum / trimmed.length,
    count: trimmed.length,
    removed: { min, max },
  }
}
