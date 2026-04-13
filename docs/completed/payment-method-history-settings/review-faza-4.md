# Review fazy 4: Finanse

Data review: 2026-04-11
Gate: kontynuacja możliwa z zastrzeżeniami

## Podsumowanie

- Zakres fazy 4 został w dużej mierze wykonany zgodnie z planem:
  - finanse korzystają z helperów metod płatności,
  - lista i szczegóły płatności używają nazw historycznych po dacie,
  - dashboard i filtry pracują po identyfikatorach metod.
- Znalazłem 2 ważne problemy w split payment.
- Nie znalazłem problemu blokującego dalszą pracę, ale przed wejściem w fazę 5 warto te dwa punkty poprawić, bo dotyczą bezpośrednio formularza płatności.

## Findings

### P2. Split payment nadal pozwala wybrać tę samą metodę dwa razy w UI

- Plik: [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
- Linie: około 910-917
- Problem:
  - Plan fazy 4 mówi wprost, że split payment ma blokować wybór tej samej metody dwa razy.
  - Obecna implementacja renderuje drugi toggle z pełnej listy metod, bez odfiltrowania metody już wybranej jako pierwsza.
  - Efekt: użytkownik może kliknąć tę samą metodę w obu miejscach, a dopiero przy zapisie dostaje toast z błędem.
- Dlaczego to ważne:
  - To nie jest tylko kosmetyka. Formularz obiecuje wybór dwóch metod, ale UI prowadzi użytkownika w ślepą uliczkę.
  - Przy jednej aktywnej metodzie split wygląda na dostępny, mimo że w praktyce nie da się go poprawnie zapisać.
- Oczekiwany kierunek poprawki:
  - Drugi toggle powinien ukrywać albo blokować metodę już wybraną jako pierwsza.
  - Gdy dla split payment nie ma dwóch różnych aktywnych metod, UI powinno to jasno komunikować.

### P2. Podgląd pierwszej kwoty split payment nie odświeża się po ręcznej zmianie sumy

- Plik: [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
- Linie: około 946-950
- Problem:
  - Pole `Kwota — pierwsza forma` jest wyliczane automatycznie przez `updateSplitAmount1()`.
  - Gdy użytkownik ręcznie zmienia `Łączną kwotę`, handler aktualizuje tylko komunikat salda, ale nie przelicza tego readonly pola.
  - W efekcie na ekranie może zostać stara kwota pierwszej metody, mimo że zapis pójdzie już na nowych liczbach.
- Dlaczego to ważne:
  - To wprowadza użytkownika w błąd tuż przed zapisem.
  - Formularz może pokazywać inny podział niż ten, który naprawdę zapisze się w danych.
- Oczekiwany kierunek poprawki:
  - Przy każdej ręcznej zmianie łącznej kwoty trzeba też wywołać przeliczenie `updateSplitAmount1()`.

## Co sprawdziłem

- dokumentację zadania i plan fazy 4,
- [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js),
- helpery metod płatności w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js),
- `git status --short`,
- `node --check js/views/finance.js`,
- `node --check js/data.js`.

## Wniosek

Faza 4 jest funkcjonalnie blisko celu i nie wymaga cofania zmian. Najlepszy następny krok to krótka poprawka tych 2 punktów przez `dev-docs-execute`, a dopiero potem spokojne wejście w fazę 5.
