# Review fazy 1: fundament danych

Status: **kontynuacja możliwa z zastrzeżeniami**
Data review: 2026-04-11
Faza: `Faza 1: Model danych`

## Wynik

- P1: 0
- P2: 2
- P3: 0

## Ustalenia

### P2 — `normalizePaymentMethodId()` nie pilnuje zasady 4 stałych slotów

- Plik: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L118)
- Linie: 118–148

`normalizePaymentMethodId()` zwraca nieznany identyfikator bez odrzucenia, a `createPaymentMethodHistoryEntry()` przyjmuje go dalej do historii. To łamie ustalone założenie, że system ma działać tylko na 4 stałych slotach (`pm1`–`pm4`).

Praktyczny skutek: jeśli do historii trafi błędny albo stary identyfikator spoza slotów, część helperów go zachowa, ale inne helpery oparte o `getPaymentMethodSlotIds()` już go nie pokażą. To tworzy cichy, niespójny stan: wpis istnieje w danych, ale może nie pojawić się w `Ustawieniach`, opcjach lub odczycie historii.

**Rekomendacja:** znormalizować nieznane identyfikatory do `null` i dopuścić ich obsługę dopiero w warstwie migracji / fallbacku, a nie w fundamencie danych.

### P2 — błędne `archivedAt` jest cicho zamieniane na dzisiejszą datę

- Plik: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L146)
- Linie: 146–154

`createPaymentMethodHistoryEntry()` woła `normalizeDateKey(data.archivedAt, null)`, ale `normalizeDateKey()` dla niepoprawnej wartości nie zwraca `null`, tylko dzisiejszą datę. To oznacza, że uszkodzony wpis historii może zostać „naprawiony” po cichu i wyglądać jak poprawne archiwum zamknięte dziś.

To jest sprzeczne z kierunkiem ustalonym dla tej funkcji: przy problemach z danymi system ma być czytelny i ostrożny, a nie maskować błąd. Taka zamiana utrudni później prawidłowe wykrycie problemów migracyjnych.

**Rekomendacja:** pozwolić `archivedAt` zostać `null` przy błędnej wartości albo zwracać jawny stan błędu do obsługi w fazie migracji.

## Co sprawdziłem

- porównanie implementacji z planem i checklistą fazy 1
- przegląd [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
- `node --check js/data.js`
- lokalny test helperów uruchomiony w Node

## Czego nie potwierdziłem

- nie było jeszcze testów integracyjnych z migracją
- nie było jeszcze testów na realnym UI, bo ta faza nie obejmowała widoków
- nie sprawdzałem kolejnych faz, tylko fundament danych

## Wniosek

Faza 1 jest blisko gotowości, ale przed wejściem w fazę 2 warto poprawić oba problemy w `js/data.js`. To nie blokuje całego projektu jak P1, ale jeśli zostaną, migracja i fallback danych będą trudniejsze i bardziej podatne na ciche błędy.

## Status po poprawkach

- 2026-04-11: poprawiono oba wskazane problemy w `js/data.js`.
- Dodatkowa weryfikacja:
  - `normalizePaymentMethodId('blik')` zwraca `null`
  - błędne `archivedAt` nie jest już zamieniane na dzisiejszą datę
- Ten raport pozostaje jako zapis review; aktualny stan fazy 1 jest gotowy do dalszej pracy.
