# Kontekst techniczny: metody płatności z historią nazw

Branch: `main`
Last updated: 2026-04-11

## O co chodzi

Ta zmiana dotyka jednocześnie modelu danych, `Ustawień`, finansów, kalendarza i migracji starych rekordów. Najważniejsza zasada: logika systemu ma działać na stałych identyfikatorach metod, a nazwa jest tylko warstwą prezentacji zależną od historii i `daty płatności`.

## Główne decyzje

- Metody płatności mają 4 stałe sloty systemowe.
- Użytkownik nie ustawia liczby metod; widzi 4 pola tekstowe.
- Metoda jest aktywna tylko wtedy, gdy jej pole ma poprawną nazwę.
- Historia nazw jest przechowywana osobno, nie w rekordzie płatności.
- Płatność trzyma identyfikator metody, a wyświetlanie nazwy sprawdza `payment.date`.
- Zmiana nazwy działa od dnia zmiany.
- Skasowanie nazwy nie niszczy historii; kończy tylko bieżący wpis i archiwizuje nazwę.
- W jednym dniu dla jednej metody może istnieć tylko jedna obowiązująca nazwa.
- Filtry i sumy finansowe liczą po identyfikatorze metody.
- Otwarte formularze płatności muszą być zamykane albo odświeżane po zmianach metod.

## Ważne pliki

- [js/data.js](/Users/pawelszmit/Desktop/Gabinet/js/data.js)
  - `createAppSettings()`
  - `createPaymentMethodSettings()`
  - `createPaymentMethodHistoryEntry()`
  - `getPaymentMethodSlotIds()`
  - `getPaymentMethodLabelForDate()`
  - `getActivePaymentMethodOptions()`
  - `findPaymentMethodLabelConflict()`
  - `createPayment()`
  - `savePaymentRecord()`
  - `deserializeAppData()`
  - `migrateLegacyPaidSessionsToPayments()`
  - `reconcilePaymentStatus()`
- [js/views/settings.js](/Users/pawelszmit/Desktop/Gabinet/js/views/settings.js)
  - render sekcji `Ustawienia`
  - obecny debounce `saveSettings()`
- [js/views/finance.js](/Users/pawelszmit/Desktop/Gabinet/js/views/finance.js)
  - `METHOD_LABELS`
  - `paymentMethodLabel()`
  - `paymentMethodClass()`
  - `revenueByMethod()`
  - `renderPaymentSheet()`
  - `savePayment()`
- [js/views/calendar.js](/Users/pawelszmit/Desktop/Gabinet/js/views/calendar.js)
  - `_paymentMethodName()`
- [sw.js](/Users/pawelszmit/Desktop/Gabinet/sw.js)
  - obowiązkowy bump `CACHE_NAME`

## Dzisiejszy stan kodu

- Nazwy metod są wpisane lokalnie w kilku plikach.
- `settings.js` zapisuje ustawienia debounce'em po `input`.
- `finance.js` zakłada tylko 3 metody:
  - `Alior Bank`
  - `ING Bank`
  - `Gotówka`
- `calendar.js` ma własną kopię mapowania nazw.
- Split payment działa już na dwóch metodach, ale nadal na starych identyfikatorach.

## Dane i migracja

- Stare identyfikatory trzeba zamapować na nowe sloty.
- Na starcie trzeba utworzyć pierwsze wpisy historii dla starych metod.
- Historia ma działać dla starych i nowych płatności.
- Jeśli nie da się poprawnie zmapować metody:
  - nie naprawiać po cichu,
  - dodać wpis do `migrationIssues`,
  - pokazać komunikat w UI,
  - użyć etykiety awaryjnej `Metoda archiwalna`.

## Walidacja w Ustawieniach

- Nie akceptować:
  - pustego tekstu jako aktywnej nazwy,
  - samych spacji,
  - samych znaków specjalnych,
  - nazwy użytej już historycznie lub aktualnie przez inną metodę.
- Dla konfliktu nazwy pokazać podpowiedź, żeby użyć wariantu typu `Nazwa 1`.

## Zachowanie UI

- Lista płatności pokazuje nazwę historyczną zgodną z `payment.date`.
- Filtry pokazują bieżącą nazwę aktywnej metody.
- Dashboard i podsumowania liczą po identyfikatorze.
- Split payment:
  - nadal trzyma 2 identyfikatory,
  - każda część ma własną nazwę historyczną po `payment.date`.

## Zależności i kolejność

- Najpierw model danych i helpery.
- Potem migracja.
- Dopiero potem `Ustawienia` i widoki.
- `sw.js` zawsze na końcu.

## Notatki na kolejną sesję

- Faza 1 została wykonana w `js/data.js`.
- `AppState.settings` ma już nową strukturę `paymentMethods` z polami:
  - `slotIds`
  - `history`
- Dodane helpery fundamentu danych:
  - pobieranie slotów metod,
  - pobieranie historii nazw,
  - pobieranie nazwy po dacie,
  - pobieranie aktywnych metod,
  - walidacja nazw,
  - wykrywanie konfliktów nazw.
- Stara stała `PAYMENT_METHODS` została usunięta z `data.js`, żeby nie była już źródłem prawdy.
- Trzeba uważać na obecny `saveSettings()` w `settings.js`, bo nie może zapisywać zmian metod bez potwierdzenia.
- Dobrze zacząć wykonanie od helperów domenowych w `data.js`, bo od nich zależy cała reszta.
- Podczas implementacji warto szybko sprawdzić, czy `patients.js` lub `app.js` nigdzie nie pokazują jeszcze metody płatności po staremu.

## Status po fazie 2

- Zrobiono migrację legacy metod `aliorBank`, `ingBank`, `cash` do logiki slotów `pm1`–`pm4` na poziomie helperów i historii.
- `deserializeAppData()`:
  - migruje legacy płatności z sesji bez `paymentId`,
  - seeduje początkową historię metod na podstawie najwcześniejszej znanej daty,
  - zbiera problemy migracyjne do `AppState.migrationIssues`,
  - sprawdza pokrycie historii nazw dla dat płatności.
- Dodano fallback tekstowy `Metoda archiwalna` do wykorzystania przy problematycznych rekordach.
- Obecny czytelny komunikat dla użytkownika w tej fazie opiera się o:
  - `AppState.migrationIssues`
  - istniejący toast ostrzegawczy po migracji w `deserializeAppData()`
- W tej fazie nie zmieniano jeszcze widoków:
  - finanse nadal nie czytają nowych helperów,
  - kalendarz nadal nie czyta nowych helperów,
  - pełne użycie historii nazw zacznie się od kolejnych faz UI.

## Weryfikacja

- Uruchomiono `node --check js/data.js` — wynik poprawny, bez błędów składni.
- Sprawdzono, że w `js/data.js` nie ma już starej stałej z nazwami metod jako lokalnego źródła prawdy.
- Uruchomiono lokalny test helperów w Node:
  - poprawna nazwa `Karta 1` przechodzi walidację,
  - `!!!` jest odrzucane,
  - `getPaymentMethodLabelForDate('pm1', '2026-04-10')` zwraca starą nazwę,
  - `getPaymentMethodLabelForDate('pm1', '2026-04-11')` zwraca nową nazwę,
  - `findPaymentMethodLabelConflict()` wykrywa konflikt historycznej nazwy.
- Po poprawkach z review fazy 1 uruchomiono dodatkowy test w Node:
  - `normalizePaymentMethodId('blik')` zwraca `null`,
  - błędne `archivedAt` zwraca `null`,
  - poprawne `archivedAt` dalej zwraca poprawną datę.
- Po wykonaniu fazy 2 uruchomiono test migracyjny w Node na sztucznych danych:
  - utworzyły się początkowe wpisy historii dla użytych metod legacy,
  - split payment został uwzględniony przy seedowaniu historii,
  - legacy session bez `paymentId` utworzyła rekord płatności,
  - nieznana metoda `blik` została wpisana do `migrationIssues`,
  - aktywował się istniejący warning migracyjny.
- Po poprawkach z review fazy 2 uruchomiono dodatkowy test w Node:
  - rekord płatności po migracji zachowuje pola kompatybilne z obecnym UI (`method`, `splitMethod`),
  - jednocześnie dostaje kanoniczne pola `methodId = pm1` i `splitMethodId = pm3`,
  - uszkodzony wpis historii z `methodId = blik` nie wpada już do `pm1`,
  - taki wpis jest pomijany i trafia do `migrationIssues` jako `invalid-payment-method-history-entry`.

## Review fazy 1

- Data review: 2026-04-11
- Gate: kontynuacja możliwa z zastrzeżeniami
- Raport: [review-faza-1.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/payment-method-history-settings/review-faza-1.md)
- Najważniejsze wnioski:
  - fundament danych jest na dobrym kierunku,
  - trzeba uszczelnić przyjmowanie nieznanych identyfikatorów metod,
  - trzeba przestać cicho zamieniać błędne `archivedAt` na dzisiejszą datę.
- Status po poprawkach:
  - oba wskazane problemy zostały naprawione w `js/data.js`,
  - fundament danych jest gotowy do wejścia w fazę 2.

## Review fazy 2

- Data review: 2026-04-11
- Gate: kontynuacja możliwa z zastrzeżeniami
- Raport: [review-faza-2.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/payment-method-history-settings/review-faza-2.md)
- Najważniejsze wnioski:
  - migracja tworzy historię startową i zbiera `migrationIssues`,
  - rekordy płatności po migracji nadal trzymają legacy identyfikatory zamiast kanonicznych slotów,
  - uszkodzony wpis historii z obcym `methodId` może zostać błędnie przypisany do `pm1`.
- Status po poprawkach:
  - rekordy płatności mają już kanoniczne pola `methodId` i `splitMethodId`,
  - zachowano stare pola `method` i `splitMethod` jako warstwę przejściową dla obecnego UI,
  - błędny wpis historii z obcym `methodId` jest odrzucany i zgłaszany jako problem migracyjny.

## Status po fazie 3

- `settings.js` ma nową sekcję `Metody platnosci` z 4 polami tekstowymi.
- Pod kazdym polem jest skrocona historia nazw z datami obowiazywania.
- Ta sekcja nie korzysta z debounce auto-save:
  - zwykle dane terapeuty dalej zapisują się automatycznie,
  - metody płatności zapisują się dopiero po kliknięciu `Zapisz zmiany` i potwierdzeniu `OK`.
- Walidacja działa dla calej sekcji naraz:
  - sama spacja nie przechodzi,
  - same znaki specjalne nie przechodza,
  - nazwa musi zawierac litere albo cyfre,
  - nazwa nie moze duplikowac aktywnej ani historycznej nazwy z innej metody.
- Logika zapisu historii została dopięta w `js/data.js`:
  - `validatePaymentMethodDrafts()`,
  - `applyPaymentMethodDrafts()`,
  - `getPaymentMethodSettingsSnapshot()`,
  - pomocnicze odczyty biezacego wpisu i nazwy.
- Reguła "druga zmiana tego samego dnia nadpisuje poprzednia" jest zaimplementowana po stronie danych:
  - zmiana tego samego dnia aktualizuje dzisiejszy wpis zamiast tworzyc kolejny,
  - wyczyszczenie nazwy w dniu dzisiejszym usuwa dzisiejszy wpis i zostawia metode nieaktywna.

## Weryfikacja po fazie 3

- Uruchomiono `node --check js/data.js` — wynik poprawny.
- Uruchomiono `node --check js/views/settings.js` — wynik poprawny.
- Uruchomiono test helperów w Node VM:
  - `!!!` jest odrzucane,
  - historyczny konflikt nazwy `ING Bank` jest wykrywany,
  - zmiana `pm1` z `Alior Bank` na `Karta` zachowuje starą nazwę dla dat sprzed zmiany,
  - wyczyszczenie `pm3` dezaktywuje metodę,
  - wpisanie `BLIK` do `pm4` aktywuje czwartą metodę,
  - druga zmiana `pm1` tego samego dnia nadpisuje dzisiejszy wpis zamiast tworzyć dwa wpisy.
- Zrobiono ograniczony smoke test przez lokalny serwer HTTP:
  - aplikacja ładuje `index.html`,
  - nie wykonano pełnego klikalnego testu ekranu `Ustawienia`, bo wejście do widoku wymaga przejścia przez warstwę logowania / shell aplikacji.

## Review fazy 3

- Data review: 2026-04-11
- Gate: kontynuacja możliwa z zastrzeżeniami
- Raport: [review-faza-3.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/payment-method-history-settings/review-faza-3.md)
- Najważniejsze wnioski:
  - historia pod polem metody pokazuje też bieżący aktywny wpis, zamiast samych nazw archiwalnych,
  - zapis zmian metod nie zamyka ani nie odświeża otwartego formularza płatności renderowanego poza `view-container`.
- Status po review:
  - faza 3 jest funkcjonalnie blisko celu,
  - przed spokojnym wejściem w kolejne fazy warto dopiąć oba powyższe punkty, żeby UI nie mylił użytkownika i nie zostawiał starego formularza z nieaktualnymi metodami.

## Status po poprawkach do review fazy 3

- Historia pod polem metody pokazuje juz tylko wpisy archiwalne, bez powielania biezacej aktywnej nazwy.
- Po zapisie metod:
  - otwarty `#fin-payment-sheet` jest zamykany,
  - aktualny widok aplikacji jest odswiezany,
  - pojawia sie komunikat, ze lista metod platnosci zostala zaktualizowana.
- Te poprawki domykaja zastrzezenia z review fazy 3 bez wchodzenia jeszcze w pełną przebudowę finansów z fazy 4.

## Weryfikacja po poprawkach do review fazy 3

- Uruchomiono `node --check js/data.js` — wynik poprawny.
- Uruchomiono `node --check js/views/settings.js` — wynik poprawny.
- Uruchomiono test helperów w Node VM:
  - snapshot ustawień pokazuje dla `pm1` tylko archiwalny wpis `Alior Bank`, bez bieżącej nazwy,
  - po zmianie nazwy na `Karta Premium` nowa nazwa trafia do bieżącego wpisu, a poprzednia `Karta` przechodzi do historii archiwalnej.
- Ścieżka zamknięcia formularza płatności po zapisie została sprawdzona przeglądem kodu:
  - po `persistData()` wywoływany jest helper zamykający `#fin-payment-sheet`,
  - helper odświeża aktualny widok i pokazuje komunikat informacyjny.
- Nie wykonano pełnego testu klikanego tej ścieżki w zalogowanym UI.

## Status po fazie 4

- `js/views/finance.js` nie korzysta już z lokalnych stałych nazw metod jako źródła prawdy.
- Widok finansów działa na stałych identyfikatorach metod:
  - dashboard sumuje po `methodId`,
  - filtry pracują po `methodId`,
  - split payment trzyma dwa osobne identyfikatory metod.
- Formularz płatności pobiera aktywne metody dla wybranej daty płatności:
  - przy nowej płatności pokazuje tylko aktywne opcje,
  - przy edycji potrafi też pokazać metodę historyczną używaną w starszym rekordzie,
  - zmiana daty płatności odświeża dostępne metody w formularzu.
- Lista płatności i szczegóły płatności pokazują już nazwy historyczne zgodne z `payment.date`.
- Dashboard `Metody płatności` pokazuje aktualne nazwy aktywnych metod, ale sumy liczy po stałych slotach systemowych.
- Chipy filtrów pokazują bieżące nazwy aktywnych metod, a filtrowanie obejmuje całą historię danej metody dzięki pracy na `methodId`.
- `savePayment()` zapisuje rekord przez helper domenowy z kanonicznymi polami:
  - `methodId`,
  - `splitMethodId`,
  - pola zgodności `method` i `splitMethod` dalej są przekazywane jako te same identyfikatory slotów.

## Weryfikacja po fazie 4

- Uruchomiono `node --check js/views/finance.js` — wynik poprawny.
- Uruchomiono `node --check js/data.js` — wynik poprawny.
- Uruchomiono smoke test `finance.js` w Node VM:
  - dashboard pokazuje bieżące nazwy aktywnych metod `Karta` i `BLIK`,
  - lista płatności pokazuje nazwę metody na podstawie `payment.date`,
  - chip filtra korzysta z `data-method=\"pm1\"`,
  - formularz edycji płatności pokazuje aktywne metody dla dnia płatności.
- Nie wykonano jeszcze pełnego testu klikanego w zalogowanym UI na realnych danych.

## Review fazy 4

- Data review: 2026-04-11
- Gate: kontynuacja możliwa z zastrzeżeniami
- Raport: [review-faza-4.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/payment-method-history-settings/review-faza-4.md)
- Najważniejsze wnioski:
  - finanse są dobrze przepięte na helpery i identyfikatory metod,
  - split payment nadal pozwala w UI wskazać tę samą metodę dwa razy i blokuje dopiero zapis,
  - readonly podgląd pierwszej kwoty split payment nie odświeża się po ręcznej zmianie łącznej kwoty.
- Status po review:
  - faza 4 jest blisko gotowości,
  - przed przejściem do fazy 5 warto zrobić krótką rundę poprawek w `finance.js`, bo oba problemy siedzą w tym samym formularzu.

## Status po poprawkach do review fazy 4

- Druga metoda w split payment nie pokazuje już metody wybranej jako pierwsza.
- Po zmianie pierwszej metody formularz od razu odświeża listę dostępnych drugich metod.
- Gdy dla wybranej daty nie ma drugiej aktywnej metody, formularz pokazuje czytelny komunikat zamiast pozwalać wejść w błędny wybór.
- Readonly podgląd pierwszej kwoty split payment odświeża się już także po ręcznej zmianie łącznej kwoty.

## Weryfikacja po poprawkach do review fazy 4

- Uruchomiono `node --check js/views/finance.js` — wynik poprawny.
- Uruchomiono krótki smoke test ukierunkowany na poprawki po review:
  - kod zawęża drugą listę split payment do metod innych niż pierwsza,
  - formularz ma komunikat pustego stanu dla braku drugiej aktywnej metody,
  - handler zmiany łącznej kwoty wywołuje ponowne przeliczenie readonly podglądu pierwszej kwoty.
- Nie wykonano jeszcze pełnego klikanego testu tej ścieżki w zalogowanym UI.

## Status po fazie 5

- `js/views/calendar.js` nie używa już lokalnej mapy legacy nazw metod jako źródła prawdy.
- Szczegóły sesji w kalendarzu biorą nazwy metod z helperów opartych o historię i datę płatności.
- Jeśli sesja jest powiązana z rekordem płatności przez `paymentId`, kalendarz korzysta z rekordu płatności jako głównego źródła:
  - dla zwykłej płatności pokazuje jedną historyczną nazwę,
  - dla split payment pokazuje nazwę łączną i osobno obie metody.
- Data odniesienia dla nazwy metody jest brana w kolejności:
  - `payment.date` z rekordu płatności,
  - potem `session.paymentDate`,
  - na końcu `session.date`.
- Sprawdzono `js/views/patients.js` i `js/app.js`:
  - nie znaleziono tam lokalnych map nazw metod płatności do poprawy w tej fazie.

## Weryfikacja po fazie 5

- Uruchomiono `node --check js/views/calendar.js` — wynik poprawny.
- Uruchomiono wyszukiwanie w `calendar.js`, `patients.js` i `app.js`:
  - nie znaleziono już starej mapy `aliorBank` / `ingBank` / `cash` poza nowym helperem w kalendarzu,
  - `patients.js` i `app.js` nie wymagają zmian w tym zakresie.
- Uruchomiono smoke test w Node VM:
  - zwykła płatność w kalendarzu pokazuje historyczną nazwę `Alior Bank` dla starszej daty,
  - split payment pokazuje osobno `Karta` i `BLIK` dla nowszej daty płatności.
- Nie wykonano jeszcze pełnego klikanego testu kalendarza w zalogowanym UI.

## Review fazy 5

- Data review: 2026-04-11
- Gate: kontynuacja możliwa z zastrzeżeniami
- Raport: [review-faza-5.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/payment-method-history-settings/review-faza-5.md)
- Najważniejsze wnioski:
  - kalendarz jest dobrze przepięty na historyczne nazwy metod,
  - split payment pokazuje osobno obie metody,
  - helper kalendarza nadal za wcześnie zależy od `session.paymentMethod`, zamiast najpierw ufać rekordowi płatności po `paymentId`.
- Status po review:
  - faza 5 jest blisko gotowości,
  - przed dalszym ciągiem warto zrobić małą poprawkę odporności na niespójne dane sesji.

## Status po poprawkach do review fazy 5

- Helper kalendarza `_paymentMethodSummary()` nie kończy już pracy tylko dlatego, że `session.paymentMethod` jest puste.
- Kalendarz najpierw próbuje pobrać rekord płatności po `paymentId`.
- Dopiero jeśli rekordu płatności nie ma, używany jest fallback z pochodnego pola `session.paymentMethod`.

## Weryfikacja po poprawkach do review fazy 5

- Uruchomiono `node --check js/views/calendar.js` — wynik poprawny.
- Uruchomiono smoke test w Node VM:
  - sesja z pustym `session.paymentMethod`, ale z poprawnym `paymentId`, nadal pokazuje historyczną nazwę `Alior Bank` z rekordu płatności.
- Nie wykonano jeszcze pełnego klikanego testu kalendarza w zalogowanym UI.

## Status po fazie 6

- Faza 6 z checklisty (`Spójność UI po zmianie metod`) była już funkcjonalnie zaimplementowana w `js/views/settings.js`.
- Po zapisie metod płatności:
  - kod sprawdza, czy otwarty jest `#fin-payment-sheet`,
  - zamyka otwarty formularz płatności przez `FinanceViews.closePaymentSheet()` albo usuwa go awaryjnie z DOM,
  - odświeża bieżący widok przez `App.refreshCurrentView()`,
  - pokazuje komunikat, że lista metod płatności została zaktualizowana.
- W tej rundzie nie były potrzebne nowe zmiany funkcjonalne w kodzie poza formalnym domknięciem fazy w dokumentacji.
- Nie wykonywano jeszcze zakresu rollout / cache z `sw.js`, bo w checklistcie zadania należy on do końcowej fazy weryfikacji.

## Weryfikacja po fazie 6

- Uruchomiono `node --check js/views/settings.js` — wynik poprawny.
- Uruchomiono smoke test źródła `settings.js`:
  - obecne jest wykrywanie otwartego `#fin-payment-sheet`,
  - obecne jest wywołanie `FinanceViews.closePaymentSheet()`,
  - obecne jest odświeżenie przez `App.refreshCurrentView()`,
  - obecny jest komunikat `Lista metod platnosci zostala zaktualizowana...`.
- Nie wykonano pełnego klikanego testu tej ścieżki w zalogowanym UI.

## Review fazy 6

- Data review: 2026-04-11
- Gate: gotowe do kontynuacji
- Raport: [review-faza-6.md](/Users/pawelszmit/Desktop/Gabinet/docs/active/payment-method-history-settings/review-faza-6.md)
- Najważniejsze wnioski:
  - nie znaleziono błędów funkcjonalnych w zakresie fazy 6,
  - zamknięcie formularza, odświeżenie widoku i komunikat są spięte w jednym flow,
  - pozostaje tylko ryzyko braku pełnego ręcznego testu w zalogowanym UI.
- Status po review:
  - faza 6 jest gotowa do kontynuacji,
  - następny sensowny krok to faza 7 i końcowa weryfikacja na realnych danych.

## Status po fazie 7

- Zakończono końcową rundę weryfikacji dla zmian metod płatności.
- `sw.js` dostał bump cache:
  - `CACHE_NAME` zmieniono z `gabinet-v54` na `gabinet-v55`.
- Sprawdzenia objęły:
  - migrację danych na reprezentatywnym payloadzie z problematyczną metodą,
  - starą płatność legacy po migracji,
  - zmianę nazwy metody i rozdzielenie historii po dacie,
  - wyczyszczenie nazwy i przejście metody do archiwum,
  - blokadę historycznie użytej nazwy,
  - split payment po zmianie nazw metod,
  - blokadę zapisu przy dacie płatności bez dostępnej nazwy metody,
  - fallback `Metoda archiwalna`,
  - start aplikacji po rejestracji service workera i po reloadzie.
- W tej fazie nie było nowych zmian domenowych poza bumpem `CACHE_NAME` w `sw.js`.

## Weryfikacja po fazie 7

- Uruchomiono `node --check js/data.js` — wynik poprawny.
- Uruchomiono `node --check js/views/settings.js` — wynik poprawny.
- Uruchomiono `node --check js/views/finance.js` — wynik poprawny.
- Uruchomiono `node --check js/views/calendar.js` — wynik poprawny.
- Uruchomiono `node --check sw.js` — wynik poprawny.
- Uruchomiono test danych w Node VM:
  - migracja zgłasza `migrationIssues` dla uszkodzonej metody,
  - stara płatność legacy zachowuje nazwę `Alior Bank` dla starej daty,
  - fallback `Metoda archiwalna` działa,
  - zmiana `pm1 -> Karta` działa dopiero od dnia zmiany,
  - wyczyszczenie `pm3` archiwizuje metodę od dnia zmiany,
  - historyczna nazwa jest blokowana przy próbie użycia w innym slocie,
  - split payment zapisuje kanoniczne `methodId` / `splitMethodId` i czyta poprawne nazwy po dacie.
- Uruchomiono test `finance.js` w Node VM:
  - zapis płatności jest blokowany, gdy wybrana metoda nie ma nazwy dla wskazanego dnia płatności.
- Uruchomiono lokalny serwer HTTP i test Playwright:
  - aplikacja ładuje się pod `http://127.0.0.1:4173/`,
  - service worker rejestruje się jako `http://127.0.0.1:4173/sw.js`,
  - `navigator.serviceWorker.controller` jest ustawiony,
  - po reloadzie tytuł nadal wynosi `Gabinet`, a kontroler dalej wskazuje `sw.js`.
- Nie potwierdzono jeszcze ręcznie zachowania na Twoich realnych danych w aktywnej zalogowanej sesji przeglądarki.

## Zrodla

- [2026-04-11-payment-method-history-settings-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-11-payment-method-history-settings-plan.md)
- [2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)
- Prośba użytkownika i ustalenia z roastowania z 2026-04-11
