# Konfigurowalne metody płatności z historią nazw

Branch: `main`
Rekomendowana gałąź robocza: `codex/payment-method-history-settings`
Last updated: 2026-04-11

## Cel

Przygotować aplikację do pracy z 4 konfigurowalnymi metodami płatności, które użytkownik ustawia sam w `Ustawieniach`. Nazwy metod mają mieć prostą historię zmian, tak aby stare płatności dalej pokazywały nazwę obowiązującą w dniu płatności, a nowe formularze korzystały tylko z aktualnie aktywnych metod.

## Zakres

- 4 pola tekstowe w `Ustawieniach` dla metod płatności.
- Walidacja nazw:
  - puste pole wyłącza metodę,
  - sama spacja jest niedozwolona,
  - same znaki specjalne są niedozwolone,
  - nazwa musi zawierać litery lub cyfry,
  - nazwy aktywne i archiwalne muszą być unikalne w całym systemie.
- Osobny rejestr historii nazw metod.
- Historia liczona po `dacie płatności`.
- Obsługa nazw historycznych w:
  - liście płatności,
  - szczegółach płatności,
  - filtrach i podsumowaniach,
  - kalendarzu,
  - split payment.
- Migracja obecnych danych z metod:
  - `aliorBank`
  - `ingBank`
  - `cash`
- Bezpieczny fallback dla problemów migracji.
- Odświeżanie lub zamykanie otwartych formularzy po zmianie metod.

## Poza zakresem

- Więcej niż 4 metody płatności.
- Oddzielne pole do ustawiania liczby metod.
- Historia zmian co do godziny.
- Przebudowa całego systemu eksportu / importu poza niezbędnym wsparciem nowego modelu.
- Zmiana logiki split payment na więcej niż 2 metody.

## Fazy

### Faza 1: Fundament danych

- Dodać stałe identyfikatory metod, np. `pm1`–`pm4`.
- Rozszerzyć `AppState.settings` o historię nazw metod.
- Dodać helpery do:
  - pobierania aktywnych metod,
  - pobierania nazwy historycznej po dacie,
  - walidacji nazw,
  - sprawdzania unikalności nazw,
  - pobierania historii do `Ustawień`.

### Faza 2: Migracja i spójność starych danych

- Zamapować stare identyfikatory na nowe sloty.
- Utworzyć początkowe wpisy historii „od początku danych”.
- Dopiąć migrację dla zwykłych płatności i split payment.
- Dodać oznaczanie problemów migracyjnych oraz etykietę awaryjną `Metoda archiwalna`.

### Faza 3: Ustawienia i historia nazw

- Dodać sekcję `Metody płatności` do `Ustawień`.
- Pokazać 4 pola tekstowe.
- Pokazać pod każdym polem skróconą historię nazw z datami.
- Dodać zapis zmian przez osobne potwierdzenie `OK / Anuluj`.
- Zaimplementować regułę:
  - druga zmiana tej samej metody tego samego dnia nadpisuje wcześniejszą zmianę z tego dnia.

Status: wykonane 2026-04-11 w `js/views/settings.js` i `js/data.js`.

### Faza 4: Finanse i formularze płatności

- Podmienić sztywne nazwy metod w `finance.js`.
- Oprzeć formularz płatności i split payment na aktywnych metodach.
- Oprzeć listę, szczegóły, dashboard i filtry na helperach metod.
- Liczyć agregacje po identyfikatorze metody, a nie po nazwie.

### Faza 5: Kalendarz i pozostałe widoki

- Podmienić lokalne mapowanie nazw metod w `calendar.js`.
- Sprawdzić `patients.js` i `app.js`, czy gdzieś jeszcze jest lokalny odczyt metody płatności.
- Upewnić się, że każda część split payment bierze nazwę osobno po `dacie płatności`.

### Faza 6: Weryfikacja i rollout

- Przetestować migrację na istniejących danych.
- Sprawdzić przypadki zwykłe i historyczne.
- Zwiększyć `CACHE_NAME` w `sw.js`.
- Odświeżyć PWA i potwierdzić, że nowy kod ładuje się poprawnie.

## Kryteria akceptacji

- Użytkownik widzi w `Ustawieniach` 4 pola metod płatności.
- Prawidłowe nazwy aktywują metodę, a puste pole ją wyłącza.
- Zmiana nazwy nie psuje starych płatności.
- Stara płatność pokazuje nazwę metody zgodną z `datą płatności`.
- Filtry finansowe liczą historię jednej metody razem, nawet jeśli jej nazwa zmieniała się w czasie.
- Split payment działa na 2 identyfikatorach metod i dla każdej części pokazuje poprawną nazwę historyczną.
- Próba użycia historycznej nazwy dla innej metody jest blokowana.
- Edycja daty płatności przelicza nazwę historyczną; jeśli nie da się jej ustalić, zapis jest blokowany.
- W przypadku problemów migracji użytkownik dostaje czytelny komunikat, a UI nie pokazuje pustych lub błędnych etykiet.

## Ryzyka

- Zakres urósł: to nie jest już tylko edycja etykiet, ale system wersjonowania nazw metod.
- Największe ryzyko leży w migracji starych danych i w miejscach, gdzie dziś nazwy są zakodowane lokalnie.
- Split payment wymaga szczególnej ostrożności, bo każda z dwóch metod ma własną historię nazw.
- Auto-save z `Ustawień` nie może przypadkiem zapisywać zmian metod bez potwierdzenia.

## Zrodla

- Prośba użytkownika z 2026-04-11 o konfigurowanie metod płatności w `Ustawieniach`
- [2026-04-11-payment-method-history-settings-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-11-payment-method-history-settings-plan.md)
- [2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)
