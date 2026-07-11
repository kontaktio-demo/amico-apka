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
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, CardBody } from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { useStore } from '../lib/store'
import { DocSheet } from '../documents/DocShell'

export default function Pomoc() {
  const firma = useStore((s) => s.aktywnaFirma)()

  return (
    <div>
      <PageHeader
        title="Poradnik AMICO"
        subtitle="Wszystko, co trzeba wiedzieć — po ludzku, krok po kroku"
        icon={<HeartHandshake size={22} />}
        actions={
          <PrintSendBar
            getPrintNode={() => <PoradnikDruk firma={firma} />}
            share={{ title: 'Poradnik AMICO', text: 'Poradnik obsługi aplikacji AMICO — Pracownia Kamieniarska.' }}
            size="sm"
            labelPrint="Drukuj poradnik"
          />
        }
      />

      {/* Powitanie */}
      <Card className="mb-6 overflow-hidden">
        <div className="border-b border-white/[0.07] bg-gradient-to-br from-brand-500/10 to-transparent p-6">
          <h2 className="text-[22px] font-display font-semibold text-ink">Witaj w AMICO 👋</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-stone-400">
            To Twoja aplikacja do prowadzenia pracowni. Wszystko, co dziś jest w segregatorach, zeszytach i na luźnych
            kartkach — klienci, wyceny, umowy, faktury, protokoły, kasa — masz tutaj w jednym miejscu. Na tablecie, w
            telefonie i na komputerze. <b className="text-stone-200">Nie musisz się niczego nauczyć na pamięć.</b> Aplikacja
            prowadzi Cię za rękę, a ten poradnik zawsze jest pod ręką.
          </p>
        </div>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Korzysc
              ikona={<FileSignature size={20} />}
              tytul="Klient podpisuje na tablecie"
              opis="Wyceny i umowy wypełniasz przy kliencie, on podpisuje palcem — koniec z drukowaniem i skanowaniem."
            />
            <Korzysc
              ikona={<CheckCircle2 size={20} />}
              tytul="Dokumenty same się robią"
              opis="Raz wpisujesz dane klienta. Wycena, umowa, protokół i faktura tworzą się z nich automatycznie."
            />
            <Korzysc
              ikona={<Cloud size={20} />}
              tytul="Nic nie ginie"
              opis="Wszystko zapisuje się samo — także bez internetu. Ty widzisz to samo na komputerze co syn na tablecie."
            />
          </div>
        </CardBody>
      </Card>

      {/* Pierwsze kroki */}
      <Sekcja tytul="Na początek — 3 kroki" ikona={<Lock size={18} />}>
        <div className="space-y-3">
          <Krok n={1} tytul="Zaloguj się">
            Przy pierwszym uruchomieniu kliknij <b>„Zaloguj przez chmurę"</b> → <b>„Załóż konto"</b>: wpisz swój e‑mail,
            hasło i imię. To wszystko. Tym samym e‑mailem i hasłem zalogujesz się na każdym urządzeniu.
          </Krok>
          <Krok n={2} tytul="Ustaw PIN (bardzo wygodne)">
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Twoje konto
            </Link>{' '}
            → ustaw 4‑cyfrowy <b>PIN</b> (a jeśli tablet ma czytnik — włącz <b>odcisk palca / Face ID</b>). Potem wchodzisz
            do aplikacji jednym dotknięciem, jak do telefonu.
          </Krok>
          <Krok n={3} tytul="Sprawdź dane firmy">
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Podmioty
            </Link>{' '}
            — są tam obie firmy (Andrzej i Milena) z NIP‑ami i kontami. Wybierasz u góry po lewej, <b>która firma</b>{' '}
            wystawia dany dokument. To ważne — od tego zależy NIP i konto na umowie i fakturze.
          </Krok>
        </div>
      </Sekcja>

      {/* Twój dzień */}
      <Sekcja tytul="Twój dzień z AMICO — od telefonu klienta do pieniędzy" ikona={<ArrowRight size={18} />}>
        <p className="mb-4 text-[14px] text-stone-400">
          To jest cała ścieżka. Każdy krok podpowiada, co dalej — nie musisz pamiętać kolejności.
        </p>
        <div className="space-y-2.5">
          <Etap n={1} do="/klienci" ikona={<Users size={18} />} tytul="Dzwoni klient → dodaj go w „Klienci CRM”">
            Zapisujesz imię, telefon, adres. Wszystko inne (wycena, umowa, faktura) będzie się z tego samo uzupełniać.
            W karcie klienta masz historię — kto, kiedy, co ustalił.
          </Etap>
          <Etap n={2} do="/wyceny" ikona={<Calculator size={18} />} tytul="Robisz wycenę → „Oferty / Wyceny”">
            To ten sam formularz co na papierze („Wstępna wycena prac kamieniarskich”), tylko liczy sam: kamień, obróbki,
            pomiar, montaż, transport → sumy netto/VAT/brutto. Klient może <b>podpisać palcem</b> od razu.
          </Etap>
          <Etap n={3} do="/umowy" ikona={<FileSignature size={18} />} tytul="Klient się zgadza → „Zrób umowę”">
            Z wyceny robisz umowę jednym przyciskiem. Dane klienta i kwoty przechodzą automatycznie, kwota wpisuje się
            <b> słownie</b>, a klient podpisuje na ekranie. Umowa zostaje w aplikacji — nie zginie.
          </Etap>
          <Etap n={4} do="/zlecenia" ikona={<ClipboardList size={18} />} tytul="Powstaje zlecenie → pilnuje etapów">
            Zlecenie prowadzi Cię przez: zadatek → pomiar → produkcja → montaż → odbiór → rozliczenie. Widzisz, na czym
            stoi każda robota.
          </Etap>
          <Etap n={5} do="/kalendarz" ikona={<CalendarDays size={18} />} tytul="Planujesz pomiar i montaż → „Kalendarz”">
            Wpisujesz termin i ekipę (Ciastki, Bogdan, Sasza). Montażysta widzi to u siebie w telefonie jako plan dnia,
            z adresem i nawigacją.
          </Etap>
          <Etap n={6} do="/dokumenty" ikona={<FileCheck2 size={18} />} tytul="Montaż skończony → „Protokół odbioru”">
            Montażysta robi protokół na miejscu, klient podpisuje palcem. Od tego momentu liczy się gwarancja i możesz
            wystawić fakturę.
          </Etap>
          <Etap n={7} do="/faktury" ikona={<Receipt size={18} />} tytul="Wystawiasz fakturę → „Faktury”">
            Faktura z wszystkimi wymaganymi polami, VAT‑em i kwotą słownie. Jest też <b>KP</b> (kasa przyjmie), gdy klient
            płaci gotówką.
          </Etap>
          <Etap n={8} do="/finanse" ikona={<Wallet size={18} />} tytul="Pilnujesz kasy → „Finanse”">
            Raport kasowy (dokładnie jak Twój papierowy), przelewy i obrót pieniężny. Wszystko można wydrukować.
          </Etap>
        </div>
      </Sekcja>

      {/* Nowości */}
      <Sekcja tytul="Trzy rzeczy, które oszczędzą Ci najwięcej czasu" ikona={<Sparkles size={18} />}>
        <div className="grid gap-4 md:grid-cols-3">
          <Nowosc
            do="/skany"
            ikona={<ScanLine size={22} />}
            tytul="Skaner dokumentów"
            opis="Masz kartkę z pomiarem, podpisaną umowę albo fakturę od dostawcy? Kliknij zielony przycisk „Skanuj” (jest zawsze na dole ekranu), zrób zdjęcie — aplikacja sama wyprostuje kartkę i zrobi z niej czysty PDF."
            jak={['Naciśnij „Skanuj”', 'Zrób zdjęcie kartki', 'Przeciągnij rogi, jeśli trzeba', 'Wybierz „Do którego zlecenia” i zapisz']}
          />
          <Nowosc
            do="/wizualizacja"
            ikona={<Sparkles size={22} />}
            tytul="Wizualizacja dla klienta"
            opis="Klient nie wie, jak będzie wyglądał blat? Wybierz kamień i podaj wymiary — pokaże się podgląd blatu i kuchni w tym kamieniu. Robi ogromne wrażenie i pomaga sprzedać."
            jak={['Wybierz rodzaj kamienia', 'Wpisz wymiary blatu', 'Pokaż klientowi na tablecie', 'Wyślij mu albo wydrukuj']}
          />
          <Nowosc
            do="/zadania"
            ikona={<ListTodo size={22} />}
            tytul="Zadania dla ekipy"
            opis="Zamiast dzwonić i przypominać — wpisujesz zadanie i przypisujesz je do osoby. Montażysta widzi je u siebie i odhacza, gdy zrobi."
            jak={['„Nowe zadanie”', 'Wpisz co i na kiedy', 'Przypisz do osoby', 'Widzisz, co zrobione']}
          />
        </div>
      </Sekcja>

      {/* Drukuj i wyślij */}
      <Sekcja tytul="Wszędzie „Drukuj” i „Wyślij”" ikona={<Printer size={18} />}>
        <p className="text-[14.5px] leading-relaxed text-stone-400">
          Na każdym dokumencie — wycenie, umowie, fakturze, protokole, raporcie — masz u góry dwa przyciski:
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-4">
            <div className="mb-1.5 flex items-center gap-2 font-semibold text-ink">
              <Printer size={16} className="text-brand-700" /> Drukuj / PDF
            </div>
            <p className="text-[13.5px] text-stone-400">
              Otwiera podgląd wydruku. Możesz wydrukować na papierze <b>albo wybrać „Zapisz jako PDF”</b> i mieć plik.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <div className="mb-1.5 flex items-center gap-2 font-semibold text-ink">
              <Send size={16} className="text-brand-700" /> Wyślij
            </div>
            <p className="text-[13.5px] text-stone-400">
              Wysyła dokument klientowi <b>e‑mailem lub SMS‑em</b> — treść już jest przygotowana, wystarczy potwierdzić.
            </p>
          </div>
        </div>
      </Sekcja>

      {/* Chmura i bezpieczeństwo */}
      <Sekcja tytul="Czy to jest bezpieczne? (tak — i wyjaśniam dlaczego)" ikona={<Cloud size={18} />}>
        <div className="space-y-3 text-[14.5px] leading-relaxed text-stone-400">
          <p>
            <b className="text-stone-200">Nic nie ginie.</b> Każda zmiana zapisuje się od razu na urządzeniu <i>i</i> w
            chmurze. Jeśli jesteś u klienta bez zasięgu — pracujesz normalnie, a aplikacja sama wyśle wszystko, gdy tylko
            złapie internet. W lewym dolnym rogu widzisz status: <b>„Zsynchronizowano”</b> znaczy, że wszystko jest
            bezpieczne.
          </p>
          <p>
            <b className="text-stone-200">Nikt obcy nie zajrzy.</b> Dane widzą tylko osoby zalogowane do Waszej firmy.
            Aplikacja blokuje się sama po 5 minutach bezczynności — gdyby tablet gdzieś został, nikt do niego nie wejdzie.
          </p>
          <p>
            <b className="text-stone-200">Każdy widzi swoje.</b> Montażysta po zalogowaniu <i>nie widzi</i> cen, finansów
            ani umów — tylko swoje zlecenia, kalendarz, zadania i skaner. Ty jako właścicielka widzisz wszystko.
          </p>
          <p>
            <b className="text-stone-200">Kopia zapasowa.</b> W{' '}
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawieniach
            </Link>{' '}
            możesz w każdej chwili zapisać kopię wszystkich danych do pliku. Warto robić to raz na jakiś czas — tak na
            wszelki wypadek.
          </p>
        </div>
      </Sekcja>

      {/* Zespół */}
      <Sekcja tytul="Jak dodać pracownika (np. montażystę)" ikona={<Users size={18} />}>
        <div className="space-y-3">
          <Krok n={1} tytul="Weź kod firmy">
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Chmura
            </Link>{' '}
            — jest tam <b>kod firmy</b> (np. <code className="rounded bg-white/[0.06] px-1.5 py-0.5">86D64CD7</code>).
            Kliknij, żeby skopiować.
          </Krok>
          <Krok n={2} tytul="Daj mu kod">
            Pracownik instaluje aplikację, klika <b>„Zaloguj przez chmurę” → „Dołącz do firmy”</b>, wpisuje swój e‑mail,
            hasło, imię i ten kod.
          </Krok>
          <Krok n={3} tytul="Nadaj mu rolę">
            W{' '}
            <Link to="/ustawienia" className="text-brand-700 underline">
              Ustawienia → Użytkownicy
            </Link>{' '}
            ustawiasz, kim jest: <b>Montażysta</b> (tylko teren), <b>Biuro</b> (sprzedaż i dokumenty) albo{' '}
            <b>Właściciel</b> (wszystko).
          </Krok>
        </div>
      </Sekcja>

      {/* FAQ */}
      <Sekcja tytul="Gdyby coś poszło nie tak" ikona={<HelpCircle size={18} />}>
        <div className="space-y-3">
          <Faq pytanie="Nie mam internetu u klienta — co robić?">
            Nic. Pracuj normalnie — wypełniaj wycenę, zbieraj podpis. Aplikacja pokaże „Offline” i sama wyśle wszystko,
            gdy wrócisz w zasięg.
          </Faq>
          <Faq pytanie="Zapomniałam PIN‑u.">
            Na ekranie blokady kliknij <b>„Zaloguj hasłem”</b> i wpisz swoje hasło. Potem możesz ustawić nowy PIN w
            Ustawieniach.
          </Faq>
          <Faq pytanie="Pomyliłam się w dokumencie.">
            Wejdź w niego z listy i popraw — dokumenty można edytować. Jeśli był już podpisany, zrób nowy (stary zostaje
            w historii).
          </Faq>
          <Faq pytanie="Czy mogę pracować na komputerze i tablecie naraz?">
            Tak. Wszystko sam się dogaduje — jeśli obie osoby coś zmienią w tym samym czasie, aplikacja <b>połączy</b>{' '}
            obie zmiany. Nic nie zostanie skasowane.
          </Faq>
          <Faq pytanie="Coś dziwnie wygląda / coś nie działa.">
            Odśwież stronę (albo zamknij i otwórz aplikację). Dane są bezpieczne — siedzą na urządzeniu i w chmurze.
          </Faq>
        </div>
      </Sekcja>

      <p className="mb-2 mt-8 text-center text-[13.5px] text-stone-500">
        Powodzenia! Ta aplikacja ma Ci oszczędzić czas i nerwy — jeśli czegoś brakuje albo coś przeszkadza, powiedz. 💚
      </p>
    </div>
  )
}

/* ---------- elementy ---------- */
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
      <div>
        <div className="text-[14.5px] font-semibold text-ink">{tytul}</div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-stone-400">{children}</p>
      </div>
    </div>
  )
}

function Etap({ n, do: href, ikona, tytul, children }: { n: number; do: string; ikona: React.ReactNode; tytul: string; children: React.ReactNode }) {
  return (
    <Link to={href} className="flex gap-3.5 rounded-xl border border-white/10 p-4 transition hover:border-white/25 hover:bg-white/[0.03]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">{ikona}</span>
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold text-ink">
          <span className="mr-1.5 text-stone-500">{n}.</span>
          {tytul}
        </div>
        <p className="mt-1 text-[13.5px] leading-relaxed text-stone-400">{children}</p>
      </div>
    </Link>
  )
}

function Nowosc({ do: href, ikona, tytul, opis, jak }: { do: string; ikona: React.ReactNode; tytul: string; opis: string; jak: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <span className="mb-2.5 grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">{ikona}</span>
      <div className="text-[15px] font-semibold text-ink">{tytul}</div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-400">{opis}</p>
      <ol className="mt-3 space-y-1">
        {jak.map((k, i) => (
          <li key={i} className="flex gap-2 text-[12.5px] text-stone-400">
            <span className="text-brand-700">{i + 1}.</span> {k}
          </li>
        ))}
      </ol>
      <Link to={href} className="btn-outline btn-sm mt-3 w-full">
        Otwórz <ArrowRight size={14} />
      </Link>
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

/* ---------- wersja do druku ---------- */
function PoradnikDruk({ firma }: { firma: any }) {
  const h2: React.CSSProperties = { fontSize: '11.5pt', fontWeight: 700, marginTop: 12, marginBottom: 4, color: '#12130f' }
  const p: React.CSSProperties = { fontSize: '9.5pt', lineHeight: 1.5, margin: '0 0 5px' }
  const li: React.CSSProperties = { fontSize: '9.5pt', lineHeight: 1.45, marginBottom: 3 }
  return (
    <DocSheet firma={firma}>
      <h1 style={{ textAlign: 'center', fontSize: '17pt', fontWeight: 600, margin: '2px 0 4px' }}>Poradnik AMICO</h1>
      <p style={{ textAlign: 'center', fontSize: '9pt', color: '#6b6459', marginBottom: 12 }}>
        Jak korzystać z aplikacji — krok po kroku
      </p>

      <h2 style={h2}>Po co to jest</h2>
      <p style={p}>
        Wszystko, co dziś jest w segregatorach i na kartkach — klienci, wyceny, umowy, faktury, protokoły, kasa — masz w
        jednym miejscu, na tablecie i na komputerze. Klient podpisuje palcem na ekranie. Dokumenty tworzą się same z
        wpisanych raz danych. Nic nie ginie: zapisuje się na urządzeniu i w chmurze, także bez internetu.
      </p>

      <h2 style={h2}>Na początek</h2>
      <ol style={{ paddingLeft: 16, margin: 0 }}>
        <li style={li}>Zaloguj się: „Zaloguj przez chmurę” → „Załóż konto” (e-mail, hasło, imię).</li>
        <li style={li}>Ustaw PIN: Ustawienia → Twoje konto (wejście jednym dotknięciem).</li>
        <li style={li}>Sprawdź dane firmy: Ustawienia → Podmioty. U góry po lewej wybierasz, która firma wystawia dokument.</li>
      </ol>

      <h2 style={h2}>Twój dzień — od telefonu klienta do pieniędzy</h2>
      <ol style={{ paddingLeft: 16, margin: 0 }}>
        <li style={li}><b>Klienci CRM</b> — dzwoni klient, zapisujesz go (imię, telefon, adres).</li>
        <li style={li}><b>Oferty / Wyceny</b> — robisz wycenę (liczy sama), klient może podpisać palcem.</li>
        <li style={li}><b>Umowy</b> — z wyceny jednym przyciskiem robisz umowę; kwota wpisuje się słownie; klient podpisuje.</li>
        <li style={li}><b>Zlecenia</b> — pilnują etapów: zadatek → pomiar → produkcja → montaż → odbiór → rozliczenie.</li>
        <li style={li}><b>Kalendarz</b> — wpisujesz pomiar i montaż, przypisujesz ekipę.</li>
        <li style={li}><b>Protokoły / KP</b> — po montażu protokół odbioru, klient podpisuje na miejscu.</li>
        <li style={li}><b>Faktury</b> — wystawiasz fakturę (VAT, kwota słownie). KP — gdy klient płaci gotówką.</li>
        <li style={li}><b>Finanse</b> — raport kasowy, przelewy, obrót pieniężny.</li>
      </ol>

      <h2 style={h2}>Trzy rzeczy, które oszczędzają najwięcej czasu</h2>
      <ul style={{ paddingLeft: 16, margin: 0 }}>
        <li style={li}>
          <b>Skaner</b> — zielony przycisk „Skanuj” na dole ekranu. Robisz zdjęcie kartki, aplikacja prostuje ją i robi
          czysty PDF, a Ty wskazujesz, do którego zlecenia go przypiąć.
        </li>
        <li style={li}>
          <b>Wizualizacja</b> — wybierasz kamień i wymiary, pokazujesz klientowi, jak będzie wyglądał blat.
        </li>
        <li style={li}>
          <b>Zadania</b> — przypisujesz pracę montażystom; oni widzą ją u siebie i odhaczają.
        </li>
      </ul>

      <h2 style={h2}>Drukuj i wyślij</h2>
      <p style={p}>
        Na każdym dokumencie u góry są przyciski <b>„Drukuj / PDF”</b> (wydruk lub zapis do pliku PDF) oraz{' '}
        <b>„Wyślij”</b> (e-mail lub SMS do klienta z gotową treścią).
      </p>

      <h2 style={h2}>Bezpieczeństwo</h2>
      <ul style={{ paddingLeft: 16, margin: 0 }}>
        <li style={li}>Każda zmiana zapisuje się od razu — na urządzeniu i w chmurze. Bez internetu też działa.</li>
        <li style={li}>Status w lewym dolnym rogu: „Zsynchronizowano” = wszystko bezpieczne.</li>
        <li style={li}>Aplikacja blokuje się sama po 5 minutach bezczynności (PIN / odcisk palca).</li>
        <li style={li}>Montażysta nie widzi cen, finansów ani umów — tylko swoje zlecenia, kalendarz i zadania.</li>
        <li style={li}>Kopia zapasowa do pliku: Ustawienia → Kopia zapasowa.</li>
      </ul>

      <h2 style={h2}>Dodanie pracownika</h2>
      <p style={p}>
        Ustawienia → Chmura → skopiuj <b>kod firmy</b>. Pracownik w aplikacji wybiera „Zaloguj przez chmurę” → „Dołącz do
        firmy”, wpisuje e-mail, hasło, imię i ten kod. Rolę (Montażysta / Biuro / Właściciel) nadajesz w Ustawieniach.
      </p>

      <h2 style={h2}>Gdyby coś poszło nie tak</h2>
      <ul style={{ paddingLeft: 16, margin: 0 }}>
        <li style={li}>Brak internetu — pracuj dalej, aplikacja wyśle wszystko po powrocie zasięgu.</li>
        <li style={li}>Zapomniany PIN — na ekranie blokady kliknij „Zaloguj hasłem”.</li>
        <li style={li}>Coś nie działa — odśwież stronę. Dane są bezpieczne.</li>
      </ul>
    </DocSheet>
  )
}
