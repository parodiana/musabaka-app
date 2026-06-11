# Para Dance Sport – Müsabaka Puanlama & Yönetim Uygulaması

Profesyonel düzeyde web tabanlı müsabaka puanlama ve yönetim sistemi. Hakemlerin tablet/telefon üzerinden anonim puan girişi, masa hakeminin kağıt puanları aktarması, admin'in yarışma yönetimi ve Başhakem onay kapısı.

## 🎯 Özellikler

- **Rol Bazlı Erişim**: Admin, Başhakem, Hakem, Masa Hakemi
- **İki Giriş Modu**: OTOMATİK (hakem cihazdan) + MASA_HAKEMİ (kağıttan)
- **Anonimlik**: Hakem sadece sırt no görür, yarışmacı adı gizli
- **Otonom Hesaplama**: Trimmed mean + (TS+MCP)×DL−Deductions formülü
- **Gerçek Zamanlı**: Firestore realtime listeners ile anlık skor tablosu
- **Excel İçe Aktarma**: Esnek kolon eşleştirme (WASMS, WorldAbilitysport)
- **Deduplication**: WASMS ID → ad+soyad+DoB ile otomatik tekrar önleme
- **Onay Kapısı**: Başhakem onayı olmadan hiçbir sonuç ilan edilmez
- **i18n**: Türkçe/İngilizce anlık geçiş
- **Audit Log**: Tüm işlemler denetim kaydına yazılır

## 🚀 Quick Start

### Ön Koşullar
- Node.js 18+
- npm veya yarn
- Firebase projesi (Firestore, Auth, Storage)

### Kurulum

1. **Projeyi Klonla**
```bash
cd paradancesport
npm install
```

2. **Environment Değişkenleri**
```bash
cp .env.local.example .env.local
# .env.local'ı Firebase config'inle doldur
```

3. **Geliştirme Sunucusu**
```bash
npm run dev
```

Açık: [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
npm run start
```

## 📁 Proje Yapısı

```
src/
├── app/                 # Next.js App Router
│   ├── (auth)/         # Login (group route)
│   ├── (dashboard)/    # Main app (group route)
│   │   ├── admin/      # Admin paneli
│   │   ├── bashakem/   # Başhakem onay
│   │   ├── hakem/      # Hakem puanlama
│   │   └── masa-hakemi/# Masa hakemi
│   └── api/            # API Routes (backend)
├── components/         # React components
│   ├── ui/            # shadcn/ui
│   ├── auth/          # Auth components
│   ├── admin/         # Admin specific
│   ├── scoring/       # Puanlama UI
│   └── layout/        # Layout components
├── lib/               # Utilities
│   ├── firebase/      # Firebase config
│   ├── scoring/       # Puanlama motoru
│   └── excel/         # Excel import
├── hooks/             # Custom React hooks
├── store/             # Zustand stores
├── types/             # TypeScript types
└── i18n/              # Translations (TR/EN)
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + TypeScript |
| Backend | Next.js API Routes |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Validation | Zod |
| i18n | next-intl |
| Excel | SheetJS |

## 📋 Firestore Koleksiyonları

- **users** - Kullanıcılar (Admin, Başhakem, Hakem, Masa Hakemi)
- **athletes** - Sporcular (yarışmadan bağımsız)
- **judges** - Hakemler (yarışmadan bağımsız)
- **competitions** - Yarışmalar
- **events** - Kategoriler/Etkinlikler
- **entries** - Yarışmacı katılımları
- **scores** - Hakem puanları
- **deductions** - Kesintiler
- **results** - Hesaplanmış sonuçlar
- **auditLog** - Denetim kaydı

## 🎮 Puanlama Formülü

```
trimmedMean(values) = (tüm - min - max) / (n - 2)  // n >= 4
                      = (tüm) / n                   // n < 4

tsValue  = trimmedMean([...TS scores])
mcpValue = trimmedMean([...MCP scores])
dlValue  = trimmedMean([...DL scores])

danceResult = (tsValue + mcpValue) × dlValue − deductions
finalScore  = sum(danceResults)  // çok danslı için
```

## 🔐 Güvenlik

- Firebase Security Rules (rol bazlı erişim)
- Server-side validation (Zod)
- Client-side validation (Zod)
- Audit logging tüm işlemler
- Yarışmacı adı sadece admin görür

## 📚 Geliştirme Fazları

1. **Faz 0** - Proje kurulumu ✓
2. **Faz 1** - Auth & Yetkilendirme
3. **Faz 2** - Admin Panel
4. **Faz 3** - Excel Import + Dedup
5. **Faz 4** - Puanlama Motoru
6. **Faz 5** - Puan Giriş Ekranları
7. **Faz 6** - Başhakem Onay Kapısı
8. **Faz 7** - Sonuçlar & Raporlama
9. **Faz 8** - i18n, Audit, Polish

Detaylı plan: [Doc/IMPLEMENTATION_PLAN.md](../Doc/IMPLEMENTATION_PLAN.md)

## 🤝 Katkı

Bu proje için spesifik istekler şu sorumlulara iletilir:
- Teknik: Bkz. IMPLEMENTATION_PLAN.md
- Functional: Bkz. ParaDanceSport_Teknik_Spesifikasyon_uygulaması.pdf

## 📄 Lisans

Özel proje - telif hakları saklıdır.

## 📞 İletişim

Sorular ve öneriler için proje yöneticisine başvurun.
