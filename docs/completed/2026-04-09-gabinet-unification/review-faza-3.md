# Review fazy 3 - widoki kliniczne i ustawienia

Data: 2026-04-10
Decyzja bramki: zablokowane przed `Unit 4`

## Liczniki

- `P1`: 1
- `P2`: 0
- `P3`: 0

## Finding 1 (P1)

Plik: [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)
Linie: `317-321`

### Tytul

Wylogowanie po odblokowaniu moze zapisac dane kliniczne jawnie

### Opis

`SecurityService.handleSignOut()` zeruje klucz i `_protectedState`, a potem wywoluje `bootstrapFromLoadedState()`. Jesli uzytkownik byl wczesniej w stanie `unlocked`, `AppState` zawiera jawne notatki kliniczne. `bootstrapFromLoadedState()` bierze wtedy ten jawny `AppState` jako nowy `_protectedState`, ustawia status `locked`, a pozniejszy `serializeAppData()` w stanie locked skleja dane z tym pseudo-protected state. Efekt potwierdzony smoke testem: eksport po `handleSignOut()` zawieral tekst `patient-secret`, mimo ze eksport przed wylogowaniem nie zawieral jawnych tresci.

### Ryzyko

To jest bloker, bo po realnym scenariuszu z planu Unit 3, czyli "wylogowanie z Google przy zachowaniu lokalnych danych", lokalny snapshot lub zapis na Drive moze dostac dane kliniczne w postaci jawnej.

### Rekomendacja

Nie odbudowywac `_protectedState` z odblokowanego `AppState` podczas sign-out. Przed wyczyszczeniem `_derivedKey` trzeba zachowac albo odswiezyc zaszyfrowany `_protectedState`, a dopiero potem nalozyc locked state. Dodatkowo dodać smoke test: ustaw haslo, odblokuj dane, wyloguj Google, wykonaj `serializeAppData()` i sprawdz, ze eksport nie zawiera jawnych notatek, celow ani wpisow postepu.

## Weryfikacja wykonana w review

- `git status --short`
- odczyt task bundle: `task.md`, `checklist.md`, `context.md`
- odczyt planu technicznego: `docs/plans/2026-04-09-gabinet-unification-plan.md`
- porownanie zakresu Unit 3 z kodem w:
  - [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)
  - [js/app.js](/Users/pawelszmit/Desktop/Gabinet/js/app.js)
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)
  - [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
- `node --check js/security.js`
- `node --check js/app.js`
- `node --check js/views/patients.js`
- `node --check js/views/calendar.js`
- `node --check js/views/settings.js`
- `git diff --check`
- targeted smoke JS/Node dla scenariusza: ustawienie hasla, eksport bez wycieku, `handleSignOut()`, ponowny eksport.

## Wynik smoke testu blokerowego

```json
{
  "statusAfterSignOut": "locked",
  "beforeLeaks": false,
  "afterLeaks": true,
  "protectedStateSessionType": "string",
  "appStateSessionNote": "",
  "afterSnippet": "patient-secret"
}
```

## Wniosek

Kierunek Unit 3 jest dobry: widoki pacjenta i kalendarza nie pokazaly prostego wycieku tekstu klinicznego po locku, a stare bezposrednie `Encryption.encrypt()` / `Encryption.decrypt()` zniknely z widokow. Nie mozna jednak przejsc do `Unit 4`, dopoki sign-out po odblokowaniu moze zamienic jawny stan w pseudo-protected state i zapisac dane kliniczne bez szyfrowania.
