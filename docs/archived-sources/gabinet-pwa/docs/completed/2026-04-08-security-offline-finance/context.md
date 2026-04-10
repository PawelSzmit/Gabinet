# Context

Branch: `main`
Recommended branch: `codex/clinical-password-security`
Last updated: 2026-04-09

## Status

- Data rozpoczęcia: 2026-04-08
- Ostatnio ukończona faza: Faza 6, a potem follow-up po review fazy 6
- Następna faza: brak; pakiet 6 faz i poprawka po review zostały wykonane
- Bramka po review: domknięta po uzupełnieniu dwóch punktów z Fazy 6

## Zrodla

- Review: [docs/review-kodu-2026-04-08.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/review-kodu-2026-04-08.md)
- Plan bazowy: [docs/plans/2026-04-08-security-offline-finance-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/plans/2026-04-08-security-offline-finance-plan.md)
- Wymagania dla hasła: [docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md)
- Plan techniczny dla hasła: [docs/plans/2026-04-08-clinical-password-security-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/plans/2026-04-08-clinical-password-security-plan.md)

## Ostatni wykonany zakres

Faza 6:

- awaryjny kod w `js/app.js` przestał zapisywać legacy pola `fee`, `note`, `defaultFee` i `autoLockEnabled`,
- fallback sesji zapisuje już `paymentAmount`, pokazuje godzinę z nowego formatu daty i nie udostępnia klinicznych notatek poza pełnym widokiem,
- fallback tworzenia wizyty korzysta ze stawki pacjenta i zapisuje nowy model sesji zamiast starego `fee` / `note`,
- fallback edycji pacjenta zapisuje `sessionRate` i nie tworzy już plaintextowych notatek pacjenta poza chronionym widokiem,
- fallback ustawień zapisuje tylko aktualne pola (`therapistName`, `therapistAddress`, `therapistNIP`, `autoLockTimeout`),
- stare pola legacy zostały zachowane już tylko w `js/data.js`, gdzie są nadal potrzebne do migracji i odczytu historycznych danych.

Follow-up po review fazy 6:

- fallback edycji i usuwania wizyty używa teraz wspólnych helperów płatności,
- fallback pacjenta zapisuje `therapyStartDate` i `sessionDayConfigs`,
- awaryjny formularz pacjenta nie zapisuje już `phone` ani `email`,
- zmiany zostały sprawdzone w testach scenariuszowych w Node VM.

## Ważne pliki i obszary

- Dane i migracje:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/data.js)
- Ochrona danych klinicznych:
  - [js/security.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/security.js)
- Lokalny snapshot i metadane synchronizacji:
  - [js/local-store.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/local-store.js)
- Logowanie, lock i przejścia aplikacji:
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/app.js)
  - [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/drive.js)
- Widoki kliniczne:
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/calendar.js)
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/patients.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/settings.js)
- UI wejścia i obietnice produktu:
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/index.html)

## Najważniejsze decyzje techniczne

- Historyczna kwota sesji jest migrowana do `paymentAmount` z dwóch źródeł:
  - legacy `fee`, jeśli istnieje,
  - `patient.sessionRate`, jeśli sesja ma pacjenta i nie ma własnej kwoty.
- Stare pola nie są teraz usuwane z rekordów podczas migracji. To celowe, żeby nie zgubić danych przed późniejszym uporządkowaniem fallbacków.
- Legacy `note` w sesji jest mapowane do `sessionNotes`.
- Użytkownik akceptuje, że po odświeżeniu strony może być potrzebne ponowne kliknięcie „Połącz z Google”.
- Użytkownik zaakceptował osobne hasło do danych klinicznych.
- Hasło ma chronić tylko dane kliniczne, nie całą aplikację.
- Po odblokowaniu hasło działa tylko w bieżącej sesji.
- Po bezczynności ponownie blokujemy dane kliniczne, ale nie wyrzucamy użytkownika z całej aplikacji.
- Lokalny snapshot przechowuje dokładnie wynik `serializeAppData()`, więc korzysta z tego samego zaszyfrowanego formatu danych klinicznych co eksport i zapis do Drive.
- Brak aktywnej sesji Google nie blokuje już pracy na lokalnej kopii danych na tym urządzeniu.

## Mapa danych klinicznych

Pola, które według aktualnego planu mają być objęte ochroną:

- `session.sessionNotes`
- `patient.sessionNotes[].content`
- `patient.therapeuticGoals[].title`
- `patient.therapeuticGoals[].notes`
- `patient.progressEntries[].title`
- `patient.progressEntries[].content`

Pola, które powinny pozostać jawne ze względów UX i działania list:

- identyfikatory,
- daty,
- statusy,
- kwoty,
- `pseudonym`,
- metadane potrzebne do renderu kart i placeholderów.

## Wzorce do zachowania

- `AppState` pozostaje centrum danych.
- `persistData()` pozostaje jednym głównym punktem zapisu po mutacji.
- Kryptografia nie powinna trafiać bezpośrednio do widoków. Widoki mają pytać o stan blokady, a nie same szyfrować lub odszyfrowywać.
- Komunikaty dla użytkownika mają być proste i spokojne, bez technicznego żargonu.

## Zależności przed kolejnymi fazami

- Faza 5 musi zapisywać lokalnie już zaszyfrowane treści kliniczne, nie plaintext.
- Faza 6 nie może usunąć starych fallbacków zbyt wcześnie, jeśli jeszcze są potrzebne do migracji danych.

## Zmienione pliki do tej pory

- [js/data.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/data.js)
- [js/security.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/security.js)
- [js/local-store.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/local-store.js)
- [js/app.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/app.js)
- [js/drive.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/drive.js)
- [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/finance.js)
- [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/calendar.js)
- [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/patients.js)
- [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/js/views/settings.js)
- [index.html](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/index.html)
- [styles.css](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/styles.css)
- [sw.js](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/sw.js)
- [docs/active/2026-04-08-security-offline-finance/task.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/active/2026-04-08-security-offline-finance/task.md)
- [docs/active/2026-04-08-security-offline-finance/checklist.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/active/2026-04-08-security-offline-finance/checklist.md)
- [docs/active/2026-04-08-security-offline-finance/context.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/active/2026-04-08-security-offline-finance/context.md)

## Dotychczasowa weryfikacja

- `node --check js/data.js`
- `node --check js/security.js`
- `node --check js/app.js`
- `node --check js/drive.js`
- `node --check js/views/finance.js`
- `node --check js/views/calendar.js`
- `node --check js/views/patients.js`
- `node --check js/views/settings.js`
- `node --check js/drive.js` po Fazie 4
- `node --check js/app.js` po Fazie 4
- `node --check js/local-store.js`
- `node --check js/drive.js` po Fazie 5
- `node --check js/app.js` po Fazie 5
- `node --check js/app.js` po Fazie 6
- `node --check js/views/settings.js` po Fazie 5
- `node --check sw.js`
- wyszukanie w kodzie potwierdzające brak przywracania tokena i expiry z `localStorage`
- test scenariuszowy Fazy 4 w Node VM:
  - legacy token, expiry i fileId są czyszczone przy `DriveService.init()`,
  - sama obecność starych wpisów w `localStorage` nie tworzy już zalogowanej sesji,
  - aktywna sesja działa tylko wtedy, gdy token istnieje w pamięci procesu,
  - cichy refresh używa `prompt: "none"`,
  - jawne połączenie z kliknięcia użytkownika nadal korzysta z flow interaktywnego.
- ręczny test logiki płatności w Node VM:
  - utworzenie płatności spina rekord płatności z sesją,
  - edycja płatności nie tworzy duplikatu i przepina sesje poprawnie,
  - usunięcie płatności odłącza sesje i czyści flagi płatności,
  - stara opłacona sesja bez rekordu płatności migruje się do `AppState.payments`.
- test scenariuszowy Fazy 3 w Node VM:
  - legacy plaintext z notatką, celem i wpisem postępu przechodzi w stan `migration-required`,
  - zapis bez hasła zostaje zablokowany,
  - ustawienie hasła tworzy zaszyfrowany eksport bez jawnych treści klinicznych,
  - ponowne wczytanie danych startuje w stanie `locked`,
  - poprawne hasło przywraca treści kliniczne,
  - błędne hasło jest odrzucane.
- test scenariuszowy Fazy 5 w headless Chromium:
  - lokalna zmiana zapisuje snapshot w `IndexedDB`,
  - po pełnym reloadzie aplikacja wstaje z lokalnej kopii danych,
  - ekran auth nie jest już pokazywany, gdy lokalna kopia istnieje,
  - banner synchronizacji pokazuje komunikat o lokalnych danych i akcji „Połącz z Google”.
- test scenariuszowy Fazy 5 w headless Chromium dla serializacji:
  - `LocalStore.saveSnapshot()` zapisuje dokładnie wynik `serializeAppData()`,
  - zapisany snapshot zawiera marker serializacji i envelope danych klinicznych, bez obchodzenia warstwy bezpieczeństwa.
- wyszukanie w `js/app.js` po Fazie 6:
  - brak zapisów fallbacków do `session.fee`, `session.note`, `patient.fee`, `patient.notes`, `settings.defaultFee`, `settings.autoLockEnabled`,
  - fallback finansów nie używa już `status === "paid"`.
- wyszukanie w `js/data.js` po Fazie 6:
  - legacy `fee` i `note` zostały tylko w migracji i kompatybilności odczytu,
  - nie ma nowego kodu aplikacyjnego, który dopisuje te pola podczas normalnej pracy.

## Luki i uwagi na przyszłość

- Nie było jeszcze pełnego testu integracyjnego w realnej przeglądarce na danych użytkownika.
- Nie było jeszcze ręcznego testu end-to-end na prawdziwym koncie Google dla scenariusza: edycja offline -> ponowne połączenie -> synchronizacja do Drive.
- Wszystkie 6 faz planu są wykonane; sensowny następny krok to `dev-docs-complete` albo ręczne testy domykające przed zamknięciem zadania.
- Follow-up po review fazy 6 jest również domknięty.

## Review fazy 6 — 2026-04-09

- Status bramki: kontynuacja z zastrzeżeniami
- Raport: [review-faza-6.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/docs/active/2026-04-08-security-offline-finance/review-faza-6.md)
- Najważniejsze wnioski:
  - fallback sesji w `js/app.js` nadal omija wspólną logikę płatności przy zapisie i usuwaniu,
  - fallback pacjenta dalej potrafi tworzyć rekordy niezgodne z głównym modelem (`therapyStartDate` i harmonogram są pomijane),
  - stare finding o tokenie OAuth w `localStorage` nie odtwarza się już w aktualnym kodzie.

Uzupełnienie po poprawce 2026-04-09:

- oba punkty z review zostały naprawione w `js/app.js`,
- fallback wizyty przepina się teraz przez wspólną logikę płatności,
- fallback pacjenta wymaga daty startu terapii i harmonogramu,
- weryfikacja scenariuszowa w Node VM przeszła pomyślnie.
