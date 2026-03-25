# BRIEF: Gabinet Terapeutyczny — Kompletna dokumentacja aplikacji

> Dokument źródłowy dla AI do przygotowania raportu rozwojowo-marketingowego.
> Zawiera pełny opis funkcji, architektury, designu, modelu danych i stanu aplikacji.

---

## 1. Informacje ogólne

| Parametr | Wartość |
|----------|---------|
| Nazwa | Gabinet Terapeutyczny |
| Nazwa skrócona | Gabinet |
| Typ | Progressive Web App (PWA) |
| Język interfejsu | Polski |
| Grupa docelowa | Psychoterapeuci prowadzący prywatny gabinet (1-osobowa praktyka) |
| Aktualny hosting | GitHub Pages (https://pawelszmit.github.io/Gabinet/) |
| Planowany hosting | VPS OVH Cloud z własną domeną |
| Repozytorium | https://github.com/PawelSzmit/Gabinet (prywatne) |
| Stan | MVP — w pełni funkcjonalna, używana przez autora |
| Licencja | Prywatna, wszelkie prawa zastrzeżone |
| Autor | Paweł Szmit (nie-programista, buduje aplikację z pomocą AI) |

---

## 2. Problem i propozycja wartości

### Problem
Psychoterapeuci prowadzący prywatne gabinety zarządzają pacjentami, sesjami, płatnościami i notatkami klinicznymi za pomocą papierowych kalendarzy, arkuszy Excel lub ogólnych narzędzi (Google Calendar, Notion), które:
- nie zapewniają szyfrowania danych wrażliwych (notatki kliniczne),
- nie automatyzują generowania cyklicznych sesji,
- nie śledzą płatności per sesja,
- nie oferują pseudonimizacji pacjentów,
- wymagają ręcznego prowadzenia statystyk.

### Propozycja wartości
Jedna aplikacja dedykowana psychoterapeutom, która:
- automatycznie generuje kalendarz sesji na podstawie harmonogramu pacjenta,
- szyfruje notatki kliniczne (AES-256-GCM) przed zapisem,
- śledzi płatności z przypisaniem do konkretnych sesji,
- używa pseudonimów dla ochrony tożsamości pacjentów,
- generuje statystyki i wykresy przychodów,
- synchronizuje dane przez Google Drive (bez własnego serwera/bazy danych),
- działa offline dzięki Service Worker,
- instaluje się na telefonie/tablecie jak natywna aplikacja.

---

## 3. Funkcjonalności — szczegółowy opis

### 3.1. Kalendarz sesji

**Trzy widoki:**
- **Miesięczny** — siatka z chipami sesji w kolorach statusu
- **Tygodniowy** (Pn–Pt) — siatka godzinowa z podświetleniem godzin pracy
- **Dzienny** — szczegółowy plan dnia z godzinami i statusami

**Automatyzacja:**
- Sesje generowane automatycznie na bieżący miesiąc przy pierwszym logowaniu w danym miesiącu
- Algorytm uwzględnia: dni sesji pacjenta, datę rozpoczęcia terapii, urlopy pacjenta, urlopy terapeuty (blokowane okresy)
- Regeneracja kalendarza na wybrany miesiąc (z zachowaniem sesji odbytych i odwołanych)

**Nawigacja:**
- Przyciski Poprzedni/Następny (miesiąc, tydzień, dzień)
- Przycisk „Dziś" — skok do bieżącej daty
- Przełącznik widoków (M/T/D)

**Kolory sesji:**
- Niebieski — zaplanowana
- Zielony — odbyta
- Pomarańczowy — odwołana, płatna
- Czerwony — odwołana, niepłatna

### 3.2. Zarządzanie pacjentami

**Dane pacjenta:**
- Imię, nazwisko, pseudonim (wymagany, unikalny)
- Data rozpoczęcia terapii
- Dni sesji (checkboxy: Wt/Śr/Czw + dowolne)
- Godzina sesji na każdy dzień
- Stawka za sesję (PLN)
- Liczba sesji na tydzień (1 lub 2)
- Do 3 okresów urlopowych (data start–koniec)
- Notatki ogólne

**Lista pacjentów:**
- Sortowanie alfabetyczne po nazwisku
- Wyszukiwanie po imieniu/nazwisku/pseudonimie
- Badge z liczbą nieopłaconych sesji
- Pseudonim wyświetlany dużą czcionką, imię i nazwisko małą (priorytet prywatności)

**Widok szczegółowy pacjenta — 7 zakładek:**

1. **Informacje** — karty z danymi: pseudonim, imię/nazwisko, data startu, dni sesji, stawka, czas trwania terapii
2. **Sesje** — lista sesji z filtrami (Wszystkie/Odbyte/Zaplanowane/Nieopłacone), kliknięcie otwiera modal sesji
3. **Notatki** — szyfrowane notatki kliniczne z datą, podgląd odszyfrowanego tekstu
4. **Cele** — cele terapeutyczne ze statusem (W toku / Osiągnięty / Nieaktualny), datą ustalenia i osiągnięcia
5. **Postępy** — oś czasu wpisów z kategorią (Przełom / Obserwacja / Zmiana / Inne)
6. **Poprzednie terapie** — ilość (0–5), daty start/koniec każdej, łączna liczba sesji z poprzednich terapii, notatki; numeracja sesji kontynuuje z uwzględnieniem offsetu
7. **Sesje odwołane** — lista odwołanych sesji z datą i powodem (przez terapeutę / urlop pacjenta / przez pacjenta / w ostatniej chwili — płatna)

**Archiwizacja:**
- Pacjent przenoszony do archiwum, zaplanowane sesje usuwane
- Przywracanie z archiwum: nowy cykl terapii, nowa data startu, nowe dni/godziny

### 3.3. Zarządzanie sesjami

**Statusy sesji:**
| Status | Opis | Numeracja |
|--------|------|-----------|
| `scheduled` | Zaplanowana (domyślny) | Nie |
| `completed` | Odbyta | Tak |
| `cancelled` + płatna | Odwołana w ostatniej chwili | Tak |
| `cancelled` + niepłatna | Odwołana z wyprzedzeniem | Nie |

**Modal sesji zawiera:**
- Data, godzina, pseudonim pacjenta
- Numer sesji (format: „Sesja nr 3 (38)" — bieżąca terapia + łącznie z poprzednimi)
- Informacja o przeniesieniu (jeśli dotyczy)
- Radio buttony statusu
- Opcje odwołania: toggle „Sesja płatna" + powód odwołania (przez pacjenta / przez terapeutę / urlop pacjenta)
- Informacja o płatności (status, kwota, metoda)
- Notatka do sesji (textarea, szyfrowana)
- Formularz przeniesienia (nowa data + godzina)

**Numeracja sesji:**
- `cycleSessionNumber` — numer w bieżącej terapii (1, 2, 3...)
- `globalSessionNumber` — łącznie z poprzednimi terapiami (36, 37, 38...)
- Offset pochodzi z zakładki „Poprzednie terapie"
- Przenumerowanie automatyczne po każdej zmianie statusu

### 3.4. Płatności

**Rejestracja płatności:**
1. Wybierz pacjenta z listy rozwijanej
2. Wyświetlona lista nieopłaconych sesji z checkboxami
3. Zaznacz sesje do opłacenia
4. Automatyczne przeliczenie kwoty (liczba sesji × stawka)
5. Wybierz datę i metodę płatności
6. Zapisz — sesje oznaczone jako opłacone

**Metody płatności:**
| Kod | Nazwa | Kolor na wykresie |
|-----|-------|-------------------|
| `aliorBank` | Alior Bank | Czerwony (#CC0000) |
| `ingBank` | ING Bank | Pomarańczowy (#FF6600) |
| `cash` | Gotówka | Zielony (#34C759) |

**Zarządzanie:**
- Edycja istniejących płatności
- Usuwanie płatności (sesje wracają do statusu nieopłaconych)
- Filtrowanie po metodzie i zakresie dat
- Szczegóły płatności z listą opłaconych sesji

### 3.5. Finanse — dashboard

- **Wykres słupkowy** przychodów miesięcznych (Chart.js):
  - Słupki stacked wg metody płatności (Alior/ING/Gotówka)
  - Wybór okresu: 3 / 6 / 12 miesięcy
- **Zakładka Płatności** — pełna lista z filtrowaniem

### 3.6. Statystyki

**Zakres dat:**
- Presety: 3 / 6 / 12 miesięcy
- Własny zakres dat (datepickery)

**Karty statystyk:**
- Łączna liczba sesji
- Sesje odbyte
- Średnia sesji na tydzień
- Średnia sesji na miesiąc
- Wskaźnik odwołań (%)
- Nowi pacjenci w okresie
- Łączny przychód
- Średni przychód/miesiąc
- Średnia kwota płatności
- Sumy per metoda (Alior / ING / Gotówka)
- Trend przychodów vs poprzedni okres (% zmiana, strzałka góra/dół)
- Najlepszy miesiąc (kwota)
- Najgorszy miesiąc (kwota)

**Wykresy:**
- Liniowy: sesje w czasie (odbyte vs odwołane)
- Stacked area: wpłaty w czasie wg metody

### 3.7. Ustawienia

- Dane terapeuty: imię, adres, NIP
- Godziny pracy: per dzień tygodnia (Pn–Pt), checkbox włączony/wyłączony + godziny start/koniec
- Blokowane okresy (urlopy terapeuty): data start + koniec + powód, dodawanie/usuwanie
- Regeneracja kalendarza: wybór miesiąca, potwierdzenie, zachowanie sesji odbytych/odwołanych
- Konto Google: email zalogowanego użytkownika, przycisk wylogowania
- Synchronizacja: data ostatniej synchronizacji, przycisk ręcznej synchronizacji
- Informacje o aplikacji: wersja
- Strefa zagrożenia: reset wszystkich danych (z potwierdzeniem)

### 3.8. Archiwum

- Lista zarchiwizowanych pacjentów
- Informacje: imię/nazwisko, pseudonim, okres terapii, liczba sesji
- Przycisk przywracania z formularzem: nowa data startu, dni sesji, godziny

---

## 4. Architektura techniczna

### 4.1. Stack technologiczny

| Warstwa | Technologia | Uwagi |
|---------|-------------|-------|
| Frontend | Vanilla JavaScript (ES6+) | Brak frameworka (React/Vue/Angular) |
| HTML | Jeden plik `index.html` (SPA) | ~782 linii |
| CSS | 3 pliki, ~2511 linii łącznie | Brak preprocesora (SASS/Less) |
| Wykresy | Chart.js (CDN) | Jedyna zewnętrzna biblioteka JS |
| Fonty | Google Fonts: Playfair Display | Ekran logowania |
| Uwierzytelnianie | Google OAuth 2.0 (GIS) | Biblioteki Google ładowane z CDN |
| Przechowywanie danych | Google Drive API v3 | Jeden plik JSON na Drive użytkownika |
| Szyfrowanie | Web Crypto API (AES-256-GCM) | Notatki kliniczne, cele, postępy |
| Offline | Service Worker (Cache API) | Cache-first strategy |
| PWA | manifest.json + SW | Instalowalna na urządzeniu |

### 4.2. Architektura aplikacji

```
┌─────────────────────────────────────────────────┐
│                    index.html                    │
│              (Single Page Application)           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ auth.js │→ │ config.js│  │ encryption.js │ │
│  └────┬────┘  └──────────┘  └───────────────┘ │
│       │                                        │
│  ┌────▼────┐                                   │
│  │ app.js  │ ← Router + Stan globalny          │
│  └────┬────┘                                   │
│       │                                        │
│  ┌────▼──────────────────────────────────────┐ │
│  │            Moduły funkcjonalne             │ │
│  │                                           │ │
│  │  patients.js  sessions.js   calendar.js   │ │
│  │  payments.js  finance.js    stats.js      │ │
│  │  notes.js     archive.js    utils.js      │ │
│  └───────────────────┬───────────────────────┘ │
│                      │                         │
│  ┌───────────────────▼───────────────────────┐ │
│  │              drive.js                      │ │
│  │     ↕ Google Drive API v3 (REST)          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
├─────────────────────────────────────────────────┤
│              service-worker.js                  │
│         (Cache-first + offline fallback)        │
└─────────────────────────────────────────────────┘
```

### 4.3. Wzorce architektoniczne

- **SPA z hash-routingiem** — nawigacja przez `#/calendar`, `#/patients`, `#/patients/:id` itd.
- **Moduły IIFE (Revealing Module Pattern)** — każdy plik JS eksportuje publiczne API przez `return { ... }`
- **Globalny obiekt danych** — jeden `appData` w `app.js`, przekazywany przez `App.getData()`
- **Debounced save** — zapis na Google Drive opóźniony o 300ms, z retry (3 próby)
- **Cache + Network fallback** — Service Worker obsługuje offline

### 4.4. Pliki i rozmiary

| Plik | Linie kodu | Rola |
|------|-----------|------|
| `index.html` | ~782 | Cała struktura HTML (widoki, modale, formularze) |
| `css/main.css` | ~802 | Zmienne, layout, nawigacja, login, dark mode |
| `css/components.css` | ~1277 | Przyciski, formularze, modale, listy, karty, badge |
| `css/calendar.css` | ~432 | Widoki kalendarza (miesiąc, tydzień, dzień) |
| `js/app.js` | ~437 | Router, inicjalizacja, stan globalny, ustawienia |
| `js/auth.js` | ~207 | Google OAuth 2.0, zarządzanie tokenem |
| `js/drive.js` | ~263 | CRUD na Google Drive, retry, cache lokalny |
| `js/encryption.js` | ~57 | AES-256-GCM, generowanie/ładowanie klucza |
| `js/patients.js` | ~710 | CRUD pacjentów, widok szczegółowy, poprzednie terapie |
| `js/sessions.js` | ~401 | Generowanie sesji, numeracja, modal, statusy |
| `js/calendar.js` | ~348 | Renderowanie kalendarza (3 widoki) |
| `js/payments.js` | ~320 | Rejestracja/edycja/usuwanie płatności |
| `js/finance.js` | ~132 | Dashboard finansowy, wykres przychodów |
| `js/stats.js` | ~394 | Statystyki, wykresy, karty |
| `js/notes.js` | ~417 | Notatki, cele, postępy (szyfrowane) |
| `js/archive.js` | ~185 | Archiwizacja i przywracanie pacjentów |
| `js/utils.js` | ~264 | Helpery, formatowanie, UI utilities |
| `js/config.js` | ~7 | Klucze Google API |
| `service-worker.js` | ~50 | Strategia cachowania |
| **ŁĄCZNIE** | **~6800** | |

### 4.5. Zewnętrzne zależności

| Zależność | Wersja | Źródło | Cel |
|-----------|--------|--------|-----|
| Chart.js | 4.x | CDN (cdn.jsdelivr.net) | Wykresy słupkowe i liniowe |
| Google Identity Services | latest | CDN (accounts.google.com) | OAuth 2.0 |
| Google API Client (gapi) | latest | CDN (apis.google.com) | Drive API |
| Google Fonts: Playfair Display | — | CDN (fonts.googleapis.com) | Czcionka na ekranie logowania |

**Brak npm, node_modules, bundlera, transpilera.** Wszystko ładowane bezpośrednio z CDN lub lokalnie.

---

## 5. Model danych

### 5.1. Struktura pliku `gabinet-data.json` (Google Drive)

```javascript
{
  version: "1.0",
  lastSync: "ISO timestamp",

  settings: {
    therapistName: String,
    therapistAddress: String,
    therapistNIP: String,        // 10 cyfr
    workingHours: {
      monday: { enabled: Boolean, start: "HH:MM", end: "HH:MM" },
      tuesday: { ... },
      wednesday: { ... },
      thursday: { ... },
      friday: { ... }
    }
  },

  patients: [{
    id: UUID,
    firstName: String,
    lastName: String,
    pseudonym: String,           // unikalny, wymagany
    therapyStartDate: "yyyy-mm-dd",
    sessionDays: ["tuesday", "thursday"],
    sessionTimes: { tuesday: "10:00", thursday: "14:00" },
    sessionsPerWeek: 1 | 2,
    sessionRate: Number,         // PLN
    sessionNumberOffset: Number, // offset z poprzednich terapii
    vacationPeriods: [{ id, startDate, endDate }],
    isArchived: Boolean,
    archivedDate: "yyyy-mm-dd" | null,
    therapyCycles: [{ id, startDate, endDate, cycleNumber }],
    therapeuticGoals: [{ id, title, description*, status, dateSet, dateAchieved }],
    previousTherapies: {
      count: 0-5,
      therapies: [{ startDate, endDate }],
      totalSessions: Number,
      notes: String
    },
    generalNotes: String
  }],

  sessions: [{
    id: UUID,
    patientId: UUID,
    date: "yyyy-mm-dd",
    time: "HH:MM",
    status: "scheduled" | "completed" | "cancelled",
    isPaymentRequired: Boolean,
    isPaid: Boolean,
    paymentId: UUID | null,
    sessionNumber: Number | null,
    cycleSessionNumber: Number | null,     // nr w bieżącej terapii
    globalSessionNumber: Number | null,    // łącznie z poprzednimi
    wasRescheduled: Boolean,
    originalDate: "yyyy-mm-dd" | null,
    originalTime: "HH:MM" | null,
    notes: String*,                        // szyfrowane AES-256-GCM
    cancellationReason: "patient" | "therapist" | "patient_vacation" | null
  }],

  payments: [{
    id: UUID,
    patientId: UUID,
    date: "yyyy-mm-dd",
    amount: Number,              // PLN
    method: "aliorBank" | "ingBank" | "cash",
    sessionIds: [UUID],
    sessionsCount: Number,
    note: String
  }],

  sessionNotes: [{
    id: UUID,
    patientId: UUID,
    sessionId: UUID | null,
    date: "yyyy-mm-dd",
    content: String*,            // szyfrowane AES-256-GCM
    createdAt: "ISO timestamp",
    modifiedAt: "ISO timestamp"
  }],

  progressEntries: [{
    id: UUID,
    patientId: UUID,
    sessionId: UUID | null,
    date: "yyyy-mm-dd",
    category: "Przełom" | "Obserwacja" | "Zmiana" | "Inne",
    title: String,
    content: String*             // szyfrowane AES-256-GCM
  }],

  blockedPeriods: [{
    id: UUID,
    startDate: "yyyy-mm-dd",
    endDate: "yyyy-mm-dd",
    reason: String
  }],

  invoices: []                   // zarezerwowane na przyszłość
}
// * = szyfrowane AES-256-GCM przed zapisem
```

### 5.2. Przechowywanie lokalne (localStorage)

| Klucz | Wartość | Cel |
|-------|---------|-----|
| `gabinet_access_token` | JWT token | Token Google OAuth |
| `gabinet_token_expiry` | timestamp | Czas wygaśnięcia tokena |
| `gabinet_user_email` | email | Email zalogowanego użytkownika |
| `gabinet_data_cache` | JSON string | Kopia danych offline |
| `lastSessionGenMonth` | "yyyy-mm" | Ostatni miesiąc generacji sesji |
| `gabinet_encryption_key` | base64 | Klucz szyfrowania AES-256 |

---

## 6. Design System — Liquid Glass

### 6.1. Filozofia designu

Inspiracja: **Apple Liquid Glass** (macOS Tahoe, WWDC 2025) + **Bold Editorial Design** (ekran logowania).

Kluczowe cechy:
- **Glassmorphism** — półprzezroczyste tła z blur i saturate
- **Minimalizm** — czyste powierzchnie, dużo białej przestrzeni
- **System Apple Colors** — kolory systemowe iOS/macOS
- **Responsywność** — mobile-first z breakpointami na tablet i desktop
- **Dark mode** — automatyczny na podstawie preferencji systemowych

### 6.2. Paleta kolorów

**Kolory systemowe:**
```
Primary:      #007AFF (niebieski Apple)
Primary Dark: #0056CC
Primary Light:#5AC8FA
Success:      #34C759 (zielony)
Warning:      #FF9F0A (pomarańczowy)
Danger:       #FF3B30 (czerwony)
Neutral:      #8E8E93 (szary)
```

**Powierzchnie (Light Mode):**
```
Background:   #F2F2F7
Card:         rgba(255,255,255,0.72)   + blur(20px) saturate(180%)
Card Solid:   #FFFFFF
Border:       rgba(0,0,0,0.08)
Text:         #1C1C1E
Text Sec.:    #8E8E93
```

**Powierzchnie (Dark Mode):**
```
Background:   #000000
Card:         rgba(28,28,30,0.72)      + blur(20px) saturate(180%)
Card Solid:   #1C1C1E
Border:       rgba(255,255,255,0.1)
Text:         #F5F5F7
Text Sec.:    #8E8E93
```

**Kolory biznesowe (wykresy):**
```
Alior Bank:   #CC0000 (czerwony)
ING Bank:     #FF6600 (pomarańczowy)
Gotówka:      #34C759 (zielony)
```

### 6.3. Typografia

- **Ekran logowania:** Playfair Display (serif) — nagłówek „Gabinet Terapeutyczny", gradient tekst
- **Cała aplikacja:** -apple-system, BlinkMacSystemFont, system-ui (domyślny stack Apple)
- **Rozmiar bazowy:** 16px
- **Nagłówki:** `font-weight: 700`

### 6.4. Komponenty UI

**Nawigacja (Dock):**
- Mobile (dół ekranu): 5 ikon + etykiety, efekt powiększenia przy hover (do 1.55×), tooltip nad ikoną
- Desktop (lewy sidebar, 240px): ikony + etykiety obok siebie, aktywny element z niebieskim tłem

**Przyciski:**
- Primary: gradient niebieski z glow
- Outline: glass effect z obramowaniem
- Danger: gradient czerwony
- Warning: gradient pomarańczowy
- FAB: okrągły, fixed bottom-right, niebieski gradient

**Formularze:**
- Inputy z glass backdrop
- Focus: niebieskie obramowanie + glow
- Error: czerwone obramowanie + glow
- Toggle slider: iOS-style

**Modale:**
- Overlay ciemny, półprzezroczysty
- Okno max 500px szerokości, wycentrowane
- Header z przyciskiem ×, scrollowalny body

**Toasty:**
- Slide-in z prawej strony
- 4 typy: info (niebieski), success (zielony), warning (pomarańczowy), error (czerwony)
- Auto-hide po 3 sekundach

**Listy:**
- `.list-item` z tytułem i podtytułem
- Badge z liczbą (np. nieopłacone sesje)
- Empty state: szary tekst na środku

### 6.5. Breakpointy responsywne

| Breakpoint | Zachowanie |
|-----------|------------|
| < 480px | Kompaktowy mobile |
| < 768px | Mobile — bottom nav, brak sidebaru |
| ≥ 768px | Tablet — sidebar widoczny, bottom nav ukryty |
| ≥ 1024px | Desktop — szerszy content area |

### 6.6. Ekran logowania (Bold Editorial)

- Czcionka: Playfair Display (serif), oversized
- Gradient tekst: `linear-gradient(135deg, #007AFF, #5AC8FA, #34C759)`
- Animowane szklane orby w tle (CSS animation)
- Podtytuł: „Twój cyfrowy asystent gabinetu psychoterapeutycznego"
- Przycisk: „Zaloguj przez Google" z ikoną Google

---

## 7. Bezpieczeństwo i prywatność

### 7.1. Szyfrowanie danych

| Co jest szyfrowane | Algorytm | Gdzie klucz |
|-------------------|----------|-------------|
| Notatki do sesji | AES-256-GCM | localStorage przeglądarki |
| Notatki kliniczne | AES-256-GCM | localStorage przeglądarki |
| Opisy celów terapeutycznych | AES-256-GCM | localStorage przeglądarki |
| Wpisy postępów | AES-256-GCM | localStorage przeglądarki |

**Ograniczenia:**
- Klucz szyfrowania w localStorage — utrata przeglądarki = utrata dostępu do zaszyfrowanych treści
- Brak mechanizmu odzyskiwania klucza
- Dane nieszyfrowane (imiona, daty, kwoty) są w plaintext na Google Drive

### 7.2. Pseudonimizacja

- Każdy pacjent ma wymagany pseudonim (np. „Klient A", „Motyl")
- Pseudonim wyświetlany jako główny identyfikator (duża czcionka)
- Imię i nazwisko wyświetlane jako podrzędne (mała czcionka)
- W kalendarzu widoczny tylko pseudonim

### 7.3. Uwierzytelnianie

- Google OAuth 2.0 — brak własnego systemu logowania
- Token odświeżany automatycznie przed wygaśnięciem
- Scope: `drive.file` — dostęp tylko do plików utworzonych przez aplikację
- Klucze API ograniczone do domeny hostingu (Google Cloud Console)

### 7.4. Znane ryzyka bezpieczeństwa

1. Klucz szyfrowania w localStorage — brak backup/recovery
2. Dane strukturalne (daty, kwoty, pseudonimy) nieszyfrowane na Drive
3. Brak 2FA poza Google OAuth
4. Brak audit log (kto/kiedy otwierał dane)
5. Brak automatycznego wylogowania po okresie bezczynności
6. Jeden użytkownik — brak systemu ról/uprawnień

---

## 8. Przepływ użytkownika (User Flow)

### 8.1. Pierwsze uruchomienie
1. Otwórz URL → ekran logowania (Bold Editorial)
2. Kliknij „Zaloguj przez Google" → consent screen Google
3. Zatwierdzenie → aplikacja tworzy `gabinet-data.json` na Google Drive
4. Ustawienia: wpisz dane terapeuty, godziny pracy
5. Dodaj pierwszego pacjenta (imię, nazwisko, pseudonim, dni sesji, stawka)
6. Sesje generowane automatycznie na bieżący miesiąc

### 8.2. Codzienny flow terapeuty
1. Otwarcie aplikacji → kalendarz na dziś
2. Kliknięcie sesji → modal z detalami
3. Zmiana statusu na „Odbyła się" + notatka kliniczna → Zapisz
4. Rejestracja płatności (po kilku sesjach)
5. Sprawdzenie statystyk i przychodów (okresowo)

### 8.3. Odwołanie sesji
1. Kliknięcie sesji w kalendarzu
2. Status → „Nie odbyła się"
3. Jeśli w ostatniej chwili: toggle „Sesja płatna" ON
4. Jeśli z wyprzedzeniem: toggle OFF → wybór powodu (pacjent / terapeuta / urlop)
5. Zapisz

---

## 9. Stan obecny i ograniczenia

### 9.1. Co działa dobrze
- Kompletny flow zarządzania sesjami i pacjentami
- Automatyczne generowanie kalendarza
- Szyfrowanie notatek klinicznych
- Synchronizacja z Google Drive
- Instalacja PWA na telefonie
- Tryb offline (odczyt z cache)
- Responsywny design (mobile/tablet/desktop)
- Dark mode automatyczny

### 9.2. Ograniczenia techniczne
- **Jeden użytkownik** — brak multi-tenancy, brak kont użytkowników
- **Brak backendu** — cała logika w przeglądarce, brak serwera
- **Brak bazy danych** — jeden plik JSON na Google Drive (skalowalność?)
- **Vanilla JS** — brak frameworka, trudniejsze utrzymanie przy rozbudowie
- **Brak testów** — zero unit/integration/e2e testów
- **Brak CI/CD** — poza GitHub Pages deploy
- **Brak i18n** — hardcoded polski
- **Chart.js z CDN** — brak kontroli wersji
- **Brak backup** — poza historią wersji Google Drive

### 9.3. Ograniczenia funkcjonalne
- Brak fakturowania (pole `invoices` zarezerwowane, ale puste)
- Brak przypomnień SMS/email do pacjentów
- Brak integracji z kalendarzem Google
- Brak eksportu danych (PDF, CSV)
- Brak importu pacjentów
- Brak widoku dla pacjenta (portal pacjenta)
- Brak RODO/GDPR compliance panel
- Brak logów aktywności
- Brak systemu uprawnień (np. sekretarka vs terapeuta)

---

## 10. Infrastruktura i deployment

### 10.1. Obecny setup
```
GitHub repo (main) → GitHub Pages → https://pawelszmit.github.io/Gabinet/
```

### 10.2. Planowany setup
```
VPS OVH Cloud → Nginx reverse proxy → domena.pl
                                    → inna-domena.pl (inna aplikacja)
```

### 10.3. Wymagania serwera
- Serwer HTTP (Nginx/Apache) — serwowanie plików statycznych
- SSL (Let's Encrypt) — HTTPS wymagany przez Google OAuth
- Brak Node.js/Python/PHP — aplikacja jest czysto kliencka
- Brak bazy danych na serwerze — dane na Google Drive użytkownika

---

## 11. Metryki i KPI (do wdrożenia)

Obecnie brak analityki. Sugerowane metryki:
- Liczba aktywnych użytkowników (DAU/MAU)
- Liczba sesji zarejestrowanych per miesiąc
- Średnia liczba pacjentów per terapeuta
- Retencja użytkowników (30/60/90 dni)
- Czas spędzony w aplikacji
- Najczęściej używane funkcje

---

## 12. Kontekst rynkowy

### 12.1. Potencjalni użytkownicy
- Psychoterapeuci z prywatną praktyką (gabinet 1-osobowy)
- Psychologowie prowadzący terapie indywidualne
- Coachowie i terapeuci par (z adaptacją)
- Gabinety grupowe (wymaga multi-user)

### 12.2. Potencjalna konkurencja (do zbadania)
- Ogólne systemy CRM (zbyt rozbudowane)
- Calendly / Cal.com (tylko rezerwacje, brak płatności/notatek)
- Cliniko, SimplePractice, TherapyNotes (anglojęzyczne, drogie)
- Arkusze Google / Notion (brak automatyzacji i szyfrowania)
- Dedykowane polskie rozwiązania (do zbadania)

### 12.3. Unikalne wyróżniki (USP)
1. **Dedykowana dla polskich psychoterapeutów** — język, NIP, PLN
2. **Szyfrowanie notatek klinicznych** — wrażliwe dane chronione
3. **Pseudonimizacja** — dodatkowa warstwa prywatności
4. **Automatyczny kalendarz sesji** — oszczędność czasu
5. **Zero konfiguracji serwera** — dane na Google Drive użytkownika
6. **PWA** — instalacja na telefonie bez App Store
7. **Offline** — dostęp do danych bez internetu

---

*Dokument wygenerowany: 2026-03-23*
*Wersja aplikacji: 1.0*
*Cache: gabinet-v9*
*Łączna liczba linii kodu: ~6800*
