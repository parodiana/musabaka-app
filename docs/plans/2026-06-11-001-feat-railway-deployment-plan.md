---
title: "feat: Deploy Next.js App to Railway"
status: active
date: 2026-06-11
depth: standard
---

# feat: Deploy Next.js App to Railway

**Problem:** `paradancesport/` altındaki Next.js 14 + Firebase uygulamasının Railway platformuna deploy edilmesi gerekiyor. Mevcut deployment konfigürasyonu yok; Firebase harici servis olduğu için Railway'de yalnızca Next.js uygulama katmanı çalışacak.

---

## Summary

Next.js 14 uygulamasını Railway'e deploy etmek için üç temel gereksinim var: Railway'in doğru alt dizini (`paradancesport/`) build etmesi, tüm Firebase ortam değişkenlerinin (özellikle build-time `NEXT_PUBLIC_*` değişkenleri) Railway'e girilmesi ve Firebase Admin service account'unun güvenli şekilde aktarılması. Kod değişikliği minimumdur; ağırlık platform konfigürasyonu ve ortam değişkeni yönetimindedir.

---

## Requirements

- **R1:** Uygulama Railway'de production modunda ayağa kalkmalı (`next build && next start`)
- **R2:** Firebase Authentication ve Firestore bağlantısı production ortamında çalışmalı
- **R3:** Firebase Admin SDK (API route'lar için) service account üzerinden authenticate olmalı
- **R4:** Railway deployment `paradancesport/` alt klasörünü doğru root olarak kullanmalı
- **R5:** Ortam değişkenleri kaynak kodda (`.env.local`, hardcode) bulunmamalı

---

## Key Technical Decisions

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| Build sistemi | Nixpacks (Railway default) | Next.js 14'ü otomatik tanır, Dockerfile gerektirmez |
| Alt klasör yöntemi | Railway dashboard "Root Directory" ayarı | `railway.json` root directory desteklemez; dashboard en temiz yöntem |
| Service account aktarımı | Base64-encoded JSON → env var | Dosya mount karmaşıklığını önler, `.env.local.example` zaten bu formatı belgeliyor |
| PORT yönetimi | Değişiklik gerekmez | `next start` Railway'in inject ettiği `PORT` env var'ı otomatik okur |
| Node.js versiyonu | `nixpacks.toml` ile 20.x sabitlenir | `package.json` Node versiyonu belirtmiyor, Railway default farklı olabilir |

---

## Scope Boundaries

**Bu planda yapılacaklar:**
- Railway projesi kurulumu ve konfigürasyonu
- `nixpacks.toml` eklenmesi (Node.js versiyonu sabitleme)
- Firebase service account hazırlanması ve ortam değişkeni olarak ayarlanması
- Tüm ortam değişkenlerinin Railway'e girilmesi
- İlk deployment ve temel doğrulama

**Ertelenen işler:**
- Firestore güvenlik kurallarının production için sıkılaştırılması (kullanıcı talebiyle ertelendi)
- Custom domain bağlama
- GitHub Actions / CI/CD pipeline kurulumu
- Monitoring ve alerting

---

## High-Level Technical Design

```
GitHub Repo (musabaka-app/)
        │
        ▼
Railway Project
  ├── Root Directory: paradancesport/
  ├── Builder: Nixpacks (auto-detect Next.js)
  ├── Build: npm run build
  ├── Start: npm start
  └── Env Vars:
        ├── NEXT_PUBLIC_FIREBASE_* (build-time)
        ├── FIREBASE_SERVICE_ACCOUNT_KEY (runtime)
        └── NEXT_PUBLIC_APP_URL = Railway URL
              │
              ▼
        Next.js App (port: $PORT)
              │
        ┌─────┴─────┐
        ▼           ▼
   Firebase      Firebase
   Auth/Firestore  Admin SDK
   (client SDK)   (API routes)
```

**Build sırası kritik:** `NEXT_PUBLIC_*` değişkenleri build anında bundle'a gömülür. Railway'de bu değişkenler deploy tetiklenmeden **önce** set edilmiş olmalıdır.

---

## Implementation Units

### U1. `nixpacks.toml` Oluşturulması

**Goal:** Railway'in Node.js 20.x kullanmasını ve build/start komutlarını açıkça tanımlamak.

**Requirements:** R1, R4

**Dependencies:** Yok

**Files:**
- `paradancesport/nixpacks.toml` (yeni)

**Approach:**
Nixpacks, Next.js'i otomatik tanır ama Node.js versiyonunu sabitlemek önemli. `paradancesport/` içine aşağıdaki içerikle dosya eklenir:

```toml
[phases.setup]
nixPkgs = ["nodejs_20"]

[start]
cmd = "npm start"
```

**Test scenarios:**
- Railway build logunda `nodejs_20` kullanıldığı görülmeli
- Build çıktısı `.next/` klasörü oluşturmalı

**Verification:** Railway deployment logunda "Built with Nixpacks" + Node 20 satırı görünmeli.

---

### U2. Firebase Admin Service Account Hazırlanması

**Goal:** `FIREBASE_SERVICE_ACCOUNT_KEY` ortam değişkenini Railway'e girebilecek formata getirmek.

**Requirements:** R3, R5

**Dependencies:** Yok (Firebase Console erişimi gerekli)

**Files:** Değiştirilecek dosya yok — bu adım operasyonel.

**Approach:**

1. **Firebase Console → Project Settings → Service Accounts** sekmesi açılır
2. **"Generate new private key"** tıklanır → JSON dosyası indirilir (örn. `service-account.json`)
3. JSON dosyası base64'e encode edilir:
   - **macOS/Linux:** `base64 -i service-account.json | tr -d '\n'`
   - **Windows PowerShell:** `[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("service-account.json"))`
4. Üretilen string Railway'de `FIREBASE_SERVICE_ACCOUNT_KEY` değeri olarak kullanılır
5. İndirilen `service-account.json` dosyası **hemen silinmeli**, repoya commit edilmemeli

**Patterns to follow:** `paradancesport/.env.local.example` → `FIREBASE_SERVICE_ACCOUNT_KEY=base64_encoded_service_account_json`

**Test scenarios:**
- `paradancesport/src/lib/firebase/admin.ts` dosyasındaki admin init kodu base64'ü çözebilmeli
- `/api/auth/create-user` endpoint'i admin yetkisiyle çalışabilmeli

**Verification:** Deploy sonrası `/api/auth/create-user` endpoint'i 401/403 değil, beklenen yanıtı döndürmeli.

---

### U3. Railway Ortam Değişkenlerinin Ayarlanması

**Goal:** Tüm `NEXT_PUBLIC_*` ve runtime değişkenlerini Railway'e girmek.

**Requirements:** R2, R3, R5

**Dependencies:** U2 (service account base64 string hazır olmalı)

**Files:** Değiştirilecek dosya yok — Railway dashboard konfigürasyonu.

**Approach:**

Railway Dashboard → Variables sekmesine aşağıdakiler girilir:

| Değişken | Kaynak | Not |
|----------|--------|-----|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → General | Build-time |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console | Build-time |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console | Build-time |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console | Build-time |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console | Build-time |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console | Build-time |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | U2'de üretilen base64 string | Runtime |
| `NEXT_PUBLIC_APP_NAME` | `ParaDanceSport` | Build-time |
| `NEXT_PUBLIC_APP_URL` | Railway'in atadığı URL (deploy sonrası güncellenebilir) | Build-time |
| `NODE_ENV` | `production` | Otomatik set edilir, elle girmek gerekmez |

**Önemli:** `NEXT_PUBLIC_*` değişkenler **build anında** bundle'a gömülür. Değişiklik sonrası uygulamanın **yeniden deploy edilmesi** gerekir.

**Test scenarios:**
- Deploy loglarında `NEXT_PUBLIC_FIREBASE_PROJECT_ID` değerinin build'e dahil edildiği görülmeli
- Browser'da `window.__NEXT_DATA__` içinde Firebase project ID görünmeli (doğrulama için)

**Verification:** Login sayfası Firebase Authentication ile bağlanabilmeli (network tab'da Firebase istek görülmeli).

---

### U4. Railway Projesi Kurulumu ve Deploy

**Goal:** Railway projesini GitHub repo ile bağlayıp ilk başarılı deployment'ı gerçekleştirmek.

**Requirements:** R1, R4

**Dependencies:** U1, U2, U3

**Files:** Değiştirilecek dosya yok — Railway dashboard konfigürasyonu.

**Approach:**

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. `musabaka-app` reposu seçilir
3. **Settings → Source → Root Directory:** `paradancesport` girilir
4. **Build Command** (otomatik): `npm run build`
5. **Start Command** (otomatik): `npm start`
6. U3'teki tüm değişkenler girilir
7. **Deploy** tetiklenir
8. Deploy başarılı olunca Railway URL alınır → `NEXT_PUBLIC_APP_URL` bu URL ile güncellenir → **tekrar deploy** tetiklenir

**Patterns to follow:**
- Railway Nixpacks Next.js auto-detection
- `paradancesport/nixpacks.toml` (U1'de eklendi)

**Test scenarios:**
- Build logu hatasız tamamlanmalı
- Health check: Railway URL üzerinden `/` path'i 200 dönmeli
- Login sayfası render olmalı
- Firebase Authentication çalışmalı (login denenebilmeli)
- Console'da Firebase bağlantı hatası olmamalı

**Verification:** Railway dashboard'da service "Active" durumunda, Railway URL'de uygulama login sayfasını göstermeli.

---

## Open Questions

| Soru | Etki | Durum |
|------|------|-------|
| Firebase Auth'da authorized domains listesine Railway URL eklendi mi? | Firebase Auth, bilinmeyen domainlerden gelen auth isteklerini reddeder | **Blocker** — deploy sonrası Firebase Console → Authentication → Settings → Authorized domains'e Railway URL eklenmelidir |
| `NEXT_PUBLIC_APP_URL` deploy öncesi bilinemiyor | İlk deploy'da placeholder kullanılır, sonra güncellenir | Geçici, 2-pass deploy gerektirir |

---

## Risks & Dependencies

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| Firebase Authorized Domains eksikliği | Yüksek | Auth tamamen çalışmaz | Deploy sonrası Railway URL'yi Firebase Console'a ekle |
| `NEXT_PUBLIC_*` değişken eksikliği build-time | Orta | Uygulama Firebase'e bağlanamaz | U3 tamamlanmadan deploy tetiklenmemeli |
| Service account JSON repoya commit edilmesi | Düşük (dikkat edilirse) | Güvenlik ihlali | U2 sonrası JSON dosyası hemen silinmeli |
| Node.js versiyon uyumsuzluğu | Düşük | Build hatası | `nixpacks.toml` ile Node 20 sabitlendi (U1) |

---

## Sources & Research

- Railway Nixpacks Next.js desteği: Next.js 14 otomatik tanınır, `npm run build` + `npm start` varsayılan
- Next.js `PORT` env var desteği: Next.js 14 `next start` komutu `PORT` env var'ı otomatik okur, değişiklik gerekmez
- Firebase Admin base64 pattern: `.env.local.example` dosyasında zaten belgelenmiş
