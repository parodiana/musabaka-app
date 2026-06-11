import type { ScoringComponent } from '@/types'

/**
 * Para Dance Sport – puanlama skala doğrulayıcıları
 * - TS/MCP: 1.0–9.9 (adım 0.1)
 * - DL: 1.00–1.50 (adım 0.05)
 */

export interface ScaleSpec {
  min: number
  max: number
  step: number
  decimals: number
}

export const TS_SCALE: ScaleSpec = { min: 1.0, max: 9.9, step: 0.1, decimals: 1 }
export const MCP_SCALE: ScaleSpec = { min: 1.0, max: 9.9, step: 0.1, decimals: 1 }
export const DL_SCALE: ScaleSpec = { min: 1.0, max: 1.5, step: 0.05, decimals: 2 }

export function scaleFor(component: ScoringComponent): ScaleSpec {
  switch (component) {
    case 'TS':
      return TS_SCALE
    case 'MCP':
      return MCP_SCALE
    case 'DL':
      return DL_SCALE
  }
}

const EPSILON = 1e-9

/** Değer ölçek aralığında VE adıma oturuyor mu? */
export function isValidScore(value: number, component: ScoringComponent): boolean {
  const { min, max, step } = scaleFor(component)
  if (Number.isNaN(value)) return false
  if (value < min - EPSILON || value > max + EPSILON) return false
  const steps = (value - min) / step
  return Math.abs(steps - Math.round(steps)) < 1e-6
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/** Türkçe hata mesajıyla doğrulama */
export function validateScore(value: number, component: ScoringComponent): ValidationResult {
  const { min, max, step, decimals } = scaleFor(component)
  if (Number.isNaN(value)) {
    return { valid: false, error: 'Geçersiz sayı' }
  }
  if (value < min - EPSILON || value > max + EPSILON) {
    return {
      valid: false,
      error: `${component} değeri ${min.toFixed(decimals)}–${max.toFixed(decimals)} aralığında olmalı`,
    }
  }
  const steps = (value - min) / step
  if (Math.abs(steps - Math.round(steps)) >= 1e-6) {
    return { valid: false, error: `${component} değeri ${step} adımlarla girilmeli` }
  }
  return { valid: true }
}

/** Değeri en yakın geçerli adıma yuvarla (giriş yardımcısı) */
export function roundToStep(value: number, component: ScoringComponent): number {
  const { min, step, decimals } = scaleFor(component)
  const steps = Math.round((value - min) / step)
  return Number((min + steps * step).toFixed(decimals))
}

/** Bir ölçek için geçerli tüm değerleri üret (dropdown/stepper için) */
export function enumerateScale(component: ScoringComponent): number[] {
  const { min, max, step, decimals } = scaleFor(component)
  const values: number[] = []
  for (let v = min; v <= max + EPSILON; v += step) {
    values.push(Number(v.toFixed(decimals)))
  }
  return values
}
