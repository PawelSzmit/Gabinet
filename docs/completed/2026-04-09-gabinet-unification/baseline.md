# Baseline

## Po co ten plik

Ten plik sluzy jako prosta karta porownawcza przed i po kolejnych unitach scalenia.

Nie zapisuje jeszcze realnych danych uzytkownika. Zawiera:

- rozdzielenie miedzy stanem obecnym root a stanem docelowym po scaleniu,
- miejsce na reczne obserwacje "przed" i "po",
- wskazowki, co sprawdzic w tej samej kolejnosci po kazdym wiekszym etapie.

## Kopia referencyjna

- Plik eksportu referencyjnego:
  - [gabinet-backup-2026-04-09.json](/Users/pawelszmit/Downloads/gabinet-backup-2026-04-09.json)
- Co juz wiemy z pliku:
  - wersja danych: `2`
  - pacjenci: `6`
  - sesje: `74`
  - platnosci: `24`
  - split payment: `1`
  - partial payment: `0`
  - oplacone odwolane sesje: `2`

## Jak czytac ten plik

- `Stan obecny root`:
  - to, co juz wiemy o aktualnej aplikacji w katalogu root,
  - albo to, co trzeba jeszcze potwierdzic recznie przed scalaniem.
- `Stan docelowy po scaleniu`:
  - to, do czego chcemy dojsc po wykonaniu planu.
- `Obserwacje reczne`:
  - miejsce do uzupelnienia podczas pracy na prawdziwych danych uzytkownika.

## Scenariusze bazowe

### S1. Start bez Google

- Stan obecny root:
  - po wylogowaniu aplikacja wraca do landing page i wymaga ponownego logowania Google.
- Stan docelowy po scaleniu:
  - aplikacja pokazuje sensowny ekran startowy,
  - nie udaje, ze ma polaczenie z Drive,
  - nie gubi lokalnych danych, jesli takie istnieja.
- Obserwacje reczne przed scaleniem:
  - wynik: OK
  - notatki: po wylogowaniu z aplikacji wraca do landing page i prosi o zalogowanie przez Google

### S2. Polaczenie z Google

- Stan obecny root:
  - sam plik eksportu potwierdza, ze istnieje realny stan danych do porownan,
  - po recznym tescie logowanie i odczyt danych z Drive dzialaja poprawnie.
- Stan docelowy po scaleniu:
  - po kliknieciu przycisku logowania widoczne sa istniejace dane,
  - aplikacja nie tworzy pustego nowego stanu zamiast starego pliku.
- Obserwacje reczne przed scaleniem:
  - wynik: OK
  - notatki: po zalogowaniu prawidlowo pokazuja sie wszystkie dane

### S3. Odswiezenie offline

- Stan obecny root:
  - aplikacja wstaje bez internetu, ale po odswiezeniu nie pokazuje danych uzytkownika,
  - widoczny jest pusty stan: `0` pacjentow, `0` platnosci, `0` wygenerowanych sesji.
- Stan docelowy po scaleniu:
  - aplikacja potrafi wstac z lokalnej kopii,
  - stan synchronizacji jest czytelny.
- Obserwacje reczne przed scaleniem:
  - wynik: nie OK
  - notatki: aplikacja uruchamia sie bez internetu, ale nie przywraca danych po odswiezeniu

### S4. Dane kliniczne

- Stan obecny root:
  - root nie ma jeszcze osobnego hasla do danych klinicznych,
  - root nie odblokowuje jeszcze sekcji klinicznej osobnym haslem,
  - po poprawce kompatybilnosci `Unit 1` widoki nie probuja juz traktowac envelope z `GabinetPWA` jak zwyklego stringa,
  - gdy root trafi na zaszyfrowany rekord kliniczny z `GabinetPWA`, pokazuje komunikat ochronny zamiast blednego odczytu albo `runtime error`,
  - mechanizm `unlock` w app shell opiera sie na odswiezeniu tokenu Google, a nie na osobnym hasle klinicznym.
- Co widac w kopii referencyjnej:
  - w eksporcie sa `3` sesje z niepustym `sessionNotes`,
  - zapisane wartosci wygladaja na zaszyfrowane, a nie na jawny tekst,
  - to jest mocna przeslanka, ale pelne zachowanie UI nadal trzeba sprawdzic recznie.
- Stan docelowy po scaleniu:
  - bez odblokowania dane kliniczne sa ukryte,
  - po odblokowaniu mozna je odczytac i edytowac,
  - po blokadzie nie sa widoczne jawnym tekstem.
- Obserwacje reczne przed scaleniem:
  - wynik: czesciowo potwierdzone z backupu i kompatybilnosci `Unit 1`
  - notatki: root po poprawce nie powinien juz wykladac sie na zaszyfrowanych rekordach z `GabinetPWA`, ale pelny unlock nadal nalezy do kolejnego unitu

### S5. Pelna platnosc

- Stan obecny root:
  - kopia zawiera wiele zwyklych pelnych platnosci bez splitu i bez partial payment,
  - przyklad: `Arktyka`, `2026-04-04`, `250 zl`, `cash`, `1` sesja.
- Stan docelowy po scaleniu:
  - sesja, lista platnosci i dashboard zgadzaja sie.
- Obserwacje reczne przed scaleniem:
  - wynik: czesciowo potwierdzone z backupu
  - notatki: zachowanie UI nadal warto kliknac recznie

### S6. Split payment

- Stan obecny root:
  - root ma obsluge split payment,
  - w kopii referencyjnej jest `1` split payment:
    - `Kair`, data `2026-04-09`,
    - suma `220 zl`,
    - `Alior Bank 180 zl + Gotowka 40 zl`,
    - `1` sesja.
- Stan docelowy po scaleniu:
  - obie metody sa poprawnie widoczne,
  - suma metod zgadza sie z platnoscia,
  - filtr nie gubi drugiej metody.
- Obserwacje reczne przed scaleniem:
  - wynik: potwierdzone istnienie przypadku w backupie
  - notatki: wartosc gotowki za kwiecien z backupu wynosi `1040 zl`

### S7. Partial payment

- Stan obecny root:
  - root ma logike partial payment,
  - ale w kopii referencyjnej nie ma ani jednego przypadku `isPartiallyPaid = true`.
- Stan docelowy po scaleniu:
  - widoczna jest czesciowa oplata,
  - naleznosci i status sesji sa poprawne.
- Obserwacje reczne przed scaleniem:
  - wynik: brak przypadku w backupie
  - notatki: ten scenariusz trzeba sprawdzic na innym danych albo utworzyc recznie pozniej

### S8. Oplacona odwolana sesja

- Stan obecny root:
  - w kopii referencyjnej sa `2` oplacone odwolane sesje:
    - `Ciemny`, `2026-03-18`
    - `Krzeslo`, `2026-03-31`
- Stan docelowy po scaleniu:
  - kalendarz, sesja i rekord platnosci nie rozjezdzaja sie.
- Obserwacje reczne przed scaleniem:
  - wynik: potwierdzone istnienie przypadkow w backupie
  - notatki: spojność widokow nadal trzeba potwierdzic recznie w aplikacji

### S9. Eksport JSON

- Stan obecny root:
  - eksport JSON istnieje i daje sie odczytac,
  - dane kliniczne w polach `sessionNotes` nie wygladaja na jawny tekst.
- Stan docelowy po scaleniu:
  - eksport jest poprawny,
  - dane kliniczne nie sa jawnym tekstem.
- Obserwacje reczne przed scaleniem:
  - wynik: czesciowo potwierdzone z backupu
  - notatki: to jest wniosek z formatu danych, nie z klikniecia eksportu w UI

## Notatka wykonawcza

Ten plik jest juz przygotowany jako szablon do recznego uzupelnienia.

Przed startem `Unit 1` trzeba:

- traktowac wynik S3 jako potwierdzony problem bazowy do naprawy w `Unit 1`,
- zachowac ten plik jako punkt porownania "przed / po" dla pracy nad offline i sync.
