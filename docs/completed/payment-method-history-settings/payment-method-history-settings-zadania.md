# Zadania: metody płatności z historią nazw

Branch: `main`
Last updated: 2026-04-11

## Faza 1: Model danych

- [x] Rozszerzyć `AppState.settings` o strukturę metod płatności i historię nazw.
- [x] Dodać helpery do pobierania aktywnych metod, nazw historycznych i walidacji nazw.
- [x] Usunąć zależność od lokalnych stałych nazw jako źródła prawdy.
- [x] Sprawdzić, czy helpery pokrywają potrzeby `settings.js`, `finance.js` i `calendar.js`.

## Faza 2: Migracja

- [x] Dodać mapowanie starych metod `aliorBank`, `ingBank`, `cash` na nowe sloty.
- [x] Utworzyć początkowe wpisy historii dla danych już istniejących.
- [x] Obsłużyć migrację split payment.
- [x] Dodać fallback dla rekordów problematycznych.
- [x] Zasilić `migrationIssues` i przygotować czytelny komunikat w UI.

## Faza 3: Ustawienia

- [x] Dodać nową sekcję `Metody płatności` w `js/views/settings.js`.
- [x] Pokazać 4 pola tekstowe.
- [x] Pokazać skróconą historię pod każdym polem.
- [x] Dodać walidację:
  - [x] nazwa zawiera litery lub cyfry
  - [x] brak samych spacji
  - [x] brak samych znaków specjalnych
  - [x] brak duplikatów względem historii i aktywnych nazw
- [x] Dodać osobne okno potwierdzenia `OK / Anuluj`.
- [x] Wyłączyć auto-save dla tej sekcji.

## Faza 4: Finanse

- [x] Podmienić `METHOD_LABELS` i lokalne mapowania na helpery.
- [x] Przebudować formularz nowej płatności pod aktywne metody.
- [x] Przebudować split payment pod aktywne metody.
- [x] Zmienić listę płatności na nazwy historyczne po `payment.date`.
- [x] Zmienić szczegóły płatności na nazwy historyczne po `payment.date`.
- [x] Zmienić dashboard i podsumowania, aby liczyły po identyfikatorach.
- [x] Zmienić filtry, aby pokazywały bieżące nazwy aktywnych metod.

## Faza 5: Kalendarz i reszta

- [x] Podmienić `_paymentMethodName()` w `calendar.js`.
- [x] Sprawdzić `patients.js` pod kątem starych map nazw.
- [x] Sprawdzić `app.js` pod kątem starych map nazw.
- [x] Upewnić się, że split payment pokazuje osobno poprawne nazwy obu metod.

## Faza 6: Spójność UI po zmianie metod

- [x] Zamknąć albo odświeżyć otwarte formularze płatności po zmianie nazw metod.
- [x] Pokazać komunikat, że lista metod została zaktualizowana.

## Faza 7: Weryfikacja

- [x] Sprawdzić migrację na obecnych danych.
- [x] Sprawdzić starą płatność po migracji.
- [x] Sprawdzić zmianę nazwy metody i poprawne rozdzielenie historii po dacie.
- [x] Sprawdzić wyczyszczenie nazwy i przejście do archiwum.
- [x] Sprawdzić blokadę dla historycznie użytej nazwy przez inną metodę.
- [x] Sprawdzić split payment po zmianie nazw metod.
- [x] Sprawdzić edycję daty płatności i blokadę, gdy brak nazwy dla danego dnia.
- [x] Sprawdzić fallback `Metoda archiwalna` dla problemu migracji.
- [x] Zwiększyć `CACHE_NAME` w `sw.js`.
- [x] Odświeżyć PWA i potwierdzić, że działa nowy kod.

## Punkty kontrolne dla użytkownika

- [ ] Po Faza 3 pokazać użytkownikowi sekcję `Ustawienia` i potwierdzić, że sposób edycji jest czytelny.
- [ ] Po Faza 4 pokazać użytkownikowi formularz płatności i listę płatności.
- [ ] Po Faza 7 potwierdzić na realnych danych, że historia nazw działa zgodnie z oczekiwaniem.

## Do poprawy po review fazy 1

- [x] Zmienić `normalizePaymentMethodId()`, żeby nieznane identyfikatory nie były wpuszczane do fundamentu danych jak poprawne sloty.
- [x] Zmienić obsługę `archivedAt`, żeby błędna data nie była automatycznie zamieniana na dzisiejszy dzień.

## Do poprawy po review fazy 2

- [x] Kanonizować `payment.method` i `payment.splitMethod` do slotów `pm1`–`pm4` już podczas migracji i tworzenia rekordów płatności.
- [x] Przestać przypisywać uszkodzony wpis historii z obcym `methodId` do `pm1`; zamiast tego oznaczać problem i pomijać błędny wpis.

## Do poprawy po review fazy 3

- [x] Pokazywać w `Ustawieniach` tylko archiwalne nazwy pod polem metody, bez duplikowania bieżącej aktywnej nazwy.
- [x] Po zapisie metod płatności zamykać albo odświeżać otwarty formularz płatności i pokazywać komunikat, że lista metod została zaktualizowana.

## Do poprawy po review fazy 4

- [x] Zablokować w UI split payment wybór tej samej metody dwa razy, zamiast dopiero odrzucać zapis toastem.
- [x] Przeliczać readonly pole pierwszej kwoty split payment także po ręcznej zmianie łącznej kwoty.

## Do poprawy po review fazy 5

- [x] W kalendarzu czytać metodę płatności najpierw z rekordu `paymentId`, a dopiero potem z pochodnego pola `session.paymentMethod`.

## Do poprawy po review fazy 6

- [x] Brak dodatkowych poprawek po review fazy 6.
