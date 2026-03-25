# REBUILD BRIEF — Gabinet Terapeutyczny

> **Cel dokumentu:** Kompletna specyfikacja techniczna i funkcjonalna umożliwiająca odbudowanie aplikacji od zera.
> Zawiera dosłownie wszystko: architekturę, kod wzorcowy, logikę biznesową, wygląd, dane, konfigurację.

---

## SPIS TREŚCI

1. [Dane projektu](#1-dane-projektu)
2. [Cel i kontekst aplikacji](#2-cel-i-kontekst-aplikacji)
3. [Architektura ogólna](#3-architektura-ogólna)
4. [Struktura plików](#4-struktura-plików)
5. [Konfiguracja zewnętrzna (Google Cloud)](#5-konfiguracja-zewnętrzna-google-cloud)
6. [Design System — Liquid Glass](#6-design-system--liquid-glass)
7. [Model danych (pełna specyfikacja JSON)](#7-model-danych-pełna-specyfikacja-json)
8. [localStorage — klucze i znaczenie](#8-localstorage--klucze-i-znaczenie)
9. [Service Worker — strategia cache](#9-service-worker--strategia-cache)
10. [Nawigacja i routing](#10-nawigacja-i-routing)
11. [Moduł: Auth (auth.js)](#11-moduł-auth-authjs)
12. [Moduł: Drive (drive.js)](#12-moduł-drive-drivejs)
13. [Moduł: Encryption (encryption.js)](#13-moduł-encryption-encryptionjs)
14. [Moduł: App (app.js)](#14-moduł-app-appjs)
15. [Moduł: Patients (patients.js)](#15-moduł-patients-patientsjs)
16. [Moduł: Sessions (sessions.js)](#16-moduł-sessions-sessionsjs)
17. [Moduł: Calendar (calendar.js)](#17-moduł-calendar-calendarjs)
18. [Moduł: Payments (payments.js)](#18-moduł-payments-paymentsjs)
19. [Moduł: Finance (finance.js)](#19-moduł-finance-financejs)
20. [Moduł: Stats (stats.js)](#20-moduł-stats-statsjs)
21. [Moduł: Notes (notes.js)](#21-moduł-notes-notesjs)
22. [Moduł: Archive (archive.js)](#22-moduł-archive-archivejs)
23. [Moduł: Utils (utils.js)](#23-moduł-utils-utilsjs)
24. [Struktura HTML — widoki i modale](#24-struktura-html--widoki-i-modale)
25. [Logika biznesowa — kluczowe algorytmy](#25-logika-biznesowa--kluczowe-algorytmy)
26. [Ekran logowania](#26-ekran-logowania)
27. [Manifest PWA](#27-manifest-pwa)
28. [CI/CD — GitHub Pages](#28-cicd--github-pages)
29. [Znane problemy i obejścia](#29-znane-problemy-i-obejścia)

---

## 1. DANE PROJEKTU

| Parametr | Wartość |
|----------|---------|
| Nazwa | Gabinet Terapeutyczny |
| Short name | Gabinet |
| Repo (GitHub) | `PawelSzmit/Gabinet` (prywatne) |
| Branch | `main` |
| Hosting | GitHub Pages → `https://pawelszmit.github.io/Gabinet/` |
| Lokalny katalog | `/Users/pawelszmit/Gabinet-PWA/` |
| Język interfejsu | Polski (hardcoded) |
| Cache SW | `gabinet-v11` |
| Wersja danych | `1.0` |

---

## 2. CEL I KONTEKST APLIKACJI

**Kto używa:** Jeden psychoterapeuta prowadzący prywatny gabinet (aplikacja dla 1 użytkownika).

**Co robi aplikacja:**
- Automatycznie generuje cykliczne sesje z pacjentami na podstawie harmonogramu
- Śledzi statusy sesji: zaplanowana / odbyła się / odwołana
- Rejestruje płatności za sesje (z przypisaniem do konkretnych sesji)
- Przechowuje szyfrowane notatki kliniczne, cele terapeutyczne i postępy
- Wyświetla statystyki i wykresy przychodów
- Synchronizuje dane z Google Drive użytkownika (1 plik JSON)
- Działa offline (Service Worker)
- Instaluje się jako PWA na telefon/tablet/komputer

**Dane przechowywane:** Jeden plik `gabinet-data.json` na Google Drive zalogowanego użytkownika.

---

## 3. ARCHITEKTURA OGÓLNA

```
Brak backendu. Czysto kliencka SPA.

┌──────────────────────────────────────────────┐
│              index.html (SPA)                │
│    Wszystkie widoki i modale w jednym pliku  │
├──────────────────────────────────────────────┤
│  JS (moduły IIFE, ładowane kolejno z CDN)   │
│                                              │
│  config.js → auth.js → drive.js             │
│  encryption.js → app.js → patients.js       │
│  sessions.js → calendar.js → payments.js    │
│  finance.js → stats.js → notes.js           │
│  archive.js → utils.js                      │
├──────────────────────────────────────────────┤
│           Google Drive API v3                │
│      (plik gabinet-data.json na Drive)       │
├──────────────────────────────────────────────┤
│      service-worker.js (cache-first)         │
└──────────────────────────────────────────────┘
```

**Wzorzec modułów:** Każdy plik JS to IIFE zwracające publiczne API:
```javascript
const ModuleName = (() => {
  // private state
  function privateFunction() { ... }
  function publicFunction() { ... }
  return { publicFunction };
})();
```

**Stan globalny:** `appData` zarządzany tylko przez `app.js`, dostępny przez `App.getData()`.

**Zapis danych:** `App.saveAndRefresh()` → `Drive.saveData(appData)` → debounce 300ms → `performSave()` → PATCH na Google Drive.

**Brak npm, brak bundlera, brak frameworka.** Wszystkie zewnętrzne zasoby z CDN.

---

## 4. STRUKTURA PLIKÓW

```
Gabinet-PWA/
├── index.html              # Główny SPA (wszystkie widoki i modale)
├── manifest.json           # PWA manifest
├── service-worker.js       # Service Worker (cache-first, cache gabinet-v11)
├── BRIEF.md                # Brief strategiczny/marketingowy
├── REBUILD_BRIEF.md        # Ten plik
├── README.md               # Dokumentacja użytkownika
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions: deploy na Pages
│
├── css/
│   ├── main.css            # Zmienne, layout, nawigacja, login screen, dark mode
│   ├── components.css      # Przyciski, formularze, modale, listy, karty, badge, toasty
│   └── calendar.css        # Widoki kalendarza (miesiąc, tydzień, dzień)
│
├── js/
│   ├── config.js           # GOOGLE_CLIENT_ID + GOOGLE_API_KEY (NIE w .gitignore)
│   ├── config.example.js   # Szablon — skopiować do config.js
│   ├── app.js              # Router, inicjalizacja, stan globalny, ustawienia
│   ├── auth.js             # Google OAuth 2.0 (GIS)
│   ├── drive.js            # Google Drive API v3 — CRUD pliku JSON
│   ├── encryption.js       # AES-256-GCM (Web Crypto API)
│   ├── patients.js         # CRUD pacjentów, lista, widok szczegółowy
│   ├── sessions.js         # Generowanie, numeracja, statusy sesji
│   ├── calendar.js         # Renderowanie kalendarza (3 widoki)
│   ├── payments.js         # Rejestracja, edycja, usuwanie płatności
│   ├── finance.js          # Dashboard finansowy z Chart.js
│   ├── stats.js            # Moduł statystyk z wykresami
│   ├── notes.js            # Notatki, cele, postępy (szyfrowane)
│   ├── archive.js          # Archiwizacja i przywracanie pacjentów
│   └── utils.js            # Funkcje pomocnicze, formatowanie, UI
│
└── icons/
    ├── icon-192.png        # PWA icon 192×192
    └── icon-512.png        # PWA icon 512×512
```

---

## 5. KONFIGURACJA ZEWNĘTRZNA (Google Cloud)

### 5.1. Wymagane usługi w Google Cloud Console

1. **Google Drive API** — włączona
2. **Google Identity Services (OAuth 2.0)** — skonfigurowany
3. **API Key** z ograniczeniem HTTP referrer na domenę hostingu
4. **OAuth 2.0 Client ID** (typ: Web application) z Authorized JavaScript origins na domenę hostingu

### 5.2. Plik config.js (NIE commitować kluczy do historii)

```javascript
const CONFIG = {
  GOOGLE_CLIENT_ID: 'TWOJ_CLIENT_ID.apps.googleusercontent.com',
  GOOGLE_API_KEY: 'TWOJ_API_KEY'
};
```

> **UWAGA:** config.js **NIE jest** w .gitignore — plik jest w repo (klucze są publiczne dla aplikacji klienckich). Bezpieczeństwo zapewniają ograniczenia HTTP referrer w Google Cloud Console.

### 5.3. Skrypty Google ładowane w index.html

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://apis.google.com/js/api.js" async defer></script>
```

### 5.4. Scope OAuth

```
https://www.googleapis.com/auth/drive.file
```
(dostęp tylko do plików stworzonych przez aplikację — NIE do całego Drive)

### 5.5. Plik danych na Google Drive

Nazwa: `gabinet-data.json`
Typ MIME: `application/json`
Wyszukiwanie: `name='gabinet-data.json' and trashed=false`

---

## 6. DESIGN SYSTEM — LIQUID GLASS

### 6.1. Inspiracja i koncepcja

**Apple Liquid Glass** (macOS Tahoe / iOS 26, WWDC 2025) + **Bold Editorial Design** (tylko ekran logowania).

Zasada: glassmorphism — półprzezroczyste powierzchnie z backdrop-filter blur.

### 6.2. Zmienne CSS (`:root`)

```css
:root {
  /* Kolory systemowe Apple */
  --primary: #007AFF;
  --primary-dark: #0056CC;
  --primary-light: #5AC8FA;
  --success: #34C759;
  --success-light: #4CD964;
  --warning: #FF9F0A;
  --warning-light: #FFB340;
  --danger: #FF3B30;
  --danger-light: #FF6961;
  --neutral: #8E8E93;

  /* Kolory płatności */
  --alior: #CC0000;
  --ing: #FF6600;
  --cash: #34C759;

  /* Powierzchnie (Light Mode) */
  --bg: #F2F2F7;
  --card: rgba(255, 255, 255, 0.72);
  --card-solid: #FFFFFF;
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-border: rgba(255, 255, 255, 0.5);
  --glass-blur: blur(20px);
  --glass-saturate: saturate(180%);
  --border: rgba(0, 0, 0, 0.08);
  --text: #1C1C1E;
  --text-secondary: #8E8E93;

  /* Wymiary */
  --header-height: 56px;
  --nav-height: 60px;
  --sidebar-width: 240px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  /* Animacje */
  --transition: 0.2s ease;
  --transition-spring: 0.35s cubic-bezier(0.25, 1, 0.5, 1);
}
```

### 6.3. Dark Mode

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --card: rgba(28, 28, 30, 0.72);
    --card-solid: #1C1C1E;
    --glass-bg: rgba(28, 28, 30, 0.72);
    --glass-border: rgba(255, 255, 255, 0.1);
    --border: rgba(255, 255, 255, 0.1);
    --text: #F5F5F7;
    --text-secondary: #8E8E93;
  }
}
```

### 6.4. Efekt szkła (glass card)

```css
.card {
  background: var(--card);
  backdrop-filter: var(--glass-blur) var(--glass-saturate);
  -webkit-backdrop-filter: var(--glass-blur) var(--glass-saturate);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}
```

### 6.5. Typografia

- **Cała aplikacja:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- **Ekran logowania:** `'Playfair Display', Georgia, serif` (z Google Fonts)
- Bazowy rozmiar: 16px
- Nagłówki: `font-weight: 700`

### 6.6. Responsive breakpoints

```css
/* Mobile default — bottom nav */
/* ≥ 768px: sidebar widoczny, bottom nav hidden */
@media (min-width: 768px) {
  .sidebar { display: flex; }
  #bottom-nav { display: none; }
  .app-content { margin-left: var(--sidebar-width); }
}
/* ≥ 1024px: szerszy content */
@media (min-width: 1024px) {
  .app-content { max-width: 900px; }
}
```

### 6.7. Dock navigation (efekt magnifikacji)

Nawigacja ma efekt magnifikacji jak w macOS Dock:

```javascript
// CSS properties sterowane przez JS:
// --dock-scale: 1.0 – 1.55
// --dock-y: 0px – -14px

// Maksymalne powiększenie: scale(1.55)
// Wzór: boost = scale * scale; item.style.setProperty('--dock-scale', (1 + boost * 0.55))
// Odległość aktywacji: 100px (horizontal), 120px (vertical)
```

```css
.dock-item {
  transform: scale(var(--dock-scale, 1)) translateY(var(--dock-y, 0));
  transition: transform var(--transition-spring);
}
```

**Mobile (`.dock`):** pozioma belka na dole, ikony + etykiety
**Desktop (`.dock-v`):** pionowy sidebar 240px, ikona + etykieta obok siebie

### 6.8. Kolory statusów sesji

| Status | Kolor | Zmienna |
|--------|-------|---------|
| scheduled | Niebieski | `--primary` |
| completed | Zielony | `--success` |
| cancelled + płatna | Pomarańczowy | `--warning` |
| cancelled + niepłatna | Czerwony | `--danger` |

### 6.9. Ekran logowania (Bold Editorial)

```css
/* Gradient tekst */
.login-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.5rem, 6vw, 4rem);
  background: linear-gradient(135deg, #007AFF, #5AC8FA, #34C759);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Animowane szklane orby */
.glass-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.3;
  animation: floatOrb 8s ease-in-out infinite;
}
```

---

## 7. MODEL DANYCH (PEŁNA SPECYFIKACJA JSON)

### 7.1. Struktura główna `gabinet-data.json`

```javascript
{
  "version": "1.0",
  "lastSync": "2025-06-01T10:30:00.000Z",  // ISO timestamp

  "settings": { /* patrz 7.2 */ },
  "patients": [ /* patrz 7.3 */ ],
  "sessions": [ /* patrz 7.4 */ ],
  "payments": [ /* patrz 7.5 */ ],
  "sessionNotes": [ /* patrz 7.6 */ ],
  "progressEntries": [ /* patrz 7.7 */ ],
  "blockedPeriods": [ /* patrz 7.8 */ ],
  "invoices": []  // zarezerwowane, zawsze puste
}
```

### 7.2. settings

```javascript
{
  "therapistName": "Jan Kowalski",
  "therapistAddress": "ul. Przykładowa 1, Warszawa",
  "therapistNIP": "1234567890",  // 10 cyfr, walidacja w formularzu
  "workingHoursStart": "08:00",  // legacy — nieużywane, zastąpione przez workingHours
  "workingHoursEnd": "20:00",    // legacy
  "encryptionKeyHash": "",       // legacy — nieużywane
  "workingHours": {
    "monday":    { "enabled": false, "start": "08:00", "end": "16:00" },
    "tuesday":   { "enabled": true,  "start": "08:00", "end": "20:00" },
    "wednesday": { "enabled": true,  "start": "08:00", "end": "20:00" },
    "thursday":  { "enabled": true,  "start": "08:00", "end": "20:00" },
    "friday":    { "enabled": false, "start": "08:00", "end": "16:00" }
  }
}
```

### 7.3. patients[] — pojedynczy pacjent

```javascript
{
  "id": "uuid-v4",
  "firstName": "Anna",
  "lastName": "Nowak",
  "pseudonym": "Motyl",          // wymagany, unikalny w całej bazie
  "therapyStartDate": "2024-01-15",  // yyyy-mm-dd
  "sessionDays": ["tuesday", "thursday"],  // możliwe: monday-friday
  "sessionTimes": {
    "tuesday": "10:00",
    "thursday": "14:00"
  },
  "sessionsPerWeek": 1,          // 1 lub 2
  "sessionRate": 200,            // PLN, liczba całkowita lub dziesiętna
  "sessionNumberOffset": 35,     // łączna liczba sesji z poprzednich terapii (0 jeśli brak)
  "vacationPeriods": [
    {
      "id": "uuid-v4",
      "startDate": "2024-07-01",
      "endDate": "2024-07-31"
    }
  ],
  "isArchived": false,
  "archivedDate": null,          // yyyy-mm-dd gdy zarchiwizowany
  "therapyCycles": [
    {
      "id": "uuid-v4",
      "startDate": "2024-01-15",
      "endDate": null,           // null = aktualny cykl
      "cycleNumber": 1
    }
  ],
  "therapeuticGoals": [
    {
      "id": "uuid-v4",
      "title": "Redukcja lęku społecznego",
      "description": "BASE64_AES256GCM_ENCRYPTED",  // szyfrowane
      "status": "inProgress",    // inProgress | achieved | abandoned
      "dateSet": "2024-01-15",
      "dateAchieved": null
    }
  ],
  "previousTherapies": {
    "count": 2,                  // 0-5
    "therapies": [
      { "startDate": "2020-01-10", "endDate": "2021-06-30" },
      { "startDate": "2022-03-01", "endDate": "2023-12-15" }
    ],
    "totalSessions": 35,         // łączna liczba sesji z poprzednich terapii
    "notes": "Tekst notatek o poprzednich terapiach"
  },
  "generalNotes": "Dodatkowe informacje o pacjencie"
}
```

### 7.4. sessions[] — pojedyncza sesja

```javascript
{
  "id": "uuid-v4",
  "patientId": "uuid-v4",          // FK → patients[].id
  "date": "2024-03-15",            // yyyy-mm-dd
  "time": "10:00",                 // HH:MM
  "status": "completed",           // scheduled | completed | cancelled
  "isPaymentRequired": true,       // true = sesja wlicza się do płatności
  "isPaid": false,                 // true gdy payment.sessionIds zawiera to id
  "paymentId": null,               // uuid | null → FK → payments[].id
  "sessionNumber": 3,              // = cycleSessionNumber (dla kompatybilności)
  "cycleSessionNumber": 3,         // numer w bieżącej terapii: 1, 2, 3...
  "globalSessionNumber": 38,       // łącznie z poprzednimi: cycleSessionNumber + sessionNumberOffset
  "wasRescheduled": false,         // true gdy przeniesiona na inny termin
  "originalDate": null,            // yyyy-mm-dd jeśli wasRescheduled=true
  "originalTime": null,            // HH:MM jeśli wasRescheduled=true
  "notes": "BASE64_AES256GCM_ENCRYPTED",  // szyfrowana notatka do sesji
  "cancellationReason": null       // null | "patient" | "therapist" | "patient_vacation"
}
```

**Reguły numeracji sesji:**
- Numerowane są tylko sesje z `status === 'completed'` LUB `status === 'cancelled' && isPaymentRequired === true`
- `cycleSessionNumber` — bieżąca terapia, liczy od 1 niezależnie od poprzednich
- `globalSessionNumber = cycleSessionNumber + patient.sessionNumberOffset`
- Wyświetlanie: `"Sesja nr 3 (38)"` — gdzie 3 = cycleSessionNumber, 38 = globalSessionNumber

### 7.5. payments[] — pojedyncza płatność

```javascript
{
  "id": "uuid-v4",
  "patientId": "uuid-v4",          // FK → patients[].id
  "date": "2024-03-20",            // data wpłaty, yyyy-mm-dd
  "amount": 400,                   // kwota PLN (edytowalna, domyślnie: count * sessionRate)
  "method": "aliorBank",           // aliorBank | ingBank | cash
  "sessionIds": ["uuid-1", "uuid-2"],  // FK[] → sessions[].id
  "sessionsCount": 2,              // = sessionIds.length
  "note": ""                       // opcjonalna notatka
}
```

### 7.6. sessionNotes[] — notatka do sesji

```javascript
{
  "id": "uuid-v4",
  "patientId": "uuid-v4",
  "sessionId": "uuid-v4",          // null jeśli nie przypisana do sesji
  "date": "2024-03-15",
  "content": "BASE64_AES256GCM_ENCRYPTED",
  "createdAt": "2024-03-15T10:30:00.000Z",
  "modifiedAt": "2024-03-15T10:30:00.000Z"
}
```

### 7.7. progressEntries[] — wpis postępu

```javascript
{
  "id": "uuid-v4",
  "patientId": "uuid-v4",
  "sessionId": "uuid-v4",          // null jeśli nie przypisany
  "date": "2024-03-15",
  "category": "Przełom",           // Przełom | Obserwacja | Zmiana | Inne
  "title": "Tytuł wpisu",
  "content": "BASE64_AES256GCM_ENCRYPTED"
}
```

### 7.8. blockedPeriods[] — urlop/blokada terapeuty

```javascript
{
  "id": "uuid-v4",
  "startDate": "2024-07-01",
  "endDate": "2024-07-21",
  "reason": "Urlop letni"
}
```

---

## 8. LOCALSTORAGE — KLUCZE I ZNACZENIE

| Klucz | Typ | Znaczenie |
|-------|-----|-----------|
| `gabinet_access_token` | string | Access token Google OAuth |
| `gabinet_token_expiry` | string (timestamp ms) | Czas wygaśnięcia tokena |
| `gabinet_user_email` | string | Email zalogowanego użytkownika |
| `gabinet_data_cache` | JSON string | Kopia danych offline (dla Service Worker) |
| `gabinet_encryption_key` | base64 string | Klucz AES-256 do szyfrowania notatek |
| `lastSessionGenMonth` | string "yyyy-mm" | Ostatni miesiąc automatycznej generacji sesji |

> **KRYTYCZNE:** `gabinet_encryption_key` — utrata tego klucza = utrata dostępu do wszystkich zaszyfrowanych notatek. Brak mechanizmu recovery!

---

## 9. SERVICE WORKER — STRATEGIA CACHE

**Nazwa cache:** `gabinet-v11`
*(przy każdej zmianie pliku SW należy zwiększyć numer)*

**Strategia:** Cache-first z fallback na sieć

```javascript
// Przy fetch:
// 1. Sprawdź cache → zwróć jeśli jest
// 2. Fetch z sieci → zapisz do cache
// 3. Jeśli brak sieci i document → zwróć ./index.html z cache

// Google APIs NIE są cache'owane:
// accounts.google.com, apis.google.com, www.googleapis.com, oauth2.googleapis.com
```

**Cached assets (aktualne):**
```javascript
'./', './index.html',
'./css/main.css', './css/calendar.css', './css/components.css',
'./js/config.js', './js/app.js', './js/auth.js', './js/drive.js',
'./js/encryption.js', './js/patients.js', './js/sessions.js',
'./js/calendar.js', './js/payments.js', './js/finance.js',
'./js/stats.js', './js/notes.js', './js/archive.js', './js/utils.js',
'https://cdn.jsdelivr.net/npm/chart.js'
```

---

## 10. NAWIGACJA I ROUTING

### 10.1. Hash-based routing

Format URL: `https://app.com/#/route/param/subparam`

| Hash | Widok | Opis |
|------|-------|------|
| `#/calendar` | view-calendar | Kalendarz (domyślny) |
| `#/patients` | view-patients | Lista pacjentów |
| `#/patients/new` | view-patient-form | Nowy pacjent |
| `#/patients/:id` | view-patient-detail | Szczegóły pacjenta |
| `#/patients/:id/edit` | view-patient-form | Edycja pacjenta |
| `#/finance` | view-finance | Dashboard finansowy |
| `#/finance/payments` | view-finance | Zakładka płatności |
| `#/stats` | view-stats | Statystyki |
| `#/settings` | view-settings | Ustawienia |
| `#/archive` | view-archive | Archiwum |

### 10.2. Elementy nawigacji

```html
<!-- Mobile: bottom nav -->
<nav id="bottom-nav" class="dock">
  <div class="dock-item" data-route="calendar">
    <span class="dock-icon">📅</span>
    <span class="dock-label">Kalendarz</span>
  </div>
  <!-- ... -->
</nav>

<!-- Desktop: sidebar nav -->
<nav id="sidebar-nav" class="dock dock-v">
  <div class="dock-item" data-route="calendar">
    <span class="dock-icon">📅</span>
    <span class="dock-label">Kalendarz</span>
  </div>
  <!-- ... -->
</nav>
```

### 10.3. 5 pozycji w menu

| Ikona | Etykieta | Route |
|-------|----------|-------|
| 📅 | Kalendarz | calendar |
| 👥 | Pacjenci | patients |
| 💰 | Finanse | finance |
| 📊 | Statystyki | stats |
| ⚙️ | Ustawienia | settings |

---

## 11. MODUŁ: AUTH (auth.js)

### 11.1. Odpowiedzialność

Google OAuth 2.0 z Google Identity Services (GIS). Zarządzanie tokenem, logowanie, wylogowanie, refresh tokena.

### 11.2. Kluczowe stałe

```javascript
const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;  // z config.js
const GOOGLE_API_KEY = CONFIG.GOOGLE_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
```

### 11.3. Flow logowania

1. User klika `#btn-google-login`
2. `tokenClient.requestAccessToken({ prompt: 'consent' })` → popup Google
3. Callback `handleTokenResponse(response)` → zapisuje token do localStorage
4. `initGapiClient()` → inicjalizuje `gapi.client` z Discovery API Drive v3
5. Pobiera email usera: `GET /oauth2/v2/userinfo`
6. Wywołuje `onLoginCallback()` → `App.onLogin()`

### 11.4. Token refresh

```javascript
// Token odświeżany gdy wygasa za < 60 sekund
async function ensureValidToken() {
  const expiry = localStorage.getItem('gabinet_token_expiry');
  if (expiry && Date.now() >= parseInt(expiry, 10) - 60000) {
    // tokenClient.requestAccessToken({ prompt: '' }) — bez UI
  }
}
```

### 11.5. Publiczne API

```javascript
Auth.init(onLogin, onLogout)  // inicjalizacja
Auth.getToken()               // zwraca access token string
Auth.getUserEmail()           // zwraca email string
Auth.isLoggedIn()             // boolean
Auth.ensureValidToken()       // Promise — odświeża token jeśli potrzeba
Auth.handleLogout()           // wylogowanie, revoke tokena
```

---

## 12. MODUŁ: DRIVE (drive.js)

### 12.1. Odpowiedzialność

Wszystkie operacje na Google Drive API v3. Jeden plik JSON jako baza danych.

### 12.2. Operacje Drive API

```javascript
// Szukanie pliku:
gapi.client.drive.files.list({
  q: "name='gabinet-data.json' and trashed=false",
  spaces: 'drive',
  fields: 'files(id, name, modifiedTime)'
})

// Tworzenie pliku (multipart):
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart

// Pobieranie zawartości:
GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media

// Aktualizacja:
PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media
```

### 12.3. Strategia zapisu

```
saveData(data)
  → zapisz do localStorage (gabinet_data_cache)
  → debouncedSave(data, 300ms)
    → performSave(data)
      → jeśli isSaving=true: zapisz do pendingSave
      → Auth.ensureValidToken()
      → PATCH file na Drive
      → jeśli 401: refresh token + retry
      → retry max 3 razy z backoff (1s, 2s, 3s)
      → setSyncStatus('synced'/'error')
      → po zakończeniu: jeśli pendingSave → performSave(pendingSave)
```

### 12.4. Default data

```javascript
function getDefaultData() {
  return {
    version: '1.0',
    lastSync: new Date().toISOString(),
    settings: {
      therapistName: '',
      therapistAddress: '',
      therapistNIP: '',
      workingHoursStart: '08:00',  // legacy
      workingHoursEnd: '20:00',    // legacy
      encryptionKeyHash: ''        // legacy
    },
    patients: [],
    sessions: [],
    payments: [],
    sessionNotes: [],
    progressEntries: [],
    blockedPeriods: [],
    invoices: []
  };
}
```

### 12.5. Publiczne API

```javascript
Drive.loadData()     // Promise → appData object
Drive.saveData(data) // void (debounced, async w tle)
Drive.forceSync()    // Promise → appData (resetuje cache fileId)
Drive.getDefaultData() // zwraca pustą strukturę danych
```

---

## 13. MODUŁ: ENCRYPTION (encryption.js)

### 13.1. Algorytm

**AES-256-GCM** przez Web Crypto API przeglądarki.

### 13.2. Format zaszyfrowanych danych

```
Base64( IV (12 bytes) + CipherText )
```

### 13.3. Klucz

- Generowany jednorazowo przez `crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 })`
- Eksportowany do base64 i zapisywany w `localStorage.gabinet_encryption_key`
- Przy kolejnym logowaniu importowany z localStorage

### 13.4. Kod encrypt/decrypt

```javascript
async function encrypt(text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText) {
  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
  // W catch: zwraca oryginalny tekst (dla legacy/błędów)
}
```

### 13.5. Co jest szyfrowane

- `sessions[].notes`
- `sessionNotes[].content`
- `patients[].therapeuticGoals[].description`
- `progressEntries[].content`

### 13.6. Publiczne API

```javascript
Encryption.init()           // ładuje/generuje klucz
Encryption.encrypt(text)    // Promise<string> — base64 ciphertext
Encryption.decrypt(b64str)  // Promise<string> — plaintext
```

---

## 14. MODUŁ: APP (app.js)

### 14.1. Odpowiedzialność

Główny kontroler: routing, inicjalizacja wszystkich modułów, globalny stan, ustawienia.

### 14.2. Kolejność inicjalizacji

```javascript
// DOMContentLoaded:
App.init()
  → registerServiceWorker()
  → Auth.init(onLogin, onLogout)
  → setupModalCloseHandlers()
  → jeśli Auth.isLoggedIn() → onLogin()

// onLogin():
  → Encryption.init()
  → appData = await Drive.loadData()
  → [uzupełnij brakujące tablice]
  → Patients.init(), Sessions.init(), Calendar.init()...
  → setupNavigation()
  → setupSettings()
  → Sessions.checkAndGenerateMonthlySessionsIfNeeded()
  → Drive.saveData(appData)
  → handleRoute()
  → checkUnpaidNotifications()
```

### 14.3. Notyfikacje nieopłaconych sesji

```javascript
// Przy starcie: jeśli pacjent ma >= 3 nieopłacone sesje → toast ostrzegawczy
function checkUnpaidNotifications() {
  appData.patients.filter(p => !p.isArchived).forEach(patient => {
    const unpaid = Patients.getUnpaidSessionsCount(patient.id, appData);
    if (unpaid >= 3) {
      Utils.showToast(`${patient.pseudonym} ma ${unpaid} nieopłaconych sesji`, 'warning');
    }
  });
}
```

### 14.4. Domyślne godziny pracy

```javascript
{
  monday:    { enabled: false, start: '08:00', end: '16:00' },
  tuesday:   { enabled: true,  start: '08:00', end: '20:00' },
  wednesday: { enabled: true,  start: '08:00', end: '20:00' },
  thursday:  { enabled: true,  start: '08:00', end: '20:00' },
  friday:    { enabled: false, start: '08:00', end: '16:00' }
}
```

### 14.5. Publiczne API

```javascript
App.navigate(route)   // zmień widok przez hash
App.getData()         // zwraca appData
App.saveAndRefresh()  // Drive.saveData + handleRoute
App.showView(viewId)  // przełącz aktywny widok
App.refreshViews()    // handleRoute()
```

---

## 15. MODUŁ: PATIENTS (patients.js)

### 15.1. Odpowiedzialność

CRUD pacjentów, lista, widok szczegółowy (7 zakładek).

### 15.2. Formularz dodawania/edycji pacjenta — pola

```
firstName         (text, wymagane)
lastName          (text, wymagane)
pseudonym         (text, wymagane, unikalny)
therapyStartDate  (date, wymagane)
sessionDays       (checkboxy: tuesday, wednesday, thursday + inne dni)
sessionTimes      (time input per dzień)
sessionsPerWeek   (radio: 1 | 2)
sessionRate       (number, PLN)
vacationPeriods   (dynamiczne, do 3: startDate + endDate + usuń)
```

### 15.3. Walidacja unikalności pseudonimu

```javascript
// Przy dodawaniu:
const duplicate = data.patients.find(p =>
  p.pseudonym.toLowerCase() === pseudonym.toLowerCase() && p.id !== editingId
);
```

### 15.4. Sortowanie listy pacjentów

Alfabetycznie po `lastName` (a-z). Aktywna filtracja przez searchbox po: `lastName`, `firstName`, `pseudonym`.

### 15.5. Wyświetlanie na liście

```html
<!-- DUŻY tekst: pseudonym -->
<span class="list-item-title">{pseudonym}</span>
<!-- MAŁY tekst: imię i nazwisko -->
<span class="list-item-subtitle">{lastName} {firstName}</span>
```

### 15.6. Widok szczegółowy — 7 zakładek

| ID zakładki | Nazwa | Zawartość |
|-------------|-------|-----------|
| `pd-info` | Informacje | Karty: pseudonim, imię/nazwisko, start terapii, dni/godziny sesji, stawka, czas trwania terapii. Przyciski: Edytuj, Archiwizuj |
| `pd-sessions` | Sesje | Filtry (Wszystkie/Odbyte/Zaplanowane/Nieopłacone), lista sesji |
| `pd-notes` | Notatki | Lista szyfrowanych notatek klinicznych + przycisk nowej |
| `pd-goals` | Cele | Lista celów terapeutycznych ze statusem + przycisk nowego |
| `pd-progress` | Postępy | Oś czasu wpisów postępu + przycisk nowego |
| `pd-prev-therapies` | Poprzednie terapie | Dropdown 0-5, daty terapii, łączna liczba sesji, notatki |
| `pd-cancelled` | Sesje odwołane | Lista sesji z `status=cancelled` z datą i powodem |

### 15.7. Archiwizacja

```javascript
// Archiwizacja: isArchived=true, archivedDate=today, usuń scheduled sessions
// Przywracanie: isArchived=false, nowy therapyCycle, nowe sessionDays/Times
```

### 15.8. getUnpaidSessionsCount

```javascript
function getUnpaidSessionsCount(patientId, data) {
  return data.sessions.filter(s =>
    s.patientId === patientId &&
    !s.isPaid &&
    (s.status === 'completed' || (s.status === 'cancelled' && s.isPaymentRequired))
  ).length;
}
```

---

## 16. MODUŁ: SESSIONS (sessions.js)

### 16.1. Generowanie sesji

```javascript
function generateSessionsForMonth(patient, monthDate) {
  // Dla każdego dnia miesiąca:
  // 1. Sprawdź czy dzień tygodnia jest w patient.sessionDays
  // 2. Sprawdź czy date >= patient.therapyStartDate
  // 3. Sprawdź czy NIE jest w patient.vacationPeriods
  // 4. Sprawdź czy NIE jest w data.blockedPeriods (urlopy terapeuty)
  // 5. Sprawdź czy sesja już nie istnieje (duplikat)
  // 6. Dodaj nową sesję ze statusem 'scheduled'
}
```

### 16.2. Auto-generacja co miesiąc

```javascript
// Uruchamiana przy każdym onLogin()
// Sprawdza localStorage.lastSessionGenMonth
// Jeśli !== current month → generuje i zapisuje nowy month key
function checkAndGenerateMonthlySessionsIfNeeded() {
  const currentMonth = Utils.getMonthKey(new Date()); // "2025-06"
  const lastGenMonth = localStorage.getItem('lastSessionGenMonth');
  if (lastGenMonth !== currentMonth) {
    generateSessionsForAllPatients(new Date());
    localStorage.setItem('lastSessionGenMonth', currentMonth);
  }
}
```

### 16.3. Algorytm numeracji sesji

```javascript
function recalculateAllSessionNumbers(patientId) {
  // Sortuj sesje rosnąco po dacie i czasie
  // Zresetuj wszystkie numery do null
  // Iteruj po posortowanych:
  //   isNumbered = status==='completed' || (status==='cancelled' && isPaymentRequired===true)
  //   jeśli isNumbered:
  //     currentCount++
  //     session.cycleSessionNumber = currentCount           // 1, 2, 3...
  //     session.globalSessionNumber = currentCount + offset // 36, 37, 38...
  //     session.sessionNumber = currentCount               // alias
}
```

### 16.4. Format wyświetlania numeru sesji

```javascript
let numberStr = `Sesja nr ${session.cycleSessionNumber}`;
if (offset > 0 && session.globalSessionNumber) {
  numberStr += ` (${session.globalSessionNumber})`;
}
// Przykład: "Sesja nr 3 (38)"
```

### 16.5. Modal sesji — pola i zachowanie

```
date        — tylko wyświetlanie
time        — tylko wyświetlanie
patient     — pseudonym, tylko wyświetlanie
sessionNumber — "Sesja nr X (Y)" jeśli numerowana
wasRescheduled — info o oryginalnej dacie jeśli przeniesiona

Status (radio):
  - scheduled (Zaplanowana)
  - completed (Odbyła się)
  - cancelled (Nie odbyła się)

Gdy cancelled:
  - Toggle: "Sesja płatna" (ms-payment-required)
  - Gdy NIE płatna → pokaż radio: powód odwołania
    - patient (Odwołana przez pacjenta)
    - therapist (Odwołana przez terapeutę)
    - patient_vacation (Urlop pacjenta)

Informacja o płatności:
  - isPaid=true → "Opłacona ✓" + szczegóły (metoda, data, kwota)
  - isPaid=false → "Nieopłacona ✗" + link do Finansów

Notatka (textarea, szyfrowana przy zapisie)

Przenoszenie sesji:
  - Przycisk "Przenieś sesję" → formularz (nowa data + godzina)
  - Przycisk "Potwierdź przeniesienie"
  - WAŻNE: isPaid i paymentId NIE są resetowane przy przeniesieniu
```

### 16.6. Statusy płatności przy przenoszeniu

```javascript
// KLUCZOWE: przeniesienie sesji NIE resetuje statusu płatności
// session.date = newDate
// session.time = newTime
// session.wasRescheduled = true
// session.originalDate = oldDate
// session.isPaid i session.paymentId — NIEZMIENIONE
```

### 16.7. Regeneracja miesiąca (Ustawienia)

```javascript
function regenerateMonth(year, month) {
  // Usuwa TYLKO scheduled+unpaid sesje w danym miesiącu
  // NIE usuwa: completed, cancelled, scheduled+paid
  // Generuje nowe sesje dla wszystkich aktywnych pacjentów
  // Przelicza numery sesji dla wszystkich pacjentów z sesjami w tym miesiącu
  return { removedCount, newCount }
}
```

---

## 17. MODUŁ: CALENDAR (calendar.js)

### 17.1. Trzy widoki

- **Miesiąc** — siatka 7×6 z chipami sesji
- **Tydzień** — siatka Pn–Pt × godziny pracy z kolorowymi blokami sesji
- **Dzień** — lista sesji na wybrany dzień ze szczegółami

### 17.2. Kliknięcie sesji

Każdy chip/blok sesji → `Sessions.showSessionModal(sessionId)`.

### 17.3. Podświetlenie godzin pracy

W widoku tygodniowym: godziny poza `settings.workingHours` tło szare.

### 17.4. Automatyczna nawigacja

Przyciski ← → zmieniają tydzień/miesiąc/dzień. Przycisk "Dziś" wraca do today.

---

## 18. MODUŁ: PAYMENTS (payments.js)

### 18.1. Rejestracja płatności — flow

1. Wybierz pacjenta → załaduj nieopłacone sesje
2. Zaznacz checkboxy sesji → auto-wylicz kwotę (liczba × stawka)
3. **Kwota jest edytowalna** — można wpisać inną wartość niż wyliczona
4. Wybierz datę i metodę (Alior/ING/Gotówka)
5. Zapisz → sesje oznaczone isPaid=true, paymentId=payment.id

### 18.2. Nieopłacone sesje widoczne w liście wyboru

```javascript
// Kwalifikują się do płatności:
s.patientId === patientId &&
!s.isPaid &&
(s.status === 'scheduled' || s.status === 'completed' ||
 (s.status === 'cancelled' && s.isPaymentRequired))
```

### 18.3. Metody płatności

| Kod | Etykieta |
|-----|----------|
| `aliorBank` | Alior Bank |
| `ingBank` | ING Bank |
| `cash` | Gotówka |

### 18.4. Edycja płatności

- Usuwa stare `isPaid=true` z sesji ze starego payment
- Ustawia nowe wartości
- Przywraca `amount` z płatności (zachowuje edytowaną kwotę)

---

## 19. MODUŁ: FINANCE (finance.js)

### 19.1. Chart.js — wykres przychodów

Stacked bar chart (słupkowy):
- Os X: miesiące (etykiety z POLISH_MONTHS)
- Os Y: PLN
- Datasets: Alior (czerwony #CC0000), ING (pomarańczowy #FF6600), Gotówka (zielony #34C759)
- Selector: 3 / 6 / 12 miesięcy

### 19.2. Zakładki widoku finansów

- `fin-chart` — wykres przychodów
- `fin-payments` — lista płatności z filtrami

---

## 20. MODUŁ: STATS (stats.js)

### 20.1. Karty statystyk

```
Sesje: łącznie, odbyte, średnia/tydzień, średnia/miesiąc, wskaźnik odwołań, nowi pacjenci
Finanse: łączny przychód, średni/miesiąc, średnia kwota płatności
         suma Alior, suma ING, suma Gotówka
Trendy: zmiana % vs poprzedni okres (strzałka ↑↓), najlepszy miesiąc, najgorszy miesiąc
```

### 20.2. Zakres dat

- Presety: 3M / 6M / 12M
- Custom: datepicker od–do
- Domyślny: ostatnie 6 miesięcy

### 20.3. Wykresy w stats

- Liniowy: sesje w czasie (odbyte vs odwołane)
- Stacked area: wpłaty wg metody

---

## 21. MODUŁ: NOTES (notes.js)

### 21.1. Trzy podmoduły

**Notatki kliniczne** (`sessionNotes`)
- Powiązane z sesją lub nie
- Treść szyfrowana AES-256-GCM
- Wyświetlane jako lista z datą i podglądem

**Cele terapeutyczne** (`patients[].therapeuticGoals`)
- Tytuł, opis (szyfrowany), status (inProgress/achieved/abandoned)
- Data ustalenia, data osiągnięcia
- Badge kolorowy wg statusu

**Postępy** (`progressEntries`)
- Kategoria: Przełom / Obserwacja / Zmiana / Inne
- Tytuł, treść (szyfrowana), data
- Wyświetlane jako oś czasu

### 21.2. Szyfrowanie w notes.js

```javascript
// Zapis: const encrypted = await Encryption.encrypt(content);
// Odczyt: const plaintext = await Encryption.decrypt(note.content);
```

---

## 22. MODUŁ: ARCHIVE (archive.js)

### 22.1. Archiwizacja pacjenta

```javascript
patient.isArchived = true;
patient.archivedDate = Utils.todayISO();
// Usuń scheduled sessions dla tego pacjenta
data.sessions = data.sessions.filter(s =>
  s.patientId !== patientId || s.status !== 'scheduled'
);
```

### 22.2. Przywracanie pacjenta

Modal z formularzem:
- Nowa data startu terapii
- Dni sesji (do nowego cyklu)
- Godziny sesji

```javascript
patient.isArchived = false;
patient.archivedDate = null;
patient.therapyStartDate = newStartDate;
patient.sessionDays = newDays;
patient.sessionTimes = newTimes;
patient.therapyCycles.push({
  id: generateUUID(),
  startDate: newStartDate,
  endDate: null,
  cycleNumber: patient.therapyCycles.length + 1
});
```

---

## 23. MODUŁ: UTILS (utils.js)

### 23.1. Wszystkie eksportowane funkcje i stałe

```javascript
// UUID
generateUUID()  // crypto.randomUUID() || fallback

// Daty
formatDatePL(dateStr)       // "15.03.2024"
formatDateLongPL(dateStr)   // "15 marca 2024"
formatDateISO(date)         // "2024-03-15"
getMonthKey(date)           // "2024-03"
getDayOfWeek(dateStr)       // "tuesday"
getDaysInMonth(year, month) // 28-31
getFirstDayOfMonth(y, m)    // 0-6
getWeekDates(date)          // Array[7] Date objects (Pn-Nd)
isDateInRange(d, s, e)      // boolean
getMonthsBetween(s, e)      // integer

// Formatowanie
formatCurrency(amount)      // "1 200 zł" (Intl pl-PL)
formatTime(timeStr)         // "HH:MM" (pierwsze 5 znaków)
calculateTherapyDuration(startDate) // "1 rok, 3 mies."

// UI
showToast(message, type)    // type: info|success|warning|error, auto-hide 3s
showModal(modalId)          // pokaż modal
hideModals()                // ukryj wszystkie modale
showConfirm(title, msg, cb) // modal potwierdzenia
debounce(fn, delay)         // klasyczny debounce

// Etykiety
getPaymentMethodLabel(method)  // "Alior Bank" | "ING Bank" | "Gotówka"
getStatusLabel(status)         // "Zaplanowana" | "Odbyła się" | "Nie odbyła się"
getGoalStatusLabel(status)     // "W toku" | "Osiągnięty" | "Nieaktualny"
escapeHtml(str)                // HTML-safe
todayISO()                     // "2024-03-15"

// Stałe (tablice)
POLISH_MONTHS           // ['Styczeń', 'Luty', ...]
POLISH_MONTHS_GENITIVE  // ['stycznia', 'lutego', ...]
POLISH_DAYS             // ['Niedziela', 'Poniedziałek', ...]
POLISH_DAYS_SHORT       // ['Nd', 'Pn', ...]
DAY_MAP                 // { sunday: 0, monday: 1, ... }
DAY_NAMES_PL            // { tuesday: 'Wtorek', ... }
```

---

## 24. STRUKTURA HTML — WIDOKI I MODALE

### 24.1. Struktura SPA

```html
<body>
  <!-- Ekran logowania (visible gdy niezalogowany) -->
  <div id="login-screen" class="active">
    ...btn-google-login...
  </div>

  <!-- Shell aplikacji (hidden gdy niezalogowany) -->
  <div id="app-shell" class="hidden">
    <header id="app-header">
      <button id="btn-back" class="hidden">←</button>
      <h1 id="header-title">Kalendarz</h1>
      <button id="btn-settings">⚙️</button>
      <div id="sync-indicator"></div>
    </header>

    <nav id="sidebar-nav" class="dock dock-v">
      <!-- desktop: 5 pozycji -->
    </nav>

    <main id="main-content">
      <!-- Widoki (tylko jeden active w danej chwili) -->
      <div id="view-calendar" class="view"></div>
      <div id="view-patients" class="view"></div>
      <div id="view-patient-detail" class="view"></div>
      <div id="view-patient-form" class="view"></div>
      <div id="view-finance" class="view"></div>
      <div id="view-stats" class="view"></div>
      <div id="view-settings" class="view"></div>
      <div id="view-archive" class="view"></div>
    </main>

    <nav id="bottom-nav" class="dock">
      <!-- mobile: 5 pozycji -->
    </nav>
  </div>

  <!-- Modale (poza shell, zawsze w DOM) -->
  <div id="modal-overlay" class="hidden">
    <div id="modal-session" class="modal hidden">...</div>
    <div id="modal-payment" class="modal hidden">...</div>
    <div id="modal-payment-detail" class="modal hidden">...</div>
    <div id="modal-note" class="modal hidden">...</div>
    <div id="modal-goal" class="modal hidden">...</div>
    <div id="modal-progress" class="modal hidden">...</div>
    <div id="modal-restore" class="modal hidden">...</div>
    <div id="modal-confirm" class="modal hidden">...</div>
  </div>

  <!-- Toasty -->
  <div id="toast-container"></div>
</body>
```

### 24.2. Kluczowe ID elementów

**Header:**
- `btn-back` — przycisk powrotu (hidden/visible)
- `header-title` — tytuł widoku
- `btn-settings` — otwiera ustawienia
- `sync-indicator` — kółko statusu sync (syncing/synced/error)

**Sesje (modal-session):**
- `ms-date`, `ms-time`, `ms-patient` — info tylko do odczytu
- `ms-number-info`, `ms-number` — numer sesji
- `ms-rescheduled-info`, `ms-original-date` — info o przeniesieniu
- `input[name="sessionStatus"]` — radio: scheduled/completed/cancelled
- `ms-cancelled-options` — container (hidden gdy nie cancelled)
- `ms-payment-required` — checkbox "sesja płatna"
- `ms-cancellation-reason` — container z radio powodu
- `input[name="cancellationReason"]` — radio: patient/therapist/patient_vacation
- `ms-payment-status`, `ms-payment-details`, `ms-payment-link` — status płatności
- `ms-reschedule-form` — formularz przeniesienia (hidden)
- `ms-new-date`, `ms-new-time` — nowe dane sesji
- `ms-btn-reschedule` — toggle formularza
- `ms-btn-confirm-reschedule` — potwierdź przeniesienie
- `ms-notes` — textarea notatki
- `ms-btn-save` — zapisz zmiany

**Płatności (modal-payment):**
- `mp-title` — "Zarejestruj płatność" / "Edytuj płatność"
- `mp-patient` — select pacjenta
- `mp-sessions-list` — lista checkboxów sesji
- `mp-count` — liczba zaznaczonych sesji
- `mp-amount` — kwota (input number, edytowalny!)
- `input[name="paymentMethod"]` — radio: aliorBank/ingBank/cash
- `mp-date` — data wpłaty
- `mp-btn-save` — zapisz

**Ustawienia (view-settings):**
- `set-name`, `set-address`, `set-nip` — dane terapeuty
- `set-google-email` — email konta Google
- `working-hours-list` — lista wierszy `.working-day-row[data-day="monday"...]`
  - `.wh-enabled` (checkbox), `.wh-start`, `.wh-end` (time inputs)
- `blocked-periods-list` — lista `.blocked-item`
  - `.blocked-start`, `.blocked-end` (date), `.blocked-reason` (text)
- `btn-add-blocked` — dodaj blokadę
- `btn-save-settings` — zapisz ustawienia
- `btn-force-sync` — wymusz sync
- `btn-reset-data` — reset wszystkich danych
- `regen-month` — input[type=month] do regeneracji
- `btn-regen-month` — regeneruj wybrany miesiąc
- `set-last-sync` — ostatnia synchronizacja (czas)

**Poprzednie terapie (zakładka pacjenta):**
- `pt-count` — select 0-5
- `pt-therapies-list` — dynamicznie generowane pola start/koniec
- `pt-total-sessions-group` — container (hidden gdy count=0)
- `pt-total-sessions` — input number
- `pt-notes-group` — container
- `pt-notes` — textarea
- `btn-save-prev-therapies` — zapisz

---

## 25. LOGIKA BIZNESOWA — KLUCZOWE ALGORYTMY

### 25.1. Kiedy sesja dostaje numer?

```
status === 'completed'
  → ZAWSZE dostaje numer

status === 'cancelled' && isPaymentRequired === true
  → dostaje numer (odwołana w ostatniej chwili, płatna)

status === 'cancelled' && isPaymentRequired === false
  → NIE dostaje numeru (odwołana z wyprzedzeniem, niepłatna)

status === 'scheduled'
  → NIE dostaje numeru
```

### 25.2. Numeracja — format wyświetlania

```
Jeśli patient.sessionNumberOffset > 0:
  "Sesja nr 3 (38)" — gdzie 3 = numer w bieżącej terapii, 38 = łącznie

Jeśli patient.sessionNumberOffset === 0:
  "Sesja nr 3" — tylko numer bieżący
```

### 25.3. Generowanie sesji — lista warunków blokujących

```
data < patient.therapyStartDate          → pomiń
dayOfWeek ∉ patient.sessionDays          → pomiń
data ∈ patient.vacationPeriods           → pomiń
data ∈ data.blockedPeriods               → pomiń (urlopy terapeuty)
session z tą datą już istnieje           → pomiń (duplikat)
```

### 25.4. Przenoszenie sesji — co się zmienia, co nie

```
ZMIENIA SIĘ:
  session.date = newDate
  session.time = newTime
  session.wasRescheduled = true
  session.originalDate = (stara data)
  session.originalTime = (stara godzina)

NIE ZMIENIA SIĘ (WAŻNE!):
  session.isPaid
  session.paymentId
  session.status
  session.isPaymentRequired
```

### 25.5. Rejestracja płatności — co się zmienia

```
Przy zapisaniu payment:
  payment.sessionIds.forEach(sid => {
    session.isPaid = true
    session.paymentId = payment.id
  })

Przy usunięciu payment:
  payment.sessionIds.forEach(sid => {
    session.isPaid = false
    session.paymentId = null
  })
```

### 25.6. Archiwizacja — co się usuwa

```
Przy archiwizacji pacjenta:
  patient.isArchived = true
  patient.archivedDate = today
  USUWANE: sessions gdzie patientId === patient.id && status === 'scheduled'
  POZOSTAJĄ: completed, cancelled sessions
```

### 25.7. Kwota płatności — logika edycji

```
Domyślna kwota = (liczba zaznaczonych sesji) × patient.sessionRate
Kwota jest edytowalna (input number)
Przy edycji istniejącej płatności → przywracana jest zapisana kwota (może się różnić od wyliczonej)
```

---

## 26. EKRAN LOGOWANIA

### 26.1. HTML struktura

```html
<div id="login-screen" class="active">
  <div class="login-orbs">
    <div class="glass-orb orb-1"></div>
    <div class="glass-orb orb-2"></div>
    <div class="glass-orb orb-3"></div>
  </div>
  <div class="login-card">
    <h1 class="login-title">Gabinet Terapeutyczny</h1>
    <p class="login-subtitle">Twój cyfrowy asystent gabinetu psychoterapeutycznego</p>
    <button id="btn-google-login" class="btn-google">
      <img src="[google-icon]" alt="Google">
      Zaloguj przez Google
    </button>
    <p class="login-note">Dane przechowywane bezpiecznie na Twoim Google Drive</p>
  </div>
</div>
```

### 26.2. Animowane orby CSS

```css
.glass-orb {
  position: absolute; border-radius: 50%;
  filter: blur(60px); opacity: 0.3;
  animation: floatOrb 8s ease-in-out infinite;
}
.orb-1 { width: 300px; height: 300px; background: var(--primary); top: -50px; left: -50px; }
.orb-2 { width: 200px; height: 200px; background: var(--success); bottom: 10%; right: -30px; animation-delay: -3s; }
.orb-3 { width: 150px; height: 150px; background: var(--warning); top: 40%; left: 20%; animation-delay: -5s; }

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(20px, -30px) scale(1.05); }
  66% { transform: translate(-10px, 20px) scale(0.95); }
}
```

### 26.3. Google Fonts — ładowanie

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
```

---

## 27. MANIFEST PWA

```json
{
  "name": "Gabinet Terapeutyczny",
  "short_name": "Gabinet",
  "description": "Zarządzanie gabinetem psychoterapeutycznym",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#F2F2F7",
  "theme_color": "#007AFF",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 27.1. Meta tagi PWA w `<head>`

```html
<meta name="theme-color" content="#007AFF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Gabinet">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="manifest" href="manifest.json">
```

---

## 28. CI/CD — GITHUB PAGES

### 28.1. `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### 28.2. URL po deployu

`https://pawelszmit.github.io/Gabinet/`

### 28.3. Lokalne uruchomienie

Wymaga serwera HTTP (nie działa z `file://`):
```bash
python3 -m http.server 8000
# lub
npx serve .
```

Otworzyć: `http://localhost:8000`

---

## 29. ZNANE PROBLEMY I OBEJŚCIA

### 29.1. git-filter-repo

Przy czyszczeniu historii:
```bash
# Nie działa jako git subkomenda:
git filter-repo --path js/config.js --invert-paths

# Działa jako python moduł:
python3 -m git_filter_repo --path js/config.js --invert-paths

# Po filter-repo trzeba dodać remote:
git remote add origin https://github.com/PawelSzmit/Gabinet.git
git push --force origin main
```

### 29.2. config.js i bezpieczeństwo

Browser-side Google OAuth Client ID i API Key są **z natury publiczne** — zabezpieczenie zapewniają ograniczenia HTTP referrer w Google Cloud Console, nie ukrywanie kluczy.

### 29.3. Szyfrowanie — utrata klucza

Klucz AES-256 w `localStorage.gabinet_encryption_key`. Wyczyszczenie localStorage = utrata dostępu do zaszyfrowanych notatek. Brak mechanizmu backup/recovery.

### 29.4. Cache Service Worker

Przy każdej zmianie pliku `service-worker.js` zwiększyć `CACHE_NAME` np. z `gabinet-v11` na `gabinet-v12`. Bez tego stary cache może nadal działać u użytkowników.

### 29.5. Generacja sesji — tylko bieżący miesiąc

Auto-generacja działa tylko dla bieżącego miesiąca. Poprzednie miesiące wymagają ręcznej regeneracji z Ustawień.

### 29.6. Chart.js z CDN

Biblioteka ładowana z `https://cdn.jsdelivr.net/npm/chart.js`. Brak versji pinned — może się zmienić. Alternatywnie: pobrać lokalnie i dodać do repo.

---

## LISTA KONTROLNA ODBUDOWY

- [ ] Sklonuj repo: `git clone https://github.com/PawelSzmit/Gabinet.git`
- [ ] Utwórz projekt w Google Cloud Console
- [ ] Włącz Google Drive API
- [ ] Utwórz OAuth 2.0 Client ID (Web application)
- [ ] Utwórz API Key
- [ ] Dodaj domenę do HTTP referrer restrictions
- [ ] Skopiuj `js/config.example.js` → `js/config.js` i uzupełnij klucze
- [ ] Przetestuj lokalnie: `python3 -m http.server 8000`
- [ ] Wdróż na hosting z HTTPS
- [ ] Zaktualizuj Authorized JavaScript origins w OAuth Client ID

---

*Dokument wygenerowany: 2026-03-25*
*Wersja cache SW: gabinet-v11*
*Wersja danych: 1.0*
