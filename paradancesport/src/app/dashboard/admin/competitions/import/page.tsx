'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { mapAthlete } from '@/lib/firebase/athletes'
import { parseSpreadsheet, type ParsedSheet } from '@/lib/excel/parser'
import { autoMap, type ColumnMapping, type AthleteField } from '@/lib/excel/athleteImport'
import {
  extractCompetitionMeta,
  buildImportPlan,
  runCompetitionImport,
  FULL_IMPORT_FIELDS,
  type CompetitionMeta,
  type ImportPlan,
  type ImportResult,
} from '@/lib/excel/competitionImport'
import { useAuthStore } from '@/store/auth.store'
import type { Athlete } from '@/types'
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Trophy,
  Layers,
  Users,
  ListChecks,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'

type Step = 'upload' | 'map' | 'preview' | 'done'

export default function CompetitionImportPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [meta, setMeta] = useState<CompetitionMeta | null>(null)
  // Düzenlenebilir yarışma alanları (metadata bulunamazsa elle doldurulur)
  const [compName, setCompName] = useState('')
  const [compCode, setCompCode] = useState('')
  const [compDate, setCompDate] = useState('')
  const [compVenue, setCompVenue] = useState('')
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const detected = extractCompetitionMeta(result.metaRows)
      setMeta(detected)
      // Düzenlenebilir alanları tespit edilenle doldur
      setCompName(detected.name)
      setCompCode(detected.code)
      setCompDate(new Date().toISOString().slice(0, 10))
      setCompVenue('')
      setMapping(autoMap(result.headers, FULL_IMPORT_FIELDS))
      setStep('map')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dosya okunamadı')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const setFieldMapping = (field: string, header: string) => {
    setMapping((prev) => ({ ...prev, [field]: header || undefined }))
  }

  const requiredMissing = FULL_IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key])

  const handlePreview = async () => {
    if (!parsed) return
    if (!compName.trim()) {
      setError('Yarışma adı gerekli')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const snap = await getDocs(collection(db, 'athletes'))
      const existing: Athlete[] = snap.docs.map((d) => mapAthlete(d.id, d.data()))
      const editedMeta: CompetitionMeta = {
        name: compName.trim(),
        code: compCode.trim().toUpperCase(),
        sport: meta?.sport,
        date: compDate ? new Date(compDate + 'T00:00:00') : new Date(),
        venue: compVenue.trim() || undefined,
      }
      const p = buildImportPlan(editedMeta, parsed.rows, mapping, existing)
      setPlan(p)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Önizleme oluşturulamadı')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!plan) return
    setBusy(true)
    setError(null)
    try {
      const res = await runCompetitionImport(plan, user?.uid ?? 'admin')
      setResult(res)
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
    setMeta(null)
    setMapping({})
    setPlan(null)
    setResult(null)
    setError(null)
  }

  const newAthletes = plan?.athletes.filter((a) => !a.existingId).length ?? 0
  const reusedAthletes = plan?.athletes.filter((a) => a.existingId).length ?? 0

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/admin/competitions"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Yarışmalara dön
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Excel&apos;den Yarışma İçe Aktar</h1>
        <p className="text-gray-600 mt-1">
          WASMS export dosyasından yarışma, kategoriler, sporcular ve kayıtları tek seferde oluştur.
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
                  active ? 'bg-blue-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i + 1}
              </span>
              <span className={active ? 'font-medium text-gray-900' : 'text-gray-500'}>{labels[i]}</span>
              {i < 3 && <span className="text-gray-300 mx-1">→</span>}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">{error}</div>
      )}

      {/* ADIM 1: Yükle */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 rounded-xl p-12 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
            <Upload className="w-10 h-10 text-gray-400" />
            <span className="text-gray-700 font-medium">
              {busy ? 'Okunuyor...' : 'WASMS Excel/CSV dosyası seç'}
            </span>
            <span className="text-xs text-gray-500">Üstte yarışma bilgisi, altta kayıt tablosu olan export</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={busy} className="hidden" />
          </label>
        </div>
      )}

      {/* ADIM 2: Eşleştir */}
      {step === 'map' && parsed && (
        <div className="space-y-4">
          {/* Yarışma bilgisi (tespit edilen + düzenlenebilir) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Yarışma Bilgisi</h2>
              {meta?.name && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Otomatik tespit edildi
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Dosyadan tespit edildi; gerekirse düzenleyebilirsin. Tarih ve mekan genelde dosyada
              olmaz, elle gir.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-medium text-gray-600">Yarışma Adı *</label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="input"
                  placeholder="Yarışma adı"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Kod</label>
                <input
                  type="text"
                  value={compCode}
                  onChange={(e) => setCompCode(e.target.value)}
                  className="input uppercase"
                  placeholder="TR2026"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Tarih</label>
                <input
                  type="date"
                  value={compDate}
                  onChange={(e) => setCompDate(e.target.value)}
                  className="input"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-medium text-gray-600">Mekan</label>
                <input
                  type="text"
                  value={compVenue}
                  onChange={(e) => setCompVenue(e.target.value)}
                  className="input"
                  placeholder="Örn: Mersin Spor Salonu"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              {parsed.rows.length} kayıt satırı, {parsed.headers.length} kolon
            </div>
            <p className="text-xs text-gray-500">
              Kolonlar otomatik eşleştirildi. Dosya formatı farklıysa aşağıdan elle düzeltebilirsin.
              Zorunlu (*) alanlar dolu olmalı; opsiyoneller boş kalabilir, eksik satırlar atlanır.
            </p>

            <div className="space-y-3">
              {FULL_IMPORT_FIELDS.map((field) => (
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
              <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Baştan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADIM 3: Önizleme */}
      {step === 'preview' && plan && (
        <div className="space-y-4">
          {/* Yarışma */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">{plan.meta.name}</span>
              <span className="text-sm text-blue-600 font-mono">({plan.meta.code})</span>
            </div>
          </div>

          {/* Özet kartları */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard icon={Layers} color="text-purple-600" value={plan.events.length} label="Kategori" />
            <SummaryCard icon={Users} color="text-green-600" value={newAthletes} label="Yeni Sporcu" />
            <SummaryCard icon={Users} color="text-amber-600" value={reusedAthletes} label="Mevcut Sporcu" />
            <SummaryCard icon={ListChecks} color="text-blue-600" value={plan.entries.length} label="Kayıt" />
          </div>

          {plan.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {plan.errors.length} satır hatalı ve atlanacak.
            </div>
          )}

          {/* Kategoriler */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-700">
              Türetilen Kategoriler
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {plan.events.map((ev) => (
                    <tr key={ev.eventCode} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{ev.eventCode}</td>
                      <td className="px-4 py-2 text-gray-900">{ev.eventName}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {ev.discipline} · {ev.gender} · {ev.class} · {ev.format}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'İçe aktarılıyor...' : 'Yarışmayı Oluştur'}
            </button>
            <button onClick={() => setStep('map')} disabled={busy} className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Geri
            </button>
          </div>
        </div>
      )}

      {/* ADIM 4: Bitti */}
      {step === 'done' && result && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Yarışma Oluşturuldu</h2>
          <div className="text-gray-600 mt-2 space-y-1">
            <p>
              <strong>{result.eventsCreated}</strong> kategori · <strong>{result.athletesCreated}</strong> yeni sporcu
              {result.athletesReused > 0 && ` (${result.athletesReused} mevcut)`} ·{' '}
              <strong>{result.entriesCreated}</strong> kayıt eklendi.
            </p>
          </div>
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => router.push(`/dashboard/admin/competitions/${result.competitionId}`)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Yarışmayı Aç
            </button>
            <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Yeni İçe Aktarma
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  color: string
  value: number
  label: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}
