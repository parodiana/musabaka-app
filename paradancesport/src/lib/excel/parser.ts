import * as XLSX from 'xlsx'

export interface ParsedSheet {
  /** Başlık satırındaki kolon adları */
  headers: string[]
  /** Her satır: { [header]: hücre değeri } */
  rows: Record<string, string>[]
  /** Başlık satırından ÖNCEKI satırlar (metadata bloğu) — dizi-dizi */
  metaRows: string[][]
}

/**
 * Excel/CSV dosyasını tarayıcıda parse eder.
 * İlk çalışma sayfasını okur, başlık satırını ve veri satırlarını döndürür.
 */
export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('Dosyada çalışma sayfası bulunamadı')
  }

  const sheet = workbook.Sheets[firstSheetName]

  // Satırları dizi-dizi olarak al (başlık tespiti için)
  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  })

  if (rawMatrix.length === 0) {
    throw new Error('Dosya boş görünüyor')
  }

  // Başlık satırını tespit et: en çok dolu hücreye sahip ilk satır.
  // (WASMS/sistem export'larında üstte metadata satırları olabilir.)
  const nonEmptyCount = (row: unknown[]) =>
    row.filter((c) => String(c ?? '').trim() !== '').length
  let headerIdx = 0
  let maxCols = 0
  for (let i = 0; i < rawMatrix.length; i++) {
    const count = nonEmptyCount(rawMatrix[i] as unknown[])
    if (count > maxCols) {
      maxCols = count
      headerIdx = i
    }
  }

  const headerRow = (rawMatrix[headerIdx] as unknown[]).map((h) => String(h ?? '').trim())
  const headers = headerRow.filter((h) => h.length > 0)

  if (headers.length === 0) {
    throw new Error('Başlık satırı okunamadı')
  }

  // Veri satırlarını başlık anahtarlarıyla eşleştir (başlıktan sonraki satırlar)
  const rows: Record<string, string>[] = []
  for (let i = headerIdx + 1; i < rawMatrix.length; i++) {
    const rowArr = rawMatrix[i] as unknown[]
    const obj: Record<string, string> = {}
    let hasValue = false
    headerRow.forEach((header, idx) => {
      if (!header) return
      const cell = rowArr[idx]
      const value = cell == null ? '' : String(cell).trim()
      obj[header] = value
      if (value) hasValue = true
    })
    if (hasValue) rows.push(obj)
  }

  // Başlıktan önceki satırlar (metadata)
  const metaRows: string[][] = []
  for (let i = 0; i < headerIdx; i++) {
    metaRows.push((rawMatrix[i] as unknown[]).map((c) => String(c ?? '').trim()))
  }

  return { headers, rows, metaRows }
}
