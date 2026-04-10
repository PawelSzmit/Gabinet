# Re-review fazy 3 - poprawka sign-out

Data: 2026-04-10
Decyzja bramki: gotowe do przejscia do `Unit 4`

## Liczniki

- `P1`: 0
- `P2`: 0
- `P3`: 0

## Kontekst

Re-review po poprawce `P1` z review fazy 3. Oryginalny finding dotyczył scenariusza:

1. ustaw haslo kliniczne,
2. odblokuj dane kliniczne,
3. wyloguj Google,
4. wykonaj kolejny eksport lub zapis snapshotu.

W starej wersji `handleSignOut()` mogło to odbudować `_protectedState` z jawnego `AppState`, co skutkowało wyciekiem tresci klinicznych do eksportu.

## Co sprawdzono

- [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js)
- [js/app.js](/Users/pawelszmit/Desktop/Gabinet/js/app.js)
- [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js)
- [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)
- [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
- task bundle:
  - [task.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/task.md)
  - [checklist.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/checklist.md)
  - [context.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/context.md)
- plan techniczny:
  - [2026-04-09-gabinet-unification-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-09-gabinet-unification-plan.md)

## Wynik poprawki

Oryginalny finding `P1` jest zamkniety.

`handleSignOut()` robi teraz dwie wazne rzeczy we wlasciwej kolejnosci:

- jesli dane kliniczne sa odblokowane i istnieje `_protectedState`, najpierw naklada `_applyLockedState()` na aktualny `AppState`,
- dopiero potem czyści klucz i uruchamia `bootstrapFromLoadedState()`.

To powoduje, ze:

- jawne dane kliniczne znikaja z `AppState` przed dalszym zapisem,
- `_protectedState` pozostaje zaszyfrowanym zrodlem prawdy,
- eksport po sign-out nie zawiera juz jawnych notatek, celow ani wpisow postepu,
- po ponownym odblokowaniu te dane wracaja poprawnie.

## Weryfikacja wykonana w re-review

- `git status --short`
- `node --check js/security.js`
- `node --check js/app.js`
- `node --check js/views/patients.js`
- `node --check js/views/calendar.js`
- `node --check js/views/settings.js`
- `git diff --check`
- targeted smoke JS/Node dla scenariusza:
  - ustaw haslo,
  - potwierdz brak wycieku w eksporcie,
  - wykonaj `handleSignOut()`,
  - potwierdz brak wycieku po sign-out,
  - odblokuj dane ponownie i sprawdz odzyskanie tresci klinicznych.

## Wynik smoke testu

```json
{
  "beforeLeaks": false,
  "afterLeaks": false,
  "unlock": {
    "ok": true,
    "values": {
      "session": "session-secret",
      "patient": "patient-secret",
      "goal": "goal-secret",
      "progress": "progress-secret"
    }
  }
}
```

## Wniosek

Nie potwierdzono nowych findingow `P1`, `P2` ani `P3`.

Najwazniejsze:

- poprawka zamyka realny wyciek danych klinicznych po sign-out,
- eksport po wylogowaniu pozostaje szyfrowany,
- ponowne odblokowanie nadal przywraca poprawne dane kliniczne,
- nie ma blokera przed przejsciem do `Unit 4`.
