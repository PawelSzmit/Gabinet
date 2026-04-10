# Checklist

## Status unitow

- [x] Unit 0: baseline i zabezpieczenie wykonania
- [x] Unit 1: fundament security, offline i sync w root
- [x] Unit 2: model danych i migracje
- [x] Unit 3: widoki kliniczne i ustawienia
- [x] Unit 4: finanse i jedno zrodlo prawdy dla platnosci
- [x] Unit 5: shell, PWA assets i cleanup

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
- [x] Po poprawce wykonac re-review fazy 3 przed startem `Unit 4`

## Re-review fazy 3 - 2026-04-10

- [x] Brak nowych findingow `P1`
- [x] Brak nowych findingow `P2`
- [x] Brak nowych findingow `P3`
- [x] Poprzedni finding `P1` o wycieku danych klinicznych po sign-out zamkniety
- [x] Smoke test potwierdza brak jawnych danych w eksporcie po sign-out
- [x] Smoke test potwierdza, ze po ponownym unlock wracaja poprawne dane kliniczne
- [x] Bramka po re-review: mozna przejsc do `Unit 4`

## Zadania do Unit 4

- [x] Przeniesc zapis i usuwanie platnosci na wspolne helpery w `js/data.js`
- [x] Utrzymac partial payment i split payment przy zapisie, edycji i usuwaniu platnosci
- [x] Dopilnowac, zeby po edycji lub usunieciu platnosci stare flagi sesji byly czyszczone z jednego miejsca
- [x] Ujednolicic dashboard i liste platnosci, aby liczyly przychod po dacie platnosci i rekordach `payments`
- [x] Ujednolicic revenue by method dla split payment tak, aby bazowal na rzeczywistych kwotach z `payment.splitAmounts`
- [x] Zachowac kalendarz jako widok sesji, ale bez rozjazdu z autorytatywnym rekordem platnosci
- [x] Spisac decyzje semantyczna: finanse w dashboardzie liczymy po dacie platnosci, nie po dacie sesji

## Wynik Unit 4

- [x] `savePaymentRecord()` i `deletePaymentRecord()` staly sie wspolnym torem zmian dla platnosci
- [x] `reconcilePaymentStatus()` czysci tez stare flagi platnosci na sesjach, wiec odlaczone sesje nie zachowuja juz starego statusu
- [x] Edycja platnosci nie zostawia juz poprzednio oplaconej sesji w stanie `isPaid = true`
- [x] Usuniecie platnosci czyści stan sesji z jednego miejsca
- [x] Dashboard i trend przychodow licza po rekordach `payments` i po `payment.date`
- [x] Split payment w revenue by method rozbija sie bezposrednio po `splitAmounts.primary` i `splitAmounts.secondary`
- [x] Partial payment dalej ustawia `isPartiallyPaid` i `partialPaymentAmount` na najstarszej sesji zgodnie z kwota platnosci

## Weryfikacja Unit 4

- [x] `node --check js/data.js`
- [x] `node --check js/views/finance.js`
- [x] `node --check js/views/calendar.js`
- [x] `git diff --check`
- [x] Targeted smoke Node/vm: partial payment ustawia `isPartiallyPaid` i `partialPaymentAmount`
- [x] Targeted smoke Node/vm: revenue liczy po `payment.date`, a nie po dacie sesji
- [x] Targeted smoke Node/vm: split payment rozbija metody na dokladne kwoty `40 / 60 / 200`, bez zawyzania
- [x] Targeted smoke Node/vm: edycja platnosci czyści stary stan sesji usunietej z `sessionIds`
- [x] Targeted smoke Node/vm: usuniecie platnosci czyści stan sesji i zostawia jeden rekord w `payments`

## Do poprawy po review fazy 4

- [x] Ujednolicic filtrowanie zakresu dat w liscie platnosci, aby porownywalo lokalny dzien platnosci zamiast surowego stringa ISO
- [x] Ujednolicic zapis `payment.date` przy edycji platnosci z normalizacja uzywana przy tworzeniu nowego rekordu

## Wynik poprawek po review fazy 4

- [x] Lista platnosci filtruje teraz po lokalnym dniu platnosci, wiec rekord zapisany na `2026-04-07` nie wypada juz z filtra `Od = Do = 2026-04-07`
- [x] Edycja platnosci zachowuje ten sam format `payment.date` co tworzenie nowego rekordu

## Weryfikacja poprawek po review fazy 4

- [x] `node --check js/data.js`
- [x] `node --check js/views/finance.js`
- [x] `git diff --check`
- [x] Targeted smoke Node/vm: `paymentDayKey()` mapuje zapisane ISO na lokalny dzien `YYYY-MM-DD`
- [x] Targeted smoke Node/vm: filtr `Od = Do = 2026-04-07` zwraca platnosc zapisana na ten dzien
- [x] Targeted smoke Node/vm: edycja platnosci zachowuje taki sam format ISO jak utworzenie nowego rekordu

## Zadania do Unit 5

- [x] Uporzadkowac rootowy `sw.js` jako jedyny utrzymywany service worker aplikacji
- [x] Dodac do cache root pliki `js/security.js` i `js/local-store.js`, z ktorych faktycznie korzysta shell
- [x] Ujednolicic `manifest.json` z rootowym shellem i uruchamianiem z wzglednej sciezki
- [x] Oznaczyc `GabinetPWA` jako katalog archiwalny bez przedwczesnego usuwania
- [x] Poprawic README tak, aby opisywal aktualny root zamiast starej struktury `service-worker.js` / `config.js`

## Wynik Unit 5

- [x] `sw.js` cache'uje aktualny app shell root, wlacznie z `js/security.js` i `js/local-store.js`
- [x] PWA assets root uzywaja wzglednych sciezek `./`, wiec sa spojniejsze z uruchamianiem z podfolderu
- [x] `manifest.json` ma `id`, `scope` i `start_url` ustawione na rootowy shell
- [x] `docs/archived-sources/gabinet-pwa/ARCHIVE.md` oznacza katalog jako archiwalne zrodlo porownawcze
- [x] README nie odsyla juz do nieistniejacego `service-worker.js` ani `config.example.js`

## Weryfikacja Unit 5

- [x] `node --check sw.js`
- [x] `python3 -m json.tool manifest.json`
- [x] `git diff --check`
- [x] `curl -I http://127.0.0.1:4173/index.html`
- [x] `curl -I http://127.0.0.1:4173/sw.js`
- [x] `curl -I http://127.0.0.1:4173/manifest.json`
- [x] `curl -I http://127.0.0.1:4173/js/security.js`
- [x] `curl -I http://127.0.0.1:4173/js/local-store.js`
- [x] `rg -n "service-worker\\.js|config\\.example|config\\.js" README.md` nie znajduje juz starych odniesien

## Do poprawy po review fazy 5

- [x] Wykonac finalne scenariusze PWA z planu Unit 5: twarde odswiezenie po zmianie service workera, instalacja PWA oraz start po odswiezeniu na telefonie i desktopie
- [x] Dorecznie poprawic tabele technologii w README, aby nie opisywala juz starego `Chart.js` i starej pary fontow

## Wynik poprawek po review fazy 5

- [x] Root przeszedl koncowy smoke PWA w Chromium dla desktopu i mobilki po reloadzie
- [x] CDP `Page.getInstallabilityErrors` zwraca pusty wynik, wiec manifest i service worker nie blokuja instalowalnosci
- [x] README opisuje juz aktualna pare fontow `Fraunces + Manrope` i nie odwoluje sie do `Chart.js`

## Weryfikacja poprawek po review fazy 5

- [x] `git diff --check`
- [x] `rg -n "Chart\\.js|Playfair Display" README.md`
- [x] Targeted Playwright Chromium smoke: desktop load -> service worker ready -> reload -> tytul `Gabinet`
- [x] Targeted Playwright Chromium smoke: mobile emulation load -> reload -> tytul `Gabinet`
- [x] Targeted CDP check: `Page.getAppManifest` bez bledow
- [x] Targeted CDP check: `Page.getInstallabilityErrors` zwraca pusta liste
