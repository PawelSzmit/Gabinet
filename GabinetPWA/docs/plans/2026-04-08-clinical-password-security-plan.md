# Plan wdrożenia: hasło do danych klinicznych

## Problem

Aplikacja ma obietnicę szyfrowania treści klinicznych, ale obecnie zapisuje je jawnym tekstem. Nowe założenie produktu jest takie:

- użytkownik loguje się do aplikacji przez Google jak dziś,
- osobne hasło chroni tylko dane kliniczne,
- reszta aplikacji działa także wtedy, gdy dane kliniczne są zablokowane,
- po bezczynności blokujemy ponownie dane kliniczne, a nie całą aplikację.

To jest zmiana przekrojowa, bo dotyka modelu danych, serializacji, ustawień, widoków pacjenta i kalendarza, eksportu oraz obecnego auto-lock.

## Scope

Plan obejmuje:

- dodanie osobnego hasła do danych klinicznych,
- wprowadzenie prawdziwego szyfrowania treści klinicznych przed zapisem,
- leniwe odblokowanie tylko sekcji klinicznych,
- ponowną blokadę danych klinicznych po bezczynności,
- migrację starych nieszyfrowanych notatek,
- zmianę komunikatów w UI, aby uczciwie opisywały bezpieczeństwo i flow.

## Non-goals

- zmiana dostawcy logowania,
- backend lub własny serwer,
- odzyskiwanie hasła przez e-mail,
- szyfrowanie całej aplikacji lub wszystkich pól pacjenta,
- przebudowa całego UI od zera,
- wykonanie fazy 4 i 5 z planu bezpieczeństwo/offline/finanse w tym samym kroku.

## Source Context

- Wymagania produktu: [docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md)
- Szerszy plan programu naprawczego: [docs/plans/2026-04-08-security-offline-finance-plan.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/plans/2026-04-08-security-offline-finance-plan.md)
- Aktywne zadanie, które będzie trzeba później zaktualizować przed wykonaniem:
  - [docs/active/2026-04-08-security-offline-finance/task.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/active/2026-04-08-security-offline-finance/task.md)
  - [docs/active/2026-04-08-security-offline-finance/context.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/active/2026-04-08-security-offline-finance/context.md)
  - [docs/active/2026-04-08-security-offline-finance/checklist.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/active/2026-04-08-security-offline-finance/checklist.md)

## Current State

### Co już mamy i warto zachować

- `AppState` w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js) jest centrum danych.
- `persistData()` w [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js) jest jednym punktem zapisu po zmianie danych.
- Widoki domenowe są rozbite na `js/views/calendar.js`, `js/views/patients.js`, `js/views/settings.js`.
- Jest już ogólny mechanizm bezczynności w [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js), więc nie trzeba wymyślać timera od zera.

### Co dziś blokuje poprawne wdrożenie

- `serializeAppData()` w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js) zapisuje cały stan jako zwykły JSON.
- Widoki czytają treści kliniczne bezpośrednio z pól takich jak:
  - `session.sessionNotes`,
  - `patient.sessionNotes[].content`,
  - `patient.therapeuticGoals[].title`,
  - `patient.therapeuticGoals[].notes`,
  - `patient.progressEntries[].title`,
  - `patient.progressEntries[].content`.
- `AutoLock` w [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js) jest dziś spięty z reautoryzacją Google, a nie z blokadą danych klinicznych.
- Ekran auth w [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html) już obiecuje szyfrowanie, ale nie ma jeszcze flow ustawienia ani odblokowania hasła klinicznego.

## Research Notes

Plan opiera się na oficjalnych źródłach:

- Google Identity token model: [Using the token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
  - tokeny są krótkotrwałe,
  - odświeżenie dostępu powinno wynikać z gestu użytkownika,
  - to nie zastępuje osobnego sekretu do odszyfrowania danych.
- Web Crypto: [SubtleCrypto: deriveKey()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
  - PBKDF2 jest przewidziane do wyprowadzania klucza z hasła.
- Web Crypto: [SubtleCrypto: encrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
  - `AES-GCM` jest trybem uwierzytelnianym i nadaje się do tego przypadku.
- IndexedDB: [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
  - lokalny magazyn można wersjonować i aktualizować przez `onupgradeneeded`,
  - to przyda się później, gdy faza offline będzie korzystać już z zaszyfrowanego formatu.

## Proposed Approach

Rekomendowany model jest dwuwarstwowy:

1. Aplikacja nadal działa na zwykłym `AppState` dla danych organizacyjnych i finansowych.
2. Dane kliniczne dostają osobny mechanizm ochrony:
   - na dysku i w eksporcie są zaszyfrowane,
   - po odblokowaniu są chwilowo dostępne w pamięci bieżącej sesji,
   - po ponownej blokadzie plaintext jest usuwany z aktywnego stanu i z DOM.

Kluczowa decyzja techniczna: nie szyfrujemy "po cichu" w pojedynczych widokach. Zamiast tego wprowadzamy centralny `SecurityService`, który:

- ustawia i zmienia hasło,
- wyprowadza klucz z hasła,
- weryfikuje poprawność hasła,
- szyfruje i odszyfrowuje pola kliniczne,
- wie, czy dane kliniczne są `unconfigured`, `locked`, `unlocking`, `unlocked` albo `migrationRequired`,
- czyści odszyfrowane treści przy blokadzie.

To pozwala zachować prosty kod widoków: widok pyta tylko, czy treści kliniczne są dostępne, a nie zajmuje się kryptografią.

## Planned Technical Decisions

- Dodać nowy moduł `js/security.js` jako jedyne miejsce odpowiedzialne za hasło i szyfrowanie.
- Trzymać hasło i wyprowadzony klucz tylko w pamięci bieżącej sesji.
- Użyć `PBKDF2 + AES-GCM`.
- Każdy zaszyfrowany rekord ma własny `iv`.
- Dodać mały zaszyfrowany rekord kontrolny do weryfikacji hasła, zamiast "zgadywania po błędzie".
- Nie szyfrować pól potrzebnych do działania list i harmonogramu:
  - identyfikatorów,
  - dat,
  - statusów,
  - kwot,
  - pseudonimów,
  - podstawowych metadanych potrzebnych do renderu placeholderów.
- Użyć jednej spokojnej ścieżki UX:
  - brak hasła: "Ustaw hasło",
  - hasło istnieje: "Odblokuj notatki",
  - błędne hasło: krótki, ludzki komunikat bez technicznego opisu.
- Na start użyć istniejącego `settings.autoLockTimeout` jako czasu ponownej blokady danych klinicznych, żeby nie mnożyć ustawień.
- Eksport JSON zawsze korzysta z formatu zaszyfrowanego, niezależnie od tego, czy użytkownik ma akurat otwarte dane kliniczne.

## Files In Scope

- nowy plik: [js/security.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/security.js)
- [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
- [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
- [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js)
- [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/calendar.js)
- [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js)
- [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)
- [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)

## Nearby Patterns To Follow

- Fabryki i normalizacja danych w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
- Centralny zapis przez `persistData()` w [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js)
- Modal detali sesji w [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/calendar.js)
- Panele i sekcje robocze pacjenta w [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js)
- Ustawienia jako osobny widok w [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)

## Implementation Units

### Unit 1. Model bezpieczeństwa i granice danych klinicznych

- Objective:
  - zdefiniować, co dokładnie jest chronione i w jakim formacie ma być zapisane.
- Files:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
  - nowy [js/security.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/security.js)
- Planned decisions:
  - dodać metadane ochrony klinicznej do ustawień lub top-level storage, np.:
    - `enabled`,
    - `version`,
    - `salt`,
    - `kdfIterations`,
    - `kdfHash`,
    - `passwordHint` tylko jeśli użytkownik kiedyś będzie tego chciał; na teraz poza zakresem.
  - zdefiniować wspólny envelope szyfrowania, np.:
    - `alg`,
    - `iv`,
    - `ciphertext`.
  - objąć ochroną:
    - `session.sessionNotes`,
    - `patient.sessionNotes[].content`,
    - `patient.therapeuticGoals[].title`,
    - `patient.therapeuticGoals[].notes`,
    - `patient.progressEntries[].title`,
    - `patient.progressEntries[].content`.
  - pozostawić jawne metadane potrzebne do renderu:
    - `id`,
    - `date`,
    - `status`,
    - `sessionId`,
    - liczniki i daty.
- Why first:
  - bez jasnej granicy danych wykonanie szybko rozjedzie się między widokami i serializacją.
- Risks:
  - zaszyfrowanie zbyt wielu pól może zepsuć listy i kalendarz,
  - zaszyfrowanie zbyt mało pól zostawi wrażliwe treści w JSON.
- Test scenarios:
  - model przechowuje dość metadanych, by wyświetlić placeholdery bez odszyfrowania,
  - nie da się znaleźć treści klinicznych w gotowym JSON.
- Verification:
  - ręczna inspekcja próbki serializacji,
  - check listy pól chronionych kontra pola jawne.

### Unit 2. `SecurityService` i cykl życia hasła

- Objective:
  - wprowadzić jedno miejsce, które zarządza ustawieniem hasła, odblokowaniem i ponowną blokadą.
- Files:
  - nowy [js/security.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/security.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)
- Planned decisions:
  - `SecurityService` trzyma tylko stan runtime:
    - `status`,
    - `derivedKey`,
    - `unlockedAt`,
    - `hasPendingMigration`,
    - lekką pamięć o zaszyfrowanych payloadach potrzebnych do ponownego odblokowania.
  - po ustawieniu hasła użytkownik jest od razu uznany za odblokowanego.
  - po błędnym haśle nie ujawniamy części danych i nie zapisujemy "prawie poprawnego" stanu.
  - minimalna walidacja UX:
    - hasło i powtórzenie muszą się zgadzać,
    - minimalna długość 8 znaków,
    - bez skomplikowanych wymogów typu symbole/cyfry, żeby nie pogorszyć UX.
- Why second:
  - wszystkie kolejne widoki muszą polegać na jednym źródle prawdy dla stanu `locked/unlocked`.
- Risks:
  - przypadkowe trzymanie sekretu w `localStorage` albo `AppState`,
  - odblokowanie pozorne, gdy widok myśli, że dane są otwarte, ale nie zostały zhydradowane.
- Test scenarios:
  - ustawienie hasła na pustej bazie,
  - odblokowanie poprawnym hasłem,
  - odblokowanie błędnym hasłem,
  - zmiana hasła po wcześniejszym odblokowaniu.
- Verification:
  - ręczne sprawdzenie, że `localStorage` nie zawiera hasła ani klucza,
  - test w konsoli przeglądarki, że stan runtime znika po reloadzie.

### Unit 3. Serializacja, deserializacja i migracja starych notatek

- Objective:
  - sprawić, żeby dane zapisane na Drive i eksportowane do JSON były zaszyfrowane, a stare plaintexty migrowały się bez utraty treści.
- Files:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
  - [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/drive.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)
- Planned decisions:
  - `serializeAppData()` ma korzystać z helpera, który przed zapisem zamienia pola kliniczne na ciphertext.
  - `deserializeAppData()` ma rozpoznawać trzy przypadki:
    - brak ochrony i brak starych notatek,
    - brak ochrony, ale istnieją stare plaintexty,
    - aktywna ochrona i zaszyfrowane dane.
  - przy danych legacy:
    - nie gubimy treści,
    - oznaczamy stan jako `migrationRequired`,
    - dopiero po ustawieniu hasła wykonujemy zaszyfrowanie i trwały zapis.
  - eksport korzysta z tego samego bezpiecznego formatu co zapis do Drive.
- Why after unit 2:
  - najpierw trzeba mieć gotowy mechanizm hasła i stanu odblokowania.
- Risks:
  - migracja może podmienić stare notatki na puste wartości,
  - eksport może przez pomyłkę zaciągnąć plaintext z pamięci.
- Test scenarios:
  - świeża baza z nowym hasłem,
  - stara baza z plaintextem i pierwsza migracja,
  - odczyt zaszyfrowanej bazy po reloadzie,
  - eksport w stanie `locked`,
  - eksport w stanie `unlocked`.
- Verification:
  - porównać plik JSON przed i po migracji,
  - wyszukać w eksporcie fragment starej notatki i potwierdzić, że już nie występuje.

### Unit 4. Guardy UI dla sekcji klinicznych

- Objective:
  - wdrożyć spokojny, czytelny interfejs ustawiania i odblokowania bez psucia reszty pracy.
- Files:
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/patients.js)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/calendar.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)
- Planned decisions:
  - w ustawieniach dodać sekcję "Ochrona danych klinicznych":
    - ustaw hasło,
    - zmień hasło,
    - stan ochrony,
    - krótkie ostrzeżenie o braku łatwego odzyskania treści.
  - w widoku pacjenta:
    - sekcja kliniczna pokazuje kartę blokady zamiast pustych danych,
    - po odblokowaniu wraca obecny układ notatek i celów.
  - w widoku sesji:
    - sekcja notatek pokazuje placeholder i przycisk "Odblokuj notatki",
    - edycja notatek wymaga stanu `unlocked`.
  - historia pacjenta:
    - wpisy postępu traktować jak dane kliniczne,
    - cykle terapii mogą pozostać dostępne, jeśli nie niosą wrażliwej treści.
  - wspólny modal lub sheet do:
    - ustawienia hasła,
    - odblokowania,
    - zmiany hasła.
- Why after serialization:
  - UI musi znać realny stan ochrony i migracji.
- Risks:
  - użytkownik pomyli hasło kliniczne z logowaniem Google,
  - kalendarz lub karta pacjenta pokażą pustkę zamiast jasnego komunikatu.
- Test scenarios:
  - pierwsze wejście do sekcji klinicznej bez hasła,
  - wejście do sekcji klinicznej z aktywnym hasłem,
  - próba edycji notatki przy stanie `locked`,
  - zmiana hasła z poziomu ustawień.
- Verification:
  - ręczne przejście flow w przeglądarce,
  - sprawdzenie copy i komunikatów bez technicznego żargonu.

### Unit 5. Zmiana zachowania auto-lock

- Objective:
  - zamienić obecną blokadę całej aplikacji na blokadę tylko danych klinicznych.
- Files:
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/settings.js)
  - opcjonalnie [index.html](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/index.html)
- Planned decisions:
  - obecny timer bezczynności zostaje, ale jego efekt się zmienia:
    - zamiast wyrzucać do reautoryzacji Google, woła `SecurityService.lockClinicalData()`.
  - po blokadzie:
    - aplikacja zostaje w bieżącym widoku,
    - sekcje kliniczne wracają do placeholderów,
    - pojawia się lekka informacja typu "Dane kliniczne zostały ponownie zablokowane".
  - obecne ustawienie czasu blokady wykorzystujemy ponownie.
- Why after UI guards:
  - dopiero wtedy blokada ma gdzie bezpiecznie "opaść".
- Risks:
  - relock w trakcie edycji notatki może zgubić wpisaną treść,
  - część DOM może przez chwilę pokazywać starą treść po locku.
- Test scenarios:
  - bezczynność w widoku pacjenta,
  - bezczynność w otwartym modalu sesji,
  - powrót do pracy po odblokowaniu,
  - brak blokady zwykłych sekcji finansowych i organizacyjnych.
- Verification:
  - ręczny test z krótkim timeoutem,
  - sprawdzenie, że po locku notatki nie są dalej widoczne w DOM.

### Unit 6. Spięcie z istniejącym planem bezpieczeństwa/offline

- Objective:
  - uniknąć konfliktu między nowym hasłem klinicznym a kolejnymi fazami o tokenie i offline.
- Files:
  - [docs/plans/2026-04-08-security-offline-finance-plan.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/plans/2026-04-08-security-offline-finance-plan.md)
  - [docs/active/2026-04-08-security-offline-finance/context.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/active/2026-04-08-security-offline-finance/context.md)
  - [docs/active/2026-04-08-security-offline-finance/checklist.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/active/2026-04-08-security-offline-finance/checklist.md)
- Planned decisions:
  - potraktować ten plan jako docelową specyfikację dla nowej wersji Fazy 3.
  - przy fazie 4 i 5 pilnować, żeby:
    - reload mógł wymagać ponownego kliknięcia "Połącz z Google",
    - lokalny snapshot przechowywał już tylko zaszyfrowane treści kliniczne.
- Why last:
  - to jest dokumentacyjne domknięcie zależności, nie pierwszy krok wykonawczy.
- Risks:
  - bez tego kolejna sesja może wdrożyć starą, nieaktualną wersję fazy 3.
- Test scenarios:
  - brak.
- Verification:
  - zaktualizowane aktywne docs przed startem wykonania.

## Dependencies and Sequencing

Zalecana kolejność wykonania:

1. Unit 1
2. Unit 2
3. Unit 3
4. Unit 4
5. Unit 5
6. Unit 6

Najważniejsze zależności:

- UI guardy nie powinny powstać przed ustaleniem modelu danych i `SecurityService`.
- Auto-lock nie powinien być przepinany wcześniej niż po wprowadzeniu placeholderów i bezpiecznego relocku.
- Faza offline powinna startować dopiero po tym, jak zapis lokalny i Drive korzystają już z zaszyfrowanego formatu.

## Risks and Mitigations

- Ryzyko: użytkownik zapomni hasła.
  - Mitigation: bardzo jasny komunikat przy ustawianiu hasła, bez ukrywania konsekwencji.

- Ryzyko: stare notatki zostaną utracone przy migracji.
  - Mitigation: osobny stan `migrationRequired`, migracja dopiero po świadomym ustawieniu hasła, test na kopii danych.

- Ryzyko: UI pokaże puste sekcje zamiast czytelnego powodu.
  - Mitigation: wspólny komponent placeholdera z jednym głównym CTA.

- Ryzyko: po locku plaintext zostanie w pamięci albo DOM.
  - Mitigation: centralny relock w `SecurityService`, jawne czyszczenie danych klinicznych z aktywnego stanu i wymuszenie rerenderu.

- Ryzyko: eksport lub synchronizacja wyślą plaintext.
  - Mitigation: wszystkie zapisy i eksporty przechodzą przez tę samą warstwę serializacji.

## Verification Strategy

- `node --check` dla zmienianych plików JS.
- Ręczne scenariusze w przeglądarce dla:
  - pierwszego ustawienia hasła,
  - odblokowania,
  - błędnego hasła,
  - zmiany hasła,
  - auto-lock,
  - migracji starych plaintextów,
  - eksportu JSON,
  - reloadu z danymi zaszyfrowanymi.
- Kontrola pliku JSON:
  - brak jawnych treści klinicznych,
  - obecność envelope i metadanych ochrony.
- Kontrola stanu przeglądarki:
  - brak hasła i klucza w `localStorage`.

## Explicit Test Scenarios

- Nowy użytkownik ustawia hasło i dodaje pierwszą notatkę kliniczną.
- Istniejący użytkownik z plaintextowymi notatkami ustawia hasło i migruje dane.
- Użytkownik odblokowuje notatki, edytuje sesję, potem czeka na auto-lock.
- Użytkownik wpisuje błędne hasło.
- Użytkownik zmienia hasło w ustawieniach.
- Użytkownik eksportuje dane, gdy notatki są zablokowane.
- Użytkownik eksportuje dane po wcześniejszym odblokowaniu.
- Użytkownik robi reload, ponownie łączy Google i odblokowuje dane kliniczne.

## Open Questions

Do rozstrzygnięcia w trakcie wykonania, ale bez blokowania startu:

- Czy przy relocku w trakcie edycji notatki zachowujemy lokalny draft tylko w pamięci, czy od razu go czyścimy.
  - Rekomendacja: w pierwszej wersji pokazać ostrzeżenie i zamknąć edycję bez trwałego draftu.

- Czy dodać wskaźnik siły hasła.
  - Rekomendacja: nie w pierwszej wersji; wystarczy prosty komunikat i minimalna długość.

- Czy pozwalać na całkowite wyłączenie hasła po ustawieniu.
  - Rekomendacja: poza zakresem pierwszej wersji, bo zwiększa ryzyko i komplikację migracji.

## Recommended Next Step

Najlepszy następny krok to użyć [$dev-docs](/Users/pawelszmit/.codex/skills/dev-docs/SKILL.md), a potem [$dev-docs-execute](/Users/pawelszmit/.codex/skills/dev-docs-execute/SKILL.md) dla tej nowej wersji Fazy 3. Przed wykonaniem warto też odświeżyć aktywne dokumenty zadania, żeby nie opierały się już na starym założeniu "bez hasła".
