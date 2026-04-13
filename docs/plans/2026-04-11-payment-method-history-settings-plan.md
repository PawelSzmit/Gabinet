# Konfigurowalne metody płatności z historią nazw

## Problem

Aktualnie aplikacja ma 3 metody płatności wpisane na sztywno (`aliorBank`, `ingBank`, `cash`) i ich nazwy są rozsiane po kilku plikach. To blokuje rozwój, bo użytkownik nie może sam ustawić własnych nazw metod ani bezpiecznie ich zmieniać w czasie. Po ustaleniach z brainstormingu i roastowania wymaganie jest już szersze niż samo pole w `Ustawieniach`: aplikacja ma wspierać 4 konfigurowalne metody, historię nazw liczonych po `dacie płatności`, archiwalne nazwy w starych danych oraz bezpieczną migrację obecnych rekordów.

## Scope

- Dodać konfigurację 4 metod płatności w `Ustawieniach` jako 4 pola tekstowe.
- Uznawać metodę za aktywną, jeśli jej pole ma poprawną nazwę.
- Wprowadzić historię nazw metod płatności w osobnym rejestrze.
- Wyświetlać nazwę metody na podstawie stałego identyfikatora metody i `daty płatności`.
- Zachować zgodność ze split payment: jedna płatność nadal może mieć maksymalnie 2 metody, ale każda z nich korzysta z własnej historii nazw.
- Zmienić wszystkie widoki i filtry, aby liczyły po identyfikatorze metody, a nie po nazwie.
- Dodać migrację danych ze starych identyfikatorów do nowego modelu.
- Dodać bezpieczny fallback dla niepełnej lub uszkodzonej migracji.

## Non-goals

- Brak obsługi więcej niż 4 metod.
- Brak zmiany liczby metod przez osobne pole lub licznik.
- Brak historii zmian co do godziny; historia działa per dzień.
- Brak przebudowy eksportu/importu poza to, co jest potrzebne do utrzymania nowego modelu danych.
- Brak zmian w logice rozliczeń sesji poza odczytem i prezentacją nazw metod.

## Source Context

- Prośba użytkownika: zaplanowanie konfigurowanych metod płatności w `Ustawieniach`.
- Ustalenia po roastowaniu:
  - 4 pola tekstowe zamiast pola liczby metod.
  - Puste pole, same spacje lub same znaki specjalne są niedozwolone; nazwa musi zawierać litery lub cyfry.
  - Skasowanie nazwy przenosi obecną nazwę do historii archiwalnej.
  - Zmiana nazwy tworzy nowy wpis historyczny od dnia zmiany, a stara nazwa przechodzi do historii.
  - Historia nazw działa po `dacie płatności`, nie po dacie zapisu.
  - Filtry i raporty liczą po stałym identyfikatorze metody, ale pokazują aktualną nazwę aktywnej metody.
  - Split payment przechowuje 2 identyfikatory metod i liczy historię każdej z nich osobno.
  - W jednym dniu może istnieć tylko jedna obowiązująca nazwa dla danej metody; kolejna zmiana tego samego dnia nadpisuje poprzednią.
  - Każda zmiana nazw w `Ustawieniach` wymaga osobnego potwierdzenia `OK` / `Anuluj`.
  - Nazwy aktywne i archiwalne muszą być unikalne globalnie w skali całego systemu.
  - Po zmianie nazw otwarte formularze płatności mają być odświeżone albo zamknięte z komunikatem.
  - Przy błędzie migracji aplikacja nie może po cichu zapisać złego stanu.
- Powiązany wcześniejszy plan: [docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md](/Users/pawelszmit/Desktop/Gabinet/docs/plans/2026-04-08-001-feat-split-payment-two-methods-plan.md)

## Current State

- `js/data.js`
  - `PAYMENT_METHODS` i domyślne `method` / `splitMethod` są zakodowane na stałe jako `aliorBank`, `ingBank`, `cash`.
  - `createPayment()`, `savePaymentRecord()`, `migrateLegacyPaidSessionsToPayments()` i `reconcilePaymentStatus()` zakładają te identyfikatory.
  - `AppState.settings` nie ma konfiguracji metod płatności ani historii nazw.
- `js/views/settings.js`
  - zapisuje ustawienia prostym debounce do `AppState.settings` i `persistData()`.
  - nie ma mechanizmu walidacji wielopolowej, potwierdzania zmian ani sekcji historii nazw.
- `js/views/finance.js`
  - ma własne `METHOD_LABELS`, klasy badge i filtry zakodowane na 3 metody.
  - formularz płatności i split payment zakładają 3 stałe opcje.
  - dashboard finansowy i lista płatności opierają się na tych samych 3 etykietach.
- `js/views/calendar.js`
  - ma osobne mapowanie `_paymentMethodName()` dla tych samych 3 metod.
- `sw.js`
  - wymaga bumpa `CACHE_NAME` przy wdrażaniu zmian w JS.

## Proposed Approach

Przyjąć model oparty o 4 stałe identyfikatory systemowe, na przykład `pm1`, `pm2`, `pm3`, `pm4`. Płatności i split payment przechowują tylko identyfikatory. Nazwa nigdy nie jest źródłem prawdy dla logiki rozliczeń.

Nazwy metod przechowujemy w osobnym rejestrze historii, np. jako listę wpisów `{ methodId, label, validFrom, archivedAt? }`. Wyświetlanie nazwy działa przez helper, który dla danego `methodId` i `payment.date` znajduje nazwę obowiązującą w tym dniu. Raporty, agregacje i filtry działają po `methodId`, żeby nie rozbijać jednej metody na kilka pozycji tylko dlatego, że zmieniła nazwę.

W `Ustawieniach` użytkownik widzi 4 pola tekstowe odpowiadające 4 stałym metodom. Pole z poprawną nazwą oznacza metodę aktywną. Wyczyszczenie pola nie usuwa historii; zamyka tylko aktualny wpis i czyni metodę niewybieralną w nowych formularzach. Zmiana nazwy tworzy albo nadpisuje wpis dla bieżącej daty. Wszystkie zmiany w sekcji metod są zapisywane dopiero po potwierdzeniu w osobnym oknie.

## Nearby Patterns Worth Reusing

- `createAppSettings()` w `js/data.js` jako punkt wejścia do rozszerzenia ustawień.
- `reconcilePaymentStatus()` jako autorytatywne miejsce propagacji informacji o metodach na sesje.
- `renderPaymentSheet()` i `savePayment()` w `js/views/finance.js` jako główny wzorzec dla walidacji i aktualizacji formularza płatności.
- Debounced `saveSettings()` w `js/views/settings.js` jako wzorzec techniczny, ale dla metod płatności trzeba go obejść osobnym przepływem `OK` / `Anuluj`.
- `migrateLegacyPaidSessionsToPayments()` jako istniejące miejsce migracji starych rekordów po załadowaniu danych.

## Implementation Units

### Unit 1: Nowy model danych metod płatności i helpery domenowe

- Objective
  - Dodać spójny model konfiguracji metod i historii nazw, który stanie się jedynym źródłem prawdy dla całej aplikacji.
- Files
  - `js/data.js`
- Changes
  - Rozszerzyć `createAppSettings()` o strukturę metod płatności, np.:
    - `paymentMethodSlots: ['pm1', 'pm2', 'pm3', 'pm4']`
    - `paymentMethodHistory: []`
  - Zastąpić stare stałe `PAYMENT_METHODS` nowym zestawem helperów:
    - `getPaymentMethodSlotIds()`
    - `getPaymentMethodHistory()`
    - `getPaymentMethodLabelForDate(methodId, date)`
    - `getCurrentPaymentMethodLabel(methodId)`
    - `getActivePaymentMethodOptions()`
    - `getAllUsedPaymentMethodOptions()`
    - `isPaymentMethodActive(methodId)`
    - `isValidPaymentMethodLabel(label)`
    - `normalizePaymentMethodLabel(label)`
  - Dodać helper wyszukujący ostatnie 2–3 archiwalne nazwy do wyświetlenia w `Ustawieniach`.
  - Dodać walidację globalnej unikalności nazw względem aktywnych i archiwalnych wpisów historii.
- Patterns to follow
  - Obecny styl fabryk danych i pomocniczych funkcji w `js/data.js`.
- Risks
  - Rozproszenie logiki nazw pomiędzy `data.js`, `finance.js` i `calendar.js`.
  - Niejasny kontrakt helperów może później rozjechać filtry i UI.
- Test scenarios
  - Metoda aktywna z poprawną nazwą jest widoczna w opcjach.
  - Puste pole, spacje i same znaki specjalne są odrzucone.
  - Dwie metody nie mogą używać tej samej nazwy, nawet jeśli jedna nazwa jest tylko archiwalna.
  - Wyszukiwanie nazwy po dacie zwraca właściwy wpis historyczny.
- Verification
  - Ręczne uruchomienie helperów w konsoli devtools na testowych danych.
  - Brak bezpośrednich map nazw metod poza helperami.

### Unit 2: Migracja starych danych i fallback na problemy migracyjne

- Objective
  - Przenieść obecne rekordy na nowy model bez utraty czytelności historii i dodać bezpieczne zachowanie awaryjne.
- Files
  - `js/data.js`
  - ewentualnie `js/views/settings.js` dla komunikatu o problemach migracji
- Changes
  - Dodać mapowanie migracyjne:
    - `aliorBank -> pm1`
    - `ingBank -> pm2`
    - `cash -> pm3`
  - Przy pierwszym ładowaniu danych utworzyć początkowe wpisy historii dla istniejących metod:
    - nazwy startowe: `Alior Bank`, `ING Bank`, `Gotówka`
    - `validFrom`: najwcześniejsza znana data płatności albo bezpieczna data techniczna, jeśli brak płatności
  - Zmienić `createPayment()`, `savePaymentRecord()`, `migrateLegacyPaidSessionsToPayments()` i `reconcilePaymentStatus()`, by używały nowych identyfikatorów.
  - Dodać wykrywanie rekordów, dla których nie da się odtworzyć poprawnej nazwy po dacie.
  - W takich przypadkach:
    - nie zapisywać cicho „naprawionego” stanu,
    - oznaczyć rekord jako problem migracyjny,
    - pokazać komunikat przy starcie lub w `Ustawieniach`,
    - używać technicznej etykiety zastępczej, np. `Metoda archiwalna`.
- Patterns to follow
  - Istniejące `AppState.migrationIssues`.
  - Obecna migracja w `deserializeAppData()` i `migrateLegacyPaidSessionsToPayments()`.
- Risks
  - Błędne przepisanie `splitMethod`.
  - Zmienione identyfikatory mogą przestać pasować do istniejących filtrów i widoków przed ich przebudową.
- Test scenarios
  - Stare dane z pojedynczą metodą po migracji nadal pokazują poprawne nazwy.
  - Stare dane ze split payment poprawnie mapują oba identyfikatory.
  - Dane uszkodzone lub nieznane pokazują fallback i wpis w `migrationIssues`.
- Verification
  - Import starego backupu i ręczne sprawdzenie kilku historycznych płatności.
  - Brak `undefined` lub pustych etykiet metody po migracji.

### Unit 3: Sekcja metod płatności w Ustawieniach

- Objective
  - Dodać w `Ustawieniach` 4 pola tekstowe, skróconą historię nazw i osobny przepływ potwierdzania zmian.
- Files
  - `js/views/settings.js`
  - `styles.css` tylko jeśli lokalne style w `settings.js` okażą się niewystarczające
- Changes
  - Dodać nową sekcję `Metody płatności` z 4 polami tekstowymi.
  - Dla każdego pola pokazać:
    - bieżącą nazwę,
    - pod spodem 2–3 ostatnie archiwalne nazwy z datami obowiązywania,
    - stan aktywna / archiwalna, jeśli to pomaga użytkownikowi.
  - Wprowadzić lokalny stan formularza dla metod płatności, niezależny od debounced `saveSettings()`.
  - Przy kliknięciu `Zapisz`:
    - zwalidować wszystkie 4 pola jako całość,
    - przygotować listę zmian,
    - pokazać osobne okno `OK / Anuluj`,
    - dopiero po `OK` zapisać nowy wpis historii lub zamknąć aktualny wpis.
  - Zasady zapisu:
    - zmiana nazwy tworzy nowy wpis od bieżącej daty,
    - druga zmiana tego samego dnia nadpisuje wpis z tego dnia,
    - skasowanie nazwy zamyka bieżący wpis i czyni metodę nieaktywną,
    - aktywna metoda musi mieć nazwę zawierającą litery lub cyfry.
  - Po zapisie zmian:
    - natychmiast odświeżyć widoki korzystające z metod płatności,
    - zamknąć albo przeładować otwarte formularze płatności z komunikatem.
- Patterns to follow
  - Obecne bottom sheet i modalowe wzorce z `settings.js` oraz `finance.js`.
- Risks
  - Zostawienie debounced auto-save dla tej sekcji zepsuje wymaganie `OK / Anuluj`.
  - Brak jasnego komunikatu o unikalności nazw może frustrować użytkownika.
- Test scenarios
  - Pierwsze otwarcie po migracji pokazuje 3 wypełnione pola startowe i 1 puste.
  - Wpisanie pustego tekstu, samych spacji lub samych znaków specjalnych blokuje zapis.
  - Próba użycia nazwy historycznej przez inną metodę blokuje zapis i pokazuje podpowiedź o dodaniu np. cyfry `1`.
  - Zmiana nazwy dwa razy tego samego dnia nie tworzy dwóch wpisów dziennych.
  - `Anuluj` nie zapisuje zmian.
- Verification
  - Ręczne sprawdzenie sekcji `Ustawienia` i historii pod polami.
  - Po odświeżeniu aplikacji zapisane zmiany pozostają spójne.

### Unit 4: Finance UI i split payment oparte o helpery metod

- Objective
  - Usunąć stałe nazwy metod z widoków finansowych i przejść na nowy rejestr nazw oraz aktywne opcje.
- Files
  - `js/views/finance.js`
- Changes
  - Zastąpić lokalne `METHOD_LABELS`, `paymentMethodLabel()` i `paymentMethodClass()` helperami opartymi o `methodId`.
  - Przebudować:
    - toggle metod w formularzu płatności,
    - split payment,
    - listę płatności,
    - szczegóły płatności,
    - dashboard metod płatności,
    - filtry metod.
  - Filtry i agregacje mają działać po `methodId`, ale chipy filtrów pokazują bieżące nazwy aktywnych metod.
  - Historyczne nazwy w liście i szczegółach płatności mają być liczone po `payment.date`.
  - Split payment:
    - nadal wybiera 2 różne aktywne metody,
    - każda część płatności osobno pobiera historyczną nazwę po dacie płatności.
  - Jeśli w trakcie otwartego formularza zmienią się metody w `Ustawieniach`, formularz ma się zamknąć albo przeładować z komunikatem.
- Patterns to follow
  - Obecna logika `savePayment()` i `renderPaymentSheet()`.
- Risks
  - Dashboard „Metody płatności” dziś zakłada 3 stałe wiersze; trzeba go uogólnić, ale bez popsucia układu.
  - Filtry mogą przypadkiem pokazywać historyczne nazwy zamiast bieżących.
- Test scenarios
  - Formularz nowej płatności pokazuje tylko aktywne metody.
  - Split payment blokuje wybór tej samej metody dwa razy.
  - Lista płatności pokazuje nazwę historyczną z dnia płatności.
  - Filtry pokazują bieżące nazwy aktywnych metod, ale obejmują całą historię danej metody.
  - Dashboard finansów sumuje po identyfikatorze, nie po etykiecie historycznej.

- Status po wykonaniu 2026-04-11
  - Unit 4 wykonany w `js/views/finance.js`.
  - Widok finansów korzysta z helperów i identyfikatorów metod zamiast lokalnych stałych nazw.
  - Formularz płatności, split payment, lista, szczegóły, dashboard i filtry zostały przepięte na nowy model.
- Verification
  - Ręczne przejście przez: nowa płatność, edycja płatności, split payment, filtrowanie, szczegóły płatności.

### Unit 5: Calendar i pozostałe miejsca odczytu nazw metod

- Objective
  - Doprowadzić do tego, żeby wszystkie miejsca pokazujące metodę płatności korzystały z tego samego źródła prawdy.
- Files
  - `js/views/calendar.js`
  - przejrzeć `js/views/patients.js` i `js/app.js` pod kątem ewentualnych odczytów `paymentMethod`
- Changes
  - Zastąpić `_paymentMethodName()` helperem opartym o `methodId` i `paymentDate`.
  - Upewnić się, że szczegóły sesji, nieobecności i inne widoki nie mają już lokalnych map nazw.
  - Jeśli gdziekolwiek w aplikacji pokazujemy metodę tylko jako tekst z sesji, doprecyzować skąd brać datę odniesienia:
    - preferować `session.paymentDate`,
    - fallback do `session.date` tylko gdy to konieczne.
- Patterns to follow
  - Obecne wyświetlanie metod w `calendar.js`.
- Risks
  - Sesje przechowują tylko pochodny stan płatności; trzeba pilnować, żeby nie dublować logiki historii nazw na sesji.
- Test scenarios
  - Szczegóły sesji pokazują dobrą nazwę historyczną.
  - Sesja powiązana ze split payment pokazuje dwie nazwy w poprawnej wersji historycznej.
- Verification
  - Ręczne sprawdzenie kalendarza na sesjach starych i nowych.

- Status po wykonaniu 2026-04-11
  - Unit 5 wykonany w `js/views/calendar.js`.
  - Szczegóły sesji korzystają z helperów historii nazw i daty płatności.
  - Split payment pokazuje osobno obie historyczne nazwy metod.
  - `js/views/patients.js` i `js/app.js` zostały sprawdzone i nie wymagały zmian w tym zakresie.

### Unit 6: Rollout, cache i końcowa weryfikacja manualna

- Objective
  - Zabezpieczyć wdrożenie zmiany cross-cutting w PWA.
- Files
  - `sw.js`
- Changes
  - Zwiększyć `CACHE_NAME`.
  - Upewnić się, że po wdrożeniu użytkownik dostanie nowy JS z nową migracją.
- Risks
  - Stary service worker może zostawić użytkownika na kodzie bez nowych helperów i z nową strukturą danych.
- Test scenarios
  - Start aplikacji na istniejących danych po odświeżeniu PWA.
  - Import backupu ze starym modelem.
  - Eksport i ponowny import po migracji.
- Verification
  - Twarde odświeżenie i ponowne wejście do aplikacji.
  - Kontrola, czy widoki po migracji ładują się bez błędów w konsoli.

- Uwaga względem checklisty wykonawczej
  - W aktywnym pliku zadań `Faza 6` dotyczy już spójności UI po zmianie metod i ten zakres został domknięty wcześniej w `js/views/settings.js`.
  - Zakres rollout / cache z `sw.js` pozostaje do wykonania razem z końcową fazą weryfikacji.

- Status po wykonaniu 2026-04-11
  - Bump `CACHE_NAME` wykonany w `sw.js` (`gabinet-v55`).
  - Lokalny test PWA przeszedł:
    - rejestracja service workera,
    - aktywny kontroler po załadowaniu,
    - poprawny reload strony po odświeżeniu.
  - Końcowe scenariusze danych zostały sprawdzone w kontrolowanych testach Node VM.

## Dependencies and Sequencing

1. Unit 1 musi powstać przed wszystkimi zmianami w UI, bo definiuje kontrakt helperów.
2. Unit 2 musi zostać wykonany zaraz po Unit 1, zanim UI zacznie polegać na nowym modelu.
3. Unit 3 i Unit 4 mogą być rozwijane równolegle tylko wtedy, gdy helpery z Unit 1 są już stabilne.
4. Unit 5 dopina wszystkie miejsca, które jeszcze mogą korzystać ze starych map nazw.
5. Unit 6 zawsze na końcu.

## Risks and Mitigations

- Ryzyko: plan urósł z „prostego pola w ustawieniach” do systemu wersjonowania nazw.
  - Mitigation: trzymać stałe identyfikatory metod i jeden centralny rejestr historii, bez kopiowania nazw do płatności.
- Ryzyko: niespójność pomiędzy aktywną nazwą, historią i filtrami.
  - Mitigation: wszystkie odczyty nazw przepiąć przez helpery z `data.js`.
- Ryzyko: użytkownik nie zrozumie, czemu stara płatność pokazuje inną nazwę niż dziś.
  - Mitigation: pokazać krótką historię zmian pod polami w `Ustawieniach`.
- Ryzyko: uszkodzona migracja ukryje problem.
  - Mitigation: używać `migrationIssues`, komunikatu w UI i etykiety zastępczej zamiast cichego błędu.
- Ryzyko: stary formularz płatności zapisze dane na nieaktualnej liście metod.
  - Mitigation: zamknąć albo przeładować formularz po zmianach metod.

## Verification Strategy

- Manualna weryfikacja danych istniejących:
  - uruchomić aplikację na obecnym stanie,
  - sprawdzić migrację kilku starych płatności,
  - sprawdzić split payment.
- Manualna weryfikacja `Ustawień`:
  - poprawna nazwa,
  - puste pole,
  - same spacje,
  - same znaki specjalne,
  - duplikat nazwy historycznej,
  - zmiana dwa razy tego samego dnia,
  - `OK` / `Anuluj`.
- Manualna weryfikacja finansów:
  - nowa płatność,
  - edycja daty płatności,
  - filtrowanie po metodzie,
  - dashboard metod,
  - szczegóły płatności.
- Manualna weryfikacja kalendarza:
  - szczegóły sesji z płatnością zwykłą,
  - szczegóły sesji ze split payment.
- Operacyjnie:
  - bump `CACHE_NAME`,
  - odświeżenie PWA,
  - sprawdzenie importu / eksportu.

## Explicit Test Scenarios

1. Stara płatność `cash` sprzed migracji po uruchomieniu pokazuje `Gotówka` jako nazwę historyczną.
2. Zmiana `Gotówka` na `Karta` dnia `2026-04-11` sprawia, że płatności przed `2026-04-11` pokazują `Gotówka`, a od `2026-04-11` pokazują `Karta`.
3. Druga zmiana tej samej metody tego samego dnia nadpisuje wpis dzienny, nie tworzy nowego.
4. Wyczyszczenie aktywnej nazwy przenosi ją do archiwum i usuwa metodę z nowych formularzy.
5. Próba użycia dawnej nazwy przez inną metodę kończy się błędem walidacji i podpowiedzią o dodaniu np. cyfry `1`.
6. Edycja daty starej płatności na dzień, w którym metoda nie miała aktywnej nazwy, blokuje zapis i pokazuje czytelny komunikat.
7. Split payment z dwiema metodami po zmianie nazw pokazuje dla każdej części właściwą nazwę historyczną po `payment.date`.
8. Filtr „bieżąca nazwa metody” zbiera wszystkie płatności tej metody mimo zmian historycznych nazw.
9. Uszkodzona migracja pokazuje `Metoda archiwalna` i sygnalizuje problem w UI.

## Open Questions

- Czy komunikat o problemach migracji ma być tylko w `Ustawieniach`, czy również jako jednorazowy alert po starcie aplikacji. To można bezpiecznie zdecydować podczas implementacji, jeśli nie zmieni modelu danych.
- Czy historia pod polem ma pokazywać dokładnie 2 czy 3 wpisy archiwalne. Funkcyjnie oba warianty są zgodne z wymaganiem; ważne, by nie pokazywać pełnej, długiej listy w głównym formularzu.

## Recommended Next Step

Najlepszy kolejny krok to przejście do wykonania z dokumentacją roboczą, czyli `dev-docs`, a potem implementacja etapami według powyższych unitów. Jeśli chcesz ruszyć od razu bez dodatkowej dokumentacji zadania, wykonanie powinno zacząć się od `Unit 1` i `Unit 2`, bo one stabilizują dane oraz migrację przed zmianami w interfejsie.
