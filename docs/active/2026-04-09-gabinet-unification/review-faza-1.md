# Review fazy 1

Data: 2026-04-09
Faza: `Unit 1 - fundament security, offline i sync w root`
Status bramki: zablokowane przed `Unit 2`

## Podsumowanie

- `P1`: 2
- `P2`: 1
- `P3`: 0

## Findings

### [P1] Root gubi `clinicalSecurity` juz przy samym wczytaniu danych

- Plik: [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js#L147)
- Szczegoly:
  - `createAppSettings()` zachowuje tylko kilka starych pol ustawien i nie przenosi `clinicalSecurity`.
  - potem `deserializeAppData()` nadpisuje `AppState.settings = createAppSettings(data.settings || {})`, wiec metadane hasla klinicznego z danych pochodzacych z `GabinetPWA` sa tracone juz przy pierwszym loadzie.
- Dlaczego to wazne:
  - jesli istnieja backupy albo dane testowe z drugiej galezi z wlaczona ochrona kliniczna, root nie zachowa konfiguracji zabezpieczen.
  - to podcina glowny cel scalania: jedna aplikacja ma czytac dane z obu drog rozwoju bez cichej utraty informacji.

### [P1] Unit 1 nadal nie potrafi bezpiecznie obsluzyc zaszyfrowanych pol klinicznych z `GabinetPWA`

- Plik glowny: [js/security.js](/Users/pawelszmit/Desktop/Gabinet/js/security.js#L36)
- Wspierajace miejsca uzycia:
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js#L360)
  - [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js#L635)
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js#L133)
  - [js/views/patients.js](/Users/pawelszmit/Desktop/Gabinet/js/views/patients.js#L558)
- Szczegoly:
  - nowy `SecurityService` jest tylko stubem: `isUnlocked()` zawsze zwraca `false`, `canReadClinicalData()` zawsze zwraca `true`, a `prepareDataForStorage()` niczego nie szyfruje ani nie odtwarza.
  - jednoczesnie widoki nadal zakladaja, ze pola kliniczne sa zwyklymi stringami i wywoluja na nich `.trim()` albo stare `Encryption.decrypt(...)`.
- Dlaczego to wazne:
  - dane zaszyfrowane envelope z `GabinetPWA` nie sa ani odblokowywane, ani maskowane.
  - w takim przypadku widoki kalendarza i pacjentow moga wejsc na obiekt zamiast stringa i wywrocic sie w runtime albo pokazac bledny stan.

### [P2] Najwazniejszy scenariusz tej fazy nadal nie jest faktycznie potwierdzony po wdrozeniu

- Plik: [checklist.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/2026-04-09-gabinet-unification/checklist.md#L69)
- Szczegoly:
  - plan dla `Unit 1` wymagal recznego scenariusza: start online, odswiezenie offline, powrot online i zapis.
  - w checklist nadal ten test jest otwarty, a status fazy opisano jako "kod gotowy".
- Dlaczego to wazne:
  - ta faza miala naprawic dokladnie problem z baseline `S3`.
  - bez tego testu nie ma twardego potwierdzenia, ze glowny blad bazowy rzeczywiscie zniknal.

## Wniosek bramki

Nie rekomenduje przechodzenia do `Unit 2`, dopoki nie beda poprawione dwa problemy `P1`.

Najpierw trzeba:

1. zachowac `clinicalSecurity` w modelu danych root podczas `deserializeAppData()`,
2. ustalic bezpieczne zachowanie dla envelope klinicznych z `GabinetPWA`:
   - albo juz teraz je rozumiec,
   - albo przynajmniej nie dopuszczac, by widoki traktowaly je jak zwykly string,
3. dopiero po tym wykonac reczny smoke test online/offline i domknac `Unit 1`.
