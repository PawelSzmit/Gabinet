# Review fazy 0

Data review: 2026-04-09
Status bramki: zablokowane przed rozpoczeciem Unit 1
Zakres review: Unit 0 - baseline i zabezpieczenie wykonania

## Podsumowanie

- P1: 1
- P2: 1
- P3: 0

## Findings

### [P1] Unit 0 zostal oznaczony jako ukonczony bez spelnienia wlasnej weryfikacji koncowej

Plan dla Unit 0 wymaga nie tylko listy scenariuszy, ale tez eksportu danych z aktualnie uzywanej wersji oraz "kopii danych do porownan". Tymczasem status zadania oznacza Unit 0 jako ukonczony, mimo ze dokumenty tego samego taska wprost mowia, ze eksport prawdziwych danych nie zostal wykonany. To jest blokujace, bo kolejne unity dotykaja security, offline, sync i migracji danych, czyli wlasnie tych miejsc, gdzie brak referencyjnej kopii najbardziej utrudni wykrycie cichej regresji albo odzyskanie stanu po bledzie.

Dowody:

- plan: [2026-04-09-gabinet-unification-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-09-gabinet-unification-plan.md#L145)
- status zadania: [task.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/task.md#L36)
- ograniczenie zapisane w kontekscie: [context.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/context.md#L65)
- baseline bez kopii danych: [baseline.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/baseline.md#L3)

Rekomendacja:

- przed Unit 1 wykonac eksport danych z aktualnie uzywanej, zalogowanej aplikacji,
- zapisac gdzie ta kopia lezy,
- dopiero potem uznac Unit 0 za gotowy do dalszego ruchu.

### [P2] Baseline dla danych klinicznych opisuje stan docelowy, a nie obecny stan root

Plik baseline ma sluzyc jako karta porownawcza "przed i po", ale scenariusz S4 zaklada juz docelowe zachowanie po wdrozeniu osobnego hasla klinicznego: dane ukryte przed odblokowaniem i widoczne dopiero po unlocku. Obecny root tak jeszcze nie dziala. W widoku pacjenta root od razu probuje odszyfrowac podglady notatek, a w app shell "unlock" opiera sie na odswiezeniu tokenu Google, nie na osobnym hasle klinicznym. To sprawia, ze dla jednego z najwazniejszych obszarow baseline nie opisuje rzeczywistego punktu startu.

Dowody:

- scenariusz S4: [baseline.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/baseline.md#L30)
- obecny root odczytuje notatki w widoku pacjenta: [patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js#L99)
- obecny root nie ma osobnego unlocku klinicznego, tylko token Google: [app.js](/Users/pawelszmit/Desktop/Gabinet/js/app.js#L220)

Rekomendacja:

- uzupelnic baseline o rzeczywiste obserwacje z aktualnego root,
- oddzielic "stan obecny" od "stanu docelowego po scaleniu",
- szczegolnie dla scenariusza danych klinicznych.

## Ocena z czterech perspektyw

### Security i dane

Najwieksza luka to brak realnej kopii danych przed ruszeniem migracji security/offline/sync. To oslabia caly sens bezpiecznego punktu startu.

### Performance

Nie znalazlem problemu wydajnosciowego w samym Unit 0, bo to etap dokumentacyjny.

### Architektura i spojnosc

Task bundle jest sensownie ulozony i dobrze osadza decyzje w historii Git. Problemem nie jest kierunek, tylko zbyt optymistyczne domkniecie fazy.

### Pokrycie scenariuszy

Lista scenariuszy jest dobra i praktyczna, ale nie ma jeszcze realnych wynikow "przed". Dodatkowo scenariusz kliniczny miesza stan biezacy ze stanem docelowym.

## Decyzja bramki

Nie rekomenduje przechodzenia do Unit 1, dopoki nie powstana dwa artefakty:

1. rzeczywisty eksport danych z obecnie uzywanej aplikacji,
2. notatki z wykonania scenariuszy bazowych na aktualnym root.

Po wykonaniu tych dwoch rzeczy Unit 0 bedzie mozna uznac za gotowy bez zastrzezen blokujacych.
