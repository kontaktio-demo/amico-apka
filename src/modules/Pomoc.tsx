import { useState } from 'react'
import {
  HeartHandshake,
  Users,
  Calculator,
  FileSignature,
  ClipboardList,
  CalendarDays,
  ScanLine,
  Sparkles,
  ListTodo,
  Receipt,
  FileCheck2,
  Wallet,
  Cloud,
  Lock,
  Printer,
  Send,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Smartphone,
  PenLine,
  Save,
  Package,
  Contact,
  Store,
  Settings,
  Lightbulb,
  ChevronDown,
  LayoutDashboard,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, CardBody, cx } from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { useStore } from '../lib/store'
import { DocSheet } from '../documents/DocShell'

export default function Pomoc() {
  const firma = useStore((s) => s.aktywnaFirma)()

  return (
    <div className="pb-6">
      <PageHeader
        title="Poradnik AMICO"
        subtitle="Wszystko wyjaśnione po ludzku – krok po kroku, bez skrótów"
        icon={<HeartHandshake size={22} />}
        actions={
          <PrintSendBar
            getPrintNode={() => <PoradnikDruk firma={firma} />}
            share={{ title: 'Poradnik AMICO', text: 'Poradnik obsługi aplikacji AMICO – Pracownia Kamieniarska.' }}
            size="sm"
            labelPrint="Drukuj poradnik"
          />
        }
      />

      {/* ---------- Powitanie ---------- */}
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-white/[0.07] bg-gradient-to-br from-brand-500/10 to-transparent p-6">
          <h2 className="text-[22px] font-display font-semibold text-ink">Witaj w AMICO</h2>
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-stone-400">
            To Twoja aplikacja do prowadzenia pracowni. Wszystko, co dziś jest w segregatorach, zeszytach i na luźnych
            kartkach – <b className="text-stone-700">klienci, wyceny, umowy, faktury, protokoły, kasa</b> – masz tutaj w
            jednym miejscu.
          </p>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-stone-400">
            Nie musisz niczego umieć „technicznie”. Aplikacja pilnuje kolejności, liczy za Ciebie i sama zapisuje. Ten
            poradnik jest zawsze pod ręką – <b className="text-stone-700">możesz go też wydrukować</b> (przycisk u góry)
            i trzymać przy biurku.
          </p>
        </div>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Korzysc
              ikona={<FileSignature size={20} />}
              tytul="Klient podpisuje na tablecie"
              opis="Wycenę i umowę wypełniasz przy kliencie, a on podpisuje palcem na ekranie. Koniec z drukowaniem, podpisywaniem i skanowaniem z powrotem."
            />
            <Korzysc
              ikona={<CheckCircle2 size={20} />}
              tytul="Dokumenty same się robią"
              opis="Dane klienta wpisujesz RAZ. Wycena, umowa, protokół i faktura biorą je automatycznie – nie przepisujesz tego samego pięć razy."
            />
            <Korzysc
              ikona={<Cloud size={20} />}
              tytul="Nic nie ginie"
              opis="Każda zmiana zapisuje się sama – również bez internetu. To samo widzisz na komputerze, co syn na tablecie."
            />
          </div>
        </CardBody>
      </Card>

      {/* ---------- Słowniczek ---------- */}
      <Sekcja tytul="Najpierw słowniczek – 7 słów, które wystarczy znać" ikona={<BookOpen size={18} />}>
        <p className="mb-4 text-[14px] text-stone-400">
          W aplikacji pojawia się kilka słów, które mogą brzmieć „komputerowo”. Tłumaczę je raz, po ludzku – potem już
          wszystko będzie jasne.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Slowko slowo="Aplikacja (apka)">
            Program, w którym teraz jesteś. Otwierasz go jak każdą inną ikonę na tablecie – nie trzeba nic instalować z
            płyty ani aktualizować ręcznie.
          </Slowko>
          <Slowko slowo="Zakładka">
            Pozycja w menu po lewej stronie (np. „Klienci CRM”, „Faktury”). Klikasz w nią i przechodzisz do tej części
            aplikacji. Jak przekładka w segregatorze.
          </Slowko>
          <Slowko slowo="Chmura">
            Bezpieczne miejsce w internecie, gdzie leży <b>kopia</b> Twoich danych. Dzięki temu to samo widzisz na
            tablecie i na komputerze, a gdyby tablet zginął – dane są dalej bezpieczne.
          </Slowko>
          <Slowko slowo="Synchronizacja">
            Automatyczne „dogadywanie się” urządzeń. Ty zmieniasz coś na tablecie → po chwili to samo jest na
            komputerze. Dzieje się samo, nic nie klikasz.
          </Slowko>
          <Slowko slowo="Offline">
            Brak internetu (np. u klienta w piwnicy). <b>Aplikacja i tak działa</b> – zapisuje wszystko u siebie i
            wyśle, gdy tylko złapiesz zasięg.
          </Slowko>
          <Slowko slowo="PDF">
            Gotowy dokument w postaci pliku – taki „elektroniczny wydruk”. Wygląda dokładnie tak, jak na papierze. Można
            go wysłać mailem albo wydrukować.
          </Slowko>
          <Slowko slowo="PIN">
            Czterocyfrowy kod (jak w telefonie), którym szybko wchodzisz do aplikacji zamiast wpisywać całe hasło.
          </Slowko>
          <Slowko slowo="Rola">
            To, co dana osoba może w aplikacji zobaczyć. Ty jesteś <b>Właścicielem</b> (widzisz wszystko), a montażysta
            ma rolę <b>Montażysta</b> (widzi zlecenia i kalendarz, ale bez kwot, cennika, wycen, umów i finansów).
          </Slowko>
        </div>
      </Sekcja>

      {/* ---------- Instalacja ---------- */}
      <Sekcja tytul="Jak mieć aplikację jako ikonę na tablecie" ikona={<Smartphone size={18} />}>
        <p className="mb-4 text-[14.5px] leading-relaxed text-stone-400">
          Aplikację otwiera się przez internet, ale możesz ją „przypiąć” do ekranu – wtedy wygląda i działa jak zwykły
          program z ikoną, na pełnym ekranie.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-4">
            <div className="mb-2 text-[14.5px] font-semibold text-ink">iPad / iPhone</div>
            <ol className="space-y-1.5 text-[13.5px] leading-relaxed text-stone-400">
              <li>
                1. Otwórz adres aplikacji w przeglądarce <b>Safari</b>.
              </li>
              <li>
                2. Naciśnij przycisk <b>„Udostępnij”</b> (kwadracik ze strzałką w górę).
              </li>
              <li>
                3. Wybierz <b>„Dodaj do ekranu początkowego”</b>.
              </li>
              <li>4. Gotowe – na ekranie pojawi się ikona AMICO.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <div className="mb-2 text-[14.5px] font-semibold text-ink">Android / komputer</div>
            <ol className="space-y-1.5 text-[13.5px] leading-relaxed text-stone-400">
              <li>
                1. Otwórz adres aplikacji w przeglądarce <b>Chrome</b>.
              </li>
              <li>
                2. Pojawi się pytanie <b>„Zainstalować aplikację?”</b> – potwierdź.
              </li>
              <li>
                3. Jeśli się nie pojawi: menu (trzy kropki) → <b>„Zainstaluj aplikację”</b>.
              </li>
              <li>4. Gotowe – ikona AMICO ląduje na pulpicie.</li>
            </ol>
          </div>
        </div>
        <Wskazowka>
          Po zainstalowaniu aplikacja działa <b>także bez internetu</b>. Nie musisz nic aktualizować – nowe wersje
          pojawiają się same.
        </Wskazowka>
      </Sekcja>

      {/* ---------- Pierwsze uruchomienie ---------- */}
      <Sekcja tytul="Pierwsze uruchomienie – 4 kroki (robisz raz)" ikona={<Lock size={18} />}>
        <div className="space-y-3">
          <Krok n={1} tytul="Załóż sobie konto">
            Na ekranie startowym kliknij <b>„Zaloguj przez chmurę”</b> (mały napis na dole), a potem zakładkę{' '}
            <b>„Załóż konto”</b>. Wpisz swoje <b>imię i nazwisko</b>, swój <b>e-mail</b> i wymyśl <b>hasło</b>. Kliknij
            „Załóż konto i połącz”.
            <br />
            <span className="mt-1 block text-stone-500">
              Zapamiętaj ten e-mail i hasło – <b>tym samym</b> zalogujesz się później na komputerze albo na nowym
              tablecie i zobaczysz te same dane.
            </span>
          </Krok>
          <Krok n={2} tytul="Ustaw PIN – żeby wchodzić jednym dotknięciem">
            Wejdź w{' '}
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Twoje konto i zabezpieczenia
            </Link>
            . W polu <b>„Kod PIN”</b> wpisz 4 cyfry i kliknij „Zapisz”. Jeśli tablet ma czytnik linii papilarnych albo
            Face ID – kliknij jeszcze <b>„Włącz odblokowanie”</b> przy „Biometria”.
            <br />
            <span className="mt-1 block text-stone-500">
              Od tej pory nie wpisujesz hasła – wystarczy PIN albo palec. Hasło przyda się tylko, gdybyś zapomniała
              PIN-u.
            </span>
          </Krok>
          <Krok n={3} tytul="Sprawdź dane firmy">
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Podmioty (firmy)
            </Link>{' '}
            – są tam wpisane <b>obie firmy</b> (Amico Andrzej Fiks i Amico Milena Fiks) z NIP-ami, adresem i numerami
            kont. Sprawdź, czy wszystko się zgadza.
          </Krok>
          <Krok n={4} tytul="Wybieraj, KTÓRA firma wystawia dokument">
            To ważne! <b>U góry po lewej</b>, pod logo, jest przycisk z nazwą firmy (np. „Amico Andrzej Fiks”). Kliknij
            i wybierz właściwą.
            <br />
            <span className="mt-1 block text-stone-500">
              Od tego zależy, <b>jaki NIP i jakie konto bankowe</b> pojawią się na umowie i fakturze. Zawsze sprawdź to
              przed wystawieniem dokumentu.
            </span>
          </Krok>
        </div>
      </Sekcja>

      {/* ---------- Jak się poruszać ---------- */}
      <Sekcja tytul="Jak poruszać się po aplikacji" ikona={<LayoutDashboard size={18} />}>
        <div className="space-y-3 text-[14.5px] leading-relaxed text-stone-400">
          <p>
            <b className="text-stone-700">Menu po lewej stronie</b> – to jest Twój segregator. Klikasz zakładkę i
            przechodzisz do tej części. Na telefonie menu chowa się pod przyciskiem w lewym górnym rogu.
          </p>
          <p>
            <b className="text-stone-700">Zielony przycisk „Skanuj”</b> – jest zawsze w prawym dolnym rogu, na każdym
            ekranie. Służy do robienia zdjęć dokumentów (patrz niżej).
          </p>
          <p>
            <b className="text-stone-700">Na dole menu</b> widzisz, kto jest zalogowany, oraz status:{' '}
            <span className="badge-green">Zsynchronizowano</span> = wszystko bezpiecznie zapisane.
          </p>
          <p>
            <b className="text-stone-700">Nic nie psujesz klikaniem.</b> Możesz spokojnie wchodzić we wszystko i się
            rozglądać – dane zapisują się dopiero, gdy klikniesz „Zapisz” albo „Dodaj”.
          </p>
        </div>
      </Sekcja>

      {/* ---------- Przewodnik po zakładkach ---------- */}
      <Sekcja tytul="Przewodnik po zakładkach – co jest gdzie i po co" ikona={<BookOpen size={18} />}>
        <p className="mb-4 text-[14px] text-stone-400">
          Kliknij nagłówek, żeby rozwinąć szczegóły. Nie musisz czytać wszystkiego naraz – wracaj tu, gdy czegoś
          potrzebujesz.
        </p>
        <div className="space-y-2">
          <Zakladka
            do="/"
            ikona={<LayoutDashboard size={18} />}
            tytul="Pulpit"
            pocoJednym="Szybki rzut oka na całą firmę"
          >
            To strona główna. Widzisz na niej: ilu masz klientów, ile są warte Twoje oferty, ile umów czeka na podpis,
            ile pieniędzy klienci są Ci winni, co masz zaplanowane na dziś oraz <b>„Wymaga działania”</b> – czyli listę
            rzeczy, o których łatwo zapomnieć (oferty do wysłania, faktury po terminie). Zaczynaj dzień od Pulpitu.
          </Zakladka>

          <Zakladka
            do="/klienci"
            ikona={<Users size={18} />}
            tytul="Klienci CRM"
            pocoJednym="Kartoteka wszystkich klientów"
          >
            Tu trzymasz wszystkich klientów. Wchodząc w klienta, widzisz jego <b>kartę</b>: dane, telefon, adres,
            historię rozmów i ustaleń, a także przyciski skrótów: „Zleć pomiar”, „Wyślij ofertę”, „Generuj umowę”,
            „Wyślij SMS”.
            <br />
            <b className="text-stone-700">Po co:</b> raz wpisane dane klienta przechodzą potem <i>same</i> do wyceny,
            umowy i faktury. Nie przepisujesz ich w kółko.
            <br />
            <b className="text-stone-700">Etap</b> pokazuje, na czym stoi sprawa (nowy → wycena → umowa → montaż →
            zakończone).
          </Zakladka>

          <Zakladka
            do="/wyceny"
            ikona={<Calculator size={18} />}
            tytul="Oferty / Wyceny"
            pocoJednym="Ten sam formularz co na papierze, ale liczy sam"
          >
            To jest Wasza „Wstępna wycena prac kamieniarskich” – te same rubryki: dane klienta, miejsce montażu, zakres
            prac, zestawienie (kamień, obróbki, pomiar, montaż, transport), warunki i uwagi.
            <br />
            <b className="text-stone-700">Różnica:</b> aplikacja <b>liczy sumy za Ciebie</b> (netto, VAT, brutto) i
            pilnuje, żeby nic nie umknęło. Klient może <b>podpisać palcem</b> od razu na tablecie.
            <br />
            Gdy klient się zgodzi – klikasz <b>„Zrób umowę”</b> i umowa tworzy się sama z tej wyceny.
          </Zakladka>

          <Zakladka
            do="/umowy"
            ikona={<FileSignature size={18} />}
            tytul="Umowy"
            pocoJednym="Gotowe umowy z podpisem na ekranie"
          >
            Znajdziesz tu wszystkie rodzaje umów, których używacie: <b>umowa o dzieło</b> (8% / 23% VAT), umowa
            prowizyjna, umowa współpracy (ekspozycja kamienia), oświadczenie klienta.
            <br />
            Dane stron i kwoty wchodzą automatycznie, kwota wpisuje się też <b>słownie</b>. Klient podpisuje palcem, Ty
            podpisujesz jako firma. Umowa zostaje w aplikacji – <b>nie zginie i zawsze ją odnajdziesz</b>.
          </Zakladka>

          <Zakladka
            do="/zlecenia"
            ikona={<ClipboardList size={18} />}
            tytul="Zlecenia"
            pocoJednym="Pilnuje, na czym stoi każda robota"
          >
            Zlecenie to „teczka” jednej roboty. Prowadzi Cię przez etapy:{' '}
            <b>zadatek → pomiar z natury → produkcja → montaż → protokół odbioru → rozliczenie</b>. Odhaczasz to, co
            zrobione, i od razu widzisz, co dalej.
            <br />
            <b className="text-stone-700">Po co:</b> nie musisz pamiętać, u kogo czekacie na pomiar, a komu trzeba już
            wystawić fakturę – aplikacja to pokazuje.
          </Zakladka>

          <Zakladka
            do="/kalendarz"
            ikona={<CalendarDays size={18} />}
            tytul="Kalendarz"
            pocoJednym="Terminy pomiarów i montaży + kto jedzie"
          >
            Wpisujesz tu <b>pomiary, montaże i transporty</b>: dzień, godzinę, adres i osobę z ekipy (Ciastki, Bogdan,
            Sasza). Montażysta widzi to u siebie w telefonie jako <b>plan dnia</b> – z adresem i nawigacją.
          </Zakladka>

          <Zakladka
            do="/zadania"
            ikona={<ListTodo size={18} />}
            tytul="Zadania"
            pocoJednym="Przydzielanie pracy zamiast dzwonienia"
          >
            Wpisujesz zadanie („zadzwonić do pani Nowak”, „zamówić płytę”), ustawiasz termin i{' '}
            <b>przypisujesz do osoby</b>. Zadania układają się w trzy kolumny:{' '}
            <b>Do zrobienia → W trakcie → Zrobione</b>. Widzisz, co jest zrobione, a co się opóźnia.
          </Zakladka>

          <Zakladka
            do="/dokumenty"
            ikona={<FileCheck2 size={18} />}
            tytul="Protokoły / KP"
            pocoJednym="Odbiór po montażu i potwierdzenie gotówki"
          >
            <b>Protokół odbioru</b> – robi się go po montażu, klient podpisuje palcem. To ważny dokument: potwierdza, że
            robota jest odebrana, i od niego liczy się gwarancja.
            <br />
            <b>KP („kasa przyjmie”)</b> – pokwitowanie, gdy klient płaci <b>gotówką</b>. Kwota wpisuje się też słownie.
          </Zakladka>

          <Zakladka
            do="/faktury"
            ikona={<Receipt size={18} />}
            tytul="Faktury"
            pocoJednym="Faktury z wszystkimi wymaganymi polami"
          >
            Wystawiasz fakturę VAT (albo zaliczkową / proformę). Aplikacja pilnuje, żeby były wszystkie wymagane prawem
            pola, dobrze policzony VAT i kwota słownie. Widzisz też, które faktury są <b>po terminie</b>.
          </Zakladka>

          <Zakladka
            do="/skany"
            ikona={<ScanLine size={18} />}
            tytul="Skany / Archiwum"
            pocoJednym="Wszystkie zeskanowane kartki w jednym miejscu"
          >
            Tu trafia wszystko, co zeskanujesz zielonym przyciskiem „Skanuj”. Możesz przeglądać, otworzyć jako PDF,
            wydrukować albo wysłać. Każdy skan jest <b>przypięty do zlecenia lub klienta</b>, więc łatwo go znaleźć.
          </Zakladka>

          <Zakladka
            do="/wizualizacja"
            ikona={<Sparkles size={18} />}
            tytul="Wizualizacja"
            pocoJednym="Pokaż klientowi, jak będzie wyglądał blat"
          >
            Wybierasz rodzaj kamienia (granit, marmur, kwarc…) i podajesz wymiary – aplikacja rysuje{' '}
            <b>podgląd blatu</b> i <b>kuchnię z tym kamieniem</b>. Świetnie działa przy sprzedaży: klient od razu widzi
            efekt.
          </Zakladka>

          <Zakladka
            do="/kontrahenci"
            ikona={<Contact size={18} />}
            tytul="Kontrahenci"
            pocoJednym="Projektanci, stolarze, deweloperzy, dostawcy"
          >
            Baza firm i osób, z którymi współpracujecie: projektanci, stolarze i studia kuchenne, wykonawcy,
            deweloperzy, sprzedawcy, hurtownie. Przy tych, którzy dostają <b>prowizję</b>, możesz zapisać, ile i za co –
            oraz czy już wypłacone.
          </Zakladka>

          <Zakladka
            do="/produkty"
            ikona={<Package size={18} />}
            tytul="Produkty / Katalog"
            pocoJednym="Twój cennik i lista materiałów"
          >
            Lista kamieni (granit, marmur, spieki, Dekton…) i usług (pomiar, montaż, transport) z cenami. Z tej listy
            wybierasz pozycje przy robieniu wyceny – nie wpisujesz wszystkiego ręcznie.
          </Zakladka>

          <Zakladka
            do="/ekspozycje"
            ikona={<Store size={18} />}
            tytul="Ekspozycje"
            pocoJednym="Kamień wystawiony u sprzedawców"
          >
            Pilnuje ekspozycji u partnerów: ile jest warta, do kiedy obowiązuje umowa i{' '}
            <b>ile partner już od Was kupił</b> względem zobowiązania (5-krotność wartości). Kolorowy pasek pokazuje,
            czy się wyrabia.
          </Zakladka>

          <Zakladka
            do="/finanse"
            ikona={<Wallet size={18} />}
            tytul="Finanse"
            pocoJednym="Raport kasowy, przelewy, obrót"
          >
            <b>Raport kasowy</b> – dokładnie taki, jak Wasz papierowy (Nazwisko, Zlec., Treść, Przychód, Rozchód), tylko
            sam liczy Obroty i Saldo. <b>Przelewy</b> – z pilnowaniem, czy numer konta jest poprawny.{' '}
            <b>Obrót pieniężny</b> – co weszło, co wyszło. Wszystko można wydrukować.
          </Zakladka>

          <Zakladka
            do="/odprawa"
            ikona={<ClipboardList size={18} />}
            tytul="Odprawa"
            pocoJednym="Twoja poranna kartka dla ekipy"
          >
            Dzienna odprawa: montaże (kto gdzie jedzie), pomiary do zrobienia, transport płyt, zlecenia do rozliczenia,
            nowe umowy. Można wydrukować i dać ekipie na rękę.
          </Zakladka>

          <Zakladka
            do="/ustawienia"
            ikona={<Settings size={18} />}
            tytul="Ustawienia"
            pocoJednym="Firmy, zespół, kopia zapasowa, chmura"
          >
            Dane obu firm, zespół, logo, teksty i klauzule na dokumentach, <b>kopia zapasowa</b>, <b>chmura</b> (kod do
            dodania pracownika) oraz Twoje konto (PIN, hasło, biometria).
          </Zakladka>
        </div>
      </Sekcja>

      {/* ---------- Scenariusze ---------- */}
      <Sekcja tytul="Najczęstsze sytuacje – dokładnie, co klikać" ikona={<ArrowRight size={18} />}>
        <div className="space-y-4">
          <Scenariusz
            tytul=" Dzwoni nowy klient – chce blat do kuchni"
            kroki={[
              'Menu po lewej → „Klienci CRM”.',
              'Kliknij niebieski przycisk „Nowy klient” (u góry po prawej).',
              'Wpisz imię, nazwisko i telefon. Adres i e-mail, jeśli podaje. Resztę można uzupełnić później.',
              'Kliknij „Dodaj klienta”. Gotowe – klient jest zapisany.',
              'Możesz od razu wejść w jego kartę i w „Notatki / Historia” zapisać, o czym rozmawialiście.',
            ]}
          />
          <Scenariusz
            tytul=" Robisz wycenę i klient podpisuje ją na tablecie"
            kroki={[
              'Menu → „Oferty / Wyceny” → przycisk „Nowa wycena”.',
              'W polu „Wybierz z bazy klientów” wskaż klienta – jego dane wpiszą się same.',
              'Uzupełnij „Miejsce realizacji” (gdzie montaż) i „Zakres prac” (np. blat kuchenny, granit Nero).',
              'W tabeli pozycji wpisz ilości i ceny (Kamień, Obróbki, Pomiar, Montaż, Transport). Sumy policzą się same.',
              'Sprawdź warunki płatności i ważność wyceny.',
              'Podaj tablet klientowi → sekcja „Podpis i akceptacja” → „Podpisz” → klient podpisuje palcem → „Zatwierdź podpis”.',
              'Na górze kliknij „Drukuj / PDF” (żeby dać mu wydruk) albo „Wyślij” (żeby wysłać mailem).',
            ]}
          />
          <Scenariusz
            tytul=" Klient się zgodził – robisz umowę"
            kroki={[
              'Wejdź w tę wycenę (Menu → „Oferty / Wyceny” → kliknij ją na liście).',
              'Po prawej kliknij „Zrób umowę”.',
              'Wybierz rodzaj umowy (najczęściej „Umowa o dzieło”).',
              'Sprawdź: KTÓRA FIRMA wystawia (przycisk u góry po lewej), kwotę, zadatek i terminy.',
              'Daj tablet klientowi → „Podpisz – Zamawiający” → podpis palcem. Potem podpisujesz Ty jako Wykonawca.',
              'Kliknij „Drukuj / PDF” i daj klientowi egzemplarz (albo „Wyślij” mailem).',
            ]}
          />
          <Scenariusz
            tytul=" Masz kartkę (pomiar, podpisana umowa, faktura od dostawcy) – skanujesz ją"
            kroki={[
              'Kliknij zielony przycisk „Skanuj” (prawy dolny róg – jest zawsze widoczny).',
              'Zrób zdjęcie kartki (aparat włączy się sam). Jeśli nie ma aparatu – kliknij „Wgraj” i wybierz zdjęcie.',
              'Przeciągnij 4 kropki tak, żeby objęły całą kartkę – aplikacja ją wyprostuje.',
              'Wybierz wygląd: „Auto” zwykle wystarczy („Czarno-biały” daje najczystszy dokument).',
              'Kliknij „Dodaj stronę”. Jeśli kartek jest więcej – powtórz („Kolejna strona”).',
              'Na końcu wpisz nazwę, wybierz „Przypisz do zlecenia” i kliknij „Zapisz dokument”.',
              'Skan znajdziesz w Menu → „Skany / Archiwum”. Możesz go wysłać jako PDF.',
            ]}
          />
          <Scenariusz
            tytul=" Montaż skończony – protokół odbioru i faktura"
            kroki={[
              'Menu → „Protokoły / KP” → zakładka „Protokoły odbioru” → „Nowy protokół”.',
              'Wybierz klienta i zlecenie, wpisz, co zostało odebrane, i ewentualne uwagi.',
              'Klient podpisuje palcem → „Drukuj / PDF” (dajesz mu egzemplarz).',
              'Jeśli płaci gotówką: zakładka „KP” → „Nowe KP” → wpisz kwotę (słownie wpisze się samo) → podpis → wydruk.',
              'Menu → „Faktury” → „Nowa faktura” → wybierz klienta i pozycje → „Drukuj / PDF” albo „Wyślij”.',
            ]}
          />
          <Scenariusz
            tytul=" Chcesz pokazać klientowi, jak będzie wyglądał blat"
            kroki={[
              'Menu → „Wizualizacja”.',
              'Wybierz „Rodzaj kamienia” i wpisz nazwę (np. Calacatta, Nero Assoluto).',
              'Podaj długość i głębokość blatu; zaznacz wycięcie na zlew i płytę.',
              'Przełącz na „Wizualizacja kuchni” i pokaż klientowi tablet.',
              'Możesz to zapisać („Zapisz”) albo wysłać mu („Wyślij”).',
            ]}
          />
        </div>
      </Sekcja>

      {/* ---------- Podpis ---------- */}
      <Sekcja tytul="Podpis klienta na tablecie – jak to działa i czy jest ważny" ikona={<PenLine size={18} />}>
        <div className="space-y-3 text-[14.5px] leading-relaxed text-stone-400">
          <p>
            Wszędzie, gdzie potrzebny jest podpis, zobaczysz przycisk <b>„Podpisz”</b>. Po kliknięciu otwiera się białe
            pole – klient <b>podpisuje się palcem albo rysikiem</b>, tak jak długopisem. Jeśli mu się nie uda, klika
            „Wyczyść” i podpisuje jeszcze raz. Na końcu <b>„Zatwierdź podpis”</b>.
          </p>
          <p>
            Podpis zapisuje się razem z dokumentem – <b>wraz z datą i godziną</b>. Widać go potem na wydruku i w PDF-ie,
            dokładnie tam, gdzie na papierze.
          </p>
          <p>
            <b className="text-stone-700">Czy taki podpis jest ważny?</b> Tak – przy umowie o dzieło (a takie właśnie
            zawieracie) prawo nie wymaga formy papierowej. Podpis na ekranie jest wiążący, a dokument z datą i godziną
            zostaje w aplikacji jako dowód.
          </p>
        </div>
      </Sekcja>

      {/* ---------- Przyciski ---------- */}
      <Sekcja tytul="Trzy przyciski, które zobaczysz wszędzie" ikona={<Printer size={18} />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Przycisk ikona={<Save size={16} />} nazwa="Zapisz">
            Zapisuje to, co wpisałaś. Warto klikać po skończeniu – chociaż aplikacja i tak zapisuje sama w tle.
          </Przycisk>
          <Przycisk ikona={<Printer size={16} />} nazwa="Drukuj / PDF">
            Otwiera podgląd wydruku. Możesz wydrukować na papierze <b>albo wybrać „Zapisz jako PDF”</b> i mieć plik na
            komputerze.
          </Przycisk>
          <Przycisk ikona={<Send size={16} />} nazwa="Wyślij">
            Wysyła dokument klientowi <b>e-mailem albo SMS-em</b>. Treść jest już przygotowana – tylko potwierdzasz.
          </Przycisk>
        </div>
      </Sekcja>

      {/* ---------- Bezpieczeństwo ---------- */}
      <Sekcja tytul="Czy to jest bezpieczne? (tak – i wyjaśniam dokładnie dlaczego)" ikona={<Cloud size={18} />}>
        <div className="space-y-3 text-[14.5px] leading-relaxed text-stone-400">
          <p>
            <b className="text-stone-700">1. Nic nie ginie.</b> Każda zmiana zapisuje się od razu w dwóch miejscach: na
            urządzeniu <i>i</i> w chmurze. Nie ma czegoś takiego jak „zapomniałam zapisać”.
          </p>
          <p>
            <b className="text-stone-700">2. Brak internetu nie przeszkadza.</b> U klienta w piwnicy aplikacja działa
            normalnie – wypełniasz wycenę, zbierasz podpis. Zobaczysz napis{' '}
            <span className="badge-amber">Offline – zapisze się później</span>. Gdy tylko złapiesz zasięg, wszystko
            wyśle się samo i pojawi się <span className="badge-green">Zsynchronizowano</span>.
          </p>
          <p>
            <b className="text-stone-700">3. Dwie osoby naraz to nie problem.</b> Jeśli Ty zmienisz coś na komputerze, a
            syn w tym samym czasie na tablecie – aplikacja <b>połączy obie zmiany</b>. Nikt nikomu nic nie skasuje. To
            było dokładnie sprawdzone.
          </p>
          <p>
            <b className="text-stone-700">4. Nikt obcy nie zajrzy.</b> Dane widzą tylko osoby zalogowane do Waszej
            firmy. Aplikacja <b>blokuje się sama po 5 minutach</b> bezczynności – gdyby tablet gdzieś został, nikt do
            niego nie wejdzie. Twoje hasło i PIN <b>nie są wysyłane do chmury</b> – zostają tylko na urządzeniu.
          </p>
          <p>
            <b className="text-stone-700">5. Każdy widzi tylko to, czego potrzebuje.</b> Montażysta po zalogowaniu{' '}
            <b>nie widzi cennika, wycen, umów, faktur ani finansów</b>. Ma zlecenia, kalendarz, zadania, odprawę i
            skaner – ale <b>bez kwot</b>. Jedyna kwota, jaką widzi, to ta na pokwitowaniu KP, które sam wystawia u
            klienta. Ty widzisz wszystko.
          </p>
          <p>
            <b className="text-stone-700">6. Kopia zapasowa.</b> W{' '}
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawieniach
            </Link>{' '}
            kliknij <b>„Eksportuj kopię”</b> – zapisze się plik ze wszystkimi danymi. Warto robić to raz na miesiąc i
            trzymać np. na pendrivie. Tak na wszelki wypadek.
          </p>
        </div>
      </Sekcja>

      {/* ---------- Zespół ---------- */}
      <Sekcja tytul="Jak dodać pracownika (np. montażystę)" ikona={<Users size={18} />}>
        <div className="space-y-3">
          <Krok n={1} tytul="Skopiuj kod firmy">
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Chmura i synchronizacja
            </Link>{' '}
            – jest tam <b>„Kod firmy (dla zespołu)”</b>, np.{' '}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5">86D64CD7</code>. Kliknij go, żeby skopiować.
          </Krok>
          <Krok n={2} tytul="Przekaż kod pracownikowi">
            Pracownik otwiera aplikację na swoim telefonie, klika <b>„Zaloguj przez chmurę” → „Dołącz do firmy”</b>,
            wpisuje swoje imię, e-mail, hasło <b>i ten kod</b>.
          </Krok>
          <Krok n={3} tytul="Nadaj mu rolę">
            W{' '}
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Użytkownicy i role
            </Link>{' '}
            wybierasz przy nim rolę:
            <br />• <b>Montażysta</b> – zlecenia, kalendarz, zadania, odprawa i skaner, bez kwot (nie widzi cennika,
            wycen, umów, faktur ani finansów),
            <br />• <b>Biuro</b> – sprzedaż, dokumenty i finanse,
            <br />• <b>Właściciel</b> – wszystko.
          </Krok>
        </div>
      </Sekcja>

      {/* ---------- FAQ ---------- */}
      <Sekcja tytul="Co robić, gdy…" ikona={<HelpCircle size={18} />}>
        <div className="space-y-3">
          <Faq pytanie="…nie mam internetu u klienta?">
            <b>Nic.</b> Pracuj normalnie – wypełniaj wycenę, zbieraj podpis. Zobaczysz napis „Offline”. Gdy wrócisz w
            zasięg, aplikacja sama wszystko wyśle. Nic nie przepadnie.
          </Faq>
          <Faq pytanie="…zapomniałam PIN-u?">
            Na ekranie blokady kliknij <b>„Zaloguj hasłem”</b> i wpisz swoje hasło (to, które ustawiłaś przy zakładaniu
            konta). Potem możesz ustawić nowy PIN w Ustawieniach.
          </Faq>
          <Faq pytanie="…pomyliłam się w dokumencie?">
            Wejdź w niego z listy i popraw – dokumenty można edytować. Jeśli był już podpisany przez klienta, lepiej
            zrób nowy (stary zostanie w historii, nic nie przepada).
          </Faq>
          <Faq pytanie="…chcę pracować na komputerze i tablecie jednocześnie?">
            Możesz. Zaloguj się <b>tym samym e-mailem i hasłem</b>. Wszystko sam się dogaduje – jeśli oboje coś
            zmienicie naraz, aplikacja <b>połączy</b> obie zmiany.
          </Faq>
          <Faq pytanie="…widzę napis „Zaloguj ponownie do chmury”?">
            To znaczy, że sesja wygasła (np. po długiej przerwie). Wejdź w <b>Ustawienia → Chmura</b> i zaloguj się
            ponownie swoim e-mailem i hasłem. <b>Dane są bezpieczne</b> – leżą na urządzeniu i czekają.
          </Faq>
          <Faq pytanie="…coś dziwnie wygląda albo się zacięło?">
            Zamknij i otwórz aplikację (albo odśwież stronę). Dane są bezpieczne – siedzą na urządzeniu i w chmurze.
          </Faq>
          <Faq pytanie="…chcę mieć wszystko na papierze?">
            Każdy dokument ma przycisk <b>„Drukuj / PDF”</b>. Ten poradnik też – przycisk „Drukuj poradnik” u samej
            góry.
          </Faq>
        </div>
      </Sekcja>

      {/* ---------- Złote zasady ---------- */}
      <Sekcja tytul="Trzy złote zasady na koniec" ikona={<Lightbulb size={18} />}>
        <div className="space-y-2.5">
          <Zasada n={1}>
            <b>Zawsze sprawdź, która firma wystawia dokument</b> (przycisk u góry po lewej). Od tego zależy NIP i konto
            na umowie oraz fakturze.
          </Zasada>
          <Zasada n={2}>
            <b>Wpisuj klienta raz – w „Klienci CRM”.</b> Potem wszystko (wycena, umowa, faktura) bierze jego dane samo.
          </Zasada>
          <Zasada n={3}>
            <b>Patrz na status w lewym dolnym rogu.</b> „Zsynchronizowano” = wszystko bezpieczne. To Twój sygnał, że
            możesz spać spokojnie.
          </Zasada>
        </div>
      </Sekcja>

      <p className="mt-8 text-center text-[13.5px] leading-relaxed text-stone-500">
        Ta aplikacja ma Ci oszczędzić czas i nerwy.
        <br />
        Jeśli czegoś brakuje, coś jest niejasne albo przeszkadza – <b className="text-stone-400">po prostu powiedz</b>.
      </p>
    </div>
  )
}

/* ================= elementy ================= */
function Korzysc({ ikona, tytul, opis }: { ikona: React.ReactNode; tytul: string; opis: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <span className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">{ikona}</span>
      <div className="text-[14.5px] font-semibold text-ink">{tytul}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-stone-400">{opis}</p>
    </div>
  )
}

function Sekcja({ tytul, ikona, children }: { tytul: string; ikona: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="mb-6">
      <CardBody>
        <h3 className="mb-4 flex items-center gap-2.5 text-[17px] font-display font-semibold text-ink">
          <span className="text-brand-700">{ikona}</span> {tytul}
        </h3>
        {children}
      </CardBody>
    </Card>
  )
}

function Krok({ n, tytul, children }: { n: number; tytul: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-white/10 p-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[14px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold text-ink">{tytul}</div>
        <div className="mt-1 text-[13.5px] leading-relaxed text-stone-400">{children}</div>
      </div>
    </div>
  )
}

function Slowko({ slowo, children }: { slowo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <div className="text-[14px] font-semibold text-brand-700">{slowo}</div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-stone-400">{children}</p>
    </div>
  )
}

function Wskazowka({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5">
      <Lightbulb size={17} className="mt-0.5 shrink-0 text-amber-300" />
      <p className="text-[13.5px] leading-relaxed text-amber-100/80">{children}</p>
    </div>
  )
}

function Zakladka({
  do: href,
  ikona,
  tytul,
  pocoJednym,
  children,
}: {
  do: string
  ikona: React.ReactNode
  tytul: string
  pocoJednym: string
  children: React.ReactNode
}) {
  const [otwarte, setOtwarte] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <button
        onClick={() => setOtwarte((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{ikona}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-ink">{tytul}</span>
          <span className="block text-[12.5px] text-stone-500">{pocoJednym}</span>
        </span>
        <ChevronDown size={18} className={cx('shrink-0 text-stone-500 transition', otwarte && 'rotate-180')} />
      </button>
      {otwarte && (
        <div className="border-t border-white/[0.07] px-4 py-3.5">
          <div className="text-[13.5px] leading-relaxed text-stone-400">{children}</div>
          <Link to={href} className="btn-outline btn-sm mt-3">
            Otwórz zakładkę <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}

function Scenariusz({ tytul, kroki }: { tytul: string; kroki: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <div className="mb-3 text-[15px] font-semibold text-ink">{tytul}</div>
      <ol className="space-y-2">
        {kroki.map((k, i) => (
          <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-stone-400">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white">
              {i + 1}
            </span>
            <span>{k}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Przycisk({ ikona, nazwa, children }: { ikona: React.ReactNode; nazwa: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[14.5px] font-semibold text-ink">
        <span className="text-brand-700">{ikona}</span> {nazwa}
      </div>
      <p className="text-[13.5px] leading-relaxed text-stone-400">{children}</p>
    </div>
  )
}

function Faq({ pytanie, children }: { pytanie: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <div className="text-[14px] font-semibold text-ink">{pytanie}</div>
      <p className="mt-1 text-[13.5px] leading-relaxed text-stone-400">{children}</p>
    </div>
  )
}

function Zasada({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-4">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-600 text-[13px] font-bold text-white">
        {n}
      </span>
      <p className="text-[13.5px] leading-relaxed text-stone-400">{children}</p>
    </div>
  )
}

/* ================= wersja do druku ================= */
function PoradnikDruk({ firma }: { firma: any }) {
  const h2: React.CSSProperties = {
    fontSize: '11.5pt',
    fontWeight: 700,
    marginTop: 11,
    marginBottom: 3,
    color: '#12130f',
  }
  const p: React.CSSProperties = { fontSize: '9.3pt', lineHeight: 1.45, margin: '0 0 4px' }
  const li: React.CSSProperties = { fontSize: '9.3pt', lineHeight: 1.4, marginBottom: 2 }
  return (
    <DocSheet firma={firma} compact>
      <h1 style={{ textAlign: 'center', fontSize: '17pt', fontWeight: 600, margin: '2px 0 3px' }}>Poradnik AMICO</h1>
      <p style={{ textAlign: 'center', fontSize: '8.5pt', color: '#6b6459', marginBottom: 10 }}>
        Jak korzystać z aplikacji – krok po kroku
      </p>

      <h2 style={h2}>Po co to jest</h2>
      <p style={p}>
        Wszystko, co dziś jest w segregatorach i na kartkach – klienci, wyceny, umowy, faktury, protokoły, kasa – masz w
        jednym miejscu, na tablecie i na komputerze. Klient podpisuje palcem na ekranie. Dane klienta wpisujesz raz, a
        dokumenty biorą je automatycznie. Nic nie ginie: zapisuje się na urządzeniu i w chmurze, także bez internetu.
      </p>

      <h2 style={h2}>Słowniczek</h2>
      <ul style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>
          <b>Chmura</b> – bezpieczne miejsce w internecie z kopią danych (to samo widać na tablecie i komputerze).
        </li>
        <li style={li}>
          <b>Synchronizacja</b> – automatyczne dogadywanie się urządzeń. Dzieje się samo.
        </li>
        <li style={li}>
          <b>Offline</b> – brak internetu. Aplikacja i tak działa i wyśle wszystko później.
        </li>
        <li style={li}>
          <b>PDF</b> – „elektroniczny wydruk”, plik do wysłania lub druku.
        </li>
        <li style={li}>
          <b>PIN</b> – 4 cyfry do szybkiego wejścia (jak w telefonie).
        </li>
        <li style={li}>
          <b>Rola</b> – co dana osoba widzi (Właściciel = wszystko, Montażysta = tylko teren).
        </li>
      </ul>

      <h2 style={h2}>Pierwsze uruchomienie (robisz raz)</h2>
      <ol style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>
          „Zaloguj przez chmurę” → „Załóż konto”: imię, e-mail, hasło. (Tym samym zalogujesz się na każdym urządzeniu.)
        </li>
        <li style={li}>
          Ustawienia → Twoje konto: ustaw <b>PIN</b> (4 cyfry) i ewentualnie odcisk palca / Face ID.
        </li>
        <li style={li}>Ustawienia → Podmioty: sprawdź dane obu firm (NIP, adres, konto).</li>
        <li style={li}>
          <b>Zawsze wybieraj u góry po lewej, KTÓRA firma wystawia dokument</b> – od tego zależy NIP i konto.
        </li>
      </ol>

      <h2 style={h2}>Twój dzień – od telefonu klienta do pieniędzy</h2>
      <ol style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>
          <b>Klienci CRM</b> – zapisujesz klienta (imię, telefon, adres). Dane wpisujesz tylko raz.
        </li>
        <li style={li}>
          <b>Oferty / Wyceny</b> – robisz wycenę; sumy liczą się same; klient podpisuje palcem.
        </li>
        <li style={li}>
          <b>Umowy</b> – z wyceny jednym przyciskiem („Zrób umowę”); kwota wpisuje się słownie; klient podpisuje.
        </li>
        <li style={li}>
          <b>Zlecenia</b> – pilnują etapów: zadatek → pomiar → produkcja → montaż → odbiór → rozliczenie.
        </li>
        <li style={li}>
          <b>Kalendarz</b> – wpisujesz pomiar/montaż i osobę z ekipy; montażysta widzi to jako plan dnia.
        </li>
        <li style={li}>
          <b>Protokoły / KP</b> – protokół odbioru po montażu (podpis klienta); KP, gdy płaci gotówką.
        </li>
        <li style={li}>
          <b>Faktury</b> – faktura z wymaganymi polami, VAT-em i kwotą słownie.
        </li>
        <li style={li}>
          <b>Finanse</b> – raport kasowy, przelewy, obrót pieniężny. Wszystko do wydruku.
        </li>
      </ol>

      <h2 style={h2}>Skanowanie kartek (zielony przycisk „Skanuj”)</h2>
      <ol style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>Kliknij „Skanuj” (prawy dolny róg – zawsze widoczny).</li>
        <li style={li}>Zrób zdjęcie kartki (albo „Wgraj” gotowe zdjęcie).</li>
        <li style={li}>Przeciągnij 4 kropki, żeby objąć kartkę – aplikacja ją wyprostuje.</li>
        <li style={li}>
          Wybierz wygląd („Auto” wystarczy; „Czarno-biały” daje najczystszy dokument) → „Dodaj stronę”.
        </li>
        <li style={li}>
          Wpisz nazwę, wskaż „Przypisz do zlecenia” → „Zapisz dokument”. Skan jest w „Skany / Archiwum”.
        </li>
      </ol>

      <h2 style={h2}>Podpis klienta na tablecie</h2>
      <p style={p}>
        Klikasz „Podpisz” → klient podpisuje palcem w białym polu → „Zatwierdź podpis”. Podpis zapisuje się z datą i
        godziną i widać go na wydruku. Przy umowie o dzieło taki podpis jest <b>ważny</b> – prawo nie wymaga papieru.
      </p>

      <h2 style={h2}>Trzy przyciski, które są wszędzie</h2>
      <ul style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>
          <b>Zapisz</b> – zapisuje wpisane dane (aplikacja i tak zapisuje sama w tle).
        </li>
        <li style={li}>
          <b>Drukuj / PDF</b> – wydruk na papierze lub „Zapisz jako PDF” (plik).
        </li>
        <li style={li}>
          <b>Wyślij</b> – wysyłka do klienta e-mailem lub SMS-em, z gotową treścią.
        </li>
      </ul>

      <h2 style={h2}>Bezpieczeństwo</h2>
      <ul style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>Każda zmiana zapisuje się od razu – na urządzeniu i w chmurze.</li>
        <li style={li}>
          Bez internetu aplikacja działa; wyśle wszystko po powrocie zasięgu („Offline” → „Zsynchronizowano”).
        </li>
        <li style={li}>Dwie osoby naraz – aplikacja połączy obie zmiany; nic nie zostanie skasowane.</li>
        <li style={li}>Blokada po 5 minutach bezczynności (PIN / odcisk palca). Hasło i PIN nie idą do chmury.</li>
        <li style={li}>
          Montażysta nie widzi cennika, wycen, umów, faktur ani finansów. Zlecenia i kalendarz widzi bez kwot.
        </li>
        <li style={li}>Kopia zapasowa: Ustawienia → „Eksportuj kopię” (raz na miesiąc, np. na pendrive).</li>
      </ul>

      <h2 style={h2}>Dodanie pracownika</h2>
      <p style={p}>
        Ustawienia → Chmura → skopiuj <b>kod firmy</b>. Pracownik w aplikacji wybiera „Zaloguj przez chmurę” → „Dołącz
        do firmy”, wpisuje imię, e-mail, hasło i ten kod. Rolę (Montażysta / Biuro / Właściciel) nadajesz w
        Ustawieniach.
      </p>

      <h2 style={h2}>Co robić, gdy…</h2>
      <ul style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>
          <b>brak internetu</b> – pracuj dalej; aplikacja wyśle wszystko po powrocie zasięgu.
        </li>
        <li style={li}>
          <b>zapomniany PIN</b> – na ekranie blokady kliknij „Zaloguj hasłem”.
        </li>
        <li style={li}>
          <b>pomyłka w dokumencie</b> – wejdź w niego z listy i popraw (jeśli był podpisany – zrób nowy).
        </li>
        <li style={li}>
          <b>„Zaloguj ponownie do chmury”</b> – Ustawienia → Chmura → zaloguj się ponownie. Dane są bezpieczne.
        </li>
        <li style={li}>
          <b>coś się zacięło</b> – zamknij i otwórz aplikację. Dane są bezpieczne.
        </li>
      </ul>

      <h2 style={h2}>Trzy złote zasady</h2>
      <ol style={{ paddingLeft: 14, margin: 0 }}>
        <li style={li}>
          Zawsze sprawdź, <b>która firma</b> wystawia dokument (przycisk u góry po lewej).
        </li>
        <li style={li}>
          Klienta wpisuj <b>raz</b> – w „Klienci CRM”. Reszta weźmie jego dane sama.
        </li>
        <li style={li}>
          Patrz na status w lewym dolnym rogu: <b>„Zsynchronizowano”</b> = wszystko bezpieczne.
        </li>
      </ol>
    </DocSheet>
  )
}
