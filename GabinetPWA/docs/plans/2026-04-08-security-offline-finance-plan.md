# Plan wdrożenia zmian po review: bezpieczeństwo, offline i spójność finansów

## Problem

Aplikacja ma pięć istotnych problemów:

1. token Google Drive jest przechowywany w `localStorage`,
2. historia finansowa zależy od bieżącej stawki pacjenta,
3. dane kliniczne nie są szyfrowane mimo obietnicy w UI,
4. tryb offline nie odtwarza danych po odświeżeniu,
5. kalendarz potrafi oznaczyć sesję jako opłaconą bez utworzenia rekordu płatności.

To są problemy przekrojowe, bo dotykają modelu danych, logowania, synchronizacji, widoków i obietnic produktu.

## Scope

Plan obejmuje:

- utwardzenie obsługi tokena i logowania,
- utrwalenie kwoty sesji jako historycznego snapshotu,
- ujednolicenie źródła prawdy dla płatności,
- wprowadzenie prawdziwego szyfrowania pól klinicznych,
- dodanie lokalnego snapshotu danych do pracy offline po odświeżeniu,
- ograniczone uporządkowanie kolidujących fallbacków, jeśli blokują spójność powyższych zmian.

## Non-goals

- przebudowa całego UI,
- pełny refactor całego `js/app.js`,
- zmiana dostawcy logowania lub odejście od Google Drive,
- backend lub własny serwer,
- rozbudowane testy E2E z nowym frameworkiem testowym,
- naprawa wszystkich uwag P3 spoza zakresu tych pięciu findingów.

## Source Context

- Prośba użytkownika: plan zmian dla pięciu findingów z review.
- Review źródłowe: [docs/review-kodu-2026-04-08.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/review-kodu-2026-04-08.md)
- Kluczowe pliki:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
  - [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/calendar.js)
  - [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/finance.js)
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)
  - [sw.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/sw.js)

## Current State

### Lokalny wzorzec, który warto zachować

- `AppState` w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js) jest faktycznym centrum danych.
- Fabryki `createPatient`, `createSession`, `createPayment`, `createAppSettings` już pilnują kształtu danych.
- `persistData()` w [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js) jest jednym punktem wejścia po zmianie danych.
- Widoki domenowe są już rozdzielone do `js/views/*`, więc warto wzmacniać ten kierunek zamiast dopisywać logikę do `js/app.js`.

### Dług techniczny, który wpływa na plan

- `js/app.js` zawiera starszy fallback modelu danych (`fee`, `time`, `note`, `defaultFee`, `autoLockEnabled`), a nowsze widoki działają już na `sessionRate`, `paymentAmount`, `sessionNotes`, `pseudonym`.
- Dane z Drive są traktowane jako jedyne trwałe źródło stanu, więc aplikacja nie ma lokalnego odtworzenia po odświeżeniu offline.
- Tekstowe dane kliniczne są dziś serializowane bez ochrony.

## Research Notes

Plan uwzględnia te bieżące źródła:

- Google GIS token model: [Using the token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
  - dostęp tokenowy jest krótko żyjący,
  - odnowienie tokena powinno być wywoływane gestem użytkownika,
  - ten model nie daje sensownego, bezpiecznego “trwałego zalogowania” po stronie samej przeglądarki.
- Google OAuth best practices: [OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
  - tokeny użytkownika powinny być przechowywane bezpiecznie,
  - `localStorage` nie jest dobrym miejscem na wrażliwy token dostępu.
- Web Crypto: [SubtleCrypto.encrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
  - preferowane jest szyfrowanie uwierzytelniane,
  - dla tego przypadku sensownym wyborem jest `AES-GCM`.
- Offline storage: [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
  - IndexedDB jest właściwym mechanizmem na lokalny snapshot danych do pracy offline.

## Proposed Approach

Docelowo aplikacja powinna mieć trzy wyraźne warstwy:

1. `AppState` i model danych:
   - każdy rekord sesji ma trwałą kwotę historyczną,
   - rekord płatności jest jedyną drogą oznaczania sesji jako opłaconej,
   - pola kliniczne są przechowywane jako zaszyfrowany envelope zamiast jawnego tekstu.

2. Warstwa bezpieczeństwa:
   - token Google tylko w pamięci procesu,
   - klucz do odszyfrowania danych klinicznych wyprowadzany z lokalnie podanego hasła,
   - brak trwałego przechowywania sekretu odszyfrowującego w Drive lub `localStorage`.

3. Warstwa synchronizacji i offline:
   - lokalny snapshot w IndexedDB,
   - szybkie uruchomienie z lokalnej kopii,
   - późniejsza synchronizacja z Drive, gdy połączenie i autoryzacja są dostępne.

## Implementation Units

### Unit 1. Ustalenie docelowego schematu danych i migracji

- Objective:
  - wprowadzić docelowy kształt danych, który obsłuży historyczne kwoty, szyfrowane pola i lokalny snapshot bez łamania starych danych.
- Files:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
  - opcjonalnie nowy plik: `js/security.js`
  - opcjonalnie nowy plik: `js/local-store.js`
- Patterns to follow:
  - istniejące fabryki `create*`,
  - `serializeAppData()` i `deserializeAppData()`,
  - wersjonowanie danych już obecne w `version: 2`.
- Planned decisions:
  - podnieść wersję danych,
  - utrwalać na sesji pole typu `paymentAmount` jako historyczną kwotę sesji, a nie tylko “niestandardową kwotę”,
  - dodać envelope dla tekstów klinicznych, np.:
    - `encryption: { version, salt, iv, algorithm }`
    - zaszyfrowane wartości dla:
      - `Session.sessionNotes`,
      - `Patient.sessionNotes[].content`,
      - `Patient.progressEntries[].content`,
      - `Patient.therapeuticGoals[].notes`.
  - nie szyfrować pól potrzebnych do działania list i harmonogramu, takich jak imię, nazwisko, pseudonim, daty, statusy, kwoty.
- Migration notes:
  - przy deserializacji uzupełniać brakujące `paymentAmount` dla starych sesji z `patient.sessionRate`, jeśli pacjent jeszcze istnieje,
  - jeśli stara sesja nie ma pacjenta, a nie da się jednoznacznie odzyskać kwoty, zostawić ślad migracyjny do ręcznego sprawdzenia zamiast zgadywać,
  - zachować kompatybilność odczytu dla starego plain text do czasu pełnej migracji.
- Risks:
  - błędna migracja może zmienić stare raporty finansowe,
  - zbyt szerokie szyfrowanie może zablokować render list i kalendarza.
- Test scenarios:
  - stare dane bez `paymentAmount` ładują się poprawnie,
  - nowa sesja od razu ma trwałą kwotę,
  - stare notatki plain text są wczytane i migrowane do nowego formatu bez utraty treści.
- Verification:
  - ręcznie porównać eksport JSON przed i po migracji na kopii danych,
  - sprawdzić, że liczby w widoku finansów są identyczne przed zmianą stawki i po zmianie stawki pacjenta.

### Unit 2. Ujednolicenie finansów i przepływu płatności

- Objective:
  - usunąć rozjazd między “sesja opłacona” a “rekord płatności istnieje”.
- Files:
  - [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/finance.js)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/calendar.js)
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
- Patterns to follow:
  - `createPayment()`,
  - istniejące `paymentId`, `paymentMethod`, `paymentDate`, `isPaid`,
  - istniejący widok szczegółów płatności w `finance.js`.
- Planned decisions:
  - dodać wspólne helpery domenowe, np. `recordPaymentForSessions()`, `detachPaymentFromSessions()`, `rebuildPaymentLinks()` zamiast rozrzucać logikę po widokach,
  - przepływ “odwołana, ale płatna” z kalendarza ma zawsze tworzyć rekord w `AppState.payments`,
  - wszystkie raporty finansowe mają liczyć kwoty z utrwalonego `session.paymentAmount`,
  - usuwanie lub edycja płatności ma przechodzić przez jedną wspólną ścieżkę.
- Risks:
  - podwójne tworzenie płatności dla tej samej sesji,
  - brak cofnięcia flag na sesji po usunięciu płatności.
- Test scenarios:
  - zarejestrowanie płatności w finansach oznacza sesje jako opłacone i tworzy rekord,
  - zaznaczenie płatnej odwołanej sesji w kalendarzu tworzy rekord płatności,
  - edycja płatności aktualizuje sesje,
  - usunięcie płatności przywraca sesje do stanu nieopłaconego,
  - zmiana `patient.sessionRate` nie zmienia starych przychodów.
- Verification:
  - porównać liczby w dashboardzie finansów i liście płatności po kilku typach operacji,
  - sprawdzić usunięcie pacjenta z istniejącą historią płatności i sesji.

### Unit 3. Prawdziwe szyfrowanie danych klinicznych

- Objective:
  - spełnić obietnicę szyfrowania bez udawania bezpieczeństwa.
- Files:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
  - nowy plik: `js/security.js`
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/calendar.js)
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)
- Patterns to follow:
  - jawne helpery zamiast szyfrowania “po cichu” w widokach,
  - centralny dostęp do stanu przez `AppState`.
- Planned decisions:
  - wprowadzić moduł `SecurityService`,
  - użyć `PBKDF2` + `AES-GCM`,
  - każdy zaszyfrowany zapis ma mieć własny `iv`,
  - hasło szyfrowania trzymać tylko w pamięci bieżącej sesji,
  - serializacja do Drive i lokalnego snapshotu zapisuje tylko ciphertext, nie plaintext.
- UX assumptions:
  - po zalogowaniu użytkownik wpisuje osobne hasło do odszyfrowania danych klinicznych,
  - bez tego hasła można wejść do aplikacji, ale pola kliniczne są niedostępne albo ukryte.
- Risks:
  - utrata hasła oznacza brak dostępu do danych klinicznych,
  - błędy migracji mogą uszkodzić stare notatki,
  - błędy w zarządzaniu IV lub envelope osłabią bezpieczeństwo.
- Test scenarios:
  - nowa notatka zapisuje się zaszyfrowana,
  - po odświeżeniu i ponownym podaniu hasła treść wraca poprawnie,
  - bez hasła treść nie jest czytelna w eksporcie JSON,
  - stare notatki plain text da się odczytać i przepisać do formatu szyfrowanego.
- Verification:
  - sprawdzić eksport danych i potwierdzić, że treści kliniczne nie występują już jawnie,
  - zweryfikować odszyfrowanie dla notatek sesji i notatek pacjenta,
  - sprawdzić zachowanie przy błędnym haśle.

### Unit 4. Utwardzenie logowania i obsługi tokena

- Objective:
  - usunąć przechowywanie access tokena w `localStorage` bez rozbicia podstawowego flow aplikacji.
- Files:
  - [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)
- Patterns to follow:
  - istniejący `DriveService.init()`,
  - `requestToken()` wywoływane z kliknięcia użytkownika.
- Planned decisions:
  - całkowicie usunąć zapis access tokena i expiry z `localStorage`,
  - zostawić co najwyżej bezpieczne, niewrażliwe metadane:
    - `fileId`,
    - podstawowe dane profilu do UI, jeśli są naprawdę potrzebne,
    - informację o istnieniu lokalnego snapshotu.
  - po pełnym odświeżeniu strony nie próbować “cicho” wznowić sesji z tokena,
  - zamiast tego:
    - załadować lokalny snapshot,
    - pokazać stan “dane lokalne dostępne, połącz z Google aby zsynchronizować”.
- Risks:
  - to zmieni UX, bo świeży reload może wymagać ponownego kliknięcia połączenia z Google,
  - jeśli flow zostanie źle spięty, użytkownik zobaczy pusty ekran mimo lokalnych danych.
- Test scenarios:
  - po zwykłej pracy token nie trafia już do `localStorage`,
  - po reloadzie lokalne dane są widoczne,
  - po kliknięciu “połącz” działa synchronizacja z Drive,
  - wylogowanie czyści tylko to, co powinno być wyczyszczone.
- Verification:
  - ręcznie sprawdzić `localStorage`,
  - sprawdzić start aplikacji po reloadzie online i offline,
  - sprawdzić flow “kliknij, aby zsynchronizować”.

### Unit 5. Lokalny snapshot offline i start aplikacji z dwóch źródeł

- Objective:
  - zapewnić realny offline po odświeżeniu, bez konfliktu z Drive.
- Files:
  - nowy plik: `js/local-store.js`
  - [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)
  - [sw.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/sw.js)
  - opcjonalnie usunięcie albo oznaczenie martwego [service-worker.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/service-worker.js)
- Patterns to follow:
  - `persistData()` jako punkt po mutacji,
  - istniejący banner offline i loading sync.
- Planned decisions:
  - wprowadzić IndexedDB jako lokalny magazyn snapshotu,
  - przy każdej mutacji:
    - najpierw zaktualizować lokalny snapshot,
    - potem zaplanować synchronizację z Drive,
  - przy starcie:
    - najpierw próbować odczytu snapshotu z IndexedDB,
    - jeśli online i autoryzacja dostępna, dociągnąć najnowszy stan z Drive,
    - jeśli offline, zostać na snapshotcie i jasno to pokazać w UI.
  - trzymać proste metadane synchronizacji:
    - `lastLocalWriteAt`,
    - `lastDriveSyncAt`,
    - `hasPendingSync`.
- Risks:
  - konflikt “lokalne nowsze vs Drive starsze”,
  - użytkownik może nadpisać sobie nowsze dane starszym snapshotem, jeśli kolejność będzie zła.
- Conflict strategy:
  - na tym etapie przyjąć prostą regułę:
    - lokalna zmiana ustawia `hasPendingSync = true`,
    - dopóki lokalna zmiana nie zostanie zsynchronizowana, nie nadpisywać jej ślepo stanem z Drive,
    - w razie rozjazdu pokazać komunikat i zostawić lokalny stan jako wygrywający do czasu świadomej synchronizacji.
- Test scenarios:
  - aplikacja działa po odświeżeniu offline,
  - nowe dane zapisane offline wracają po kolejnym uruchomieniu,
  - po powrocie internetu snapshot synchronizuje się do Drive,
  - brak tokena nie blokuje pracy na lokalnych danych.
- Verification:
  - scenariusz: online -> edycja -> reload offline -> dalsza edycja -> online -> sync,
  - potwierdzenie stanu w UI i w Drive.

### Unit 6. Minimalne porządki, żeby nowa logika nie walczyła ze starym fallbackiem

- Objective:
  - usunąć lub odizolować stare ścieżki, które psują nowy model bezpieczeństwa i finansów.
- Files:
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)
- Planned decisions:
  - nie rozwijać starego fallbackowego CRUD-u w `js/app.js`,
  - ograniczyć go do roli “boot + router + helpery”, jeśli to możliwe,
  - usunąć lub jasno zdezaktywować fragmenty, które operują na starych polach finansowych i starym modelu ustawień.
- Risks:
  - przypadkowe zostawienie starej ścieżki może nadpisywać dane w nowym formacie.
- Test scenarios:
  - wszystkie główne zakładki nadal otwierają właściwe widoki z `js/views/*`,
  - żaden stary formularz nie zapisuje danych w starym formacie.
- Verification:
  - przejść ręcznie po zakładkach i sprawdzić, że zapis idzie tylko przez nową logikę.

## Dependencies and Sequencing

Kolejność wykonania:

1. Unit 1
   - najpierw trzeba ustalić docelowy schemat danych i migrację.
2. Unit 2
   - finanse muszą zostać ujednolicone zanim offline i sync zaczną utrwalać stan.
3. Unit 3
   - szyfrowanie powinno wejść przed trwałym snapshotem offline, żeby nie kopiować plaintextu do IndexedDB jako nowego standardu.
4. Unit 4
   - po ustaleniu bezpieczeństwa danych można bezpiecznie zmienić model sesji Google.
5. Unit 5
   - offline powinien budować na nowym modelu danych, szyfrowaniu i auth flow.
6. Unit 6
   - porządki na końcu, żeby nie rozwalić prac wcześniejszych.

## Risks and Mitigations

- Ryzyko: utrata wygody “trwałego zalogowania”.
  - Mitigation: jasno pokazać użytkownikowi lokalne dane i przycisk “Połącz z Google”, zamiast udawać pełną sesję.

- Ryzyko: użytkownik zapomni hasła szyfrowania.
  - Mitigation: dodać ostrzeżenie w UI i wymagać świadomego potwierdzenia przy ustawianiu hasła.

- Ryzyko: historyczne dane po migracji będą częściowo niepełne.
  - Mitigation: log migracji i raport sesji, których nie dało się jednoznacznie przeliczyć.

- Ryzyko: konflikt lokalnego snapshotu z Drive.
  - Mitigation: prosty znacznik `hasPendingSync`, brak cichego nadpisywania nowszych zmian lokalnych.

- Ryzyko: stare fallbacki z `js/app.js` dalej będą aktywne.
  - Mitigation: podczas wykonania od razu oznaczyć, które ścieżki są wspierane, a które wyłączone.

## Nearby Existing Patterns Worth Copying

- Fabryki modelu w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
- `persistData()` i debounce zapisu w [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js)
- Widoki domenowe z własnymi helperami w `js/views/*`
- `toast()` z [js/utils.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/utils.js)

## Explicit Test Scenarios

### Bezpieczeństwo

- nowy access token nie pojawia się w `localStorage`,
- eksport JSON nie zawiera jawnych treści klinicznych,
- błędne hasło nie odszyfrowuje notatek,
- wylogowanie usuwa token z pamięci i nie zostawia aktywnej sesji Drive.

### Finanse

- zmiana stawki pacjenta nie zmienia starych raportów,
- usunięcie pacjenta nie zeruje starych przychodów,
- płatna odwołana sesja jest widoczna na liście płatności,
- usunięcie płatności odwraca stan sesji.

### Offline

- aplikacja po odświeżeniu offline nadal pokazuje dane,
- nowa notatka i nowa płatność dodane offline wracają po kolejnym otwarciu,
- po odzyskaniu internetu stan synchronizuje się do Drive bez utraty lokalnych zmian.

## Open Questions

1. Czy akceptujesz, że po pełnym odświeżeniu strony użytkownik może musieć kliknąć “Połącz z Google” ponownie?
   - To jest najbezpieczniejsze przy obecnym modelu czysto przeglądarkowym.

2. Czy akceptujesz dodatkowe hasło do odszyfrowania danych klinicznych?
   - Bez osobnego sekretu nie da się uczciwie wdrożyć prawdziwego szyfrowania po stronie samej przeglądarki.

3. Czy stare dane z niejednoznaczną kwotą mają być:
   - oznaczane do ręcznego sprawdzenia,
   - czy mimo wszystko przeliczane “najlepszym wysiłkiem”?

## Recommended Next Step

Najlepszy następny krok:

- najpierw potwierdzić 2 decyzje produktowe z sekcji `Open Questions`,
- potem przejść do wykonania według tej kolejności:
  - Unit 1
  - Unit 2
  - Unit 3
  - Unit 4
  - Unit 5
  - Unit 6

Jeśli chcesz pracować dokumentowo krok po kroku, następna komenda powinna użyć `dev-docs`.
Jeśli chcesz od razu zacząć wdrożenie, można przejść bezpośrednio do wykonania tego planu w kolejnej sesji.
