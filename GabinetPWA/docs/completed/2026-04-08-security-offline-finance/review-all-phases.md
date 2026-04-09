# Code Review — wszystkie 6 faz

Data: 2026-04-08 (poprawki: 2026-04-09)
Perspektywy: Security, Performance, Architecture, Scenario Testing

---

## Podsumowanie po naprawach

| Priorytet | Znalezione | Naprawione |
|-----------|------------|------------|
| 🔴 P1-blocking | 3 | 3 ✅ |
| 🟠 P2-important | 22 | 21 ✅ |
| 🟡 P3-nit | 14 | 0 |

**Verdict: ✅ GOTOWE DO KONTYNUACJI — wszystkie P1 i prawie wszystkie P2 naprawione**

---

## 🔴 P1-blocking

### P1-1. Brak HTML-escapingu nazw pacjentów w calendar.js (XSS)

**Lokalizacje:**
- `js/views/calendar.js:242` — `renderWeekly()`: `name` bez escapingu
- `js/views/calendar.js:286` — `renderDaily()`: `name` bez escapingu
- `js/views/calendar.js:360` — `renderSessionRow()`: `name` bez escapingu
- `js/views/calendar.js:402-406` — `showAddSessionModal()`: nazwy w `<option>` bez escapingu
- `js/views/calendar.js:564,636-637` — `openSessionDetail()`: `name` i `pseudo` bez escapingu

Inne widoki (`patients.js`, `finance.js`, `settings.js`) konsekwentnie escapują — to przeoczenie tylko w kalendarzu.

### P1-2. Brak ochrony przed częściowym stanem przy zmianie/ustawieniu hasła

**Lokalizacja:** `js/security.js:260-286`

`_setInitialPassword` i `_changePassword` zmieniają stan w pamięci (nowy klucz, nowe ustawienia) PRZED zapisem. Jeśli `serializeAppData()` lub `persistData()` rzuci błąd (IndexedDB pełne, Drive timeout), stan w pamięci jest zmieniony, ale dane nie są zapisane. Przy restarcie — potencjalna utrata dostępu do danych klinicznych.

### P1-3. Brak synchronizacji między zakładkami — ryzyko utraty danych

Dwie zakładki pracują na niezależnych kopiach `AppState`. Obie zapisują do Drive z debounce — druga nadpisuje zmiany pierwszej. Brak `BroadcastChannel`, `SharedWorker` ani `storage` event listenera.

---

## 🟠 P2-important

### Security

**P2-S1.** `_escapeHtml` w calendar.js zamienia `\n` na `<br>` — miesza escapowanie z formatowaniem. W `<textarea>` wstawia `<br>` zamiast newline.
`js/views/calendar.js:1048`

**P2-S2.** Przy blokowaniu (`lockClinicalData`) modalne dialogi z patients.js mogą trzymać referencje do odszyfrowanych danych w closures. Tylko `#modal-session-detail` jest czyszczony.
`js/security.js:526-529`

**P2-S3.** `localStorage` nadal przechowuje `gabinet_user_info` — nie jest czyszczony w `_clearLegacySessionCache()`.
`js/views/settings.js:320`, `js/drive.js:298`

**P2-S4.** `_unlockWithPassword` maskuje każdy błąd komunikatem "Hasło nie pasuje" — w tym błędy techniczne i korupcję danych.
`js/security.js:314-319`

### Performance

**P2-P1.** Potrójne klonowanie stanu w `prepareDataForStorage` — wystarczą 2 kopie.
`js/security.js:148-156`

**P2-P2.** `getSessionsByDate()` parsuje daty WSZYSTKICH sesji przy każdym wywołaniu. Kalendarz woła to 30-84 razy per render.
`js/data.js:563-569`

**P2-P3.** `getPatientDebt()` bez cachowania — wołane raz per pacjent na liście + ponownie przy sortowaniu. 100 pacjentów × 1000 sesji = 100k+ iteracji.
`js/data.js:492-508`, `js/views/patients.js:232-239`

**P2-P4.** `generateSessionsForMonth` — O(n²) sprawdzanie duplikatów przez iterację po wszystkich sesjach.
`js/data.js:668-672`

**P2-P5.** Podwójna serializacja (+ szyfrowanie) przy każdym `persistData()` — raz dla LocalStore, raz dla Drive.
`js/drive.js:314-322`, `js/local-store.js:104`

**P2-P6.** Pełna przebudowa DOM (`innerHTML`) przy każdej nawigacji/odświeżeniu we wszystkich widokach.
`js/views/calendar.js:12-28`, `js/views/patients.js:101`, `js/views/finance.js:395-404`

**P2-P7.** Brak wersjonowania assetów JS w Service Worker — ryzyko serwowania starego kodu z cache.
`sw.js:1-19`

### Architecture & Code Quality

**P2-A1.** SecurityService miesza kryptografię z budowaniem UI dialogów (~110 linii CSS w JS).
`js/security.js:568-774`

**P2-A2.** Duplikacja HTML-escapingu — 4 niezależne implementacje: `escHtml` (patients.js, finance.js), `esc` (settings.js), `_escapeHtml` (security.js, calendar.js).

**P2-A3.** `_changePassword` prawie identyczna kopia `_setInitialPassword`.
`js/security.js:272-286`

**P2-A4.** Błędy migracji (`migrationIssues`) logowane do konsoli, ale nie raportowane użytkownikowi.
`js/data.js:851-853`

**P2-A5.** Event listener leak w `deleteBlockedPeriod` — każde usunięcie dodaje nowy listener na `#sv-blocked-list` bez usunięcia starego.
`js/views/settings.js:448-466`

**P2-A6.** finance.js lokalne `getPatient()` zwraca `null`, globalne z data.js zwraca `undefined` — subtelna niespójność.
`js/views/finance.js:113-114`

**P2-A7.** `_debounce()` zduplikowany — raz w drive.js, raz w settings.js.

### Scenarios

**P2-SC1.** `rebuildPaymentLinks` czyści `isPaid` ze WSZYSTKICH sesji przed re-attachowaniem. Sesja z `isPaid=true` bez Payment record (po częściowej migracji) traci status.
`js/data.js:418-441`

**P2-SC2.** `_handleSignOut` nie wywołuje `SecurityService.handleSignOut()` — zaszyfrowane dane pozostają w `_protectedState` po wylogowaniu.
`js/app.js:264-281`

**P2-SC3.** `generatedMonths` nie jest persistowany w `serializeAppData` — po każdym refresh sesje są generowane ponownie (bez duplikatów, ale triggeruje zapis do Drive).
`js/app.js:427-440`, `js/data.js:793-810`

**P2-SC4.** Brak obsługi/powiadomienia przy `QuotaExceededError` w IndexedDB — użytkownik nie wie, że lokalna kopia nie została zapisana.
`js/local-store.js:96-98`

**P2-SC5.** Brak ścieżki wyjścia po zapomnieniu hasła — żadnego przycisku "Zapomniane hasło - wyczyść dane kliniczne".

---

## 🟡 P3-nit (wybrane)

1. `structuredClone()` zamiast `JSON.parse(JSON.stringify())` — szybszy.
2. Brak polityki złożoności hasła poza długością ≥8.
3. Brak limitu prób odblokowania (brak rate-limiting).
4. Brak Content-Security-Policy w index.html.
5. `AutoLock.reset()` — brak throttle na `mousemove`/`scroll`.
6. Niespójne nazwy: `patientDisplayName` vs `displayPatientName`.
7. `normalizePositiveInteger` może zwrócić wartość ≤ 0 (nazewniczo mylące).
8. Eksport nie informuje, że dane zawierają zaszyfrowane notatki wymagające hasła.
9. Brak UI importu danych z pliku JSON.
10. Brak UI do zmiany timeout auto-lock.

---

## Co zrobione dobrze

1. **Kryptografia poprawna** — PBKDF2 210k iteracji, AES-GCM 256-bit, losowy salt 16B, losowy IV 12B, `extractable: false`.
2. **Token Google tylko w pamięci** — `_clearLegacySessionCache()` aktywnie czyści stare klucze.
3. **Bezpieczna serializacja** — `prepareDataForStorage()` szyfruje przed zapisem do Drive i IndexedDB.
4. **Visitor pattern** — `_visitClinicalFields` centralizuje listę pól klinicznych.
5. **Konsekwentne escapowanie** w patients.js, finance.js, settings.js.
6. **Spójne wzorce** — AppState jako centrum, `persistData()` jako jedyny punkt zapisu.
7. **Debounce i chain** w LocalStore zapobiegają nadmiernemu zapisowi.
8. **Auto-lock** poprawnie blokuje tylko dane kliniczne, nie całą aplikację.
