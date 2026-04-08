# Code Review: Split Payment (commit ceade8d)
Data: 2026-04-08 | Status: **WYMAGA POPRAWEK**

---

## 🔴 P1 — Blocking (3 issues)

### P1-1: Division by zero w `revenueByMethod()`
**Plik:** `js/views/finance.js` — `revenueByMethod()`
**Problem:** Gdy `payment.amount = 0` i `payment.isSplit = true`, warunek `payment.amount > 0` blokuje główną ścieżkę, ale fallback nie obsługuje tego przypadku — sesja ma `paymentMethod = 'aliorBank+cash'`, który trafia do nieistniejącego bucketu w `totals`.
**Fix:** Dodać guard w `savePayment()`: gdy split=ON i `amount <= 0` → toast + return.

### P1-2: Brak walidacji `amount > 0` przy zapisie split
**Plik:** `js/views/finance.js` — `savePayment()`
**Problem:** Walidacja split nie sprawdza jawnie czy `amount > 0`. Możliwy zapis płatności z `amount = 0` przy split=ON jeśli user wyczyści pole kwoty.
**Fix:** Dodać `if (isSplit && amount <= 0) { toast(...); return; }` przed blokiem `splitAmounts`.

### P1-3: Duplikacja logiki parsowania compound method
**Pliki:** `js/views/finance.js:171`, `js/views/calendar.js:1120`
**Problem:** Obie funkcje (`paymentMethodLabel` i `_paymentMethodName`) mają identyczny kod `method.split('+').map(...)`. Funkcja `isCompoundMethod()` z `data.js` jest zdefiniowana ale nieużywana — inline `indexOf('+')` pojawia się w 3 miejscach.
**Fix:** Użyć `isCompoundMethod()` zamiast inline checks; logika etykiet może zostać zdublowana (oddzielne moduły), ale przynajmniej zrób to spójnie.

---

## 🟠 P2 — Important (2 issues)

### P2-1: splitMethod nie walidowany względem PAYMENT_METHODS
**Plik:** `js/views/finance.js`, `js/data.js`
**Problem:** Wartość `splitMethod` pochodzi z `<input hidden>` ustawianego przez JS, ale nie jest sprawdzana czy jest jedną ze znanych wartości (`aliorBank|ingBank|cash`) przed zapisem. Gdyby ktoś wstrzyknął przez DevTools, dostanie się do `session.paymentMethod`.
**Severity:** Niska w kontekście aplikacji single-user, ale warto dodać whitelist check.

### P2-2: N+1 look-up w `revenueByMethod()`
**Plik:** `js/views/finance.js:215`
**Problem:** `AppState.payments.find()` wywoływane O(n×m) gdzie n=sesje, m=płatności. Nie jest nowy problem (inne miejsca też tak robią), ale split flow go wzmacnia.
**Fix:** Zbudować `Map` payments na początku funkcji: `const payMap = new Map(AppState.payments.map(p => [p.id, p]))`.

---

## 🟡 P3 — Nit (2 issues)

### P3-1: `updateSplitAmount1` zdefiniowana po `refreshTotal`
**Plik:** `js/views/finance.js`
**Problem:** `refreshTotal()` wywołuje `updateSplitAmount1()`, która jest zdefiniowana niżej w tym samym closure. Działa (JS hoisting), ale kolejność jest myląca.
**Fix:** Przenieś definicję `updateSplitAmount1` przed `refreshTotal`.

### P3-2: `badge-split` nieobsługiwany w patients.js
**Plik:** `js/views/patients.js`
**Problem:** Widok historii sesji pacjenta może wyświetlać `session.paymentMethod = 'aliorBank+cash'` bezpośrednio (jeśli jest taki element w UI). Warto sprawdzić czy wymagana jest analogiczna obsługa.

---

## Severity Gate

⚠️ **KONTYNUUJ Z POPRAWKAMI** — 3 problemy P1 wymagają naprawy przed uznaniem feature'a za production-ready. P1-1 i P1-2 tworzą scenariusz prowadzący do uszkodzonych danych finansowych.

---

## Do naprawy

- [x] 🔴 P1-1 `savePayment()`: dodaj `if (isSplit && amount <= 0)` guard
- [x] 🔴 P1-2 `revenueByMethod()`: zabezpiecz fallback gdy compound method trafia do nieznanego bucketu
- [x] 🔴 P1-3 Użyj `isCompoundMethod()` zamiast inline `indexOf('+')` w finance.js i calendar.js
- [x] 🟠 P2-1 Whitelist check dla `splitMethod` przed zapisem
- [x] 🟠 P2-2 Zamień `AppState.payments.find()` na Map w `revenueByMethod()`
- [x] 🟡 P3-1 Kolejność definicji `updateSplitAmount1` vs `refreshTotal`
- [x] 🟡 P3-2 Sprawdź patients.js pod kątem compound method display (brak — nie wymaga zmian)
