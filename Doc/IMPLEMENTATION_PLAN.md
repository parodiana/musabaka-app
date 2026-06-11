
# Para Dance Sport – Müsabaka Puanlama & Yönetim Uygulaması
## Implementation Plan (v1.0)

---

## Context

Para Dance Sport müsabakaları için profesyonel düzeyde web tabanlı puanlama ve yönetim uygulaması geliştirilecek. Sistem; hakemlerin tablet/telefon üzerinden anonim puan girişi yapmasını, masa hakeminin kağıt puanları sisteme aktarmasını, admin'in yarışma/kategori/kullanıcı yönetimini yapmasını ve Başhakem onay kapısı üzerinden sonuçların ilan edilmesini sağlayacak. Teknik spesifikasyon v1.6 referans alınmıştır.

---

## Tech Stack (Onaylanan)

| Katman | Teknoloji | Gerekçe |
|--------|-----------|---------|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR, güçlü ekosistem, tablet uyumlu |
| Backend | Next.js API Routes | Monorepo, az karmaşıklık |
| Veritabanı | Firebase Firestore | NoSQL, gerçek zamanlı listeners |
| Auth | Firebase Authentication | Admin kullanıcı oluşturma, custom claims (rol) |
| Storage | Firebase Storage | Excel dosyası yükleme |
| Realtime | Firestore onSnapshot | Socket.io'ya gerek yok |
| Stil | Tailwind CSS + shadcn/ui | Profesyonel UI, hızlı geliştirme |
| State | Zustand | Hafif global state (auth, competition context) |
| Validasyon | Zod | Schema validation (hem client hem server) |
| i18n | next-intl | TR/EN anlık geçiş |
| Excel | xlsx (SheetJS) | Excel parsing, flexible column mapping |
| Deploy | Vercel | Next.js için en iyi platform |

---

## Firestore Veri Modeli

### Koleksiyonlar

```
/users/{uid}
  email, role: 'admin'|'bashakem'|'hakem'|'masa_hakemi'
  displayName, judgeId?, language: 'tr'|'en'
  createdAt, createdBy

/athletes/{athleteId}           # Yarışmadan bağımsız kalıcı sporcu
  givenName, familyName, dob, gender
  memberOrg, region
  externalIds: { wasms?: string }
  classifications: string[]     # ['SD1', 'L&F1', ...]
  createdAt, updatedAt

/judges/{judgeId}               # Kalıcı hakem kaydı
  givenName, familyName
  externalId?: string
  userId?: string               # Linked User (uid)
  createdAt

/competitions/{compId}
  name, code, date, venue
  defaultEntryMode: 'AUTO'|'TABLE'
  aggregationMode: 'TRIMMED'|'MEAN'
  status: 'DRAFT'|'ACTIVE'|'COMPLETED'
  createdBy, createdAt

/events/{eventId}               # Kategori (örn: Men's Single Freestyle Class 1)
  competitionId
  eventCode, eventName
  discipline: 'Standard'|'Latin'|'Freestyle'
  gender: 'M'|'F'|'Mixed'
  class: 'Class1'|'Class2'|'Powerchair'|'VI'
  format: 'Single'|'Duo'|'Combi'
  entryMode: 'AUTO'|'TABLE'
  dances: string[]
  judgeCount: number
  status: 'PENDING'|'IN_PROGRESS'|'AWAITING_APPROVAL'|'APPROVED'

/judgeAssignments/{assignmentId}
  competitionId, eventId, judgeId
  components: ('TS'|'MCP'|'DL')[]
  judgeLabel: 'A'|'B'|...|'L'  # Panel harfi

/entries/{entryId}              # Bir yarışmacının bir kategorideki kaydı
  competitionId, eventId
  athleteId                     # Single için
  athlete1Id?, athlete2Id?      # Duo/Combi için
  bibNumber: number             # Sırt no (yarışmaya özgü)
  entryClass: string
  status: 'ACTIVE'|'WITHDRAWN'|'DSQ'
  createdAt

/scores/{scoreId}               # Tek bir puan (hakem × entry × bileşen × dans)
  competitionId, eventId, entryId
  judgeId, judgeAssignmentId
  dance?: string
  component: 'TS'|'MCP'|'DL'
  value: number                 # Tam değer, yuvarlanmaz
  mode: 'AUTO'|'TABLE'
  enteredBy: string             # uid
  timestamp: Timestamp
  isValid: boolean

/deductions/{deductionId}
  competitionId, eventId, entryId
  dance?: string
  type: 'FALL'|'FLOOR_DANCE'|'ACCESSORY'|'TIME_LIMIT'|'DRESS_CODE'|'EXCESS_LIFT'|'DSQ'
  amount: number
  reason: string
  enteredBy: string
  timestamp: Timestamp

/results/{resultId}             # Hesaplanmış + onaylı sonuç
  competitionId, eventId, entryId
  dance?: string
  tsValue, mcpValue, dlValue, deductions, finalScore
  rank: number
  tieBreakScore?: number
  approvedBy?: string
  approvedAt?: Timestamp
  status: 'CALCULATED'|'APPROVED'|'RETURNED'

/auditLog/{logId}
  action, entityType, entityId
  userId, userRole
  details: object
  timestamp: Timestamp
```

---

## Klasör Yapısı

```
paradancesport/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # Rol bazlı layout + sidebar
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx            # Admin dashboard
│   │   │   │   ├── users/              # Kullanıcı yönetimi
│   │   │   │   ├── competitions/       # Yarışma yönetimi
│   │   │   │   ├── athletes/           # Sporcu yönetimi + Excel import
│   │   │   │   ├── judges/             # Hakem yönetimi
│   │   │   │   └── assignments/        # Hakem atama
│   │   │   ├── bashakem/
│   │   │   │   ├── page.tsx            # Başhakem dashboard
│   │   │   │   ├── approval/           # Onay kapısı
│   │   │   │   └── deductions/         # Kesinti girişi
│   │   │   ├── hakem/
│   │   │   │   ├── page.tsx            # Hakem dashboard
│   │   │   │   └── scoring/            # Puan giriş ekranı
│   │   │   └── masa-hakemi/
│   │   │       ├── page.tsx            # Masa hakemi dashboard
│   │   │       ├── scoring/            # Kağıttan puan girişi
│   │   │       └── scoreboard/         # Skor tablosu (realtime)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── create-user/route.ts  # Admin: kullanıcı oluştur
│   │   │   ├── competitions/route.ts
│   │   │   ├── athletes/route.ts
│   │   │   ├── scores/route.ts
│   │   │   ├── results/
│   │   │   │   └── calculate/route.ts  # Skor hesaplama + onay
│   │   │   └── excel/
│   │   │       └── import/route.ts     # Excel yükleme + mapping
│   │   ├── layout.tsx
│   │   └── page.tsx                    # Redirect → login
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn/ui (button, dialog, table...)
│   │   ├── auth/
│   │   │   └── LoginForm.tsx
│   │   ├── admin/
│   │   │   ├── UserCreateForm.tsx
│   │   │   ├── CompetitionForm.tsx
│   │   │   ├── EventForm.tsx
│   │   │   ├── JudgeAssignmentTable.tsx
│   │   │   └── ExcelImport/
│   │   │       ├── FileUploader.tsx
│   │   │       ├── ColumnMapper.tsx    # Esnek kolon eşleştirme UI
│   │   │       └── ImportPreview.tsx
│   │   ├── scoring/
│   │   │   ├── ScoreEntryForm.tsx      # Hakem puan giriş formu
│   │   │   ├── TableOfficialForm.tsx   # Masa hakemi formu
│   │   │   ├── ScoreConfirmDialog.tsx  # Onaylama popup
│   │   │   └── ScoreBoard.tsx          # Realtime skor tablosu
│   │   ├── bashakem/
│   │   │   ├── ApprovalGate.tsx        # Onay kapısı popup
│   │   │   └── DeductionForm.tsx       # Kesinti girişi
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── LanguageSwitcher.tsx
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts               # Firebase client config
│   │   │   ├── admin.ts                # Firebase Admin SDK (API routes)
│   │   │   └── converters.ts           # Firestore type converters
│   │   ├── scoring/
│   │   │   ├── engine.ts               # Ana hesaplama: (TS+MCP)×DL−Ded
│   │   │   ├── trimmed-mean.ts         # min+max at, kalan ort.
│   │   │   ├── tie-break.ts            # Eşitlik bozma: tüm notlar kabul
│   │   │   └── validators.ts           # Skala/adım validasyonu
│   │   ├── excel/
│   │   │   ├── parser.ts               # SheetJS ile Excel okuma
│   │   │   ├── mapper.ts               # Kolon eşleştirme mantığı
│   │   │   └── dedup.ts                # Deduplication: WASMS ID → ad+soyad+DoB
│   │   └── audit.ts                    # AuditLog yazma yardımcısı
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                  # Firebase Auth state
│   │   ├── useScores.ts                # onSnapshot: event scores realtime
│   │   ├── useEntries.ts               # onSnapshot: entry listesi
│   │   └── useCompetition.ts           # Aktif yarışma context
│   │
│   ├── store/
│   │   ├── auth.store.ts               # Zustand: user + role
│   │   └── competition.store.ts        # Zustand: aktif yarışma/event
│   │
│   ├── types/
│   │   ├── athlete.ts
│   │   ├── competition.ts
│   │   ├── score.ts
│   │   ├── user.ts
│   │   └── index.ts
│   │
│   ├── middleware.ts                    # Route protection (rol kontrolü)
│   │
│   └── i18n/
│       ├── tr.json                      # Türkçe metinler
│       ├── en.json                      # İngilizce metinler
│       └── config.ts
│
├── firestore.rules                      # Security rules
├── firestore.indexes.json
├── firebase.json
├── .env.local                           # Firebase config (gitignore)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Geliştirme Fazları

### Faz 0 – Proje Kurulumu
- [ ] Next.js 14 + TypeScript projesi oluştur
- [ ] Tailwind CSS + shadcn/ui kur
- [ ] Firebase projesi oluştur (Firestore, Auth, Storage)
- [ ] Firebase config (.env.local)
- [ ] next-intl TR/EN kurulumu
- [ ] Klasör yapısını oluştur

### Faz 1 – Auth & Yetkilendirme
- [ ] Firebase Auth entegrasyonu (client + Admin SDK)
- [ ] Login sayfası
- [ ] Custom claims ile rol atama (admin/bashakem/hakem/masa_hakemi)
- [ ] Next.js middleware: route protection
- [ ] Rol bazlı layout (sidebar farklı roller için farklı)
- [ ] Admin: kullanıcı oluşturma (POST /api/auth/create-user)

### Faz 2 – Admin Panel – Yarışma Yönetimi
- [ ] Competition CRUD
- [ ] Event/Kategori CRUD
- [ ] Judge CRUD
- [ ] JudgeAssignment: kategori bazında bileşen atama tablosu
- [ ] Sırt no atama (random + elle giriş, çakışma kontrolü)

### Faz 3 – Excel Import + Dedup
- [ ] Firebase Storage'a Excel yükleme
- [ ] SheetJS ile Excel parse
- [ ] Esnek kolon eşleştirme UI (ColumnMapper)
- [ ] Deduplication: WASMS ID → ad+soyad+DoB
- [ ] Hatalı satır raporlama
- [ ] Event/kategori otomatik türetme

### Faz 4 – Puanlama Motoru
- [ ] Skala validasyonu: TS/MCP (1.0–9.9, 0.1 adım), DL (1.00–1.50, 0.05 adım)
- [ ] Trimmed mean (min+max at, kalanların ortalaması)
- [ ] Final formül: (TS + MCP) × DL − Deductions
- [ ] Tie-break: tüm notlar kabul yöntemi
- [ ] Çok danslı program: her dans Result'u topla

### Faz 5 – Puan Giriş Ekranları
- [ ] Hakem ekranı (OTOMATİK mod): sırt no listesi + bileşen puanları + onay popup
- [ ] Masa hakemi ekranı: hakem seç → bileşen puanları gir → kaydet
- [ ] Çift giriş engelleme (aynı hakem×entry×bileşen benzersizliği)
- [ ] Skor tablosu (ScoreBoard): Firestore onSnapshot realtime

### Faz 6 – Başhakem Onay Kapısı
- [ ] Sonuç hesaplandığında 'Awaiting Approval' state
- [ ] Başhakem onay popup: özet (sırt no, TS/MCP/DL, kesinti, final) + Onayla/İade
- [ ] Onay → result 'APPROVED', ilan
- [ ] İade → result 'RETURNED', düzeltmeye döner
- [ ] Kesinti (Deduction) giriş formu (Başhakem/Admin)

### Faz 7 – Sonuçlar & Raporlama
- [ ] Sıralama tablosu (approved results)
- [ ] PDF/Excel export
- [ ] Yarışma geçmişi (opsiyonel): sporcu bazında skor zaman serisi

### Faz 8 – i18n, Audit, Polish
- [ ] Tüm UI metinleri TR/EN (next-intl)
- [ ] AuditLog UI (admin için)
- [ ] Firestore security rules (rol bazlı okuma/yazma)
- [ ] Firestore indexes
- [ ] Mobile/tablet responsive test
- [ ] Vercel deploy

---

## Önemli İş Kuralları (Kritik)

1. **BK-1**: Giriş modu (AUTO/TABLE) kategori bazında admin belirler
2. **BK-2**: (hakem × entry × bileşen) kombinasyonu benzersiz — çift giriş engellenir
3. **BK-3**: Dedup: WASMS ID → ad+soyad+DoB sırasıyla
4. **BK-4 Onay Kapısı**: Hiçbir sonuç Başhakem onayı olmadan ilan edilemez
5. **BK-5**: Tek Athlete kaydı + çok Entry yapısı
6. **BK-6**: Sırt no yarışmaya özgü, her yarışmada yeniden atanır
7. **Anonimlik**: Hakem ve masa hakemi hiçbir ekranda yarışmacı adını göremez
8. **Yuvarlama**: Sonuçlar yuvarlanmaz, tam değerle hesaplanır ve saklanır
9. **Deductions**: Doğrudan Başhakem/Admin girer, kolektif oylama yok
10. **Şifre**: Yalnızca admin sıfırlayabilir, self-service yok

---

## Puanlama Formülü (Özet)

```
trimmedMean(values) = (tüm değerler - min - max) / (n - 2)
// n < 4 ise düz ortalama

tsValue  = trimmedMean([...TS hakem notları])
mcpValue = trimmedMean([...MCP hakem notları])
dlValue  = trimmedMean([...DL hakem notları])

danceResult = (tsValue + mcpValue) × dlValue − deductions
finalScore  = sum(danceResults)   // çok danslı için
```

---

## Güvenlik (Firestore Rules Özeti)

- `scores`: yalnızca atanmış hakem kendi bileşenine yazabilir
- `results`: yalnızca bashakem ve admin okuyabilir/güncelleyebilir
- `athletes`/`entries`: yarışmacı adı sadece admin görür; hakem sırt no üzerinden okur
- `auditLog`: yalnızca admin okur, sistem yazar
- Tüm yazma işlemleri server-side API routes üzerinden (Admin SDK)
