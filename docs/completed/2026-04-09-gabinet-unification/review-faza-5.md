# Review fazy 5

Data: 2026-04-10
Faza: `Unit 5 - shell, PWA assets i cleanup`
Status bramki: gotowe do dalszej pracy z zastrzezeniami

## Liczniki

- P1: 0
- P2: 1
- P3: 1

## Findingi

### P2 - Unit 5 zostal oznaczony jako ukonczony mimo braku planowej weryfikacji PWA

Dokumentacja taska oznacza `Unit 5` jako zakonczony i sugeruje przejscie do `dev-docs-complete`, ale plan tej fazy wymagal jeszcze trzech koncowych scenariuszy: twardego odswiezenia po zmianie service workera, instalacji PWA oraz startu po odswiezeniu na telefonie i desktopie. Tych scenariuszy nie ma w checklistcie jako wykonanych, a w kontekście fazy zostaly wprost opisane jako luka po wdrozeniu. To nie oznacza bledu w samym kodzie `sw.js` lub `manifest.json`, ale oznacza, ze bramka jakości zostala ustawiona zbyt optymistycznie i nadal istnieje realne ryzyko ukrytej regresji w instalacji lub aktualizacji PWA.

Dowody:

- plan fazy 5: [docs/plans/2026-04-09-gabinet-unification-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-09-gabinet-unification-plan.md#L349)
- status taska: [task.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/task.md#L43)
- checklista fazy 5: [checklist.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/checklist.md#L286)
- przyznana luka po wdrozeniu: [context.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/context.md#L734)

### P3 - README nadal opisuje czesc stacku ze starej wersji aplikacji

README zostal odswiezony w tej fazie, ale tabela technologii nadal opisuje stare elementy, ktorych nie widac juz w aktualnym root. Dokumentacja podaje `Playfair Display + System fonts` oraz `Chart.js`, podczas gdy rootowy shell laduje fonty `Fraunces` i `Manrope`, a wyszukiwanie po kodzie nie pokazuje obecnego uzycia `Chart.js`. To nie psuje dzialania aplikacji, ale oslabia wartosc cleanupu, bo README nadal nie jest pelnym obrazem aktualnego stanu.

Dowody:

- tabela technologii: [README.md](/Users/pawelszmit/Desktop/Gabinet/README.md#L51)
- aktualne fonty w shellu: [index.html](/Users/pawelszmit/Desktop/Gabinet/index.html#L17)

## Co sprawdzono

- task bundle: `task.md`, `checklist.md`, `context.md`
- plan techniczny `Unit 5`
- implementacja:
  - [sw.js](/Users/pawelszmit/Desktop/Gabinet/sw.js)
  - [manifest.json](/Users/pawelszmit/Desktop/Gabinet/manifest.json)
  - [index.html](/Users/pawelszmit/Desktop/Gabinet/index.html)
  - [README.md](/Users/pawelszmit/Desktop/Gabinet/README.md)
  - [docs/archived-sources/gabinet-pwa/ARCHIVE.md](/Users/pawelszmit/Desktop/Gabinet/docs/archived-sources/gabinet-pwa/ARCHIVE.md)
- sanity check zaleznosci root <-> `GabinetPWA`
- sanity check dokumentacji technologii i sposobu uruchomienia

## Wniosek

Sam kierunek zmian w `Unit 5` jest sensowny: root ma uporzadkowany service worker, spójniejszy manifest i nie widac zaleznosci runtime od plikow zostawionych tylko w `GabinetPWA`. Problemem nie jest glowna logika PWA, tylko zbyt wczesne uznanie fazy za w pelni domknieta oraz niedokonczony cleanup README.

## Rekomendowany nastepny krok

Najpierw wykonac krotkie poprawki po review:

1. recznie przejsc finalne scenariusze PWA z planu `Unit 5` i dopiero wtedy utrzymac status `ukonczony`,
2. doprecyzowac README tak, aby tabela technologii odpowiadala aktualnemu root.

Potem mozna bezpiecznie przejsc do `dev-docs-complete`.
