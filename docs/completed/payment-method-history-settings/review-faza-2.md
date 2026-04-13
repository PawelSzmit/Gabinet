# Review fazy 2: migracja i spójność starych danych

Status: **kontynuacja możliwa z zastrzeżeniami**
Data review: 2026-04-11
Faza: `Faza 2: Migracja`

## Wynik

- P1: 0
- P2: 2
- P3: 0

## Ustalenia

### P2 — migracja nie kanonizuje zapisanych identyfikatorów metod do slotów `pm1`–`pm4`

- Plik: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L621)
- Linie: 621–633, 566–621, 1099–1124

Plan dla fazy 2 mówił o zamapowaniu starych metod `aliorBank`, `ingBank`, `cash` na nowe sloty. W praktyce rekordy `payment` po migracji dalej przechowują stare wartości tekstowe, bo `createPayment()` zapisuje `data.method` bez normalizacji, a `migrateLegacyPaidSessionsToPayments()` przekazuje dalej surowe `aliorBank` / `cash`.

Sprawdziłem to na prostym teście migracji: po `deserializeAppData()` nowo utworzony rekord płatności nadal miał `method: "aliorBank"`, a nie `pm1`.

To nie psuje wszystkiego natychmiast, bo część nowych helperów umie jeszcze czytać stare identyfikatory. Ale zostawia system w dwóch formatach naraz, co osłabia całą ideę „jednego źródła prawdy” i utrudni kolejne fazy, zwłaszcza filtry i raporty liczące po identyfikatorze.

**Rekomendacja:** w tej warstwie migrować i zapisywać już kanoniczne `pm1`–`pm4` w `payment.method` i `payment.splitMethod`, zamiast odkładać normalizację na późniejsze odczyty.

### P2 — uszkodzony wpis historii z obcym `methodId` jest przypisywany do `pm1`

- Plik: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L164)
- Linie: 164–172

`createPaymentMethodHistoryEntry()` przyjmuje nieznany `methodId` i po nieudanej normalizacji podstawia pierwszy slot (`pm1`). To oznacza, że uszkodzony wpis historii może zostać cicho podpięty pod prawdziwą metodę i zacząć fałszować jej historię nazw.

Sprawdziłem to bezpośrednio: wpis historii `{ methodId: 'blik', label: 'BLIK' }` po przejściu przez `createPaymentMethodSettings()` kończy jako wpis dla `pm1`.

To jest szczególnie groźne właśnie w fazie migracji, bo dotyczy importu starych lub uszkodzonych danych. Zamiast wykryć problem i dać fallback, system dopisuje błędną etykietę do realnej metody.

**Rekomendacja:** nie tworzyć wpisu historii dla nieznanego `methodId` bez jawnego oznaczenia problemu; lepiej zwrócić `null`, pominąć taki wpis i dodać `migrationIssue`.

## Co sprawdziłem

- porównanie implementacji z planem i checklistą fazy 2
- przegląd [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
- `node --check js/data.js`
- lokalne testy w Node dla:
  - migracji legacy sesji do płatności
  - tworzenia historii z uszkodzonym `methodId`

## Czego nie potwierdziłem

- nie sprawdzałem jeszcze widoków UI, bo ta faza ich nie obejmowała
- nie sprawdzałem jeszcze realnego importu dużego backupu użytkownika
- nie oceniałem kolejnych faz poza wpływem na migrację

## Wniosek

Faza 2 jest na dobrym tropie: bootstrap historii, `migrationIssues` i warning migracyjny już istnieją. Nadal są jednak dwie ważne nieszczelności w samej migracji danych. Obie nie blokują całego projektu jak P1, ale przed wejściem w fazy UI warto je poprawić, żeby kolejne warstwy nie musiały działać na mieszanym albo błędnie przypisanym stanie.

## Status po poprawkach

- 2026-04-11: poprawiono oba wskazane problemy w `js/data.js`.
- Dodatkowa weryfikacja:
  - rekord płatności po migracji dostaje `methodId` / `splitMethodId` w formacie `pm1`–`pm4`,
  - stare pola `method` / `splitMethod` pozostają tymczasowo dla zgodności z obecnym UI przed fazą 4,
  - błędny wpis historii z obcym `methodId` nie jest już przypisywany do `pm1`,
  - taki wpis jest pomijany i zgłaszany do `migrationIssues`.
- Ten raport pozostaje jako zapis review; faza 2 jest po poprawkach gotowa do dalszej pracy.
