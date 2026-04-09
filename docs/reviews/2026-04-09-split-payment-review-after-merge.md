# Review: split payment po scaleniu na `main`

Data: 2026-04-09  
Status: **KONTYNUUJ Z POPRAWKAMI**

## Zakres

Review najnowszego stanu implementacji split payment po scaleniu zmian na `main`, względem planu:
[2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)

## Stan repo podczas review

- gałąź: `main`
- workspace nie jest w pełni czysty:
  - zmodyfikowane: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
  - zmodyfikowane: [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/calendar.js)
  - zmodyfikowane: [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/views/finance.js)
  - nowe: `docs/superpowers/`
- właściwy kod split payment w tym review dotyczy głównej aplikacji w repo root, czyli plików pod `/Users/pawelszmit/Desktop/Gabinet/js/` oraz `/Users/pawelszmit/Desktop/Gabinet/js/views/`

## Podsumowanie

- P1: 0
- P2: 3
- P3: 0

## Co sprawdziłem

- plan split payment
- poprzedni review split payment
- [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
- [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
- [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)
- `node --check` dla:
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
  - [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)

## Findings

### P2. Lista płatności dalej ukrywa fakt podzielonej płatności

Plan dla Unit 3 zakładał, że lista płatności pokaże split payment czytelnie już na liście, a nie dopiero w szczegółach. Aktualny kod wiersza listy renderuje tylko jeden badge oparty o `payment.method`, więc płatność typu „Alior + gotówka” wygląda na zwykły pojedynczy przelew. To nie psuje zapisu danych, ale psuje szybki odczyt i jest niespójne z modalu szczegółów, który split pokazuje poprawnie.

Dowody:
- lista używa tylko `payment.method`: [js/views/finance.js:418](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js#L418)
- szczegóły pokazują już oba składniki split payment: [js/views/finance.js:1023](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js#L1023)

### P2. Filtr metody ignoruje drugą metodę w split payment

Po wdrożeniu split payment ekran płatności nadal filtruje tylko po `payment.method`. W praktyce płatność „Alior + gotówka” nie pojawi się przy filtrze „Gotówka”, mimo że część przychodu z tej płatności trafia do gotówki i jest tak liczona w dashboardzie. To daje użytkownikowi dwa różne obrazy finansów: wykres mówi, że gotówka była, ale lista po filtrze jej nie pokazuje.

Dowody:
- filtr sprawdza wyłącznie `payment.method`: [js/views/finance.js:380](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js#L380)
- dashboard rozbija split revenue na obie metody: [js/views/finance.js:213](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js#L213)

### P2. Agregacja revenue dla split payment może gubić lub dodawać grosze

`revenueByMethod()` rozdziela split payment proporcjonalnie na sesje i zaokrągla każdą część osobno do 2 miejsc po przecinku. Przy płatności podzielonej na kilka sesji suma takich lokalnych zaokrągleń nie musi już równać się oryginalnym `splitAmounts`, więc słupki metody mogą się rozjechać z realną sumą płatności o 0,01-0,02 zł lub więcej. To uderza dokładnie w kryterium z planu, że suma słupków ma się zgadzać z sumą wszystkich płatności.

Dowody:
- zaokrąglenie dzieje się osobno dla każdej sesji i dla obu metod: [js/views/finance.js:222](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js#L222)
- plan wymaga zgodności sum po agregacji: [2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)

## Werdykt

Implementacja split payment jest funkcjonalnie blisko celu i nie widzę już blockerów z poprzedniego review, ale nadal nie jest całkiem domknięta jako warstwa raportowania i czytelności finansów. Najuczciwszy status to: **kontynuuj z poprawkami**.

## Rekomendowany następny krok

Uruchomić jedno krótkie wykonanie naprawcze tylko pod te 3 punkty:

- pokazać split payment na liście płatności,
- rozszerzyć filtr metody tak, by brał pod uwagę także `splitMethod`,
- zmienić agregację revenue tak, by rozdział i zaokrąglenie zachowywały dokładną sumę końcową.
