# Checklist

## Status unitow

- [x] Unit 0: baseline i zabezpieczenie wykonania
- [x] Unit 1: fundament security, offline i sync w root
- [x] Unit 2: model danych i migracje
- [x] Unit 3: widoki kliniczne i ustawienia
- [ ] Unit 4: finanse i jedno zrodlo prawdy dla platnosci
- [ ] Unit 5: shell, PWA assets i cleanup

## Zrobione w Unit 0

- [x] Sprawdzono git context (`branch`, `status`)
- [x] Potwierdzono brak istniejacego task bundle dla tego zadania w `docs/active`
- [x] Utworzono task bundle w `docs/active/2026-04-09-gabinet-unification/`
- [x] Podpieto task bundle do aktualnych dokumentow: requirements + plan
- [x] Spisano scenariusze bazowe do recznej weryfikacji po kolejnych unitach
- [x] Spisano decyzje nadrzedne: selektywne scalanie, root jako finalne miejsce produktu, `drive.file` jako twarda decyzja
- [x] Spisano najwazniejsze sygnaly z historii Git, w tym merge i revert `GabinetPWA -> ROOT`

## Do wykonania recznie obok Unit 0

- [x] Wykonac eksport danych z aktualnie uzywanej, zalogowanej aplikacji przed wiekszym scalaniem
- [x] Zanotowac wynik scenariuszy bazowych na realnych danych uzytkownika

## Do poprawy po review fazy 0

- [x] Wykonac eksport danych z aktualnie uzywanej, zalogowanej aplikacji i zapisac lokalizacje kopii referencyjnej
- [x] Uzupelnic `baseline.md` o rzeczywiste obserwacje mozliwe do odczytania z kopii referencyjnej
- [x] Rozdzielic w `baseline.md` stan obecny root od stanu docelowego po scaleniu, szczegolnie dla danych klinicznych
- [x] Dorecznie potwierdzic scenariusze UI, ktorych backup nie pokazuje: start bez Google, polaczenie z Google, odswiezenie offline
- [x] Po wykonaniu powyzszych krokow potwierdzic ponownie, czy Unit 0 moze byc oznaczony jako gotowy bez blokady

## Zrobione po review fazy 0

- [x] Skorygowano status `Unit 0`, aby nie byl oznaczony jako ukonczony przed eksportem danych referencyjnych
- [x] Dopracowano `baseline.md`, aby rozdzielal stan obecny root od stanu docelowego po scaleniu
- [x] Dopisano jawne blokery przed startem `Unit 1`
- [x] Podpieto rzeczywisty plik eksportu JSON jako kopie referencyjna
- [x] Uzupelniono reczne wyniki testow UI dla scenariuszy S1-S3

## Zadania do Unit 1

- [x] Przeniesc `js/security.js` do root
- [x] Przeniesc `js/local-store.js` do root
- [x] Zintegrowac `LocalStore` z root `js/app.js`
- [x] Zintegrowac `SecurityService` z root `js/app.js`
- [x] Przeniesc do root sync status i powiazania z ustawieniami
- [x] Scalac `js/drive.js` tak, aby:
  - [x] zachowac `drive.file`
  - [x] nie wracac do `appDataFolder`
  - [x] nie przechowywac sesji tak jak stary root
  - [x] wspierac lokalny snapshot
- [x] Dodac brakujacy wspolny `escapeHtml` do root `js/utils.js`
- [x] Upewnic sie, ze root startuje bez regresji ekranu auth i splash

## Weryfikacja planowana dla Unit 1

- [x] `node --check js/security.js`
- [x] `node --check js/local-store.js`
- [x] `node --check js/app.js`
- [x] `node --check js/drive.js`
- [x] `node --check js/views/settings.js`
- [x] `node --check js/data.js`
- [x] `node --check js/views/calendar.js`
- [x] `node --check js/views/patients.js`
- [x] Test scenariuszowy: root nadal korzysta z `drive.file`
- [x] Test scenariuszowy: brak powrotu do `drive.appdata`
- [x] Test scenariuszowy: aplikacja potrafi wystartowac z lokalnego snapshotu po odswiezeniu

## Wynik wykonania Unit 1

- [x] Root dostal nowe pliki `js/local-store.js` i `js/security.js`
- [x] `index.html` laduje nowe moduly oraz banner statusu synchronizacji
- [x] `styles.css` ma style bannera sync
- [x] `DriveService` zapisuje i odczytuje lokalny snapshot, ale zostaje przy `drive.file`
- [x] `App` potrafi wystartowac z lokalnego snapshotu bez aktywnej sesji Google
- [x] `Ustawienia` pokazuja stan synchronizacji i fundament ochrony danych klinicznych
- [x] Krotki smoke test online/offline po wdrozeniu

## Do poprawy po review fazy 1

- [x] Zachowac `settings.clinicalSecurity` przy `deserializeAppData()` i nie gubic tej konfiguracji podczas loadu root
- [x] Ustalic bezpieczna obsluge zaszyfrowanych envelope klinicznych z `GabinetPWA`, zeby widoki root nie traktowaly ich jak zwykly string
- [x] Po poprawkach wykonac krotki scenariusz: start online, odswiezenie offline, powrot online i zapis

## Wynik smoke testu po poprawkach Unit 1

- [x] Start online bez snapshotu pokazuje ekran logowania i pusty stan `0 / 0 / 0`
- [x] Po podstawieniu snapshotu z backupu aplikacja startuje online z danymi `6 / 74 / 24`
- [x] Po odswiezeniu offline aplikacja nadal pokazuje dane `6 / 74 / 24`
- [x] Po powrocie online i lokalnym zapisie snapshot aktualizuje sie z `lastSnapshotSource = local-change`
- [x] Status synchronizacji po lokalnym zapisie przechodzi na `Lokalne zmiany czekaja na synchronizacje`

## Re-review fazy 1 - 2026-04-10

- [x] Brak nowych findingow `P1`
- [x] Brak nowych findingow `P2`
- [x] Poprzednie findingi `P1` z `clinicalSecurity` i envelope klinicznych zamkniete
- [x] Poprzednie findingi `P2` ze smoke testu i baseline S4 zamkniete
- [x] Bramka po re-review: mozna przejsc do `Unit 2`

## Zadania do Unit 2

- [x] Dodac wspolne normalizatory danych dla liczb, dat, pol klinicznych i `clinicalSecurity`
- [x] Rozszerzyc `AppState` o `migrationIssues`
- [x] Ujednolicic factory modeli tak, aby zachowywaly dodatkowe pola z root i `GabinetPWA`
- [x] Utrzymac partial payment: `isPartiallyPaid` i `partialPaymentAmount`
- [x] Utrzymac split payment: `isSplit`, `splitMethod`, `splitAmounts`
- [x] Dodac wspolne `getSessionAmount()`
- [x] Przestawic `serializeAppData()` na async i wersje danych `3`
- [x] Przepuscic zapis danych przez `SecurityService.prepareDataForStorage()`
- [x] Zachowac migracje starych danych root `v2`
- [x] Zachowac kompatybilnosc z danymi klinicznymi z `GabinetPWA`
- [x] Poprawic eksport JSON w ustawieniach tak, aby czekal na async `serializeAppData()`

## Wynik Unit 2

- [x] Backup referencyjny `gabinet-backup-2026-04-09.json` laduje sie jako `6 / 74 / 24`
- [x] Sesje z `paymentAmount: null` dostaja historyczna kwote z aktualnej stawki pacjenta przy migracji
- [x] Po migracji backupu liczba `migrationIssues` wynosi `0`
- [x] Eksport danych ma `version = 3`
- [x] Eksport danych nie zawiera `[object Promise]`
- [x] Jawna notatka kliniczna bez hasla jest blokowana przy eksporcie
- [x] Po ustawieniu hasla klinicznego jawna notatka wychodzi w eksporcie jako `__clinicalEncrypted`
- [x] Test fixture potwierdzil zachowanie split payment `aliorBank+cash`
- [x] Test fixture potwierdzil zachowanie partial payment `partialPaymentAmount = 100`

## Weryfikacja Unit 2

- [x] `node --check js/data.js`
- [x] `node --check js/security.js`
- [x] `node --check js/views/settings.js`
- [x] Smoke Playwright: backup referencyjny laduje sie bez bledow runtime
- [x] Smoke Playwright: partial payment i split payment sa zachowane po `deserializeAppData()`
- [x] Smoke Playwright: odswiezenie offline nadal wczytuje app shell i `AppState`
- [x] Smoke Playwright: ochrona kliniczna blokuje jawny tekst bez hasla i szyfruje go po ustawieniu hasla

## Do poprawy po review fazy 2

- [x] Poprawic zapis danych klinicznych w stanie locked tak, aby protected fields byly laczone po stabilnych `id`, a nie po indeksach tablic
- [x] Jesli w stanie locked nie da sie jednoznacznie dopasowac chronionego rekordu, przerwac zapis i poprosic o odblokowanie danych klinicznych
- [x] Poprawic `SecurityService.bootstrapFromLoadedState()`, aby po `deserializeAppData()` odswiezal `_protectedState` z aktualnie wczytanego JSON-a
- [x] Dodac smoke test dla scenariusza: haslo ustawione, dane locked, usuniecie/przesuniecie rekordu, eksport nie przypisuje notatki do zlego rekordu
- [x] Dodac smoke test dla scenariusza: start z lokalnego snapshotu locked, potem load z Drive, po unlock widac dane z najnowszego loadu

## Wynik poprawek po review fazy 2

- [x] Usuniecie sesji w stanie locked nie przenosi juz notatki z usunietej sesji na pozostala sesje
- [x] Proba dopisania jawnej notatki w stanie locked blokuje zapis czytelnym komunikatem
- [x] Kolejne `deserializeAppData()` odswieza protected state, wiec unlock pokazuje najnowszy wczytany stan
- [x] Backup referencyjny nadal laduje sie jako `6 / 74 / 24` i `migrationIssues = 0`

## Re-review fazy 2 - 2026-04-10

- [x] Brak nowych findingow `P1`
- [x] Brak nowych findingow `P2`
- [x] Brak nowych findingow `P3`
- [x] Poprzedni finding `P1` z laczeniem protected fields po indeksach tablic zamkniety
- [x] Poprzedni finding `P1` ze starym `_protectedState` po nowym loadzie danych zamkniety
- [x] Bramka po re-review: mozna przejsc do `Unit 3`

## Zadania do Unit 3

- [x] Uporzadkowac stan `SecurityService`, aby widoki wiedzialy, czy dane kliniczne mozna czytac
- [x] Dodac proste etykiety akcji klinicznej: `Ustaw haslo` albo `Odblokuj notatki`
- [x] Zmienic auto-lock tak, aby blokowal tylko dane kliniczne, a nie cala aplikacje
- [x] Zmienic widok pacjenta tak, aby w stanie locked nie pokazywal notatek, celow i postepow
- [x] Zmienic widok pacjenta tak, aby dopisywanie notatek, celow i postepow wymagalo dostepu klinicznego
- [x] Zmienic kalendarz tak, aby notatki sesji byly widoczne i edytowalne tylko po odblokowaniu danych klinicznych
- [x] Zmienic ustawienia tak, aby przyciski hasla klinicznego odswiezaly stan po ustawieniu, blokadzie, odblokowaniu i zmianie hasla
- [x] Przy ustawianiu hasla sprobowac przeniesc stare rootowe zaszyfrowane stringi kliniczne do nowego envelope
- [x] Usunac z widokow stare bezposrednie `Encryption.encrypt()` / `Encryption.decrypt()` dla notatek klinicznych

## Wynik Unit 3

- [x] `SecurityService.canReadClinicalData()` traktuje dane kliniczne jako czytelne tylko po odblokowaniu albo przy braku danych klinicznych
- [x] Stan `migration-required` pokazuje uzytkownikowi, ze trzeba ustawic haslo kliniczne
- [x] Auto-lock nie wyrzuca juz uzytkownika z aplikacji, tylko blokuje dane kliniczne
- [x] Widok pacjenta pokazuje karte blokady zamiast klinicznej tresci, gdy dane sa locked albo wymagaja migracji
- [x] Widok pacjenta po odblokowaniu pokazuje notatki, cele i postepy bez starego placeholdera migracyjnego
- [x] Kalendarz ukrywa podglad notatek sesji w stanie locked i pokazuje przycisk odblokowania w detalu sesji
- [x] Nowe lub edytowane notatki kliniczne sa trzymane w pamieci jako tekst jawny tylko po odblokowaniu, a zapis szyfruje je w `serializeAppData()`
- [x] Ustawienia odswiezaja panel ochrony danych klinicznych po akcjach hasla

## Weryfikacja Unit 3

- [x] `node --check js/security.js`
- [x] `node --check js/app.js`
- [x] `node --check js/views/patients.js`
- [x] `node --check js/views/calendar.js`
- [x] `node --check js/views/settings.js`
- [x] `git diff --check`
- [x] Targeted smoke JS/Node: ustawienie hasla klinicznego szyfruje dawne i nowe pola kliniczne bez wycieku jawnego tekstu w eksporcie
- [x] Targeted smoke JS/Node: lock chowa notatki w `AppState`, a unlock przywraca sesje, notatki pacjenta, cele i postepy
- [x] Targeted smoke JS/Node: widok pacjenta w stanie locked nie przecieka tresci klinicznej i pokazuje przyciski odblokowania
- [x] Targeted smoke JS/Node: widok pacjenta po unlock pokazuje tresc kliniczna i nie pokazuje karty blokady
- [x] Backup referencyjny `gabinet-backup-2026-04-09.json` nadal laduje sie jako `6 / 74 / 24`, `migrationIssues = 0`
- [x] Lekki smoke HTTP: `index.html`, `js/security.js`, `js/views/patients.js`, `js/views/calendar.js`, `js/views/settings.js` odpowiadaja `200`

## Do poprawy po review fazy 3

- [x] Poprawic `SecurityService.handleSignOut()`, aby po wylogowaniu nie odbudowywal `_protectedState` z odblokowanego, jawnego `AppState`
- [x] Upewnic sie, ze po sign-out w stanie `unlocked` kolejny `serializeAppData()` nie zawiera jawnych notatek, celow ani wpisow postepu
- [x] Dodac smoke test scenariusza z planu Unit 3: haslo ustawione, dane odblokowane, wylogowanie Google, lokalne dane zostaja, eksport/snapshot nadal szyfrowany
- [ ] Po poprawce wykonac re-review fazy 3 przed startem `Unit 4`
