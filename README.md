# Gabinet

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
| Styl | Wlasny CSS aplikacji |
| Typografia | Fraunces + Manrope |
| Wykresy | Wlasne komponenty JS/DOM |
| Uwierzytelnianie | Google OAuth 2.0 |
| Przechowywanie | Google Drive API v3 |
| Szyfrowanie | Web Crypto API (AES-256-GCM) |
| Offline | Service Worker z cache |
| Hosting | GitHub Pages |

## Struktura projektu

```
Gabinet/
├── index.html              # Glowny shell aplikacji i landing page
├── styles.css              # Style rootowej aplikacji
├── manifest.json           # Manifest PWA
├── sw.js                   # Service Worker rootowej aplikacji
├── icons/                  # Ikony PWA
├── js/
│   ├── app.js              # Inicjalizacja i routing
│   ├── data.js             # Model danych i migracje
│   ├── drive.js            # Synchronizacja z Google Drive
│   ├── encryption.js       # Kompatybilnosc ze starszym szyfrowaniem
│   ├── security.js         # Ochrona danych klinicznych
│   ├── local-store.js      # Lokalny snapshot offline
│   ├── utils.js            # Funkcje pomocnicze
│   └── views/              # Widoki aplikacji
└── docs/                   # Task bundle, plany, notatki i archiwalne zrodla
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

2. Skonfiguruj ograniczenia w Google Cloud Console dla klienta OAuth używanego przez aplikację:
   - **OAuth Client ID** → Authorized JavaScript origins → dodaj domenę hostingu
   - jeśli korzystasz z własnego projektu Google, podmień identyfikator klienta w [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/js/drive.js)

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
- **Google OAuth**: klient Google jest konfigurowany w [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/js/drive.js); dostęp ograniczaj po domenie w Google Cloud Console

## Licencja

Projekt prywatny. Wszelkie prawa zastrzeżone.
