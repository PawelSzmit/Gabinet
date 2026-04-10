# Review fazy 4

Data: 2026-04-10
Faza: `Unit 4 - finanse i jedno zrodlo prawdy dla platnosci`
Decyzja bramki: gotowe do dalszej pracy z zastrzezeniami

## Liczniki

- `P1`: 0
- `P2`: 2
- `P3`: 0

## Findings

### P2 — filtr daty platnosci gubi rekord zapisany na wybrany dzien

- Plik: [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js#L385)
- Problem:
  - lista platnosci filtruje zakres po prostym porownaniu stringow `payment.date < YYYY-MM-DD`,
  - ale nowo zapisany rekord przechodzi przez `createPayment()`, ktore normalizuje date do ISO z godzina i strefa, np. `2026-04-06T22:00:00.000Z` dla lokalnego `2026-04-07`,
  - w efekcie filtr `Od = 2026-04-07` potrafi odrzucic platnosc zapisana przez uzytkownika wlasnie na `2026-04-07`.
- Dowod:
  - lokalny check Node pokazal:
    - `paymentDate = 2026-04-06T22:00:00.000Z`
    - `from = 2026-04-07`
    - `paymentDate < from === true`
- Skutek:
  - po `Unit 4` dashboard i revenue licza po platnosciach, ale lista filtrowana po dniu moze ukryc realny rekord,
  - to podwaza obiecana spojność finansow „jedno zrodlo prawdy”.
- Rekomendacja:
  - filtrowac po tej samej semantyce daty co UI, np. przez helper zwracajacy lokalny klucz dnia `YYYY-MM-DD` z `payment.date`,
  - nie porownywac surowych stringow ISO z polami `<input type="date">`.

### P2 — edycja platnosci zapisuje date w innym formacie niz tworzenie nowej platnosci

- Plik: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L413)
- Problem:
  - przy tworzeniu nowej platnosci data przechodzi przez `createPayment()` i jest normalizowana,
  - przy edycji tego samego rekordu `savePaymentRecord()` wpisuje `paymentRecord.date = data.date || paymentRecord.date` bez normalizacji,
  - przez to po jednym przebiegu model ma date jako ISO z czasem, a po innym jako surowe `YYYY-MM-DD`.
- Skutek:
  - sortowanie, eksport i filtrowanie zaczynaja zalezec od historii rekordu, a nie od jednej reguly modelu,
  - to utrudnia utrzymanie deklarowanego „finalnego modelu danych” dla finansow.
- Rekomendacja:
  - w branchu edycji przepuscic `data.date` przez ten sam normalizator co przy tworzeniu,
  - najlepiej domknac to w jednym helperze, zeby zapis nowy i zapis po edycji nie rozchodzily sie ponownie.

## Co sprawdzono

- dokumenty task bundle:
  - [task.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/task.md)
  - [checklist.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/checklist.md)
  - [context.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/context.md)
- plan techniczny:
  - [2026-04-09-gabinet-unification-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-09-gabinet-unification-plan.md)
  - [2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)
- implementacje:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
  - [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
- weryfikacja:
  - `git status --short`
  - `node` check prostego przypadku filtra daty

## Podsumowanie

Kierunek `Unit 4` jest dobry: logika zapisu i usuwania platnosci zostala zebrana do jednego toru, a split payment nie zawyza juz revenue by method. Bramka nie jest zablokowana, ale przed dalszym domykaniem projektu warto poprawic dwie rzeczy zwiazane z data platnosci, bo to jest teraz najwieksze zrodlo potencjalnych cichych rozjazdow w finansach.
