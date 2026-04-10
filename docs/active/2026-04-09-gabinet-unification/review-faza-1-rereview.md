# Re-review fazy 1

Data: 2026-04-10
Faza: `Unit 1 - fundament security, offline i sync w root`
Status bramki: gotowe do przejscia do `Unit 2`

## Podsumowanie

- `P1`: 0
- `P2`: 0
- `P3`: 0

## Findings

Brak nowych findingow.

Poprzednie findingi z [review-faza-1.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/review-faza-1.md) zostaly zweryfikowane ponownie:

- `P1` root gubi `clinicalSecurity` przy wczytaniu danych:
  - zamkniete,
  - [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L147) zachowuje teraz dodatkowe pola ustawien, w tym `clinicalSecurity`,
  - `deserializeAppData()` nadal korzysta z `createAppSettings()`, ale factory nie ucina juz tego pola.
- `P1` root nie obsluguje bezpiecznie envelope klinicznych z `GabinetPWA`:
  - zamkniete na poziomie zgodnosci `Unit 1`,
  - [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js#L44) rozpoznaje zabezpieczone wartosci kliniczne,
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js#L360) i [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js#L636) nie traktuja juz protected envelope jak zwyklego stringa,
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js#L56) i [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js#L132) maja bezpieczny fallback dla pol klinicznych.
- `P2` smoke test online/offline niepotwierdzony:
  - zamkniete,
  - [checklist.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/checklist.md#L88) zawiera wynik smoke testu,
  - re-review ponownie odtworzyl scenariusz w przegladarce.
- `P2` baseline kliniczny opisuje stan docelowy:
  - zamkniete,
  - [baseline.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/baseline.md#L74) rozdziela obecny root, kompatybilnosc po `Unit 1` i stan docelowy po kolejnych unitach.

## Weryfikacja wykonana w re-review

Komendy:

```text
node --check js/data.js
node --check js/security.js
node --check js/local-store.js
node --check js/app.js
node --check js/drive.js
node --check js/views/calendar.js
node --check js/views/patients.js
node --check js/views/settings.js
rg -n "drive\\.appdata|appDataFolder" js index.html
rg -n "sessionNotes && sessionNotes\\.trim|session\\.sessionNotes && session\\.sessionNotes\\.trim|s\\.sessionNotes && s\\.sessionNotes\\.trim|g\\.title\\) \\+|entry\\.content \\|\\| ''|\\[object Object\\]" js/views/calendar.js js/views/patients.js
```

Wynik:

- skladnia sprawdzonych plikow jest poprawna,
- nie znaleziono powrotu do `drive.appdata` ani `appDataFolder`,
- nie znaleziono juz prostych miejsc, ktore traktowalyby `sessionNotes` jak zwykly string bez sprawdzenia typu.

Smoke test lokalny:

- start online bez snapshotu:
  - `0` pacjentow,
  - `0` sesji,
  - `0` platnosci,
  - widoczny ekran logowania.
- start online po podstawieniu snapshotu:
  - `6` pacjentow,
  - `74` sesje,
  - `24` platnosci,
  - widoczny app shell.
- odswiezenie offline:
  - nadal `6 / 74 / 24`,
  - dane nie znikaja.
- powrot online i lokalny zapis:
  - snapshot pozostaje dostepny,
  - `lastSnapshotSource = local-change`,
  - status synchronizacji: `Lokalne zmiany czekaja na synchronizacje`.

## Ocena czterech obszarow

### Security i dane

- `Unit 1` nie wlacza jeszcze pelnego hasla klinicznego i to jest zgodne z planem.
- Dla danych z `GabinetPWA` root nie powinien juz wykladac sie na envelope klinicznych ani pokazywac `[object Object]`.
- Pelna migracja szyfrowania, odblokowania i ponownego zapisu danych klinicznych nadal nalezy do `Unit 2`.

### Performance i skala

- Lokalny snapshot jest zapisywany przez kolejke `_writeChain`, co ogranicza ryzyko rownoleglych zapisow do IndexedDB.
- Smoke test na referencyjnym backupie `6 / 74 / 24` przechodzi bez widocznych problemow.

### Architektura

- `drive.file` zostalo zachowane.
- `LocalStore` i `SecurityService` sa podlaczone jako fundament, bez prob pelnego big-bang merge.
- Zakres jest zgodny z decyzja, zeby pelne haslo kliniczne zostawic do `Unit 2`.

### Scenariusze

- Glowny scenariusz `Unit 1` zostal potwierdzony: lokalny snapshot przywraca dane po odswiezeniu offline.
- Test nie obejmowal zywego logowania Google w tej sesji re-review; to bylo juz potwierdzone w baseline przed `Unit 1`.

## Wniosek bramki

Mozna przejsc do `Unit 2`.

Nie rekomenduje wracania do kolejnych poprawek `Unit 1`, chyba ze pelny test na prawdziwym Google Drive pokaze nowy problem.
