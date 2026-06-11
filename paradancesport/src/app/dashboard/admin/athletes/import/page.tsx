'use client'

import { useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapAthlete, createAthletesBatch } from '@/lib/firebase/athletes'
import { parseSpreadsheet, type ParsedSheet } from '@/lib/excel/parser'
import {
  ATHLETE_FIELDS,
  autoMap,
  mapRow,
  findDuplicate,
  type ColumnMapping,
  type AthleteField,
  type MappedRow,
} from '@/lib/excel/athleteImport'
import { useAuthStore } from '@/store/auth.store'
import type { Athlete } from '@/types'
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

type Step = 'upload' | 'map' | 'preview' | 'done'

export default function AthleteImportPage() {
  const { user } = useAuthStore()
  const [step, setStep] = useState<Step>('upload')
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erişim Engellendi</h2>
          <p className="text-gray-600 mt-2">Bu sayfaya yalnızca yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const result = await parseSpreadsheet(file)
      setParsed(result)
      setMapping(autoMap(result.headers))
      setStep('map')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dosya okunamadı')
    } finally {
      setBusy(false)
      e.target.value = '' // aynı dosya tekrar seçilebilsin
    }
  }

  const setFieldMapping = (field: AthleteField, header: string) => {
    setMapping((prev) => ({ ...prev, [field]: header || undefined }))
  }

  const requiredMissing = ATHLETE_FIELDS.filter(
    (f) => f.required && !mapping[f.key]
  )

  const handlePreview = async () => {
    if (!parsed) return
    setBusy(true)
    setError(null)
    try {
      // Mevcut sporcuları çek (dedup için)
      const snap = await getDocs(collection(db, 'athletes'))
      const existing: Athlete[] = snap.docs.map((d) => mapAthlete(d.id, d.data()))

      // Satırları eşle + dedup (dosya içi tekrarları da yakala)
      const accepted: Athlete[] = [...existing]
      const rows: MappedRow[] = parsed.rows.map((row, idx) => {
        const mapped = mapRow(row, mapping, idx)
        if (mapped.input) {
          const dup = findDuplicate(mapped.input, accepted)
          if (dup) {
            mapped.duplicateOf = dup
          } else {
            // Dosya içi sonraki satırların da bunu duplicate görmesi için ekle
            accepted.push({
              id: `pending-${idx}`,
              givenName: mapped.input.givenName,
              familyName: mapped.input.familyName,
              dob: mapped.input.dob,
              gender: mapped.input.gender,
              externalIds: mapped.input.wasms ? { wasms: mapped.input.wasms } : undefined,
              classifications: mapped.input.classifications,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }
        }
        return mapped
      })
      setMappedRows(rows)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Önizleme oluşturulamadı')
    } finally {
      setBusy(false)
    }
  }

  const newRows = mappedRows.filter((r) => r.input && !r.duplicateOf)
  const dupRows = mappedRows.filter((r) => r.input && r.duplicateOf)
  const errorRows = mappedRows.filter((r) => r.errors.length > 0)

  const handleImport = async () => {
    setBusy(true)
    setError(null)
    try {
      const inputs = newRows.map((r) => r.input!)
      const count = await createAthletesBatch(inputs)
      setImportedCount(count)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İçe aktarma başarısız')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStep('upload')
    setParsed(null)
    setMapping({})
    setMappedRows([])
    setImportedCount(0)
    setError(null)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/admin/athletes"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Sporculara dön
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Excel ile Sporcu İçe Aktar</h1>
        <p className="text-gray-600 mt-1">
          Excel/CSV dosyasından toplu sporcu ekle. Tekrarlar otomatik atlanır.
        </p>
      </div>

      {/* Adım göstergesi */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => {
          const labels = ['Yükle', 'Eşleştir', 'Önizleme', 'Bitti']
          const active = step === s
          const done = (['upload', 'map', 'preview', 'done'] as Step[]).indexOf(step) > i
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  active
                    ? 'bg-blue-600 text-white'
                    : done
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i + 1}
              </span>
              <span className={active ? 'font-medium text-gray-900' : 'text-gray-500'}>
                {labels[i]}
              </span>
              {i < 3 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* ADIM 1: Yükle */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-12 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
            <Upload className="w-10 h-10 text-gray-400" />
            <span className="text-gray-700 font-medium">
              {busy ? 'Okunuyor...' : 'Excel veya CSV dosyası seç'}
            </span>
            <span className="text-xs text-gray-500">.xlsx, .xls, .csv desteklenir</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              disabled={busy}
              className="hidden"
            />
          </label>
          <div className="mt-4 text-xs text-gray-500">
            İlk satır başlık olmalı. Beklenen kolonlar: Ad, Soyad, Doğum Tarihi, Cinsiyet
            (zorunlu); Kulüp, Bölge, WASMS, Sınıflandırma (opsiyonel).
          </div>
        </div>
      )}

      {/* ADIM 2: Eşleştir */}
      {step === 'map' && parsed && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            {parsed.rows.length} satır, {parsed.headers.length} kolon bulundu
          </div>

          <div className="space-y-3">
            {ATHLETE_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                <label className="text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={mapping[field.key] ?? ''}
                  onChange={(e) => setFieldMapping(field.key, e.target.value)}
                  className="input"
                >
                  <option value="">— Eşleştirme yok —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {requiredMissing.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
              Zorunlu alanlar eşleştirilmeli: {requiredMissing.map((f) => f.label).join(', ')}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={busy || requiredMissing.length > 0}
              className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Hazırlanıyor...' : 'Önizlemeye Geç'}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Baştan
            </button>
          </div>
        </div>
      )}

      {/* ADIM 3: Önizleme */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Özet */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{newRows.length}</div>
              <div className="text-xs text-gray-500 mt-1">Yeni (eklenecek)</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{dupRows.length}</div>
              <div className="text-xs text-gray-500 mt-1">Tekrar (atlanacak)</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{errorRows.length}</div>
              <div className="text-xs text-gray-500 mt-1">Hatalı (atlanacak)</div>
            </div>
          </div>

          {/* Tablo */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Durum</th>
                    <th className="px-4 py-2 font-medium">Ad Soyad</th>
                    <th className="px-4 py-2 font-medium">Doğum / Cins.</th>
                    <th className="px-4 py-2 font-medium">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.map((r) => {
                    const isError = r.errors.length > 0
                    const isDup = !!r.duplicateOf
                    return (
                      <tr key={r.rowIndex} className="border-b border-gray-100">
                        <td className="px-4 py-2 text-gray-400">{r.rowIndex + 2}</td>
                        <td className="px-4 py-2">
                          {isError ? (
                            <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> Hatalı
                            </span>
                          ) : isDup ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                              <RefreshCw className="w-3.5 h-3.5" /> Tekrar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Yeni
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-900">
                          {r.input
                            ? `${r.input.givenName} ${r.input.familyName}`
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {r.input
                            ? `${r.input.dob.toLocaleDateString('tr-TR')} · ${r.input.gender === 'M' ? 'E' : 'K'}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {isError
                            ? r.errors.join('; ')
                            : isDup
                              ? `Zaten kayıtlı: ${r.duplicateOf!.givenName} ${r.duplicateOf!.familyName}`
                              : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={busy || newRows.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'İçe aktarılıyor...' : `${newRows.length} Sporcuyu İçe Aktar`}
            </button>
            <button
              onClick={() => setStep('map')}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Geri (Eşleştirme)
            </button>
          </div>
        </div>
      )}

      {/* ADIM 4: Bitti */}
      {step === 'done' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">İçe Aktarma Tamamlandı</h2>
          <p className="text-gray-600 mt-2">
            <strong>{importedCount}</strong> yeni sporcu eklendi.
            {dupRows.length > 0 && ` ${dupRows.length} tekrar atlandı.`}
            {errorRows.length > 0 && ` ${errorRows.length} hatalı satır atlandı.`}
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <Link
              href="/dashboard/admin/athletes"
              className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Sporcuları Gör
            </Link>
            <button
              onClick={reset}
              className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Yeni İçe Aktarma
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
