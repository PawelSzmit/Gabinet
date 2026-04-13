# Review fazy 3: ustawienia i historia nazw

Status: **kontynuacja możliwa z zastrzeżeniami**
Data review: 2026-04-11
Faza: `Faza 3: Ustawienia`

## Wynik

- P1: 0
- P2: 2
- P3: 0

## Ustalenia

### P2 — sekcja historii pokazuje też bieżącą nazwę, więc nie spełnia obietnicy „archiwalnych nazw”

- Plik: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L264), [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js#L213)
- Linie: `js/data.js` 264–267, `js/data.js` 452–458, `js/views/settings.js` 213–245

Plan fazy 3 mówił, że pod polem mają być pokazane „2–3 ostatnie archiwalne nazwy z datami obowiązywania”. Obecna implementacja bierze historię przez `getPaymentMethodRecentHistory()`, ale ten helper filtruje tylko `entry.label` i nie odrzuca bieżącego, aktywnego wpisu. Potem `getPaymentMethodSettingsSnapshot()` przekazuje te dane wprost do widoku, a `renderPaymentMethodHistory()` renderuje je jako historię.

Praktyczny skutek: pod polem użytkownik zobaczy bieżącą nazwę jeszcze raz jako element historii, a gdy metoda ma mało wpisów, faktyczna archiwalna historia może w ogóle nie być widoczna mimo że istnieje. To jest mylące w UI i odbiega od ustalonego zachowania.

**Rekomendacja:** dodać osobny helper do „archiwalnej historii do ustawień” albo przynajmniej odfiltrować aktywny wpis (`archivedAt === null` dla bieżącego dnia) przed przekazaniem danych do `settings.js`.

### P2 — zapis zmian nie zamyka ani nie odświeża otwartych formularzy płatności

- Plik: [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js#L573), [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js#L677)
- Linie: `js/views/settings.js` 573–582, `js/views/finance.js` 677–835

W planie fazy 3 było dopięcie zachowania po zapisie: „natychmiast odświeżyć widoki korzystające z metod płatności” oraz „zamknąć albo przeładować otwarte formularze płatności z komunikatem”. Tego w kodzie jeszcze nie ma. Po potwierdzeniu zmian `settings.js` robi tylko `persistData()` i `render(container)`, czyli odświeża sam widok ustawień.

To jest istotne, bo formularz płatności w finansach jest renderowany jako overlay w `document.body` (`#fin-payment-sheet`), więc może zostać otwarty niezależnie od zawartości `#view-container`. Jeśli taki formularz zostanie na ekranie podczas zmiany metod, dalej pokazuje stare opcje i stary stan.

**Rekomendacja:** po udanym zapisie jawnie sprawdzić i zamknąć / przeładować `#fin-payment-sheet` oraz pokazać komunikat, że lista metod została zaktualizowana. Jeśli ten fragment ma trafić dopiero do fazy 6, warto co najmniej nie oznaczać fazy 3 jako w pełni domkniętej w checklistcie.

## Co sprawdziłem

- porównanie implementacji z checklistą fazy 3, kontekstem i planem technicznym
- przegląd [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
- przegląd helperów w [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
- zależności z formularzem płatności w [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
- `node --check js/data.js`
- `node --check js/views/settings.js`
- lokalny test helperów w Node dla walidacji i zapisu historii

## Czego nie potwierdziłem

- nie wykonałem pełnego ręcznego testu ekranu `Ustawienia` po przejściu całego flow logowania
- nie sprawdzałem jeszcze faktycznego odświeżania finansów i kalendarza po zmianie metod, bo to wchodzi w kolejne fazy
- nie oceniałem faz 4–7 poza miejscami, gdzie ich obecny stan wpływa już na fazę 3

## Wniosek

Faza 3 jest funkcjonalnie blisko celu: ma osobny zapis, walidację całej sekcji i logikę nadpisania zmiany tego samego dnia. Zostały jednak dwa ważne braki. Pierwszy psuje czytelność samej historii nazw w `Ustawieniach`, a drugi zostawia stary formularz płatności bez odświeżenia po zmianach metod. To nie jest blokada typu P1, ale przed świadomym wejściem w kolejne fazy warto te dwa punkty dopiąć.

## Status po poprawkach

- 2026-04-11: oba wskazane problemy zostały poprawione.
- Dodatkowa weryfikacja:
  - historia w snapshotcie ustawień pokazuje już tylko wpisy archiwalne,
  - po zapisie metod `settings.js` wywołuje helper zamykający otwarty `#fin-payment-sheet`, odświeża widok i pokazuje komunikat informacyjny.
- Ten raport zostaje jako zapis review; faza 3 jest po poprawkach gotowa do dalszej pracy.
