# Checklist

## Status faz

- [x] Faza 1: schemat danych i migracja
- [x] Faza 2: spójność finansów i płatności
- [x] Faza 3: hasło i szyfrowanie danych klinicznych
- [x] Faza 4: utwardzenie logowania i tokena
- [x] Faza 5: lokalny snapshot offline
- [x] Faza 6: porządki w starych fallbackach

## Zrobione w fazie 1

- [x] Dodano helpery normalizacji danych wejściowych
- [x] Utrwalanie `paymentAmount` na sesji korzysta z legacy `fee` albo bieżącej stawki pacjenta przy migracji
- [x] Dodano wspólny helper `getSessionAmount()`
- [x] Migracja zachowuje stare pola przez `...data`, zamiast je cicho gubić
- [x] Migracja starych sesji przenosi legacy `note` do `sessionNotes`
- [x] Wersja eksportu danych została podniesiona z `2` do `3`
- [x] Dodano rejestr `migrationIssues` dla rekordów wymagających ręcznego sprawdzenia

## Zrobione w fazie 2

- [x] Dodano wspólne helpery domenowe płatności w `js/data.js`
- [x] Finanse zapisują i usuwają płatności przez wspólną logikę zamiast ręcznie ustawiać flagi na sesjach
- [x] Kalendarz przy płatnej odwołanej sesji tworzy prawdziwy rekord w `AppState.payments`
- [x] Dodano migrację starych opłaconych sesji bez rekordu płatności do `AppState.payments`
- [x] Widoki kalendarza i finansów liczą kwoty przez wspólny helper `getSessionAmount()`

## Zadania do Fazy 3

- [x] Dodać centralny `SecurityService` do ustawiania hasła, odblokowania i ponownej blokady danych klinicznych
- [x] Ustalić docelową listę pól klinicznych objętych ochroną
- [x] Dodać format zaszyfrowanego envelope dla treści klinicznych
- [x] Podpiąć bezpieczną serializację do `serializeAppData()`
- [x] Podpiąć rozpoznawanie stanu ochrony i migracji do `deserializeAppData()`
- [x] Obsłużyć migrację starych plaintextowych notatek po ustawieniu hasła
- [x] Dodać ekran lub modal ustawienia hasła klinicznego
- [x] Dodać ekran lub modal odblokowania danych klinicznych
- [x] Dodać sekcję „Ochrona danych klinicznych” w ustawieniach
- [x] Dodać placeholdery z blokadą w widoku pacjenta i kalendarza zamiast pustych treści
- [x] Przepiąć auto-lock tak, by blokował tylko dane kliniczne
- [x] Upewnić się, że eksport JSON nie zawiera jawnych notatek
- [x] Zaktualizować teksty w `index.html`, jeśli obecne obietnice bezpieczeństwa wymagają doprecyzowania

## Weryfikacja dla Fazy 3

- [x] `node --check js/security.js`
- [x] `node --check js/data.js`
- [x] `node --check js/app.js`
- [x] `node --check js/views/calendar.js`
- [x] `node --check js/views/patients.js`
- [x] `node --check js/views/settings.js`
- [x] Test scenariuszowy w Node VM: pierwsze ustawienie hasła na bazie bez ochrony
- [x] Test scenariuszowy w Node VM: migracja starej notatki plaintext do formatu szyfrowanego
- [x] Test scenariuszowy w Node VM: odblokowanie poprawnym hasłem
- [x] Test scenariuszowy w Node VM: błędne hasło nie odsłania danych
- [x] Test scenariuszowy w Node VM: eksport JSON nie zawiera czytelnych treści klinicznych
- [ ] Test ręczny w realnej przeglądarce: auto-lock ponownie blokuje tylko dane kliniczne

## Zadania do Fazy 4

- [x] Usunąć token i expiry z `localStorage`
- [x] Oprzeć sesję Google tylko na pamięci procesu i jawnym geście użytkownika
- [x] Zachować co najwyżej niewrażliwe metadane, jeśli są nadal potrzebne
- [ ] Sprawdzić ręcznie w realnej przeglądarce flow po reloadzie z ponownym kliknięciem „Połącz z Google”

## Weryfikacja dla Fazy 4

- [x] `node --check js/drive.js`
- [x] `node --check js/app.js`
- [x] Wyszukanie w kodzie: aplikacja nie przywraca już tokena ani expiry z `localStorage`
- [x] Test scenariuszowy w Node VM: stare wpisy sesji w `localStorage` są czyszczone przy starcie i nie tworzą zalogowanej sesji
- [x] Test scenariuszowy w Node VM: sesja działa tylko z tokenem trzymanym w pamięci
- [x] Test scenariuszowy w Node VM: cichy refresh używa `prompt: "none"`, a jawne połączenie nadal działa z przycisku użytkownika

## Zadania do Fazy 5

- [x] Dodać lokalny snapshot offline
- [x] Zapisywać lokalnie już zaszyfrowane dane kliniczne
- [x] Pokazać czytelny stan „dane lokalne dostępne / połącz z Google, aby zsynchronizować”

## Weryfikacja dla Fazy 5

- [x] `node --check js/local-store.js`
- [x] `node --check js/drive.js`
- [x] `node --check js/app.js`
- [x] `node --check js/views/settings.js`
- [x] `node --check sw.js`
- [x] Headless Chromium: lokalna zmiana zapisuje snapshot i po reloadzie uruchamia aplikację z danych lokalnych
- [x] Headless Chromium: po reloadzie aplikacja pokazuje banner z komunikatem o lokalnych danych i przyciskiem „Połącz z Google”
- [x] Headless Chromium: `LocalStore` zapisuje dokładnie wynik `serializeAppData()`, więc lokalny snapshot korzysta z tego samego, zaszyfrowanego formatu co eksport i Drive
- [ ] Ręczny test end-to-end na prawdziwym koncie Google: offline edit -> ponowne połączenie -> synchronizacja do Drive

## Zadania do Fazy 6

- [x] Usunąć albo ograniczyć stare fallbacki kolidujące z nowym modelem danych
- [x] Sprawdzić, czy stare pola legacy nie są już potrzebne do migracji

## Weryfikacja dla Fazy 6

- [x] `node --check js/app.js`
- [x] Wyszukanie w `js/app.js` potwierdza brak zapisu fallbacków do legacy pól `fee`, `note`, `defaultFee` i `autoLockEnabled`
- [x] Wyszukanie w `js/data.js` potwierdza, że legacy `fee` i `note` zostały tylko w ścieżkach migracji albo kompatybilności odczytu
- [x] Fallback finansów i listy dnia korzysta już z `paymentAmount` / `getSessionAmount()` oraz stanu płatności zamiast starego `status === "paid"`

## Do poprawy po review fazy 6

- [x] Przepiąć fallback edycji i usuwania wizyty na wspólne helpery płatności, żeby nie rozjeżdżać `AppState.sessions` i `AppState.payments`
- [x] Ograniczyć fallback tworzenia pacjenta tak, żeby nie tworzył rekordów bez `therapyStartDate` i `sessionDayConfigs`, albo całkiem przekierować ten flow do głównego widoku pacjentów

## Weryfikacja po poprawce review fazy 6

- [x] `node --check js/app.js`
- [x] Test scenariuszowy w Node VM: fallback wizyty zapisuje i usuwa płatność przez wspólną logikę, bez zostawiania rozjazdu między `AppState.sessions` i `AppState.payments`
- [x] Test scenariuszowy w Node VM: fallback pacjenta wymaga `therapyStartDate` i zapisuje `sessionDayConfigs`
- [x] Test scenariuszowy w Node VM: fallback pacjenta nie zapisuje już `phone` ani `email`
