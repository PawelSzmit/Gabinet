# Gabinet Terapeutyczny

Aplikacja PWA do zarządzania gabinetem psychoterapeutycznym. Umożliwia prowadzenie kalendarza sesji, bazy pacjentów, rozliczeń finansowych i statystyk — wszystko zsynchronizowane z Google Drive.

## Funkcjonalności

### Kalendarz
- Widok miesięczny, tygodniowy (Pn–Pt) i dzienny
- Automatyczne generowanie sesji na podstawie harmonogramu pacjentów
- Regeneracja kalendarza na wybrany miesiąc (Ustawienia)
- Godziny poza pracą zaznaczone na szaro (wg ustawień)
- Zmiana statusu sesji: zaplanowana / odbyta / odwołana
- Przenoszenie sesji na inny termin

### Pacjenci
- Dodawanie, edycja i archiwizacja pacjentów
- Pseudonimy dla zachowania prywatności
- Konfiguracja dni i godzin sesji na pacjenta
- Okresy urlopowe pacjenta
- Numeracja sesji z obsługą cykli terapii
- Przywracanie pacjentów z archiwum

### Notatki kliniczne
- Szyfrowane notatki do sesji (AES-256-GCM)
- Cele terapeutyczne z śledzeniem postępów
- Dziennik postępów z kategoryzacją (Przełom / Obserwacja / Zmiana / Inne)
- Oś czasu wpisów

### Finanse
- Rejestracja płatności z przypisaniem do sesji
- Źródła płatności: Alior Bank, ING Bank, Gotówka
- Wykres przychodów miesięcznych
- Filtrowanie płatności po zakresie dat

### Statystyki
- Łączna liczba sesji, sesje odbyte, średnia tygodniowa i miesięczna
- Wskaźnik odwołań, nowi pacjenci, trend przychodów
- Najlepszy i najgorszy miesiąc pod względem przychodów
- Wykres liniowy sesji w czasie (odbyte vs odwołane)
- Wykres liniowy wpłat w czasie (z podziałem na źródła)
- Filtrowanie: 3 / 6 / 12 miesięcy lub dowolny zakres dat

### Ustawienia
- Dane terapeuty (imię, adres, NIP)
- Godziny pracy per dzień tygodnia
- Urlopy terapeuty (blokowane okresy)
- Regeneracja kalendarza na wybrany miesiąc
- Ręczna synchronizacja z Google Drive
- Reset danych

## Technologie

| Warstwa | Technologia |
|---------|-------------|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Styl | Liquid Glass Design System (glassmorphism) |
| Typografia | Playfair Display (serif) + System fonts (sans-serif) |
| Wykresy | Chart.js |
| Uwierzytelnianie | Google OAuth 2.0 |
| Przechowywanie | Google Drive API v3 |
| Szyfrowanie | Web Crypto API (AES-256-GCM) |
| Offline | Service Worker z cache |
| Hosting | GitHub Pages |

## Struktura projektu

```
Gabinet-PWA/
├── index.html              # Główny plik HTML (SPA)
├── manifest.json           # Manifest PWA
├── service-worker.js       # Service Worker (cache v6)
├── .gitignore
│
├── css/
│   ├── main.css            # Zmienne, layout, nawigacja, login
│   ├── components.css      # Przyciski, formularze, karty, modale
│   └── calendar.css        # Widoki kalendarza
│
├── js/
│   ├── config.js           # Klucze Google API (nie w repozytorium)
│   ├── config.example.js   # Szablon konfiguracji
│   ├── app.js              # Routing, inicjalizacja, stan globalny
│   ├── auth.js             # Google OAuth 2.0
│   ├── drive.js            # Synchronizacja z Google Drive
│   ├── encryption.js       # Szyfrowanie notatek (AES-256-GCM)
│   ├── patients.js         # CRUD pacjentów
│   ├── sessions.js         # Generowanie i zarządzanie sesjami
│   ├── calendar.js         # Renderowanie kalendarza
│   ├── payments.js         # Rejestracja płatności
│   ├── finance.js          # Wykresy przychodów
│   ├── stats.js            # Moduł statystyk
│   ├── notes.js            # Notatki, cele, postępy
│   ├── archive.js          # Archiwizacja pacjentów
│   └── utils.js            # Funkcje pomocnicze
│
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Instalacja i uruchomienie

### Wymagania
- Konto Google
- Projekt w [Google Cloud Console](https://console.cloud.google.com) z włączonymi API:
  - Google Drive API
  - Google Identity Services

### Konfiguracja

1. Sklonuj repozytorium:
   ```bash
   git clone https://github.com/PawelSzmit/Gabinet.git
   cd Gabinet
   ```

2. Skopiuj plik konfiguracyjny i uzupełnij klucze:
   ```bash
   cp js/config.example.js js/config.js
   ```
   Edytuj `js/config.js` i wpisz:
   - `GOOGLE_CLIENT_ID` — identyfikator klienta OAuth 2.0
   - `GOOGLE_API_KEY` — klucz API Google

3. Skonfiguruj ograniczenia w Google Cloud Console:
   - **API Key** → Application restrictions → HTTP referrers → dodaj domenę hostingu
   - **OAuth Client ID** → Authorized JavaScript origins → dodaj domenę hostingu

### Uruchomienie lokalne

Aplikacja wymaga serwera HTTP (nie działa z `file://`):

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

Otwórz `http://localhost:8000` w przeglądarce.

### Deployment na GitHub Pages

Aplikacja jest automatycznie wdrażana na GitHub Pages z gałęzi `main`. Po pushu zmiany są dostępne pod:

```
https://pawelszmit.github.io/Gabinet/
```

## Nawigacja w aplikacji

| Widok | Ścieżka | Opis |
|-------|---------|------|
| Kalendarz | `#/calendar` | Widok domyślny — kalendarz sesji |
| Pacjenci | `#/patients` | Lista aktywnych pacjentów |
| Finanse | `#/finance` | Wykresy przychodów i lista płatności |
| Statystyki | `#/stats` | Szczegółowe statystyki i wykresy |
| Ustawienia | `#/settings` | Konfiguracja gabinetu |

## Model danych

Dane przechowywane są jako jeden plik JSON na Google Drive:

```json
{
  "patients": [],
  "sessions": [],
  "payments": [],
  "sessionNotes": [],
  "blockedPeriods": [],
  "settings": {
    "therapistName": "",
    "therapistAddress": "",
    "therapistNIP": "",
    "workingHours": {}
  }
}
```

### Statusy sesji

| Status | Opis |
|--------|------|
| `scheduled` | Zaplanowana (domyślny) |
| `completed` | Odbyta |
| `cancelled` | Odwołana (z opcją „wymagana płatność") |

### Źródła płatności

| Kod | Opis |
|-----|------|
| `alior` | Alior Bank |
| `ing` | ING Bank |
| `cash` | Gotówka |

## Design System — Liquid Glass

Interfejs oparty jest na stylu glassmorphism inspirowanym macOS Tahoe (Apple WWDC 2025).

### Paleta kolorów

| Zmienna | Wartość | Zastosowanie |
|---------|---------|-------------|
| `--primary` | `#007AFF` | Akcenty, przyciski, linki |
| `--success` | `#34C759` | Powodzenie, status opłacona |
| `--warning` | `#FF9F0A` | Ostrzeżenia, odwołane z płatnością |
| `--danger` | `#FF3B30` | Błędy, usuwanie, nieopłacone |

### Efekty szkła

```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.5);
```

## Bezpieczeństwo

- **Szyfrowanie notatek**: Treści notatek klinicznych szyfrowane algorytmem AES-256-GCM (Web Crypto API) przed zapisem na Google Drive
- **Pseudonimy**: Pacjenci identyfikowani pseudonimem, nie imieniem i nazwiskiem
- **OAuth 2.0**: Autoryzacja przez Google z automatycznym odświeżaniem tokena
- **Klucze API**: Przechowywane w pliku `config.js` poza repozytorium; ograniczone do domeny w Google Cloud Console

## Licencja

Projekt prywatny. Wszelkie prawa zastrzeżone.
