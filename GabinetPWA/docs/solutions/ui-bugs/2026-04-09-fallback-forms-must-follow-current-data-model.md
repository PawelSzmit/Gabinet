---
title: "Fallback forms must follow the current data model"
date: 2026-04-09
category: ui-bugs
severity: high
stack:
  - JavaScript
  - PWA
tags:
  - fallback-ui
  - app-state
  - payments
  - patients
status: verified
last_verified: 2026-04-09
---

# Fallback forms must follow the current data model

## Symptoms

- The emergency visit sheet in `js/app.js` could change a paid session or delete it, but the finance screen still showed old payment data.
- The emergency patient sheet could create a patient without `therapyStartDate` or `sessionDayConfigs`, so the app had too little data to generate future sessions.
- The fallback patient form also wrote old fields like `phone` and `email`, even though the main patient flow no longer used them.

## Root Cause

The fallback sheets in `js/app.js` were left behind when the main data model changed. The main app had already moved to a newer shape: payments were managed through shared helpers in `js/data.js`, and patients needed a therapy start date plus a session schedule.

The fallback code still wrote directly to objects with an older shape. That meant two different parts of the app were using two different rules. The UI looked small and harmless, but it could quietly reintroduce old bugs and create data that newer screens did not fully understand.

## Solution

Bring the fallback sheets back under the same rules as the main app.

1. Route fallback visit save and delete through the shared payment helpers instead of editing session data in isolation.
2. Make the fallback patient form collect the minimum required fields for the current model:
   `pseudonym`, `therapyStartDate`, `sessionRate`, `sessionsPerWeek`, and `sessionDayConfigs`.
3. Stop writing legacy patient fields that the main UI no longer edits.

In this project the practical fix was:

- add `_syncFallbackSessionPayment()` and `_removeSessionFromPaymentRegistry()` in [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js),
- use `recordPaymentForSessions()` and `detachPaymentFromSessions()` from [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js),
- require `therapyStartDate` in the fallback patient form,
- build a minimal `sessionDayConfigs` entry from weekday and time,
- remove fallback writes to `phone` and `email`.

## Diagnostic Commands

```bash
node --check /Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js
rg -n "_syncFallbackSessionPayment|_removeSessionFromPaymentRegistry|pat-therapy-start|pat-session-weekday" /Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js
rg -n "recordPaymentForSessions|detachPaymentFromSessions|createPatient" /Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js
```

## Prevention

- When the main data model changes, review all fallback or emergency screens in the same pass.
- Keep one source of truth for payments and patient shape. Fallback UI should call shared helpers, not recreate business rules locally.
- If a simplified form is still needed, let it edit only a safe subset that is fully compatible with the main model.
- Add at least one small scenario test for fallback flows whenever they mutate `AppState`.

## Related

- [js/app.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/app.js)
- [js/data.js](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/js/data.js)
- [review-faza-6.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/completed/2026-04-08-security-offline-finance/review-faza-6.md)
- [2026-04-08-security-offline-finance-podsumowanie.md](/Users/pawelszmit/Desktop/Gabinet/GabinetPWA/docs/completed/2026-04-08-security-offline-finance/2026-04-08-security-offline-finance-podsumowanie.md)

## Context

- Verified with `node --check` for `js/app.js`.
- Verified with a targeted Node VM scenario covering fallback payment sync and fallback patient creation.
- This note documents the follow-up fix made after the Phase 6 review of the security, offline, and finance cleanup task.
