# Review kodu aplikacji Gabinet

Data: 2026-04-08
Status bramki: zablokowane
Zakres: cały kod aplikacji

Uwaga:
W repo nie ma `docs/active` ani planu faz, więc review zostało wykonane bez porównania do dokumentacji zadania i oparte wyłącznie na aktualnym kodzie.

## Podsumowanie

- P1: 2
- P2: 3
- P3: 2

## Najważniejsze findings

### P1. Historia finansowa nie jest trwała i może się zmieniać po edycji lub usunięciu pacjenta

Kwota sesji bardzo często nie jest zapisywana na samej sesji, tylko wyliczana później z bieżącej stawki pacjenta. To oznacza, że zmiana `sessionRate` po czasie zmienia stare przychody, zaległości i podsumowania. Problem robi się jeszcze większy po usunięciu pacjenta: wtedy stare sesje nadal istnieją, ale `sessionAmount()` zwraca `0`, bo pacjenta już nie ma. To psuje historię finansową i raporty.

Dowody:
- `createSession()` zostawia `paymentAmount` jako `null`: `js/data.js:65-86`
- automatycznie generowane sesje też nie utrwalają kwoty: `js/data.js:390-394`
- ekran finansów wylicza kwotę z aktualnej stawki pacjenta: `js/views/finance.js:148-153`
- usuwanie pacjenta zostawia sesje, ale usuwa źródło stawki: `js/views/patients.js:1378-1395`

### P1. Aplikacja obiecuje szyfrowanie notatek klinicznych, ale zapisuje je jawnym tekstem

W interfejsie jest wprost napisane, że notatki kliniczne są szyfrowane przed zapisem. W kodzie nie ma jednak mechanizmu szyfrowania. Notatki są zapisywane zwykłym tekstem do `AppState`, a potem cały stan leci jako zwykły JSON na Google Drive. Przy danych terapeutycznych to jest problem bezpieczeństwa i zgodności z obietnicą produktu.

Dowody:
- obietnica szyfrowania w UI: `index.html:159-161`
- cały stan jest serializowany bez szyfrowania: `js/data.js:508-518`
- notatki sesji są zapisywane wprost do pola tekstowego: `js/views/calendar.js:687-690`
- notatki pacjenta też są zapisywane wprost: `js/views/patients.js:1110-1116`

### P2. Tryb offline jest obiecany, ale po odświeżeniu aplikacja nie ma lokalnej kopii danych

UI mówi, że aplikacja działa offline po pierwszym uruchomieniu. W praktyce service worker keszuje tylko pliki aplikacji, a dane są zawsze czytane z Google Drive. Żądania do Google API są celowo omijane przez cache. Nie ma też lokalnej bazy ani choćby kopii ostatniego stanu. Efekt: interfejs się otworzy, ale po odświeżeniu offline dane pacjentów i sesji mogą być puste.

Dowody:
- obietnica działania offline: `js/views/settings.js:188`
- dane ładowane wyłącznie z Google Drive: `js/drive.js:153-176`
- zapis lokalny po zmianie nie istnieje, jest tylko zapis do Drive: `js/drive.js:316-318`
- service worker nie keszuje Google API: `sw.js:35-61`

### P2. Oznaczenie odwołanej sesji jako opłaconej omija rejestr płatności

W kalendarzu można oznaczyć nieodbytą sesję jako płatną. Ten przepływ ustawia flagi `isPaid`, `paymentMethod` i `paymentDate` na sesji, ale nie tworzy wpisu w `AppState.payments`. Przez to dashboard finansów i lista płatności opierają się na dwóch różnych źródłach prawdy i mogą pokazywać sprzeczne dane.

Dowody:
- kalendarz ustawia płatność tylko na sesji: `js/views/calendar.js:749-760`
- dashboard liczy przychód z opłaconych sesji: `js/views/finance.js:241-245`
- lista płatności bazuje tylko na `AppState.payments`: `js/views/finance.js:326-339`

### P2. Token dostępu do Google Drive jest trzymany w `localStorage`

Token OAuth jest zapisywany w `localStorage`. To jest ryzykowne, bo każdy skuteczny XSS daje od razu dostęp do tokena i do danych w Drive AppData. W aplikacji z danymi o terapii to jest zbyt słaby model ochrony.

Dowody:
- zapis tokena do `localStorage`: `js/drive.js:37-53`

### P3. W kodzie są dwie niespójne wersje aplikacji i modeli danych

`js/data.js` oraz widoki w `js/views/*` używają nowszego modelu danych (`sessionRate`, `paymentAmount`, `sessionNotes`, `pseudonym`). Równocześnie duże części `js/app.js` trzymają starszy model (`fee`, `time`, `note`, `phone`, `email`, `defaultFee`, `autoLockEnabled`). To robi bałagan i utrudnia rozwój, bo część kodu wygląda na martwą, ale nadal jest wykonywana jako fallback.

Dowody:
- nowy model: `js/data.js:31-57`, `js/data.js:65-86`
- stary model i stare formularze w `js/app.js`: `js/app.js:485-492`, `js/app.js:904-912`, `js/app.js:993-1002`, `js/app.js:1052-1057`

### P3. Konfiguracja auto-lock jest niespójna i w praktyce nie działa jako ustawienie

Logika blokady ma na sztywno ustawione 2 minuty. Po zalogowaniu zawsze się uruchamia. Jednocześnie model danych ma `autoLockTimeout`, a stary ekran ustawień zapisuje `autoLockEnabled`. Te wartości nie są ze sobą spięte, więc użytkownik nie ma realnej kontroli nad blokadą.

Dowody:
- twardo wpisane 2 minuty: `js/app.js:4-10`
- auto-lock uruchamia się zawsze po logowaniu: `js/app.js:153-160`
- model danych używa innego pola: `js/data.js:128-138`
- stary ekran ustawień zapisuje jeszcze inne pole: `js/app.js:1050-1057`

## Dodatkowe obserwacje

- W repo są dwa prawie identyczne service workery: `sw.js` i `service-worker.js`. Rejestrowany jest tylko `sw.js`, więc drugi plik wygląda na martwy i może wprowadzać w błąd.
- W widoku pacjentów i ustawień są miejsca, gdzie przy kolejnych renderach dokładane są nowe listenery do tych samych elementów globalnych (`document.addEventListener(...)`), co z czasem zwiększa bałagan i utrudnia debugowanie.
- W kodzie nie ma testów automatycznych, więc część ryzyk mogłem ocenić tylko z czytania logiki, bez potwierdzenia scenariuszami end-to-end.

## Rekomendacja

Nie przechodziłbym dalej z rozwojem funkcji bez poprawienia obu problemów P1.

Kolejność napraw:

- [ ] Utrwalać kwotę każdej sesji w momencie jej utworzenia lub rozliczenia i przestać wyliczać historię finansową z aktualnej stawki pacjenta.
- [ ] Wprowadzić prawdziwe szyfrowanie danych wrażliwych przed serializacją do JSON.
- [ ] Dodać lokalny snapshot danych do pracy offline i odtwarzania po odświeżeniu bez internetu.
- [ ] Ujednolicić model płatności, tak żeby każda opłacona sesja miała spójny wpis w `AppState.payments`.
- [ ] Wyprowadzić martwe lub stare fallbacki z `js/app.js`, żeby został jeden model danych i jedna ścieżka UI.
- [ ] Uporządkować auto-lock i powiązać ustawienia z realną logiką działania.
