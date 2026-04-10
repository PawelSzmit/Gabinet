---
date: 2026-04-08
topic: clinical-password-ux
---

# Hasło do danych klinicznych

## Problem

Aplikacja ma obietnicę szyfrowania notatek klinicznych, ale dziś nie daje na to uczciwego mechanizmu. Chcemy dodać osobne hasło w taki sposób, żeby:

- dane naprawdę były chronione,
- użytkownik nie był męczony ciągłym wpisywaniem hasła,
- interfejs pozostał spokojny, prosty i zrozumiały.

## Requirements

- R1. Użytkownik może ustawić jedno osobne hasło do ochrony danych klinicznych.
- R2. Hasło jest potrzebne do odczytu i edycji notatek klinicznych, a nie do całej reszty aplikacji.
- R3. Kalendarz, lista pacjentów, płatności i podstawowa nawigacja działają także wtedy, gdy dane kliniczne są jeszcze zablokowane.
- R4. Po poprawnym wpisaniu hasła dane kliniczne odblokowują się na czas bieżącej pracy, bez ponownego pytania przy każdym wejściu w kartę.
- R5. Po odświeżeniu strony użytkownik może zostać poproszony ponownie o kliknięcie „Połącz z Google” oraz ponowne podanie hasła klinicznego.
- R6. Po bezczynności aplikacja ponownie blokuje dostęp do danych klinicznych.
- R7. Ustawienie hasła musi być prowadzone prostym, czytelnym flow z potwierdzeniem hasła i jasnym ostrzeżeniem, że odzyskanie treści bez hasła może być niemożliwe.
- R8. Eksport danych i zapis na Drive nie mogą zawierać jawnej treści notatek klinicznych.
- R9. Stare, nieszyfrowane notatki muszą zostać bezpiecznie przeniesione do nowego modelu bez utraty treści.
- R10. Błędne hasło nie może odsłonić części treści ani prowadzić do mylących komunikatów.

## Success Criteria

- Użytkownik rozumie różnicę między logowaniem Google a hasłem do danych klinicznych.
- Pierwsze ustawienie hasła zajmuje krótko i nie budzi lęku.
- W codziennej pracy hasło pojawia się rzadko: przy pierwszym wejściu do danych klinicznych, po odświeżeniu albo po blokadzie.
- W pliku danych i eksporcie nie ma czytelnych notatek klinicznych.
- Interfejs jasno pokazuje stan: „dane kliniczne zablokowane” albo „dane kliniczne odblokowane”.

## Scope Boundaries

- W zakresie:
  - hasło do danych klinicznych,
  - ekran ustawienia hasła,
  - ekran odblokowania danych klinicznych,
  - blokada po bezczynności,
  - migracja starych notatek do bezpiecznego formatu,
  - aktualizacja tekstów w UI.
- Poza zakresem:
  - zmiana dostawcy logowania,
  - konto użytkownika z własnym backendem,
  - odzyskiwanie hasła przez e-mail,
  - rozbudowany system ról i uprawnień.

## Key Decisions

- Decyzja: Hasło ma chronić tylko treści kliniczne, nie całą aplikację.
  Dlaczego: To najmocniej poprawia UX. Użytkownik może dalej pracować z grafikiem i finansami, a najbardziej wrażliwe dane są chronione osobno.

- Decyzja: Po odblokowaniu hasło działa tylko w bieżącej sesji pracy.
  Dlaczego: To ogranicza ryzyko wycieku i nie wymaga trwałego pamiętania sekretu w przeglądarce.

- Decyzja: Odblokowanie ma być leniwe, czyli dopiero przy wejściu w notatki lub edycję kliniczną.
  Dlaczego: Dzięki temu użytkownik nie trafia na ścianę zaraz po wejściu do aplikacji.

- Decyzja: Auto-lock ma blokować ponownie dane kliniczne po bezczynności, ale bez wyrzucania użytkownika z całej aplikacji.
  Dlaczego: To daje dobry balans między wygodą i bezpieczeństwem.

- Decyzja: UX ma być bardzo spokojny i nieprzestraszający.
  Dlaczego: Użytkownik ma rozumieć, co się dzieje, bez technicznego języka i bez wrażenia, że aplikacja „zepsuła się”, gdy prosi o hasło.

## Dependencies / Assumptions

- Użytkownik akceptuje osobne hasło do danych klinicznych.
- Użytkownik akceptuje ponowne kliknięcie „Połącz z Google” po pełnym odświeżeniu strony.
- Istniejące auto-lock i logowanie Google zostaną dopasowane do nowego flow zamiast budowania wszystkiego od zera.
- Wrażliwe pola kliniczne będą traktowane inaczej niż zwykłe pola organizacyjne i finansowe.

## Open Questions

### Before Planning

- Brak krytycznych pytań blokujących. Rekomendacja na teraz:
  - hasło wymagane przy pierwszym wejściu w dane kliniczne po starcie,
  - ponowne pytanie po odświeżeniu,
  - ponowne pytanie po auto-lock.

### Deferred to Planning

- Jak długo trwa odblokowanie przed ponowną blokadą.
- Jak dokładnie pokazać status „zablokowane / odblokowane” w widokach pacjenta i kalendarza.
- Czy eksport JSON ma być całkowicie zablokowany bez hasła, czy tylko ma zawierać już zaszyfrowane pola.

## Recommended UX Flow

1. Użytkownik loguje się przez Google jak dziś.
2. Aplikacja działa normalnie, ale sekcje kliniczne pokazują spokojny panel: „Aby zobaczyć notatki kliniczne, podaj hasło”.
3. Przy pierwszym użyciu aplikacja prowadzi przez prosty ekran ustawienia hasła:
   - nowe hasło,
   - powtórz hasło,
   - krótka informacja, że to hasło chroni tylko dane kliniczne,
   - jasne ostrzeżenie, że aplikacja nie przechowuje hasła w sposób pozwalający je odzyskać.
4. Po odblokowaniu użytkownik pracuje normalnie bez kolejnych pytań o hasło w tej samej sesji.
5. Po bezczynności dane kliniczne wracają do stanu zablokowanego, ale reszta aplikacji zostaje dostępna.
6. Po pełnym odświeżeniu strony użytkownik ponownie łączy Google i ponownie odblokowuje dane kliniczne.

## UI Principles

- Jeden spokojny język w całej aplikacji: bez słów typu „klucz”, „algorytm”, „PBKDF2”.
- Zamiast błędów technicznych:
  - „Hasło nie pasuje”
  - „Dane kliniczne są zablokowane”
  - „Ustaw hasło, aby chronić notatki”
- Osobny, estetyczny panel bezpieczeństwa w ustawieniach:
  - ustaw hasło,
  - zmień hasło,
  - informacja o ostatnim stanie ochrony,
  - ostrzeżenie o braku możliwości łatwego odzyskania treści bez hasła.
- W widokach klinicznych zamiast pustki:
  - karta z ikoną kłódki,
  - krótkie wyjaśnienie,
  - jeden główny przycisk „Odblokuj notatki”.

## Next Step

Użyć [$dev-plan](/Users/pawelszmit/.codex/skills/dev-plan/SKILL.md), żeby rozpisać wdrożenie tego flow na etapy i pliki.
