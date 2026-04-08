# BRIEF: Gabinet Terapeutyczny — Kompletna dokumentacja aplikacji

> Dokument źródłowy dla AI do przygotowania raportu rozwojowo-marketingowego.
> Zawiera pełny opis funkcji, architektury, designu, modelu danych i stanu aplikacji.
> Ostatnia aktualizacja: 2026-04-08 | Cache: gabinet-v48

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
- **Miesięczny (domyślny)** — siatka z chipami sesji w kolorach statusu, duże komórki (min. 80px), pełna wysokość bez scrollowania
- **Tygodniowy** (Pn–Nd) — siatka godzinowa z minimalną szerokością kolumny 110px; przy dużej liczbie sesji pojawia się poziomy scroll. Nagłówek sticky, jeden wspólny kontener scroll (`.cal-week-scroll`). Slot 40px — 6-8 godzin widocznych bez scrollowania
- **Dzienny** — szczegółowy plan dnia z godzinami i statusami; scroll obsługiwany przez `#view-container` (nie wewnętrzny overflow)

**Panel skupienia (Focus Panel):**
- Górna linia: kicker „Twój gabinet" + tytuł z datą (po lewej), następna sesja (po prawej)
- Dolna linia: 4 kafelki statystyk w jednym rzędzie — sesje dziś, należności, aktywni pacjenci, tryb dnia
- Brak przycisków akcji w panelu (dodawanie przez modal kalendarza)
- **Widoczny w widoku miesięcznym i dziennym; ukryty w tygodniowym** (aby zmaksymalizować widoczność siatki godzin)

**Automatyzacja:**
- Sesje generowane automatycznie na bieżący miesiąc przy pierwszym logowaniu w danym miesiącu
- Algorytm uwzględnia: dni sesji pacjenta, datę rozpoczęcia terapii, urlopy pacjenta, urlopy terapeuty (blokowane okresy)
- **Dodanie urlopu pacjenta automatycznie odwołuje** istniejące zaplanowane sesje w zakresie dat (status `cancelled`, powód `patient_vacation`, `isPaymentRequired=false`)
- **Usunięcie urlopu przywraca** odwołane sesje do statusu `scheduled`
- Wygenerowane miesiące zapisywane w `generatedMonths[]` (persystowane na Drive), aby uniknąć duplikacji po przeładowaniu
- Regeneracja kalendarza na wybrany miesiąc (z zachowaniem sesji odbytych i odwołanych)

**Nawigacja:**
- Przyciski Poprzedni/Następny (miesiąc, tydzień, dzień)
- Przycisk „Dziś" — skok do bieżącej daty
- Przełącznik widoków (M/T/D)

**Kolory sesji:**
- Niebieski — zaplanowana
- Zielony — odbyta
- Pomarańczowy — odwołana, płatna / częściowo opłacona
- Czerwony — odwołana, niepłatna

**Częściowe płatności:**
- Sesja może być oznaczona jako `isPartiallyPaid` z kwotą `partialPaymentAmount`
- W kalendarzu i na liście pacjenta: pomarańczowy tekst „Częściowo opłacona (X zł)" zamiast ikony ½
- Zaległość = pełna stawka − wpłacona kwota (spójna we wszystkich widokach: kalendarz, finanse, pacjenci)

### 3.2. Zarządzanie pacjentami

**Dane pacjenta:**
- Imię, nazwisko, pseudonim (opcjonalny)
- Data rozpoczęcia terapii
- Dni sesji (checkboxy: Pn–Nd + godzina przy każdym)
- Stawka za sesję (PLN)
- Liczba sesji na tydzień (1, 2 lub 3)
- Okresy urlopowe (data start–koniec)
- Poprzednie terapie (dane historyczne)

**Lista pacjentów:**
- Sortowanie alfabetyczne po nazwisku
- Wyszukiwanie po imieniu/nazwisku/pseudonimie
- Badge z liczbą nieopłaconych sesji
- Pseudonim wyświetlany dużą czcionką, imię i nazwisko małą (priorytet prywatności)
- Przycisk „Archiwum" (tekst, wyrównany do prawej krawędzi)

**Widok szczegółowy pacjenta:**

Nagłówek z awatarem, imieniem/pseudonimem, debtbadge, statystykami (czas terapii, sesje, notatki, cele).

Nawigacja chipowa: Przegląd | Sesje | Kliniczne | Historia

Sekcja **Przegląd:**
- Karta „Tożsamość i ustawienia terapii" — imię, nazwisko, pseudonim, stawka, sesje w tygodniu
- Karta „Przebieg terapii" — data startu, czas trwania, ukończone sesje (z formatem historycznym, np. `3 (57)`), zaległości
- Karta „Rytm spotkań" — harmonogram dni/godzin

Sekcja **Sesje:**
- Ostatnie sesje z datą, godziną, statusem, ikoną płatności
- Urlopy i przerwy z datami, przycisk dodawania

Sekcja **Kliniczne:**
- **Notatki i obserwacje** — chronologiczna lista (jak zeszyt: najstarsze na górze, najnowsze na dole):
  - Notatki z sesji kalendarza — automatycznie pobierane z pola `sessionNotes` sesji, oznaczone etykietą „Sesja", tylko do odczytu
  - Notatki ręczne — dodawane przyciskiem „+ Dodaj" (np. archiwalne notatki), z możliwością usunięcia
  - Oba typy mieszane w jednej liście, posortowane po dacie
  - Pełna treść notatki (bez obcinania), async odszyfrowanie AES-256-GCM
- Cele terapeutyczne — ze statusem (W toku / Osiągnięty / Nieaktualny)

Sekcja **Historia:**
- Wpisy postępów z kategorią i datą
- Cykle terapii

**Formularz edycji pacjenta — 4 sekcje:**
1. **Dane osobowe** — imię*, nazwisko*, pseudonim, data rozpoczęcia terapii*
2. **Finansowe** — stawka za sesję*
3. **Harmonogram** — sesje w tygodniu (select 1–3), dni sesji (checkboxy z godziną)
4. **Poprzednie terapie** — pole liczbowe „Liczba poprzednich terapii" generuje dynamicznie tyle wierszy; każdy wiersz: data Od, data Do, liczba sesji. Dane historyczne (nie generują sesji w kalendarzu). Służą do obliczania łącznego licznika sesji.

**Licznik sesji z historią:**
- Format: `3 (57)` — 3 ukończone sesje w bieżącej terapii, 57 łącznie z poprzednimi
- Wyświetlany w kaflach statystyk i w karcie „Przebieg terapii"
- Jeśli brak poprzednich terapii, wyświetla się samo `3`

**Archiwizacja:**
- Pacjent przenoszony do archiwum, zaplanowane sesje usuwane
- Przywracanie z archiwum: nowy cykl terapii, nowa data startu

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
- Opcje odwołania: toggle „Sesja płatna" + powód odwołania
- Informacja o płatności (status, kwota, metoda)
- **Notatka do sesji** (textarea, szyfrowana AES-256-GCM) — po zapisie automatycznie widoczna w widoku pacjenta w sekcji „Notatki i obserwacje" z datą sesji jako nagłówkiem
- Formularz przeniesienia (nowa data + godzina) — przeniesienie zachowuje status płatności (`isPaid`, `paymentId`, `paymentAmount`, `paymentDate`, `paymentMethod`) i aktualizuje datę w powiązanej płatności (`payment.sessionIds`)
- **Usuwanie sesji** — opcja dostępna w menu kontekstowym sesji

**Numeracja sesji:**
- `cycleSessionNumber` — numer w bieżącej terapii (1, 2, 3...)
- `globalSessionNumber` — łącznie z poprzednimi terapiami (36, 37, 38...)
- Łączna liczba sesji z `previousTherapies` uwzględniana w wyświetlaniu
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

**Tytuł:** „Kondycja finansowa gabinetu" (krótki, bez opisu pod spodem)

**Kafelki metrykowe:**
- Przychód w miesiącu, zaległości, odsetki odwołań — tylko wartość, bez podtytułów `<small>`

**Rzeczy wymagające uwagi:**
- Lista w formie pogrubionego tekstu (bez dodatkowych wyjaśnień w `<span>`)

**Wykres słupkowy przychodów:**
- Słupki stacked wg metody płatności (Alior/ING/Gotówka)
- **Przełącznik okresu: 3 / 6 / 12 miesięcy** — przyciski nad wykresem, wykres aktualizuje się w miejscu bez przeładowania strony

Brak przycisku „Przejdź do pacjentów" (usunięty — zbędny w kontekście dashboardu).

### 3.6. Ustawienia

- Dane terapeuty: imię, adres, NIP
- Blokowane okresy (urlopy terapeuty): data start + koniec + powód, dodawanie/usuwanie
- Regeneracja kalendarza: wybór miesiąca, potwierdzenie
- Konto Google: email, przycisk wylogowania
- Synchronizacja: data ostatniej synchronizacji, przycisk ręcznej synchronizacji
- Informacje o aplikacji: wersja
- Strefa zagrożenia: reset danych (z potwierdzeniem)

### 3.7. Archiwum

- Lista zarchiwizowanych pacjentów
- Informacje: imię/nazwisko, pseudonim, okres terapii, liczba sesji
- Przycisk przywracania z formularzem: nowa data startu, dni sesji, godziny

### 3.8. Odzyskiwanie danych (DataRecovery)

Moduł `DataRecovery` w `drive.js`:
- Skanuje WSZYSTKIE rewizje pliku `gabinet-data.json` na Google Drive (od najnowszej do najstarszej)
- Odzyskuje utracone dane (godziny sesji, harmonogramy pacjentów) z historii wersji
- Zbiera dane z każdej rewizji do map, łączy najbardziej kompletne dane
- Użyteczny po migracji, kiedy dane mogły zostać utracone w konwersji formatu

---

## 4. Architektura techniczna

### 4.1. Stack technologiczny

| Warstwa | Technologia | Uwagi |
|---------|-------------|-------|
| Frontend | Vanilla JavaScript (ES6+) | Brak frameworka (React/Vue/Angular) |
| HTML | Jeden plik `index.html` (SPA) | ~440 linii |
| CSS | 1 plik `styles.css` + style wstrzykiwane przez moduły JS | ~3340 linii w pliku + ~200 inline per moduł |
| Fonty | Google Fonts: Manrope (interfejs), Playfair Display (login) | |
| Uwierzytelnianie | Google OAuth 2.0 (GIS) | |
| Przechowywanie danych | Google Drive API v3 | Jeden plik JSON na Drive użytkownika |
| Szyfrowanie | Web Crypto API (AES-256-GCM) | Notatki kliniczne, cele, postępy |
| Offline | Service Worker (Cache API) | Network-first (HTML) + Cache-first (assets) |
| PWA | manifest.json + SW | Instalowalna na urządzeniu |

### 4.2. Architektura aplikacji

```
┌─────────────────────────────────────────────────┐
│                    index.html                    │
│              (Single Page Application)           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────┐  ┌───────────────┐               │
│  │ app.js   │  │ encryption.js │               │
│  │ AutoLock │  │ AES-256-GCM   │               │
│  │ Router   │  └───────────────┘               │
│  └────┬─────┘                                   │
│       │                                         │
│  ┌────▼──────────────────────────────────────┐  │
│  │  data.js — AppState, modele, persistence  │  │
│  │  (createPatient, createSession, ...)      │  │
│  └────┬──────────────────────────────────────┘  │
│       │                                         │
│  ┌────▼──────────────────────────────────────┐  │
│  │         Moduły widoków (views/)            │  │
│  │  calendar.js  patients.js  finance.js      │  │
│  │  settings.js                               │  │
│  └────┬──────────────────────────────────────┘  │
│       │                                         │
│  ┌────▼─────────┐  ┌────────────┐              │
│  │  drive.js    │  │  utils.js  │              │
│  │  DriveService│  │  Helpery   │              │
│  │  DataRecovery│  └────────────┘              │
│  └──────────────┘                               │
├─────────────────────────────────────────────────┤
│                    sw.js                         │
│        (Cache-first + network fallback)          │
└─────────────────────────────────────────────────┘
```

### 4.3. Wzorce architektoniczne

- **SPA z imperatywnym routingiem** — `Router.navigate('patients', { patientId })` wywołuje render odpowiedniego widoku
- **Moduły IIFE / Object Literal** — `CalendarViews`, `PatientViews`, `FinanceViews`, `SettingsViews` — obiekty z metodami `render()`, `_bind*Events()`
- **Globalny AppState** — jeden obiekt w `data.js` ze getterami `activePatients`, `archivedPatients`; serializowany/deserializowany do Google Drive
- **Style wstrzykiwane przez JS** — każdy moduł widoku ma `_injectStyles()` tworzący `<style>` w `<head>` (deduplikacja przez id)
- **Debounced save** — zapis na Google Drive z opóźnieniem, z retry (3 próby)
- **AutoLock** — blokada ekranu po 15 minutach bezczynności (nasłuchuje click, keydown, touchstart, mousemove, scroll)

### 4.4. Pliki i rozmiary

| Plik | Linie kodu | Rola |
|------|-----------|------|
| `index.html` | ~440 | Struktura SPA (shell, ekran logowania, kontenery widoków) |
| `styles.css` | ~3340 | Zmienne CSS, layout, nawigacja, responsywność, dark mode |
| `js/app.js` | ~1290 | AutoLock, Router, App (init, auth flow, tab bar, renderowanie) |
| `js/data.js` | ~631 | AppState, fabryki modeli, helpery, generowanie sesji, persistence |
| `js/drive.js` | ~503 | DriveService (CRUD na Google Drive), DataRecovery |
| `js/encryption.js` | ~57 | AES-256-GCM szyfrowanie/deszyfrowanie, zarządzanie kluczem |
| `js/utils.js` | ~441 | Formatowanie dat, kwot, kolory awatarów, helpery UI |
| `js/views/calendar.js` | ~1186 | Trzy widoki kalendarza, focus panel, modale sesji |
| `js/views/patients.js` | ~1769 | Lista pacjentów, widok szczegółowy, formularz, archiwum, notatki |
| `js/views/finance.js` | ~827 | Dashboard finansowy, wykres przychodów, kafelki |
| `js/views/settings.js` | ~462 | Ustawienia, blokowane okresy |
| `sw.js` | ~62 | Service Worker — strategia cache |
| **ŁĄCZNIE** | **~11 008** | |

### 4.5. Zewnętrzne zależności

| Zależność | Źródło | Cel |
|-----------|--------|-----|
| Google Identity Services | CDN (accounts.google.com) | OAuth 2.0 |
| Google API Client (gapi) | CDN (apis.google.com) | Drive API |
| Google Fonts: Manrope, Playfair Display | CDN (fonts.googleapis.com) | Typografia |

**Brak npm, node_modules, bundlera, transpilera, Chart.js.** Wykresy rysowane ręcznie w HTML/CSS (pure divs). Wszystko ładowane bezpośrednio z CDN lub lokalnie.

---

## 5. Model danych

### 5.1. Struktura AppState (data.js) — serializowana do `gabinet-data.json` na Google Drive

```javascript
{
  version: 2,
  exportedAt: "ISO timestamp",

  settings: {
    therapistName:      String,
    therapistAddress:   String,
    therapistNIP:       String,         // 10 cyfr
    workingHoursStart:  "HH:MM",        // np. "08:00"
    workingHoursEnd:    "HH:MM",        // np. "20:00"
    autoLockTimeout:    Number,         // sekundy (domyślnie 120, ale w UI 900 = 15 min)
    lastGeneratedMonth: "YYYY-MM"|null  // ostatni miesiąc z automatyczną generacją sesji
  },

  patients: [{
    id:                 UUID,
    firstName:          String,
    lastName:           String,
    pseudonym:          String,         // opcjonalny
    isActive:           Boolean,        // domyślnie true
    isArchived:         Boolean,
    archivedDate:       ISO|null,
    sessionsPerWeek:    1|2|3,
    sessionRate:        Number,         // PLN
    therapyStartDate:   ISO,
    dateAdded:          ISO,
    // [{weekday: 1–7 (ISO), sessionTime: "HH:MM"}]
    sessionDayConfigs:  Array,
    // [{id, startDate, endDate, cycleNumber}]
    therapyCycles:      Array,
    // [{id, startDate, endDate}]
    vacationPeriods:    Array,
    // [{id, title, status, dateSet, dateAchieved, notes}]
    therapeuticGoals:   Array,
    // [{id, date, category, title, content}]
    progressEntries:    Array,
    // [{id, date, content*, sessionId}] — ręczne notatki, szyfrowane
    sessionNotes:       Array,
    invoices:           Array,          // zarezerwowane
    // [{id, startDate, endDate, sessionsCount}] — dane historyczne
    previousTherapies:  Array
  }],

  sessions: [{
    id:                   UUID,
    date:                 ISO,          // data+czas sesji (pełny ISO)
    patientId:            UUID,
    status:               "scheduled"|"completed"|"cancelled",
    isPaymentRequired:    Boolean,
    isPaid:               Boolean,
    paymentMethod:        String|null,
    paymentDate:          ISO|null,
    paymentAmount:        Number|null,
    paymentId:            UUID|null,
    isPartiallyPaid:      Boolean,
    partialPaymentAmount: Number|null,
    isManuallyCreated:    Boolean,
    sessionNumber:        Number|null,
    globalSessionNumber:  Number|null,
    cycleSessionNumber:   Number|null,
    wasRescheduled:       Boolean,
    originalDate:         ISO|null,
    sessionNotes:         String*       // szyfrowane AES-256-GCM — widoczne w widoku pacjenta
  }],

  payments: [{
    id:            UUID,
    patientId:     UUID,
    date:          ISO,
    amount:        Number,
    method:        "aliorBank"|"ingBank"|"cash",
    sessionsCount: Number,
    sessionIds:    [UUID],
    note:          String,
    createdAt:     ISO
  }],

  blockedPeriods: [{
    id:        UUID,
    startDate: ISO,
    endDate:   ISO,
    reason:    String
  }],

  generatedMonths: ["YYYY-MM"]  // miesiące, dla których już wygenerowano sesje
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

## 6. Design System — Naturalistic Liquid Glass

### 6.1. Filozofia designu

Inspiracja: **Apple Liquid Glass** (macOS Tahoe, WWDC 2025) połączona z **ciepłą paletą botaniczną** — naturalne zielenie, ciepłe beże, delikatne cienie zamiast ostrych kontrastów.

Kluczowe cechy:
- **Glassmorphism** — `color-mix()`, półprzezroczyste tła, `backdrop-filter: blur()`
- **Botaniczna paleta** — ciemnozielone akcenty (#49664f), ciepłe tła (#f7f2eb), naturalne cienie
- **Zaokrąglenia** — duże promienie (16–28px) na kartach, przyciskach, formularzach
- **Minimalizm** — czyste powierzchnie, dużo białej przestrzeni
- **Responsywność** — mobile-first z breakpointami na tablet (768px), desktop (1024px), wide (1440px)
- **Dark mode** — automatyczny na podstawie `prefers-color-scheme`, ciemnozielone tła (#223128). Pełne nadpisania kolorów dla kalendarza (numery dni, etykiety godzin, nagłówki tygodnia, scrollbary, blokady)

### 6.2. Paleta kolorów

**Kolory główne (zmienne CSS):**
```css
--blue:           #49664f   /* Ciemnozielony — główny akcent */
--text:           #243126   /* Tekst — ciemnozielony */
--text-secondary: rgba(36,49,38,.68)
--border:         rgba(73,102,79,.14)
--surface-raised: #f7f2eb   /* Tło kart — ciepły beż */
--green:          #6b9073   /* Sukces */
--red:            #bf6152   /* Błąd/danger */
--orange:         #cc8b56   /* Ostrzeżenie */
```

**Kolory biznesowe (wykresy przychodów):**
```
Alior Bank:   #CC0000 (czerwony)
ING Bank:     #FF6600 (pomarańczowy)
Gotówka:      #34C759 (zielony)
```

### 6.3. Typografia

- **Interfejs:** Manrope (sans-serif) — czcionka główna, font-weight 600–800
- **Ekran logowania / landing page:** Fraunces (serif) — nagłówek hero (left-aligned, editorial layout)
- **Rozmiar bazowy:** clamp()-based fluid sizing
- **Nagłówki sekcji:** uppercase, letter-spacing 0.08–0.18em, font-weight 800, mały rozmiar (0.72–0.82rem)

### 6.4. Komponenty UI

**Nawigacja (Tab Bar):**
- Mobile (dół ekranu): floating pill z blur, 4 zakładki (Dziś, Pacjenci, Finanse, Ustawienia)
- Desktop (lewy sidebar, 80px): pionowy pasek z ikonami, fixed
- Aktywna zakładka podświetlona — poprawiona synchronizacja klasy `active` / `tab-btn--active`

**Karty (Panel Cards):**
- `border-radius: 24px`, `padding: 18px`
- Tło: `color-mix(in srgb, var(--surface-raised) 92%, transparent)`
- Cień: `var(--shadow-sm)`
- Nagłówki kart: uppercase, mały rozmiar, duży tracking

**Formularze:**
- Inputy: `border-radius: 16px`, `padding: .8rem .95rem`
- Focus: zielone obramowanie + subtlejna poświata `rgba(73,102,79,.12)`
- Sekcje formularza: zaokrąglone karty (24px)

**Notatki (Notebook View):**
- Chronologiczna lista (najstarsze na górze, najnowsze na dole)
- Data jako nagłówek każdej notatki
- Etykieta „Sesja" (zielona, uppercase) przy notatkach z kalendarza
- Pełna treść bez obcinania, `white-space: pre-wrap`

**Toasty:**
- Slide-in z prawej strony, auto-hide po 3 sekundach

### 6.5. Breakpointy responsywne

| Breakpoint | Zachowanie |
|-----------|------------|
| < 640px | Kompaktowy mobile — 1 kolumna, pełna szerokość przycisków |
| < 880px | Mobile — bottom nav, siatka 1-kolumnowa |
| ≥ 768px | Tablet — content max-width 900px |
| ≥ 1024px | Desktop — sidebar 80px po lewej, content max-width 960px |
| ≥ 1440px | Wide desktop — content max-width 1080px |

---

## 7. Bezpieczeństwo i prywatność

### 7.1. Szyfrowanie danych

| Co jest szyfrowane | Algorytm | Gdzie klucz |
|-------------------|----------|-------------|
| Notatki do sesji (sessionNotes) | AES-256-GCM | localStorage przeglądarki |
| Notatki ręczne pacjenta | AES-256-GCM | localStorage przeglądarki |
| Opisy celów terapeutycznych | AES-256-GCM | localStorage przeglądarki |
| Wpisy postępów | AES-256-GCM | localStorage przeglądarki |

**Ograniczenia:**
- Klucz szyfrowania w localStorage — utrata przeglądarki = utrata dostępu do zaszyfrowanych treści
- Brak mechanizmu odzyskiwania klucza
- Dane nieszyfrowane (imiona, daty, kwoty) są w plaintext na Google Drive

### 7.2. Pseudonimizacja

- Każdy pacjent może mieć pseudonim
- Pseudonim wyświetlany jako główny identyfikator (duża czcionka)
- Imię i nazwisko wyświetlane jako podrzędne (mała czcionka)
- W kalendarzu widoczny pseudonim (jeśli ustawiony) lub imię

### 7.3. Uwierzytelnianie i blokada

- Google OAuth 2.0 — brak własnego systemu logowania
- Token odświeżany automatycznie przed wygaśnięciem
- Scope: `drive.file` — dostęp tylko do plików utworzonych przez aplikację
- **Automatyczna blokada ekranu po 15 minutach bezczynności** — nasłuchuje aktywności użytkownika (kliknięcia, ruchy myszy, scrolla, klawiatura, dotyk)

### 7.4. Znane ryzyka bezpieczeństwa

1. Klucz szyfrowania w localStorage — brak backup/recovery
2. Dane strukturalne (daty, kwoty, pseudonimy) nieszyfrowane na Drive
3. Brak 2FA poza Google OAuth
4. Brak audit log (kto/kiedy otwierał dane)
5. Jeden użytkownik — brak systemu ról/uprawnień

---

## 8. Przepływ użytkownika (User Flow)

### 8.1. Pierwsze uruchomienie
1. Otwórz URL → landing page z editorial hero (2-kolumnowy layout: tekst lewo + CSS mockupy prawo), sekcje: Korzyści, Prywatność, Podgląd (mockupy UI), Cennik (79 zł/mies.), FAQ (accordion), CTA closing
2. Kliknij „Zaloguj przez Google" → consent screen Google
3. Zatwierdzenie → aplikacja tworzy `gabinet-data.json` na Google Drive
4. Ustawienia: wpisz dane terapeuty
5. Dodaj pierwszego pacjenta (imię, nazwisko, pseudonim, dni sesji, stawka)
6. Sesje generowane automatycznie na bieżący miesiąc

### 8.2. Codzienny flow terapeuty
1. Otwarcie aplikacji → kalendarz miesięczny (domyślny widok)
2. Panel na górze: ile sesji dziś, należności, aktywni pacjenci
3. Kliknięcie sesji → modal z detalami
4. Zmiana statusu na „Odbyła się" + notatka kliniczna → Zapisz
5. Notatka automatycznie pojawia się w widoku pacjenta w sekcji „Notatki i obserwacje"
6. Rejestracja płatności (po kilku sesjach)
7. Sprawdzenie kondycji finansowej (zakładka Finanse)

### 8.3. Przeglądanie historii pacjenta
1. Zakładka Pacjenci → kliknięcie pacjenta
2. Sekcja „Kliniczne" → „Notatki i obserwacje"
3. Chronologiczna lista notatek: od najstarszej do najnowszej
4. Notatki z sesji (oznaczone „Sesja") + notatki ręczne — razem w jednej liście
5. Pełna treść każdej notatki, z datą jako nagłówkiem

---

## 9. Stan obecny i ograniczenia

### 9.1. Co działa dobrze
- Kompletny flow zarządzania sesjami i pacjentami
- Automatyczne generowanie kalendarza z uwzględnieniem urlopów i blokad
- Szyfrowanie notatek klinicznych (AES-256-GCM)
- Synchronizacja z Google Drive (z retry i offline cache)
- Odzyskiwanie danych z historii wersji Google Drive (DataRecovery)
- Instalacja PWA na telefonie
- Tryb offline (odczyt z cache)
- Responsywny design (mobile/tablet/desktop) z sidebar na dużych ekranach
- Dark mode automatyczny
- Automatyczna blokada ekranu (15 min bezczynności)
- Ujednolicony panel skupienia w kalendarzu (identyczny dla widoku M/T/D)
- Chronologiczny widok notatek (jak zeszyt) z automatycznym pobieraniem notatek sesji

### 9.2. Ograniczenia techniczne
- **Jeden użytkownik** — brak multi-tenancy, brak kont użytkowników
- **Brak backendu** — cała logika w przeglądarce, brak serwera
- **Brak bazy danych** — jeden plik JSON na Google Drive
- **Vanilla JS** — brak frameworka, trudniejsze utrzymanie przy rozbudowie
- **Brak testów** — zero unit/integration/e2e testów
- **Brak CI/CD** — poza GitHub Pages deploy
- **Brak i18n** — hardcoded polski

### 9.3. Ograniczenia funkcjonalne
- Brak fakturowania (pole `invoices` zarezerwowane, ale puste)
- Brak przypomnień SMS/email do pacjentów
- Brak integracji z kalendarzem Google
- Brak eksportu danych (PDF, CSV)
- Brak importu pacjentów
- Brak widoku dla pacjenta (portal pacjenta)
- Brak RODO/GDPR compliance panel
- Brak logów aktywności

---

## 10. Infrastruktura i deployment

### 10.1. Obecny setup
```
GitHub repo (main) → GitHub Pages → https://pawelszmit.github.io/Gabinet/
```

### 10.2. Planowany setup
```
VPS OVH Cloud → Nginx reverse proxy → domena.pl
```

### 10.3. Wymagania serwera
- Serwer HTTP (Nginx) — serwowanie plików statycznych
- SSL (Let's Encrypt) — HTTPS wymagany przez Google OAuth
- Brak Node.js/Python/PHP — aplikacja jest czysto kliencka
- Brak bazy danych na serwerze — dane na Google Drive użytkownika

---

## 11. Ostatnie zmiany (changelog v9 → v48)

### v9 → v19 (marzec 2026 — przebudowa UI)

| Zmiana | Opis |
|--------|------|
| Migracja UI/UX | Przebudowa z Apple Blue na Naturalistic Liquid Glass (botaniczna paleta, Manrope, zaokrąglone karty) |
| Moduły widoków | Nowa struktura: `views/calendar.js`, `views/patients.js`, `views/finance.js`, `views/settings.js` |
| Szyfrowanie | Migracja na AES-256-GCM (Web Crypto API) |
| Model danych v2 | `sessionDayConfigs[]` zamiast `sessionDays[]` + `sessionTimes{}`, daty ISO zamiast osobnych pól date/time |
| DataRecovery | Moduł odzyskiwania danych z historii wersji Google Drive |
| Kalendarz | Widok miesięczny domyślny, większe komórki, ujednolicony focus panel bez przycisków akcji |
| Focus panel | Identyczny nagłówek dla widoków M/T/D — kicker, data, następna sesja, 4 kafelki |
| Tab bar | Poprawiona synchronizacja klasy aktywnej zakładki |
| Archiwum | Ikonka zastąpiona tekstem „Archiwum" wysuniętym do prawej krawędzi |
| Edycja pacjenta | Naprawiony przycisk Edytuj (routing), dodana sekcja Poprzednie terapie |
| Poprzednie terapie | Pole liczbowe → dynamiczne wiersze (Od/Do/Sesji); licznik `3 (57)` |
| Badge prywatności | Usunięty badge „Pseudonim na pierwszym planie" z widoku pacjenta |
| Notatki | Ujednolicona lista chronologiczna — notatki z sesji kalendarza + ręczne w jednym widoku (najstarsze na górze, jak zeszyt) |
| Finanse | Krótszy tytuł, usunięty opis i przycisk, kafelki bez podtytułów, toggle 3/6/12 mies. na wykresie |
| AutoLock | 2 min → 15 min timeout bezczynności |
| Service Worker | Strategia: network-first (HTML) + cache-first (assets), wersjonowanie cache |

### v19 → v48 (marzec–kwiecień 2026 — bug-fixy, landing page, scroll, urlopy)

| Zmiana | Opis |
|--------|------|
| Landing page | Editorial 2-kolumnowy hero (Fraunces serif), CSS mockupy zamiast screenów, USP checklisty, sekcja cennika (79 zł/mies.), FAQ accordion, 3 CTA z `data-action="google-signin"` |
| Cennik | Pojedynczy plan miesięczny 79 zł/mies., lista 10 cech, 3 bloki kontekstowe obok |
| Częściowe płatności | Tekst „Częściowo opłacona (X zł)" zamiast ikony ½; zaległość = pełna stawka − wpłacona kwota |
| Spójność zaległości | Jedna formuła `full - partialPaymentAmount` we wszystkich widokach (kalendarz focus, finanse, pacjent) |
| Przenoszenie sesji | Status płatności (`isPaid`, `paymentId`, `paymentAmount` itp.) zachowywany po przeniesieniu; data aktualizowana w powiązanej płatności |
| Usuwanie sesji | Dodana opcja „Usuń sesję" w modalu szczegółów sesji |
| Dark mode — kalendarz | Pełne nadpisania kolorów: `.cal-day-num`, `.cal-week-time-label`, `.cal-daily-header`, `.cal-cell-blocked`, scrollbary |
| Usunięte belki | `.cal-grid-headers` i `.cal-sessions-list-header` ukryte (`display:none`) — nie niosły informacji i robiły jasne pasy w dark mode |
| Tygodniowy — kolumny | Minimalna szerokość kolumny 110px, poziomy scroll gdy ekran za wąski. Jeden kontener `.cal-week-scroll` (overflow:auto) zamiast podwójnego overflow-y hack |
| Tygodniowy — wysokość | Focus panel ukryty w widoku tygodniowym; slot 52px→40px — 6-8 godzin widocznych bez scrollowania |
| Dzienny — scroll iOS | Usunięty `overflow:hidden` z `.cal-wrapper--daily`; scroll obsługiwany przez `#view-container` (naprawiony zablokowany scroll na iOS) |
| Pacjenci — układ mobile | Toolbar bez stylu karty (bez tła/cienia), usunięty pusty prostokąt pod listą pacjentów |
| Urlopy pacjentów | Dodanie urlopu automatycznie odwołuje zaplanowane sesje w zakresie dat; usunięcie urlopu przywraca sesje do stanu `scheduled` |
| generatedMonths | Persystowane na Google Drive — zapobiega duplikacji sesji po przeładowaniu (szczególnie dla przeniesionych terminów) |
| Poprzednie terapie | Cykle terapii w widoku pacjenta pokazują daty rozpoczęcia i zakończenia; etykieta „Poprzednia terapia" zamiast „Przed aplikacją" |

---

*Dokument wygenerowany: 2026-03-23, zaktualizowany: 2026-04-08*
*Wersja cache: gabinet-v48*
*Łączna liczba linii kodu: ~11 500*
