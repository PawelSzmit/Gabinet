# Split Payment — Finance Views Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore split payment support so that a single payment can be divided across two methods (e.g. 200 zł Alior + 50 zł Gotówka), and the Finance tab correctly reflects this in filters, sums, and detail views.

**Architecture:** Add `isSplit`, `splitMethod`, `splitAmounts` fields to the Payment model in `data.js`. The payment form in `finance.js` gets a "Podziel płatność" toggle that reveals a secondary method picker and amount inputs. `filteredPayments()` is updated to match split payments against either method. `revenueByMethod()` reads split amounts from the payment record to correctly attribute revenue per method. The session's `paymentMethod` field stores a compound string `"primary+secondary"` for split payments so the calendar detail view can display it.

**Tech Stack:** Vanilla JS (no framework), browser-only PWA

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `js/data.js` | Modify lines 219-233, 326-333, 362-415 | Add split fields to `createPayment`, pass compound method in `attachPaymentToSession`, accept split data in `recordPaymentForSessions` |
| `js/views/finance.js` | Modify lines 151-167, 193-201, 322-331, 355-380, 511-570, 608-614, 642-686, 710-756 | Split-aware labels, revenue calc, filtering, form UI, save logic, detail view |

---

### Task 1: Add split payment fields to Payment model (`data.js`)

**Files:**
- Modify: `js/data.js:219-233` (`createPayment`)

- [ ] **Step 1: Add `isSplit`, `splitMethod`, `splitAmounts` to `createPayment`**

In `js/data.js`, replace the `createPayment` function (lines 219-233) with:

```javascript
function createPayment(data = {}) {
  const isSplit = data.isSplit === true;
  return {
    ...data,
    id:            data.id            || uuid(),
    patientId:     data.patientId     || null,
    date:          data.date ? normalizeSessionDate(data.date) : new Date().toISOString(),
    amount:        normalizeNullableNumber(data.amount) ?? 0,
    // aliorBank | ingBank | cash
    method:        data.method        || 'cash',
    isSplit:       isSplit,
    splitMethod:   isSplit ? (data.splitMethod || 'cash') : null,
    splitAmounts:  isSplit && data.splitAmounts
      ? { primary: normalizeNullableNumber(data.splitAmounts.primary) ?? 0,
          secondary: normalizeNullableNumber(data.splitAmounts.secondary) ?? 0 }
      : null,
    sessionsCount: normalizePositiveInteger(data.sessionsCount, 0),
    sessionIds:    Array.isArray(data.sessionIds) ? data.sessionIds : [],
    note:          data.note          || '',
    createdAt:     data.createdAt     || new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add js/data.js
git commit -m "feat(split-payment): add isSplit/splitMethod/splitAmounts to createPayment"
```

---

### Task 2: Update `attachPaymentToSession` to store compound method (`data.js`)

**Files:**
- Modify: `js/data.js:326-333` (`attachPaymentToSession`)

- [ ] **Step 1: Store compound method string on session for split payments**

Replace `attachPaymentToSession` (lines 326-333) with:

```javascript
function attachPaymentToSession(session, paymentRecord) {
  if (!session || !paymentRecord) return;
  session.paymentAmount = getSessionAmount(session);
  session.isPaid = true;
  session.paymentId = paymentRecord.id;
  session.paymentMethod = paymentRecord.isSplit
    ? (paymentRecord.method + '+' + paymentRecord.splitMethod)
    : (paymentRecord.method || null);
  session.paymentDate = paymentRecord.date || null;
}
```

This stores `"aliorBank+cash"` on the session so the calendar view can display both methods.

- [ ] **Step 2: Commit**

```bash
git add js/data.js
git commit -m "feat(split-payment): store compound paymentMethod on sessions"
```

---

### Task 3: Update `recordPaymentForSessions` to accept split data (`data.js`)

**Files:**
- Modify: `js/data.js:362-415` (`recordPaymentForSessions`)

- [ ] **Step 1: Pass split fields through to createPayment and record update**

Replace the section of `recordPaymentForSessions` from line 388 (`const paymentDate = ...`) through line 412 (`paymentRecord.note = ...`) with:

```javascript
  const paymentDate = data.date ? normalizeSessionDate(data.date) : new Date().toISOString();
  const paymentMethod = data.method || 'cash';
  const paymentTotal = calculatePaymentTotal(uniqueSessionIds);
  const isSplit = data.isSplit === true;
  const splitMethod = isSplit ? (data.splitMethod || 'cash') : null;
  const splitAmounts = isSplit && data.splitAmounts
    ? { primary: data.splitAmounts.primary, secondary: data.splitAmounts.secondary }
    : null;

  let paymentRecord = previousRecord;
  if (!paymentRecord) {
    paymentRecord = createPayment({
      patientId,
      date: paymentDate,
      amount: paymentTotal,
      method: paymentMethod,
      isSplit,
      splitMethod,
      splitAmounts,
      sessionIds: uniqueSessionIds,
      sessionsCount: uniqueSessionIds.length,
      note: data.note || '',
    });
    AppState.payments.push(paymentRecord);
  } else {
    paymentRecord.patientId = patientId;
    paymentRecord.date = paymentDate;
    paymentRecord.amount = paymentTotal;
    paymentRecord.method = paymentMethod;
    paymentRecord.isSplit = isSplit;
    paymentRecord.splitMethod = splitMethod;
    paymentRecord.splitAmounts = splitAmounts;
    paymentRecord.sessionIds = uniqueSessionIds;
    paymentRecord.sessionsCount = uniqueSessionIds.length;
    paymentRecord.note = data.note || '';
  }
```

- [ ] **Step 2: Commit**

```bash
git add js/data.js
git commit -m "feat(split-payment): pass split fields through recordPaymentForSessions"
```

---

### Task 4: Update `paymentMethodLabel` and `paymentMethodClass` for compound methods (`finance.js`)

**Files:**
- Modify: `js/views/finance.js:151-167`

- [ ] **Step 1: Handle compound method strings in label and class helpers**

Replace `paymentMethodLabel` and `paymentMethodClass` (lines 151-167) with:

```javascript
  function paymentMethodLabel(method) {
    const labels = {
      aliorBank: 'Alior Bank',
      ingBank: 'ING Bank',
      cash: 'Gotówka',
    };
    if (method && method.indexOf('+') !== -1) {
      return method.split('+').map(function(m) { return labels[m] || m; }).join(' + ');
    }
    return labels[method] || method || '—';
  }

  function paymentMethodClass(method) {
    if (method && method.indexOf('+') !== -1) return 'badge-split';
    const map = {
      aliorBank: 'badge-alior',
      ingBank: 'badge-ing',
      cash: 'badge-cash',
    };
    return map[method] || 'badge-cash';
  }
```

- [ ] **Step 2: Add CSS for `.badge-split`**

In the `injectStyles()` styles array (around line 59, after the `.fin-chip.active` line), add this entry:

```javascript
'.badge-split{background:linear-gradient(135deg,var(--blue,#49664f),#8a6d3b);color:#fff}',
```

- [ ] **Step 3: Commit**

```bash
git add js/views/finance.js
git commit -m "feat(split-payment): compound method labels and badge-split CSS"
```

---

### Task 5: Fix `revenueByMethod` to distribute split amounts correctly (`finance.js`)

**Files:**
- Modify: `js/views/finance.js:193-201`

- [ ] **Step 1: Rewrite `revenueByMethod` to read split amounts from payment records**

Replace `revenueByMethod` (lines 193-201) with:

```javascript
  function revenueByMethod(periodSessions) {
    const totals = { aliorBank: 0, ingBank: 0, cash: 0 };
    const seen = new Set();
    periodSessions.forEach(function(session) {
      if (!session.isPaid || !session.paymentId) return;
      if (seen.has(session.paymentId)) return;
      var payment = getPayments().find(function(p) { return p.id === session.paymentId; });
      if (!payment) {
        // Fallback: no payment record, attribute full amount to session method
        var method = session.paymentMethod || 'cash';
        if (method.indexOf('+') !== -1) method = method.split('+')[0];
        totals[method] = (totals[method] || 0) + sessionAmount(session);
        return;
      }
      seen.add(payment.id);
      // Only count sessions within the period
      var periodSessionIds = new Set(periodSessions.filter(function(s) { return s.isPaid && s.paymentId === payment.id; }).map(function(s) { return s.id; }));
      var periodAmount = 0;
      (payment.sessionIds || []).forEach(function(sid) {
        if (periodSessionIds.has(sid)) {
          var s = getSessions().find(function(item) { return item.id === sid; });
          if (s) periodAmount += sessionAmount(s);
        }
      });
      if (payment.isSplit && payment.splitAmounts && payment.amount > 0) {
        var fraction = periodAmount / payment.amount;
        totals[payment.method] = (totals[payment.method] || 0) + payment.splitAmounts.primary * fraction;
        totals[payment.splitMethod] = (totals[payment.splitMethod] || 0) + payment.splitAmounts.secondary * fraction;
      } else {
        totals[payment.method] = (totals[payment.method] || 0) + periodAmount;
      }
    });
    return totals;
  }
```

This uses a `seen` Set to avoid double-counting payments that cover multiple sessions. For split payments it proportionally distributes the primary/secondary amounts based on how much of the payment falls within the current period.

- [ ] **Step 2: Commit**

```bash
git add js/views/finance.js
git commit -m "fix(split-payment): revenueByMethod distributes split amounts correctly"
```

---

### Task 6: Fix `filteredPayments` to match split payments against either method (`finance.js`)

**Files:**
- Modify: `js/views/finance.js:322-331`

- [ ] **Step 1: Update filter logic to check both primary and split methods**

Replace `filteredPayments` (lines 322-331) with:

```javascript
  function filteredPayments() {
    return getPayments()
      .filter(function(payment) {
        if (paymentFilters.method !== 'all') {
          var matchesPrimary = payment.method === paymentFilters.method;
          var matchesSplit = payment.isSplit && payment.splitMethod === paymentFilters.method;
          if (!matchesPrimary && !matchesSplit) return false;
        }
        if (paymentFilters.from && payment.date < paymentFilters.from) return false;
        if (paymentFilters.to && payment.date > paymentFilters.to) return false;
        return true;
      })
      .sort(function(a, b) { return b.date.localeCompare(a.date); });
  }
```

- [ ] **Step 2: Update payment row rendering to show split-specific amount when filtered**

Replace the payment amount display in `renderPayments` (around line 365) — the line:
```javascript
'<span class="fin-payment-amount">' + escHtml(formatCurrency(payment.amount)) + '</span>' +
```

With:

```javascript
'<span class="fin-payment-amount">' + escHtml(formatCurrency(paymentDisplayAmount(payment, paymentFilters.method))) + '</span>' +
```

And add this helper function right before `filteredPayments` (around line 321):

```javascript
  function paymentDisplayAmount(payment, filterMethod) {
    if (filterMethod === 'all' || !payment.isSplit || !payment.splitAmounts) return payment.amount;
    if (payment.method === filterMethod) return payment.splitAmounts.primary;
    if (payment.splitMethod === filterMethod) return payment.splitAmounts.secondary;
    return payment.amount;
  }
```

- [ ] **Step 3: Update the total sum to use filtered amounts**

Replace the `total` calculation in `renderPayments` (line 335):
```javascript
const total = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
```

With:
```javascript
    var total = payments.reduce(function(sum, payment) { return sum + paymentDisplayAmount(payment, paymentFilters.method); }, 0);
```

- [ ] **Step 4: Commit**

```bash
git add js/views/finance.js
git commit -m "fix(split-payment): filteredPayments matches both methods, shows split amounts"
```

---

### Task 7: Add split payment UI to the payment form (`finance.js`)

**Files:**
- Modify: `js/views/finance.js:511-570` (`renderPaymentSheet`)
- Modify: `js/views/finance.js:579-625` (`bindPaymentSheetEvents`)

- [ ] **Step 1: Add split toggle and secondary method/amount fields to the form**

In `renderPaymentSheet`, after the method toggle `</div>` and its hidden input (line 546), and before the closing `</div>` of the `fin-form-group--full` (line 547), insert the split payment UI. Replace lines 545-547:

```javascript
              '</div>' +
              '<input type="hidden" id="fin-sheet-method" value="' + escHtml(selectedMethod) + '">' +
            '</div>' +
```

With:

```javascript
              '</div>' +
              '<input type="hidden" id="fin-sheet-method" value="' + escHtml(selectedMethod) + '">' +
              '<label class="fin-toggle-row" style="margin-top:10px;display:flex;align-items:center;gap:10px;cursor:pointer">' +
                '<input type="checkbox" id="fin-sheet-split"' + (payment && payment.isSplit ? ' checked' : '') + ' style="accent-color:var(--blue,#49664f)">' +
                '<span style="font-size:.82rem;font-weight:700;color:var(--text-secondary,rgba(36,49,38,.68))">Podziel płatność na dwie metody</span>' +
              '</label>' +
              '<div id="fin-split-section" style="' + (payment && payment.isSplit ? '' : 'display:none;') + 'margin-top:10px;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:18px;background:rgba(255,255,255,.48);border:1px solid var(--border,rgba(73,102,79,.1))">' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap" id="fin-split-method-toggle">' +
                  '<button class="fin-method-btn' + (splitMethodVal === 'aliorBank' ? ' active' : '') + '" type="button" data-split-method="aliorBank">Alior Bank</button>' +
                  '<button class="fin-method-btn' + (splitMethodVal === 'ingBank' ? ' active' : '') + '" type="button" data-split-method="ingBank">ING Bank</button>' +
                  '<button class="fin-method-btn' + (splitMethodVal === 'cash' ? ' active' : '') + '" type="button" data-split-method="cash">Gotówka</button>' +
                '</div>' +
                '<input type="hidden" id="fin-sheet-split-method" value="' + escHtml(splitMethodVal) + '">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
                  '<div class="fin-form-group">' +
                    '<label for="fin-split-primary">Kwota: ' + escHtml(paymentMethodLabel(selectedMethod)) + '</label>' +
                    '<input class="fin-input" type="number" step="0.01" min="0" id="fin-split-primary" value="' + (splitPrimary || '') + '">' +
                  '</div>' +
                  '<div class="fin-form-group">' +
                    '<label for="fin-split-secondary">Kwota: <span id="fin-split-secondary-label">' + escHtml(paymentMethodLabel(splitMethodVal)) + '</span></label>' +
                    '<input class="fin-input" type="number" step="0.01" min="0" id="fin-split-secondary" value="' + (splitSecondary || '') + '">' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
```

And at the top of `renderPaymentSheet`, after `const selectedMethod = ...` (line 514), add variables for split state:

```javascript
    const splitMethodVal = payment && payment.isSplit ? (payment.splitMethod || 'cash') : 'cash';
    const splitPrimary = payment && payment.splitAmounts ? payment.splitAmounts.primary : '';
    const splitSecondary = payment && payment.splitAmounts ? payment.splitAmounts.secondary : '';
```

- [ ] **Step 2: Bind events for the split UI in `bindPaymentSheetEvents`**

After the existing method button binding block (around line 614, after `});`), add:

```javascript
    // Split toggle
    var splitCheck = sheet.querySelector('#fin-sheet-split');
    var splitSection = sheet.querySelector('#fin-split-section');
    if (splitCheck && splitSection) {
      splitCheck.addEventListener('change', function() {
        splitSection.style.display = splitCheck.checked ? '' : 'none';
      });
    }

    // Split method buttons
    var splitMethodInput = sheet.querySelector('#fin-sheet-split-method');
    sheet.querySelectorAll('[data-split-method]').forEach(function(button) {
      button.addEventListener('click', function() {
        sheet.querySelectorAll('[data-split-method]').forEach(function(item) { item.classList.remove('active'); });
        button.classList.add('active');
        splitMethodInput.value = button.dataset.splitMethod;
        var label = sheet.querySelector('#fin-split-secondary-label');
        if (label) label.textContent = paymentMethodLabel(button.dataset.splitMethod);
      });
    });
```

- [ ] **Step 3: Commit**

```bash
git add js/views/finance.js
git commit -m "feat(split-payment): add split payment toggle and fields to form UI"
```

---

### Task 8: Update `savePayment` to pass split data (`finance.js`)

**Files:**
- Modify: `js/views/finance.js:642-686` (`savePayment`)

- [ ] **Step 1: Read split fields from the form and pass them to `recordPaymentForSessions`**

In `savePayment`, after `const note = ...` (line 648) and before `const sessionIds = ...` (line 649), add:

```javascript
    const isSplit = sheet.querySelector('#fin-sheet-split') && sheet.querySelector('#fin-sheet-split').checked;
    const splitMethod = isSplit ? (sheet.querySelector('#fin-sheet-split-method') || {}).value || 'cash' : null;
    const splitPrimaryVal = isSplit ? parseFloat((sheet.querySelector('#fin-split-primary') || {}).value) : 0;
    const splitSecondaryVal = isSplit ? parseFloat((sheet.querySelector('#fin-split-secondary') || {}).value) : 0;
```

Then after the validation checks, before the `try` block (around line 664), add validation for split amounts:

```javascript
    if (isSplit) {
      if (!splitPrimaryVal || splitPrimaryVal <= 0 || !splitSecondaryVal || splitSecondaryVal <= 0) {
        toast('Obie kwoty muszą być większe od zera.', 'warning');
        return;
      }
      if (method === splitMethod) {
        toast('Wybierz dwie różne metody płatności.', 'warning');
        return;
      }
    }
```

Then update the `recordPaymentForSessions` call (line 669-676) to include split data:

```javascript
      recordPaymentForSessions({
        id: existingId || null,
        patientId,
        date,
        method,
        note,
        sessionIds,
        isSplit: isSplit,
        splitMethod: splitMethod,
        splitAmounts: isSplit ? { primary: splitPrimaryVal, secondary: splitSecondaryVal } : null,
      });
```

- [ ] **Step 2: Commit**

```bash
git add js/views/finance.js
git commit -m "feat(split-payment): savePayment passes split fields to recordPaymentForSessions"
```

---

### Task 9: Update payment detail view and payment list row for split payments (`finance.js`)

**Files:**
- Modify: `js/views/finance.js:355-380` (payment row in `renderPayments`)
- Modify: `js/views/finance.js:710-756` (`openPaymentDetail`)

- [ ] **Step 1: Show split breakdown in the payment list row**

In the payment row rendering (inside `renderPayments`, around line 372), after the `payment.note` line and before the closing `</div>` of `fin-payment-main`, add split breakdown display:

After:
```javascript
(payment.note ? '<div class="fin-payment-note">' + escHtml(payment.note) + '</div>' : '') +
```

Add:
```javascript
(payment.isSplit && payment.splitAmounts
  ? '<div class="fin-payment-note" style="margin-top:6px;font-weight:700">'
    + escHtml(paymentMethodLabel(payment.method)) + ': ' + escHtml(formatCurrency(payment.splitAmounts.primary))
    + ' · ' + escHtml(paymentMethodLabel(payment.splitMethod)) + ': ' + escHtml(formatCurrency(payment.splitAmounts.secondary))
    + '</div>'
  : '') +
```

- [ ] **Step 2: Show split breakdown in the detail panel**

In `openPaymentDetail` (around line 724), replace the single method row:
```javascript
'<div class="fin-detail-row"><span>Metoda</span><strong class="fin-method-badge ' + paymentMethodClass(payment.method) + '">' + escHtml(paymentMethodLabel(payment.method)) + '</strong></div>' +
```

With:
```javascript
'<div class="fin-detail-row"><span>Metoda</span><strong class="fin-method-badge ' + paymentMethodClass(payment.isSplit ? payment.method + '+' + payment.splitMethod : payment.method) + '">' + escHtml(paymentMethodLabel(payment.isSplit ? payment.method + '+' + payment.splitMethod : payment.method)) + '</strong></div>' +
(payment.isSplit && payment.splitAmounts
  ? '<div class="fin-detail-row"><span>' + escHtml(paymentMethodLabel(payment.method)) + '</span><strong>' + escHtml(formatCurrency(payment.splitAmounts.primary)) + '</strong></div>'
  + '<div class="fin-detail-row"><span>' + escHtml(paymentMethodLabel(payment.splitMethod)) + '</span><strong>' + escHtml(formatCurrency(payment.splitAmounts.secondary)) + '</strong></div>'
  : '') +
```

- [ ] **Step 3: Commit**

```bash
git add js/views/finance.js
git commit -m "feat(split-payment): show split breakdown in payment list and detail view"
```

---

### Task 10: Update calendar's `_paymentMethodName` for compound methods (`calendar.js`)

**Files:**
- Modify: `js/views/calendar.js:1015` (`_paymentMethodName`)

- [ ] **Step 1: Handle compound method strings in calendar view**

Read and replace the `_paymentMethodName` method to handle `"aliorBank+cash"` strings:

```javascript
  _paymentMethodName(method) {
    const names = { cash: 'Gotówka', aliorBank: 'Alior Bank', ingBank: 'ING Bank' };
    if (method && method.indexOf('+') !== -1) {
      return method.split('+').map(function(m) { return names[m] || m; }).join(' + ');
    }
    return names[method] || method || '—';
  },
```

- [ ] **Step 2: Commit**

```bash
git add js/views/calendar.js
git commit -m "feat(split-payment): calendar shows compound payment method names"
```

---

### Task 11: Verify and manual test

- [ ] **Step 1: Open the app, navigate to Finance > Płatności, register a new split payment**

Verify:
- Toggle "Podziel płatność na dwie metody" shows secondary method picker and amount inputs
- Saving works, payment appears in the list with split badge and breakdown line
- Clicking into payment detail shows both methods with their amounts

- [ ] **Step 2: Test filters**

- Click "Alior" filter — split payment with Alior as primary shows with primary amount
- Click "Gotówka" filter — same payment shows with secondary amount
- "Wszystkie" shows full amount

- [ ] **Step 3: Test Kondycja Gabinetu**

- Check "Metody płatności" section — split amounts should be distributed correctly across Alior / ING / Gotówka

- [ ] **Step 4: Test calendar session detail**

- Open a session that was paid with a split payment — method should show "Alior Bank + Gotówka"

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: restore complete split payment support in finance views"
```
