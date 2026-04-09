# Review fazy 6

Data: 2026-04-09
Status bramki: kontynuacja z zastrzeżeniami
Zakres: Faza 6 — porządki w starych fallbackach

## Podsumowanie

- P1: 0
- P2: 2
- P3: 0

## Co sprawdziłem

- dokumenty zadania w `docs/active/2026-04-08-security-offline-finance/`
- kod fallbacków w [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
- helpery płatności w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
- główne widoki finansów i pacjentów w [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/finance.js) i [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js)
- `node --check js/app.js`
- wyszukanie `localStorage` w `js/drive.js` i `js/app.js`

## Findings

### P2. Fallback edycji i usuwania wizyty nadal omija wspólną logikę płatności

W Fazie 6 fallback sesji przestał używać legacy `fee`, ale dalej zapisuje zmiany bez przejścia przez helpery płatności. Przy zapisie zmienia tylko `session.status` i `session.paymentAmount`, a przy usunięciu po prostu wycina sesję z `AppState.sessions`. To omija `recordPaymentForSessions()` i `detachPaymentFromSessions()`, więc opłacona sesja może rozjechać się z rekordem w `AppState.payments`, a usunięcie sesji może zostawić martwe `sessionId` w płatności. Główny widok finansów nadal czyta listę płatności z `AppState.payments`, więc po takim fallbackowym zapisie liczby mogą być sprzeczne między ekranami.

Dowody:
- zapis i usunięcie w fallbacku: [js/app.js:1011](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js#L1011), [js/app.js:1019](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js#L1019)
- jedyna spójna ścieżka płatności: [js/data.js:346](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js#L346), [js/data.js:362](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js#L362)
- widok płatności opiera się na `AppState.payments`: [js/views/finance.js:333](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/finance.js#L333)

### P2. Fallback tworzenia pacjenta nadal zapisuje rekord niezgodny z głównym modelem

Awaryjny formularz pacjenta zbiera tylko imię, nazwisko, telefon, e-mail i stawkę. Nie zbiera `therapyStartDate` ani `sessionDayConfigs`, chociaż główny formularz pacjenta traktuje te dane jako obowiązkowe. W praktyce fallback może utworzyć pacjenta bez harmonogramu, a generator sesji wtedy nic nie wygeneruje. Dodatkowo fallback dalej zapisuje `phone` i `email`, których główny widok pacjenta już nie pokazuje ani nie edytuje, więc dokładamy z powrotem stary, częściowo ukryty kształt danych.

Dowody:
- fallback zapisuje tylko uproszczony zestaw pól: [js/app.js:1138](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js#L1138), [js/app.js:1188](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js#L1188)
- główny formularz wymaga daty startu i dni sesji: [js/views/patients.js:681](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js#L681), [js/views/patients.js:1378](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js#L1378)
- generator sesji zwraca pustą listę bez `sessionDayConfigs`: [js/data.js:678](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js#L678)

## Dodatkowe uwagi

- Stare finding o tokenie OAuth w `localStorage` nie odtwarza się już w aktualnym kodzie. Wyszukanie pokazało tylko czyszczenie legacy wpisów przez `localStorage.removeItem(...)` w [js/drive.js:305](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js#L305).

## Werdykt

Faza 6 poprawiła najważniejszy bałagan z legacy polami, ale nie domknęła jeszcze dwóch istotnych ścieżek fallbackowych. To nie blokuje dalszego rozumienia kodu, ale nie zamykałbym zadania przez `dev-docs-complete`, dopóki nie dopniemy tych dwóch punktów.
