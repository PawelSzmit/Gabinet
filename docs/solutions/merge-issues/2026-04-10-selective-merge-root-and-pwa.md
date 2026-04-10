---
title: "Selective merge of root app and parallel PWA branch"
date: 2026-04-10
category: merge-issues
severity: high
stack:
  - VanillaJS
  - PWA
  - GoogleDriveAPI
  - WebCrypto
tags:
  - merge
  - pwa
  - offline
  - security
  - payments
status: verified
last_verified: 2026-04-10
---

# Selective merge of root app and parallel PWA branch

## Symptoms

- Repo ma dwie wersje tej samej aplikacji: finalny root i rownolegly katalog `GabinetPWA`.
- Proba hurtowego przepisania `GabinetPWA -> ROOT` byla juz kiedys cofnięta.
- Najwieksze ryzyka przy kolejnym scalaniu byly ciche, a nie widowiskowe:
  - powrot do zlego scope Google Drive (`drive.appdata` zamiast `drive.file`),
  - utrata albo przeciek danych klinicznych,
  - rozjazd miedzy dashboardem finansowym, lista platnosci i stanem sesji,
  - service worker wyglada poprawnie na dysku, ale nie przechodzi koncowego scenariusza PWA.

## Root Cause

Problem nie polegal na jednym bledzie w jednym pliku. Problemem byla architektura pracy: dwa katalogi rozwijaly sie rownolegle i kazdy mial "lepsze" fragmenty w innych miejscach.

Root mial lepszy shell i nowsza logike biznesowa finansow. `GabinetPWA` mial dojrzalsze offline, security i synchronizacje. Przy takim ukladzie kopiowanie calego katalogu prawie zawsze psuje cos cennego po drugiej stronie.

Najgrozniejszy blad myslenia przy takim merge'u jest prosty: traktowac pliki jako niezalezne. W praktyce trzeba wybierac zwyciezce pakietami odpowiedzialnosci, nie pojedynczymi plikami. Offline, security, model danych, finanse i shell musza byc scalane osobno, z osobnymi checkpointami i review po kazdym etapie.

## Solution

Zastosowany wzorzec, ktory sie sprawdzil:

1. Uznaj root za jedyne finalne miejsce produktu.
2. Spisz twarde decyzje, ktorych nie wolno ruszac przy scalaniu.
3. Podziel merge na unity po odpowiedzialnosci.
4. Po kazdym unicie rob review i popraw tylko realne findingi.
5. Duplikat zostaw jako archiwum porownawcze do koncowej weryfikacji, nie kasuj go od razu.

Najwazniejsze decyzje z tego merge'u:

- `drive.file` zostaje; nie wracamy do `drive.appdata`,
- `SecurityService` i `LocalStore` przechodza z `GabinetPWA` do root,
- model danych przechodzi na jedna wersje i async `serializeAppData()`,
- partial payment i split payment sa funkcjami krytycznymi i nie wolno ich "uprościc",
- dashboard, lista platnosci i helpery danych musza liczyc po tej samej semantyce `payment.date`,
- `sw.js` i `manifest.json` trzeba domknac nie tylko skladniowo, ale tez przez smoke PWA.

Praktyczna kolejnosc:

```text
1. baseline i kopia referencyjna danych
2. security/offline/sync
3. model danych i migracje
4. widoki kliniczne
5. finanse i jedno zrodlo prawdy dla platnosci
6. shell, PWA assets i cleanup
7. koncowy smoke PWA
8. dopiero potem archiwizacja docs
```

## Diagnostic Commands

```bash
git status --short
git diff --check
rg -n "drive\\.appdata|drive\\.file" js
rg -n "SecurityService|LocalStore" js index.html
rg -n "payment.date|split|partial" js/data.js js/views/finance.js
node --check sw.js
python3 -m json.tool manifest.json
```

Koncowy smoke PWA, ktory warto powtorzyc przy podobnym merge'u:

```bash
python3 -m http.server 4173
```

Potem w Playwright lub innym sterowaniu przegladarka sprawdz:

- `navigator.serviceWorker.ready`,
- reload na desktopie,
- reload w emulacji mobilnej,
- `Page.getAppManifest`,
- `Page.getInstallabilityErrors`.

## Prevention

- Nie kopiuj calego katalogu do katalogu, jesli obie wersje zyly osobno przez dluzszy czas.
- Trzymaj task bundle od pierwszego dnia i zamykaj etap dopiero po review.
- Dla finansow testuj nie tylko zapis, ale tez semantyke dat i cleanup starych flag sesji.
- Dla security testuj scenariusze sign-out, lock/unlock i eksport, nie tylko "czy cos sie wyswietla".
- Dla PWA nie koncz fazy na `curl` i `node --check`; zrob jeszcze prawdziwy smoke przegladarkowy.
- Duplikat po merge'u najpierw oznacz jako archiwalny, a kasuj dopiero po koncowej weryfikacji.

## Related

- [2026-04-09-gabinet-unification-podsumowanie.md](/Users/pawelszmit/Desktop/Gabinet/docs/completed/2026-04-09-gabinet-unification/2026-04-09-gabinet-unification-podsumowanie.md)
- [task.md](/Users/pawelszmit/Desktop/Gabinet/docs/completed/2026-04-09-gabinet-unification/task.md)
- [context.md](/Users/pawelszmit/Desktop/Gabinet/docs/completed/2026-04-09-gabinet-unification/context.md)
- [review-faza-4.md](/Users/pawelszmit/Desktop/Gabinet/docs/completed/2026-04-09-gabinet-unification/review-faza-4.md)
- [review-faza-5.md](/Users/pawelszmit/Desktop/Gabinet/docs/completed/2026-04-09-gabinet-unification/review-faza-5.md)

## Context

- Projekt: `Gabinet`
- Data zamkniecia merge'u: 2026-04-10
- Zweryfikowane na realnym przebiegu scalania root + `GabinetPWA`
- Notatka dotyczy wzorca pracy, nie jednego pojedynczego bugfixa
