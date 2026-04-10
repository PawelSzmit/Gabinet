# Plan scalenia `Gabinet` i `GabinetPWA`

## Problem

Repo zawiera dwie wersje tej samej aplikacji:

- kod docelowy w katalogu root `Gabinet`,
- rownolegla kopie rozwojowa w `GabinetPWA`.

Obie wersje maja wartosciowe zmiany, ale w innych miejscach. W repo widac tez, ze proba pelnego przepisania `GabinetPWA -> ROOT` juz raz zostala wykonana i cofnięta. To oznacza, ze potrzebne jest scalanie selektywne, a nie kolejne hurtowe nadpisanie jednego katalogu drugim.

## Scope

Plan obejmuje:

- wybranie zwyciezcy osobno dla glownego pakietu funkcji,
- scalenie bezpieczenstwa, offline, synchronizacji, danych, finansow i widokow,
- utrzymanie jednej finalnej aplikacji w katalogu root,
- przygotowanie bezpiecznej kolejnosci prac i weryfikacji.

## Non-goals

- big-bang rewrite calej aplikacji,
- przepisywanie wszystkiego od zera,
- zmiana dostawcy logowania lub odchodzenie od Google Drive,
- pelny redesign UI,
- natychmiastowe usuwanie `GabinetPWA` przed osiagnieciem pelnej zgodnosci funkcjonalnej.

## Source Context

- wymagania: [docs/brainstorms/2026-04-09-gabinet-unification-requirements.md](/Users/pawelszmit/Desktop/Gabinet/docs/brainstorms/2026-04-09-gabinet-unification-requirements.md)
- istniejacy plan split payment: [docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)
- plan security/offline z kopii rozwojowej: [docs/plans/2026-04-08-security-offline-finance-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/plans/2026-04-08-security-offline-finance-plan.md)
- brainstorm hasla klinicznego: [docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md)
- wazne commity:
  - `4fe008d` - pelna synchronizacja `GabinetPWA -> ROOT`
  - `7729fde` - revert tej synchronizacji
  - `d3dec75` - decyzja o powrocie z `drive.appdata` do `drive.file`

## Current State

### Root `Gabinet`

- jest docelowym miejscem produktu i aktualnym stanem `main`,
- ma nowszy landing page i nowszy `styles.css`,
- ma najnowsze poprawki finansowe i split payment,
- nadal opiera sie na:
  - `js/encryption.js`,
  - sync tokena w `localStorage`,
  - synchronicznym `serializeAppData()`,
  - modelu danych v2,
  - partial payments (`isPartiallyPaid`, `partialPaymentAmount`),
  - `DataRecovery` w ustawieniach.

Kluczowe pliki:

- [js/app.js](/Users/pawelszmit/Desktop/Gabinet/js/app.js)
- [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
- [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/js/drive.js)
- [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)
- [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
- [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js)
- [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
- [index.html](/Users/pawelszmit/Desktop/Gabinet/index.html)
- [styles.css](/Users/pawelszmit/Desktop/Gabinet/styles.css)

### `GabinetPWA`

- ma dojrzalsza warstwe security/offline/sync,
- wprowadza:
  - `js/security.js`,
  - `js/local-store.js`,
  - async `serializeAppData()`,
  - model danych v3,
  - `getSessionAmount()` i przebudowane linkowanie platnosci,
  - status synchronizacji i ochrone danych klinicznych w widokach,
- ale zawiera tez decyzje, ktorych nie wolno przeniesc bezkrytycznie:
  - `drive.appdata`,
  - inne zachowanie startu aplikacji,
  - uproszczenia w niektorych widokach,
  - brak czesci logiki partial payments znanej z root.

Kluczowe pliki:

- [js/security.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/security.js)
- [js/local-store.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/local-store.js)
- [js/app.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/app.js)
- [js/data.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/data.js)
- [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/drive.js)
- [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/calendar.js)
- [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/finance.js)
- [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/patients.js)
- [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/settings.js)

### Najwazniejsze lokalne wzorce, ktore warto zachowac

- root:
  - `reconcilePaymentStatus()` i obecna logika partial payments,
  - najnowsze poprawki split payment,
  - obecny root UI shell i marketing shell.
- `GabinetPWA`:
  - `SecurityService`,
  - `LocalStore`,
  - kliniczne dane blokowane osobnym haslem,
  - lokalny snapshot po odswiezeniu,
  - sync status i ostrozniejsze obchodzenie sie z tokenem.

## Proposed Approach

Podejscie powinno byc pakietowe, nie plikowe.

To znaczy:

1. root pozostaje miejscem finalnej aplikacji,
2. zwyciezce wybieramy dla calego obszaru odpowiedzialnosci, nie dla pojedynczego pliku wyrwanego z kontekstu,
3. najpierw przenosimy fundamenty techniczne,
4. dopiero potem finansy i widoki,
5. katalog `GabinetPWA` usuwamy dopiero na koncu, kiedy root ma juz wszystkie krytyczne funkcje i przejdzie reczna weryfikacje.

### Pakiety odpowiedzialnosci

- Pakiet A: security + offline + sync
  - zwyciezca: `GabinetPWA`, ale z zachowaniem `drive.file` z root
- Pakiet B: model danych i migracje
  - scalanie reczne
- Pakiet C: finanse i linkowanie platnosci
  - scalanie reczne z przewaga root dla UX i partial payments
- Pakiet D: widoki kliniczne i ustawienia
  - scalanie reczne z przewaga `GabinetPWA` dla ochrony danych klinicznych
- Pakiet E: shell, marketing, PWA assets, cleanup
  - przewaga root dla landing page i stylu, selektywne przeniesienie PWA assets

## Recommended Decisions Before Execution

- Root pozostaje finalnym katalogiem produktu.
- `drive.file` pozostaje zakresem Google Drive.
  - Uzasadnienie: commit `d3dec75` opisuje realny problem z `drive.appdata`, ktory odcinal aplikacje od istniejacych danych.
- Partial payments zostaja w zakresie i nie wolno ich zgubic.
- `SecurityService` zastapi stary `Encryption` jako docelowy mechanizm ochrony danych klinicznych.
- `LocalStore` staje sie docelowym mechanizmem lokalnego snapshotu.
- `DataRecovery` nie jest priorytetem do rozbudowy, ale warto zachowac go do czasu stabilnej migracji.

## Implementation Units

### Unit 0. Baseline i zabezpieczenie wykonania

- Objective:
  - przygotowac bezpieczny punkt startu, zanim zacznie sie jakiekolwiek scalanie.
- Files / folders:
  - [docs/brainstorms/2026-04-09-gabinet-unification-requirements.md](/Users/pawelszmit/Desktop/Gabinet/docs/brainstorms/2026-04-09-gabinet-unification-requirements.md)
  - ten plan
  - eksport danych z dzialajacej wersji aplikacji
- Patterns to follow:
  - zadnego hurtowego kopiowania katalogu do katalogu,
  - kazdy pakiet ma osobny checkpoint reczny.
- Tasks:
  - zrobic eksport danych z aktualnie uzywanej wersji,
  - spisac 5-8 recznych scenariuszy referencyjnych:
    - logowanie,
    - start bez internetu,
    - pacjent i notatka kliniczna,
    - zwykla platnosc,
    - split payment,
    - partial payment,
    - odwolana ale platna sesja,
    - eksport JSON.
- Risks:
  - scalanie bez danych referencyjnych utrudni wykrycie cichej regresji.
- Test scenarios:
  - uruchomienie obecnej wersji root i zapis obserwacji,
  - jesli potrzebne, uruchomienie `GabinetPWA` i zapis roznic.
- Verification:
  - istnieje lista scenariuszy bazowych i kopia danych do porownan.

### Unit 1. Przeniesienie fundamentu security/offline/sync do root

- Objective:
  - wprowadzic do root fundament z `GabinetPWA`, ale bez przywracania `drive.appdata`.
- Files to touch:
  - nowe:
    - [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)
    - [js/local-store.js](/Users/pawelszmit/Desktop/Gabinet/js/local-store.js)
  - modyfikowane:
    - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/js/app.js)
    - [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/js/drive.js)
    - [js/utils.js](/Users/pawelszmit/Desktop/Gabinet/js/utils.js)
    - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
    - [index.html](/Users/pawelszmit/Desktop/Gabinet/index.html)
- Patterns to follow:
  - `SecurityService` i `LocalStore` z `GabinetPWA`,
  - zachowac decyzje z commit `d3dec75`:
    - `drive.file`,
    - plik w zwyklym Drive zamiast `appDataFolder`.
- Why this unit comes first:
  - bez tego kolejne etapy beda dalej pracowaly na starym fundamencie i potem trzeba bedzie je poprawiac drugi raz.
- Risks:
  - przypadkowy powrot do `drive.appdata`,
  - start z pustymi danymi,
  - rozjazd miedzy sync i lokalnym snapshotem,
  - konflikt starego `Encryption` z nowym `SecurityService`.
- Test scenarios:
  - logowanie Google nadal otwiera istniejace dane,
  - odswiezenie offline przywraca lokalna kopie,
  - odlaczenie Google nie kasuje lokalnej pracy,
  - status synchronizacji jest widoczny w ustawieniach.
- Verification:
  - root nadal czyta ten sam plik `gabinet-data.json`,
  - brak regresji "pustej aplikacji po migracji scope",
  - reczny test: start online, odswiezenie offline, powrot online i zapis.

### Unit 2. Scalenie modelu danych i migracji

- Objective:
  - zbudowac jeden model danych, ktory:
    - wspiera partial payments i split payments,
    - utrwala historyczna kwote sesji,
    - chroni dane kliniczne,
    - daje jasna migracje ze starego formatu root i z formatu `GabinetPWA`.
- Files to touch:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
  - [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)
  - opcjonalnie [js/encryption.js](/Users/pawelszmit/Desktop/Gabinet/js/encryption.js) do wygaszenia lub usuniecia na koncu
- Patterns to follow:
  - `getSessionAmount()` z `GabinetPWA`,
  - migracyjne ostrzezenia `migrationIssues`,
  - root `reconcilePaymentStatus()` i obecna obsluga partial payment,
  - async `serializeAppData()`.
- Planned decisions:
  - przyjac jeden nowy numer wersji danych po scaleniu,
  - `serializeAppData()` ma byc async,
  - dane kliniczne przechodza przez `SecurityService`,
  - `paymentAmount` pozostaje historyczna kwota sesji,
  - partial payment zostaje zachowany,
  - split payment zostaje zachowany.
- Why this unit comes after Unit 1:
  - security i local snapshot musza juz istniec, zeby model danych mial gdzie zapisac zaszyfrowana postac.
- Risks:
  - utrata notatek klinicznych,
  - zle odtworzenie powiazan sesja <-> platnosc,
  - niespojna obsluga starych danych z root i `GabinetPWA`.
- Test scenarios:
  - stary eksport root v2 laduje sie poprawnie,
  - dane z `GabinetPWA` laduja sie poprawnie,
  - sesja ze split payment zachowuje poprawna kwote,
  - sesja z partial payment nadal pokazuje poprawny stan,
  - eksport JSON nie zawiera jawnych danych klinicznych.
- Verification:
  - reczne porownanie eksportu przed i po,
  - brak utraty liczby pacjentow, sesji i platnosci,
  - ostrzezenia migracyjne sa czytelne, jesli czegos nie da sie odzyskac automatycznie.

### Unit 3. Widoki kliniczne i ustawienia

- Objective:
  - przelozyc nowy model security na realne zachowanie UI w root.
- Files to touch:
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/js/app.js)
- Patterns to follow:
  - kliniczne guardy z `GabinetPWA`,
  - root UI jako wizualna baza tam, gdzie nie ma konfliktu z bezpieczenstwem,
  - prosty jezyk UX z brainstormu hasla klinicznego.
- Planned decisions:
  - haslo chroni tylko dane kliniczne,
  - autolock blokuje tylko dane kliniczne, nie cala aplikacje,
  - ustawienia pokazuja stan ochrony i stan synchronizacji,
  - notatki, cele i wpisy kliniczne sa niedostepne bez odblokowania.
- Risks:
  - przypadkowe zablokowanie zwyklych danych organizacyjnych,
  - pozostawienie starego widoku, ktory nadal czyta jawny tekst,
  - niespojny UX miedzy pacjentami, kalendarzem i ustawieniami.
- Test scenarios:
  - [x] wejscie do aplikacji bez odblokowania hasla klinicznego,
  - [x] odblokowanie i edycja notatki,
  - [x] autolock po bezczynnosci,
  - [x] wylogowanie z Google przy zachowaniu lokalnych danych.
- Verification:
  - [x] wszedzie, gdzie sa dane kliniczne, UI pokazuje jeden spojny stan,
  - [x] brak jawnych notatek po zablokowaniu.

### Unit 4. Finanse i jedno zrodlo prawdy dla platnosci

- Objective:
  - scalic logike finansow tak, by zachowac biznesowe zachowania root i uporzadkowanie modelu z `GabinetPWA`.
- Files to touch:
  - [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js)
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
- Patterns to follow:
  - root:
    - split payment,
    - partial payment,
    - nowszy UX finansow,
  - `GabinetPWA`:
    - `getSessionAmount()`,
    - `rebuildPaymentLinks()` / jeden tor linkowania,
    - oddzielanie modelu danych od widoku.
- Planned decisions:
  - platnosc jest jedynym autorytatywnym zrodlem rozliczenia sesji,
  - dashboard, lista platnosci i kalendarz musza korzystac z tego samego modelu,
  - logika revenue dla split payment musi miec jawnie opisana semantyke:
    - czy liczymy po dacie sesji,
    - czy po dacie platnosci,
    - i ta decyzja musi byc spisana oraz spójna w UI.
- Why this unit comes after Unit 2:
  - finanse musza pracowac na finalnym modelu danych, a nie na stanie przejsciowym.
- Risks:
  - ponowne rozjechanie dashboardu i listy platnosci,
  - utrata partial payment przy portowaniu helperow z `GabinetPWA`,
  - ciche bledy w split payment przy kilku sesjach i kilku miesiacach.
- Test scenarios:
  - zwykla pelna platnosc,
  - partial payment jednej sesji,
  - split payment dwiema metodami dla jednej sesji,
  - split payment dla kilku sesji,
  - platna odwolana sesja z kalendarza,
  - edycja i usuniecie platnosci,
  - porownanie sum: dashboard vs lista platnosci vs szczegoly sesji.
- Verification:
  - wszystkie trzy miejsca pokazuja ten sam stan finansowy dla tych samych danych,
  - test scenariusza z Twojego zrzutu ekranu nie wraca jako regresja.

### Unit 5. Shell, PWA assets i cleanup

- Objective:
  - domknac finalna forme jednej aplikacji i przygotowac usuniecie duplikatu.
- Files to touch:
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/index.html)
  - [styles.css](/Users/pawelszmit/Desktop/Gabinet/styles.css)
  - [manifest.json](/Users/pawelszmit/Desktop/Gabinet/manifest.json)
  - [sw.js](/Users/pawelszmit/Desktop/Gabinet/sw.js)
  - opcjonalnie [service-worker.js](/Users/pawelszmit/Desktop/Gabinet/service-worker.js)
  - katalog [GabinetPWA](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA)
- Patterns to follow:
  - root pozostaje wizualna baza,
  - PWA assets przenosimy tylko jesli sa potrzebne root,
  - duplicate cleanup dopiero po pełnej weryfikacji.
- Planned decisions:
  - zachowac root landing page, chyba ze podczas wykonania wyjdzie realna przewaga drugiej wersji,
  - uporzadkowac, czy potrzebne sa oba pliki `sw.js` i `service-worker.js`,
  - oznaczyc `GabinetPWA` jako archiwalne lub usunac po finalnym checkliscie.
- Risks:
  - stary cache service workera ukryje nowe JS,
  - przedwczesne usuniecie `GabinetPWA` utrudni porownanie,
  - niespojnosc assetow PWA.
- Test scenarios:
  - twarde odswiezenie po zmianie service workera,
  - instalacja PWA,
  - start po odswiezeniu na telefonie i desktopie.
- Verification:
  - finalna aplikacja uruchamia sie tylko z root,
  - nie ma zaleznosci od plikow zostawionych tylko w `GabinetPWA`.

## Risks and Mitigations

- Ryzyko: powrot do `drive.appdata` odetnie aplikacje od istniejących danych.
  - Mitigacja: traktowac `drive.file` jako twarda decyzje i sprawdzac ja w review kazdego etapu.

- Ryzyko: utrata lub zablokowanie danych klinicznych.
  - Mitigacja: przed wykonaniem eksport danych, podczas wykonania test na kopii i porownanie eksportu.

- Ryzyko: zgubienie partial payments przy scalaniu danych i finansow.
  - Mitigacja: potraktowac partial payment jako funkcje krytyczna i miec osobne scenariusze reczne.

- Ryzyko: mieszanie starego `Encryption` i nowego `SecurityService`.
  - Mitigacja: okres przejsciowy tylko na czas migracji, a potem jeden docelowy mechanizm.

- Ryzyko: kolejny big-bang merge ukryje prawdziwe przyczyny bledow.
  - Mitigacja: wdrazac pakietami, po kazdym pakiecie robic reczny checkpoint.

## Open Questions

### Before Execution

- Czy partial payments na pewno pozostaja obowiazkowe w finalnej aplikacji?
  - Plan zaklada: tak.
- Czy root landing page zostaje bez zmian?
  - Plan zaklada: tak.

### During Execution

- Czy `DataRecovery` ma zostac jako widoczna funkcja ustawien, czy tylko narzedzie awaryjne?
- Czy domyslny widok kalendarza ma pozostac taki jak w root, czy przejmowac zachowanie z `GabinetPWA`?
- Czy w finansach semantyka "biezacy miesiac" ma byc liczona po sesjach, po platnosciach, czy w dwoch roznych sekcjach?

## Verification Strategy

- Po kazdym unicie:
  - uruchomic aplikacje,
  - wykonac odpowiedni podzbior recznych scenariuszy,
  - sprawdzic, czy eksport i odczyt danych nadal dzialaja.

- Przed cleanupem `GabinetPWA`:
  - przejsc pelna liste scenariuszy bazowych z Unit 0,
  - sprawdzic start online i offline,
  - sprawdzic logowanie, sync, notatki kliniczne, pacjentow, kalendarz, finanse i eksport.

## Recommended Next Step

Przejsc do wykonania w osobnym zadaniu, najlepiej etapami zgodnie z Unit 1 -> Unit 5. Najbezpieczniejszy start to Unit 0 i Unit 1, bo one ustawiaja fundament bez dotykania jeszcze najbardziej delikatnej logiki finansowej.
