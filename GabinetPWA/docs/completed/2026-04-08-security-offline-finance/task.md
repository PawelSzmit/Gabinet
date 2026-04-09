# Task: Security, Offline, Finance Fixes

Branch: `main`
Recommended branch: `codex/clinical-password-security`
Last updated: 2026-04-09

## Cel

Dowieźć cały pakiet poprawek po review, ale z nowym założeniem dla Fazy 3:

- dane kliniczne są chronione osobnym hasłem,
- hasło nie blokuje całej aplikacji,
- po bezczynności blokujemy ponownie tylko treści kliniczne,
- zapis na Drive i eksport nie zawierają jawnych notatek klinicznych.

Po review Fazy 6 domknięto też dwa dodatkowe punkty w starych fallbackach: zapis i usuwanie wizyty oraz awaryjny formularz pacjenta.

## Zakres

To zadanie nadal obejmuje sześć faz:

1. Faza 1: schemat danych i migracja
2. Faza 2: spójność finansów i płatności
3. Faza 3: hasło i szyfrowanie danych klinicznych
4. Faza 4: utwardzenie logowania i tokena
5. Faza 5: lokalny snapshot offline
6. Faza 6: porządki w starych fallbackach

Największa zmiana dokumentacyjna dotyczy teraz Fazy 3. Wcześniej była koncepcyjnie zablokowana przez brak zgody na osobne hasło. To już nieaktualne.

## Poza zakresem

- zmiana dostawcy logowania,
- własny backend lub serwer,
- odzyskiwanie hasła przez e-mail,
- pełna przebudowa UI,
- wykonywanie kilku faz naraz w jednym kroku bez kontroli jakości.

## Fazy

### Faza 1

Uporządkowanie modelu danych i migracji starych rekordów.

Status: ukończona

### Faza 2

Ujednolicenie źródła prawdy dla płatności i poprawa spójności finansów.

Status: ukończona

### Faza 3

Wdrożenie osobnego hasła do danych klinicznych, prawdziwego szyfrowania przed zapisem, migracji starych notatek i spokojnych ekranów odblokowania.

Status: ukończona

### Faza 4

Usunięcie tokena Google z `localStorage` i przejście na bezpieczniejszy model sesji po stronie przeglądarki.

Status: ukończona

### Faza 5

Dodanie lokalnego snapshotu offline, który będzie już przechowywał zaszyfrowane treści kliniczne.

Status: ukończona

### Faza 6

Ograniczone porządki w starych fallbackach, które mogą kolidować z nowym modelem bezpieczeństwa i offline.

Status: ukończona

## Kryteria akceptacji

- Historia finansowa korzysta z utrwalonych kwot sesji, a nie z bieżącej stawki pacjenta.
- Każda płatność ma jedno spójne źródło prawdy w `AppState.payments`.
- Dane kliniczne nie występują jawnym tekstem w zapisie na Drive ani w eksporcie JSON.
- Użytkownik może wejść do aplikacji i pracować z kalendarzem, pacjentami i finansami bez natychmiastowego podawania hasła klinicznego.
- Dane kliniczne są odblokowywane tylko po poprawnym haśle i ponownie blokowane po bezczynności.
- Po odświeżeniu strony użytkownik może ponownie kliknąć „Połącz z Google”, a potem odblokować dane kliniczne osobno.

## Ryzyka

- Użytkownik może zapomnieć hasła klinicznego.
- Migracja starych notatek może uszkodzić treści, jeśli będzie źle wykonana.
- Zbyt szerokie szyfrowanie może zepsuć listy i kalendarz.
- Zbyt wczesne zmiany w auth albo offline mogą wejść w konflikt z nową Fazą 3.

## Zrodla

- Review: [docs/review-kodu-2026-04-08.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/review-kodu-2026-04-08.md)
- Główny plan programu naprawczego: [docs/plans/2026-04-08-security-offline-finance-plan.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/plans/2026-04-08-security-offline-finance-plan.md)
- Wymagania dla hasła klinicznego: [docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/brainstorms/2026-04-08-clinical-password-ux-requirements.md)
- Plan techniczny dla hasła klinicznego: [docs/plans/2026-04-08-clinical-password-security-plan.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/plans/2026-04-08-clinical-password-security-plan.md)
