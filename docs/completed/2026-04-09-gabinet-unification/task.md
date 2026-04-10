# Task: Scalenie `Gabinet` i `GabinetPWA`

Branch: `main`
Recommended branch: `codex/gabinet-unification`
Last updated: 2026-04-10 (Unit 5)

## Cel

Doprowadzic projekt do jednej, spojnej aplikacji w katalogu root `Gabinet`, bez utraty kluczowych funkcji z rownolegle rozwijanej wersji `GabinetPWA`.

Scalanie ma byc selektywne:

- bezpieczenstwo, offline i synchronizacja sa brane glownie z `GabinetPWA`,
- finanse, split payment i nowsze poprawki biznesowe sa scalane ostroznie z przewaga tego, co jest lepsze funkcjonalnie,
- root pozostaje finalnym miejscem produktu, ale nie jest automatycznie zwyciezca w kazdym obszarze.

## Zakres

Zadanie obejmuje piec glownego pakietu wykonawczego i jeden etap przygotowawczy:

0. Baseline i zabezpieczenie wykonania
1. Fundament security, offline i sync w root
2. Model danych i migracje
3. Widoki kliniczne i ustawienia
4. Finanse i jedno zrodlo prawdy dla platnosci
5. Shell, PWA assets i cleanup

## Poza zakresem

- big-bang merge jednego katalogu nad drugim,
- przepisywanie aplikacji od zera,
- backend,
- deploy i push bez osobnej decyzji,
- usuniecie `GabinetPWA` przed koncowa weryfikacja.

## Aktualny status

- Unit 0: ukonczony
- Unit 1: ukonczony po poprawkach kompatybilnosci i krotkim smoke tescie online/offline
- Unit 2: ukonczony
- Unit 3: ukonczony po poprawce i re-review
- Unit 4: ukonczony
- Unit 5: ukonczony

## Status po Unit 1

- lokalny snapshot offline zostal przeniesiony do root,
- root nadal korzysta z `drive.file`,
- w ustawieniach widac stan synchronizacji i lokalnej kopii,
- odlaczenie Google nie powinno juz wyrzucac uzytkownika z lokalnej pracy,
- root zachowuje `settings.clinicalSecurity` przy loadzie danych,
- widoki root rozpoznaja zaszyfrowane envelope kliniczne z `GabinetPWA` i nie traktuja ich juz jak zwyklego stringa,
- fundament `SecurityService` zostal przeniesiony, ale pelne haslo kliniczne nadal czeka na Unit 2,
- krotki smoke test potwierdzil scenariusz:
  - start online bez snapshotu daje stan `0 / 0 / 0`,
  - start z lokalnego snapshotu przywraca dane `6 / 74 / 24`,
  - odswiezenie offline nie gubi danych,
  - powrot online i lokalny zapis aktualizuja snapshot.

## Status po Unit 2

- model danych root obsluguje format `version = 3`,
- `serializeAppData()` jest asynchroniczne i przechodzi przez `SecurityService.prepareDataForStorage()`,
- import starego root `v2` uzupelnia historyczna kwote sesji z karty pacjenta, gdy stare dane mialy `paymentAmount: null`,
- `migrationIssues` zostaly dodane jako jawny sygnal problemow migracji,
- partial payment i split payment zostaly zachowane w modelu,
- eksport JSON w ustawieniach czeka na async `serializeAppData()`,
- jawne dane kliniczne nie powinny zostac wyeksportowane bez hasla klinicznego,
- po ustawieniu hasla dane kliniczne sa zapisywane jako envelope `__clinicalEncrypted`,
- pelne uporzadkowanie widokow klinicznych, odblokowania i ustawien pozostaje zakresem `Unit 3`.

## Status po Unit 3

- dane kliniczne sa teraz realnie ukrywane w widoku pacjenta i kalendarza, gdy ochrona jest locked albo wymaga ustawienia hasla,
- uzytkownik dostaje prosta akcje: `Ustaw haslo` przed migracja albo `Odblokuj notatki` po skonfigurowaniu hasla,
- auto-lock blokuje tylko dane kliniczne, a nie cala aplikacje,
- ustawienia odswiezaja stan ochrony po ustawieniu, zablokowaniu, odblokowaniu i zmianie hasla,
- widoki nie uzywaja juz bezposrednio starego `Encryption.encrypt()` / `Encryption.decrypt()` do notatek klinicznych,
- przy ustawianiu hasla aplikacja probuje przeniesc stare rootowe zaszyfrowane stringi kliniczne do nowego envelope,
- backup referencyjny nadal laduje sie jako `6 / 74 / 24`, bez problemow migracji,
- poprawka i re-review zamknely bloker w scenariuszu sign-out po odblokowaniu danych klinicznych,
- kolejnym etapem jest `Unit 4`: finanse i jedno zrodlo prawdy dla platnosci.

## Status po Unit 4

- zapis, edycja i usuwanie platnosci przechodza teraz przez wspolne helpery w `js/data.js`, zamiast recznie ustawiac status sesji w widoku finansow,
- `reconcilePaymentStatus()` czyści tez stare flagi platnosci na sesjach, wiec po zmianie lub usunieciu platnosci nie zostaje juz „stary” stan na odlaczonej sesji,
- dashboard finansowy liczy przychod po dacie platnosci i po rekordach `payments`, tak samo jak lista platnosci,
- revenue per metoda liczy split payment bez proporcji opartych o pelna kwote sesji, wiec partial + split nie zawyzaja juz wykresu,
- zachowane zostaly partial payment i split payment,
- kolejnym etapem jest `Unit 5`: shell, PWA assets i cleanup.

## Status po Unit 5

- rootowy `sw.js` stal sie jedynym utrzymywanym service workerem aplikacji i ma juz pelna liste aktualnie ladowanych plikow root, w tym `js/security.js` i `js/local-store.js`,
- cache PWA uzywa wzglednych sciezek, wiec shell jest mniej kruchy przy uruchamianiu z podfolderu,
- `manifest.json` ma spojne `id`, `scope`, `start_url` i kolor motywu wzgledem rootowego shellu,
- katalog `GabinetPWA` zostal oznaczony jako archiwalne zrodlo porownawcze, ale nie zostal jeszcze usuniety,
- README opisuje juz aktualny uklad root zamiast starego `service-worker.js` i nieistniejacych plikow konfiguracyjnych,
- po poprawkach po review fazy 5 root przeszedl tez koncowy smoke PWA w Chromium:
  - reload po rejestracji service workera na desktopie,
  - reload w emulacji mobilnej,
  - check instalowalnosci bez bledow manifestu,
- wszystkie unity `0-5` sa wykonane, a kolejnym krokiem jest archiwizacja taska przez `dev-docs-complete`.

## Kryteria akceptacji

- jest jedna finalna aplikacja w root,
- dane kliniczne sa chronione osobnym haslem,
- aplikacja ma lokalny snapshot offline po odswiezeniu,
- root nadal korzysta z `drive.file`, a nie z `drive.appdata`,
- split payment i partial payment pozostaja dostepne,
- dashboard, lista platnosci i kalendarz nie pokazuja sprzecznych danych dla tych samych rekordow.

## Zrodla

- wymagania: [docs/brainstorms/2026-04-09-gabinet-unification-requirements.md](/Users/pawelszmit/Desktop/Gabinet/docs/brainstorms/2026-04-09-gabinet-unification-requirements.md)
- plan techniczny: [docs/plans/2026-04-09-gabinet-unification-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-09-gabinet-unification-plan.md)
- plan split payment: [docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)
- historyczny pakiet security/offline: [docs/completed/2026-04-08-security-offline-finance/task.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/completed/2026-04-08-security-offline-finance/task.md)
