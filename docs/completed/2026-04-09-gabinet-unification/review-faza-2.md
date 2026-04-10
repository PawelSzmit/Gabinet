# Review fazy 2 - 2026-04-10

## Status

- Faza: `Unit 2 - model danych i migracje`
- Decyzja bramki: zablokowane przed `Unit 3`
- `P1`: 2
- `P2`: 0
- `P3`: 0

## Zakres review

Sprawdzono wykonanie `Unit 2` wzgledem:

- [task.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/task.md)
- [context.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/context.md)
- [checklist.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/checklist.md)
- [docs/plans/2026-04-09-gabinet-unification-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-09-gabinet-unification-plan.md)

Najwazniejsze kryteria z planu:

- jeden nowy numer wersji danych,
- async `serializeAppData()`,
- dane kliniczne przechodza przez `SecurityService`,
- `paymentAmount` pozostaje historyczna kwota sesji,
- partial payment i split payment zostaja zachowane,
- stary eksport root v2 i dane z `GabinetPWA` laduja sie poprawnie,
- eksport JSON nie zawiera jawnych danych klinicznych.

## Findings

### Finding 1 (P1): zablokowany zapis dokleja dane kliniczne po indeksach tablic

Plik: [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)

Zakres: linie 258-266 oraz 604-611

`prepareDataForStorage()` w stanie zablokowanym bierze aktualny stan aplikacji i dokleja zaszyfrowane pola kliniczne ze starego `_protectedState`. Problem polega na tym, ze `_mergeProtectedFields()` robi to po sciezce tablicy, np. `sessions[0].sessionNotes`, a nie po stabilnym `id` rekordu.

To jest blokujace, bo jesli uzytkownik w stanie locked usunie albo przestawi rekord, indeks `sessions[0]` moze oznaczac juz inna sesje. Wtedy eksport moze przypisac notatke kliniczna z usunietej sesji do innej sesji.

Potwierdzenie testem:

- utworzono dwie sesje `s1` i `s2` z notatkami `note-one` i `note-two`,
- ustawiono haslo kliniczne,
- zablokowano dane kliniczne,
- usunieto `s1`,
- wykonano eksport w stanie locked,
- eksport zawieral tylko `s2`, ale po odszyfrowaniu jej notatka byla `note-one`.

To oznacza ryzyko pomieszania danych klinicznych miedzy rekordami.

Rekomendacja:

- nie mergowac chronionych pol po indeksach tablic,
- dla sesji i pacjentow laczyc protected fields po stabilnych `id`,
- dla zagniezdzonych notatek/celow/wpisow rowniez preferowac `id`,
- jesli nie da sie jednoznacznie dopasowac rekordu w stanie locked, przerwac zapis czytelnym bledem i poprosic o odblokowanie danych klinicznych.

### Finding 2 (P1): `bootstrapFromLoadedState()` moze zostawic stary `_protectedState` po wczytaniu nowych danych

Plik: [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)

Zakres: linie 162-166

Na poczatku `bootstrapFromLoadedState()` jest szybki return: jesli `SecurityService` jest skonfigurowany, ma juz `_protectedState` i nie jest odblokowany, funkcja tylko ustawia status `locked` i konczy dzialanie. To oznacza, ze po `deserializeAppData()` z nowego zrodla danych chroniony stan moze nie zostac odswiezony.

W praktyce ryzykowny scenariusz wyglada tak:

- aplikacja startuje z lokalnego snapshotu i ustawia `_protectedState`,
- pozniej Google Drive zwraca nowszy plik,
- `deserializeAppData()` wczytuje nowszy plik,
- `bootstrapFromLoadedState()` widzi stary `_protectedState` i wychodzi bez jego podmiany,
- po wpisaniu hasla `_unlockWithPassword()` odszyfrowuje stary protected state, czyli moze przywrocic poprzednie dane i przykryc nowsze.

To jest blokujace, bo Unit 2 dotyka dokladnie styku migracji, lokalnego snapshotu i chronionych danych. Bez poprawki mozna miec poprawny JSON z Drive, ale po odblokowaniu zobaczyc poprzedni stan z pamieci.

Rekomendacja:

- po kazdym `deserializeAppData()` protected state powinien byc budowany z aktualnie wczytanego JSON-a,
- szybki return moze zostac tylko dla sytuacji, gdzie nie bylo nowego loadu danych,
- rozwazyc jawny parametr, np. `bootstrapFromLoadedState({ forceRefreshProtectedState: true })`,
- po odswiezeniu protected state ponownie zastosowac locked view na aktualnych danych.

## Pozytywne obserwacje

- `serializeAppData()` zostalo poprawnie przestawione na async i wersje `3`.
- Eksport w ustawieniach robi `await serializeAppData()`, wiec nie zapisuje `[object Promise]`.
- `paymentAmount: null` ze starego backupu root jest uzupelniane stawka pacjenta.
- Partial payment i split payment zostaly zachowane w modelu.
- Dodanie `migrationIssues` jest dobrym kierunkiem, bo daje jawny kanal na problemy migracji.

## Weryfikacja wykonana w review

- `git status --short`
- `node --check js/data.js`
- `node --check js/security.js`
- `node --check js/views/settings.js`
- `git diff --check`
- targeted code review:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
  - [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
- dodatkowy smoke Playwright potwierdzajacy finding 1.

## Wniosek

`Unit 2` ma dobry kierunek i domyka wiekszosc planowanego zakresu, ale nie powinien przechodzic do `Unit 3` bez poprawy dwoch mechanizmow protected state. Oba dotycza integralnosci danych klinicznych, wiec traktuje je jako blokujace.
