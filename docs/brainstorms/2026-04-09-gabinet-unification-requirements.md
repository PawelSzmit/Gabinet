---
date: 2026-04-09
topic: gabinet-unification
---

# Scalenie `Gabinet` i `GabinetPWA` do jednej aplikacji

## Problem

Projekt rozszedl sie na dwie wersje rozwijane rownolegle:

- glowny katalog `Gabinet`,
- osobny katalog `GabinetPWA`.

Obie wersje maja wartosciowe zmiany, ale w innych obszarach. To tworzy ryzyko:

- dalszego dublowania pracy,
- nowych bledow przy recznym przepisywaniu zmian,
- rozjazdu zachowania aplikacji zaleznie od tego, z ktorego folderu korzystamy.

## Requirements

- R1. Docelowo ma zostac jedna aplikacja i jeden zestaw plikow zrodlowych.
- R2. Scalanie nie moze zgubic zadnej waznej funkcji z obszarow: bezpieczenstwo, offline, finanse, pacjenci, kalendarz, ustawienia.
- R3. Jesli dwa rozwiazania robia podobna rzecz, preferowana jest wersja nowsza czasowo, ale tylko wtedy, gdy nie jest slabsza funkcjonalnie.
- R4. Bezpieczenstwo danych klinicznych ma zostac zachowane jako osobny, wazny filar aplikacji.
- R5. Finanse musza pozostac spojne i oparte o jedno zrodlo prawdy.
- R6. Po scaleniu ma byc jasne, ktory modul jest odpowiedzialny za:
  - dane,
  - synchronizacje,
  - ochrone danych klinicznych,
  - widoki.
- R7. Trzeba uniknac mieszania dwoch konkurencyjnych mechanizmow szyfrowania i dwoch konkurencyjnych mechanizmow pracy offline.
- R8. Scalanie powinno byc etapowe, z mozliwoscia sprawdzenia kazdego etapu osobno.

## Success Criteria

- Jedna wersja aplikacji zawiera najlepsze elementy obu folderow.
- Nie ma juz drugiego rownoleglego katalogu produktu do utrzymywania.
- Dane kliniczne sa chronione osobnym haslem i nie wyciekaja do jawnego JSON.
- Aplikacja umie uruchomic sie z lokalnej kopii offline po odswiezeniu.
- Platnosci, dashboard i kalendarz licza te same dane w ten sam sposob.
- Ustawienia jasno pokazuja stan synchronizacji i ochrony danych.

## Scope Boundaries

- W zakresie:
  - porownanie obu wersji,
  - wskazanie wersji docelowej dla kazdego glownego obszaru,
  - plan funkcjonalnego scalenia,
  - decyzja, co zachowac, co odrzucic i co przepisac.
- Poza zakresem:
  - samo wdrozenie scalenia,
  - refactor calej architektury od zera,
  - nowy backend,
  - zmiana modelu logowania z Google Drive.

## Key Decisions

- Decyzja: nie wybieramy jednej bazy kodu tylko po dacie plikow ani po nazwie katalogu.
  Dlaczego: historia Git pokazuje, ze pelna synchronizacja `GabinetPWA -> ROOT` zostala najpierw wykonana, a potem cofnięta. To oznacza, ze sama "nowszosc" plikow w root nie jest wiarygodnym dowodem, ze ta wersja jest lepsza jako calosc.

- Decyzja: kod wybieramy modul po module.
  Dlaczego: oba katalogi maja mocne strony, ale w innych obszarach. Proba mechanicznego przepisania calej jednej wersji na druga juz raz wydarzyla sie w repo i zostala odkrecona.

- Decyzja: historie Git traktujemy jako sygnal intencji, a nie jako automatyczny werdykt.
  Dlaczego: commit mowi nam, co autor probowal osiagnac i co potem uznal za problematyczne. To jest bardzo cenna wskazowka, ale nie zastapi sprawdzenia logiki modulu i jego skutkow biznesowych.

- Decyzja: glowny katalog `Gabinet` pozostaje docelowym miejscem produktu, ale nie oznacza to automatycznie, ze kazdy modul z root ma byc wersja zwycieska.
  Dlaczego: trzeba rozdzielic "gdzie bedzie finalna aplikacja" od "z ktorej wersji bierzemy dany obszar kodu".

- Decyzja: z `GabinetPWA` nalezy zachowac i przeniesc przede wszystkim warstwe bezpieczenstwa i offline.
  Dlaczego: ten obszar jest tam wyraznie bardziej dojrzaly i juz zostal opisany jako domkniety pakiet bezpieczenstwo + offline + synchronizacja.

- Decyzja: finanse trzeba scalic ostroznie, a nie wybierac mechanicznie jednej wersji pliku.
  Dlaczego: glowny katalog ma nowsze zmiany i obsluge czesciowych platnosci, ale `GabinetPWA` ma lepszy porzadek wokol jednego zrodla prawdy i utrwalonej kwoty sesji.

- Decyzja: nie nalezy utrzymywac dwoch systemow ochrony danych klinicznych.
  Dlaczego: glowny katalog ma starszy mechanizm `Encryption`, a `GabinetPWA` ma pelniejszy `SecurityService` z osobnym haslem i migracja.

- Decyzja: nie nalezy utrzymywac dwoch systemow lokalnego zapisu.
  Dlaczego: `GabinetPWA` ma `LocalStore` i sensowny model snapshotu offline, czego glowna wersja nie ma.

## Dependencies / Assumptions

- Zakladamy, ze glowny katalog `Gabinet` jest docelowym miejscem produktu.
- Zakladamy, ze katalog `GabinetPWA` byl eksperymentalna lub boczna sciezka rozwoju.
- Zakladamy, ze daty plikow moga pomagac tylko pomocniczo, ale nie moga byc glowna zasada wyboru.
- Zakladamy, ze commit "sync: pelna synchronizacja GabinetPWA -> ROOT" i jego pozniejszy revert sa istotnym sygnalem, ze potrzebne jest scalanie selektywne, a nie kolejne pelne nadpisanie.
- Zakladamy, ze bezpieczenstwo danych klinicznych i offline to funkcje krytyczne, wiec maja pierwszenstwo nad starszymi prostszymi mechanizmami.

## Open Questions

### Before Planning

- Czy docelowo zachowujemy landing page z glownego katalogu, czy wersje marketingowa z `GabinetPWA`?
- Czy czesciowe platnosci z glownego katalogu sa funkcja, ktora na pewno ma zostac?

### Deferred to Planning

- Kolejnosc przenoszenia modulow plik po pliku.
- Jak rozwiazac migracje danych, jesli obecnie obie wersje zapisaly juz rozne formaty.
- Jakie testy reczne wykonac po kazdym etapie scalenia.

## Recommended Direction

### Zasada nadrzedna

- nie wybieramy calej bazy po dacie katalogu,
- nie kopiujemy juz w calosci `GabinetPWA -> ROOT` ani `ROOT -> GabinetPWA`,
- wybieramy zwyciezce osobno dla kazdego glownego modulu,
- Git traktujemy jako wazny kontekst: co bylo swiadomym pakietem zmian, co bylo pozniejsza poprawka, a co zostalo juz raz odkrecone.

### Zachowac z glownego katalogu `Gabinet`

- docelowe miejsce finalnej aplikacji,
- nowszy landing page i styles,
- najnowsze poprawki w finansach, ale po recznym przegladzie logiki,
- obsluge czesciowych platnosci, jesli jest potrzebna biznesowo.

### Zachowac z `GabinetPWA`

- `js/security.js`,
- `js/local-store.js`,
- podejscie do ochrony danych klinicznych,
- podejscie do lokalnego snapshotu offline,
- podejscie do statusu synchronizacji,
- fragmenty `drive.js`, `app.js`, `settings.js`, `patients.js`, `calendar.js`, ktore sa zwiazane z blokowaniem/odblokowaniem danych klinicznych i praca offline.

### Scalac recznie

- `js/data.js`,
- `js/views/finance.js`,
- `js/views/calendar.js`,
- `js/views/patients.js`,
- `js/views/settings.js`,
- `js/app.js`,
- `js/drive.js`.

## Next Step

Uzyc [$dev-plan](/Users/pawelszmit/.codex/skills/dev-plan/SKILL.md), zeby rozpisac bezpieczny plan scalania etapami, z decyzja bazowej wersji plikow i kolejka migracji modulow.
