import type { Umowa, Firma } from '../lib/types'
import { DocSheet, DocSection, DocSignatures } from './DocShell'
import { fmtPLN, fmtDate, fmtNIP, fmtKonto, kwotaSlownie } from '../lib/format'
import { SignatureView } from '../components/SignaturePad'

// ============================================================================
// Umowa – pelna tresc dokumentu zaleznie od typu (dzielo / prowizyjna /
// wspolpracy / oswiadczenie). Odwzorowanie oryginalnych wzorow AMICO.
// ============================================================================

const has = (v: unknown): boolean => v !== undefined && v !== null && v !== ''

// ---------- Style wspolne (drobny tekst prawny) ----------
const P: React.CSSProperties = { fontSize: '8.7pt', lineHeight: 1.5, textAlign: 'justify', color: '#2a2820', margin: '0 0 5px' }
const OL: React.CSSProperties = { margin: '2px 0 4px', paddingLeft: 20 }
const OL_ALPHA: React.CSSProperties = { ...OL, listStyleType: 'lower-alpha', marginTop: 3 }
const LI: React.CSSProperties = { fontSize: '8.7pt', lineHeight: 1.5, textAlign: 'justify', color: '#2a2820', marginBottom: 4, paddingLeft: 3 }
const partyTitle: React.CSSProperties = { fontWeight: 700, color: '#12130f' }

// ---------- Pole do wpisania: wartosc z 'u' albo kropkowana linia ----------
function Fill({ v, w }: { v?: React.ReactNode; w?: number }) {
  const ok = v !== undefined && v !== null && v !== ''
  return (
    <span
      style={{
        borderBottom: '1px dotted #6b6459',
        display: 'inline-block',
        minWidth: w ?? 130,
        padding: '0 5px',
        textAlign: ok ? 'left' : 'center',
        fontWeight: ok ? 600 : 400,
        color: '#12130f',
      }}
    >
      {ok ? v : ' '}
    </span>
  )
}

// ---------- Blok stopki: klauzula podpisu + podpisy + RODO ----------
function StopkaPodpisow({
  u,
  klauzulaPodpis,
  klauzulaRodo,
}: {
  u: Umowa
  klauzulaPodpis: string
  klauzulaRodo: string
}) {
  return (
    <div className="avoid-break" style={{ marginTop: 18 }}>
      {klauzulaPodpis && (
        <div style={{ fontSize: '8.2pt', lineHeight: 1.45, color: '#4a463f', textAlign: 'justify', marginBottom: 8 }}>
          {klauzulaPodpis}
        </div>
      )}
      <DocSignatures
        left={<SignatureView sig={u.podpisZamawiajacego} label="(podpis)" />}
        right={<SignatureView sig={u.podpisWykonawcy} label="(podpis)" />}
        labelLeft="ZAMAWIAJĄCY"
        labelRight="WYKONAWCA"
      />
      {klauzulaRodo && (
        <div style={{ marginTop: 16, fontSize: '7pt', lineHeight: 1.4, color: '#8a8478', textAlign: 'justify' }}>
          {klauzulaRodo}
        </div>
      )}
    </div>
  )
}

// ---------- Naglowek "zawarta w ... w dniu ..." ----------
function Zawarcie({ u }: { u: Umowa }) {
  return (
    <div style={P}>
      zawarta w <Fill v={u.miejscowoscZawarcia} w={120} /> w dniu <Fill v={fmtDate(u.dataZawarcia)} w={90} /> pomiędzy:
    </div>
  )
}

// ---------- Opis Wykonawcy (dane firmy z props) ----------
function WykonawcaOpis({ firma }: { firma: Firma }) {
  return (
    <div style={P}>
      <span style={partyTitle}>{firma.nazwa}</span> z siedzibą w {firma.miasto} ({firma.kod}) przy ul. {firma.ulica}, numer
      NIP: {fmtNIP(firma.nip)} reprezentowaną przez właściciela {firma.wlasciciel}, zwanego w dalszej części umowy
      „Wykonawcą”
    </div>
  )
}

// ---------- Opis Zamawiajacego (dane z 'u') ----------
function ZamawiajacyOpis({ u, pesel }: { u: Umowa; pesel?: boolean }) {
  return (
    <div>
      <div style={P}>
        <Fill v={u.zamawiajacyNazwa} w={340} />
      </div>
      <div style={P}>
        <Fill v={u.zamawiajacyAdres} w={340} />
      </div>
      <div style={P}>
        {pesel ? 'PESEL: ' : 'NIP: '}
        <Fill v={pesel ? u.zamawiajacyPesel : u.zamawiajacyNip} w={150} />
        {'  '}telefon: <Fill v={u.zamawiajacyTelefon} w={150} />
      </div>
      <div style={P}>zwanym w dalszej części umowy „Zamawiającym”</div>
      <div style={P}>Zwanymi łącznie „Stronami”</div>
    </div>
  )
}

// ============================================================================
// Umowa o dzielo (23% / 8% / 8-23%)
// ============================================================================
function DzieloBody({
  u,
  firma,
  variant,
}: {
  u: Umowa
  firma: Firma
  variant: 'dzielo_23' | 'dzielo_8' | 'dzielo_8_23'
}) {
  const pesel = variant !== 'dzielo_23'
  const showPowierzchnia = variant !== 'dzielo_23'
  const showProporcja = variant === 'dzielo_8_23'
  const showKary = variant !== 'dzielo_23'
  const showOdstapienie14 = variant !== 'dzielo_23'
  const is23 = variant === 'dzielo_23'
  const zadatekDni = is23 ? '3' : '2'
  const konto = has(firma.konto) ? fmtKonto(firma.konto as string) : ''
  const brutto = has(u.wynagrodzenieBrutto) ? fmtPLN(u.wynagrodzenieBrutto) : ''
  const bruttoSlownie = has(u.wynagrodzenieBrutto) ? kwotaSlownie(u.wynagrodzenieBrutto as number) : ''
  const prog = has(u.progPracDodatkowych) ? fmtPLN(u.progPracDodatkowych) : ''
  const progSlownie = has(u.progPracDodatkowych) ? kwotaSlownie(u.progPracDodatkowych as number) : ''

  // numeracja glownych sekcji
  let n = 0
  const nr = () => String(++n)

  return (
    <>
      <Zawarcie u={u} />
      <WykonawcaOpis firma={firma} />
      <div style={{ ...P, textAlign: 'center', fontWeight: 700 }}>A</div>
      <ZamawiajacyOpis u={u} pesel={pesel} />

      <DocSection n={nr()} title="Przedmiot umowy, oświadczenia stron">
        <ol style={OL}>
          <li style={LI}>
            Zamawiający zamawia, a Wykonawca przyjmuje do wykonania usługę remontowo-budowlaną w budynku mieszkalnym
            położonym w <Fill v={u.adresRealizacji} w={260} /> polegającą na: produkcji, dostawie i montażu{' '}
            <Fill v={u.przedmiot} w={260} /> wg pomiaru z natury.
          </li>
          <li style={LI}>
            Szczegółowy zakres prac z wyszczególnieniem powierzchni, na której mają być przeprowadzone prace oraz
            materiałów określa załącznik nr 1 do umowy, sporządzany po pomiarze z natury. Zamawiający oświadcza, iż
            posiada uprawnienia do dysponowania nieruchomością na cele remontowo-budowlane.
          </li>
          <li style={LI}>
            Zamawiający zobowiązany jest uzyskać na własny koszt wszystkie wymagane przez obowiązujące przepisy
            zezwolenia, zgody i opinie oraz załatwić wszystkie formalności urzędowe związane z realizacją niniejszej
            umowy.
          </li>
          {showProporcja && (
            <li style={LI}>
              Zamawiający oświadcza, iż mieszkanie (dom) nie spełnia wymogów dotyczących budownictwa objętego społecznym
              programem mieszkaniowym i przekracza następujące limity powierzchni użytkowej uprawniające do zastosowania
              preferencyjnej stawki VAT (8%), tj.: budynki mieszkalne jednorodzinne – do 300 m² oraz lokale mieszkalne –
              do 150 m².
            </li>
          )}
          {variant === 'dzielo_8' && (
            <li style={LI}>
              Zamawiający oświadcza, iż nieruchomość spełnia wymogi dotyczące budownictwa objętego społecznym programem
              mieszkaniowym i mieści się w limitach powierzchni użytkowej (budynki mieszkalne jednorodzinne – do 300 m²
              oraz lokale mieszkalne – do 150 m²), co uprawnia do zastosowania preferencyjnej stawki VAT 8%.
            </li>
          )}
          {showPowierzchnia && (
            <li style={LI}>
              Powierzchnia nieruchomości wynosi <Fill v={u.powierzchniaM2} w={90} /> m².
            </li>
          )}
          {showProporcja && (
            <li style={LI}>
              Stawką podatku VAT w wysokości 8% zostanie objęta część prac odpowiadająca proporcjonalnie powierzchni
              nieruchomości podlegającej preferencyjnej stawce podatku VAT, zaś podstawową stawką 23% VAT zostanie objęta
              część należności przypadająca na powierzchnię nieruchomości większą niż powierzchnia uprawniająca do
              zastosowania preferencyjnej stawki podatku od towarów i usług.
            </li>
          )}
          <li style={LI}>
            Wykonawca oświadcza, iż posiada niezbędne umiejętności, wiedzę, środki, sprzęt i doświadczenie do wykonania
            prac będących przedmiotem umowy i zobowiązuje się je wykonać z należytą starannością oraz aktualnym poziomem
            wiedzy i techniki.
          </li>
          <li style={LI}>
            Wykonawca oświadcza, a Zamawiający przyjmuje do wiadomości i akceptuje, iż wyroby Wykonawcy wykonywane są z
            produktów natury i jako takie posiadają charakterystyczne dla danego kamienia naturalne zmiany barwy, odcieni
            i użylenia. Takie cechy jak: żyła krystaliczna, odcień barwy, muszla, plamka rdzy czy odcisk skamielin, nie
            dają podstawy do zwrotu zakupionego materiału ani nie powodują obniżenia ceny. Kamienie naturalne i ich
            konglomeraty posiadają w swej naturze mikropory i mikroszczeliny. Odcień i użylenie kamienia może różnić się
            od próbnika przedstawionego Zamawiającemu.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Termin i sposób wykonania umowy">
        <ol style={OL}>
          <li style={LI}>
            Strony ustalają termin rozpoczęcia prac na dzień <Fill v={fmtDate(u.terminRozpoczecia)} w={140} />, nie
            wcześniej jednak niż w terminie 3 dni roboczych od dnia wpłaty przez Zamawiającego zadatku na poczet
            wykonania dzieła, ustalonego przez Strony, zgodnie z pkt 3.2 niniejszej umowy.
          </li>
          {is23 && (
            <li style={LI}>
              Deklarowany termin ustawienia mebli / przygotowania podłoża / możliwości wykonania pomiaru do cięcia:{' '}
              <Fill v={u.terminUstawieniaMebli} w={180} />
            </li>
          )}
          {is23 && (
            <li style={LI}>
              W przypadku niemożności wykonania pomiarów w deklarowanym terminie – termin wykonania prac kamieniarskich
              ulega przesunięciu proporcjonalnie o dany okres.
            </li>
          )}
          {is23 && (
            <li style={LI}>
              W okresie urlopowym (lipiec, sierpień) oraz świątecznym (Boże Narodzenie, Nowy Rok, Wielkanoc) czas
              oczekiwania na pomiar do cięcia może ulec wydłużeniu do 14 dni kalendarzowych.
            </li>
          )}
          <li style={LI}>
            Strony ustalają termin zakończenia prac na: <Fill v={fmtDate(u.terminZakonczenia)} w={140} />.
          </li>
          <li style={LI}>
            Termin wykonania umowy może ulec zmianie, w przypadku opóźnienia w dostawie materiałów zamówionych na żądanie
            Zamawiającego.
          </li>
          <li style={LI}>
            Termin wykonania umowy ulega przedłużeniu o:
            <ol style={OL_ALPHA}>
              <li style={LI}>czas opóźnień Zamawiającego w zapłacie zadatku,</li>
              <li style={LI}>czas opóźnień w przekazaniu pomieszczeń, w których ma być wykonywana niniejsza umowa,</li>
              <li style={LI}>
                czas oczekiwania na wskazówki Zamawiającego w przypadku zaistnienia konieczności dokonania konsultacji
                pomiędzy Wykonawcą i Zamawiającym. Ewentualne konsultacje będą prowadzone za pośrednictwem poczty e-mail.
              </li>
              <li style={LI}>przerw w dostawie nośników energii i działania siły wyższej,</li>
              <li style={LI}>
                konieczności zlecenia robót dodatkowych lub zamiennych mogących mieć wpływ na pierwotnie uzgodniony
                termin wykonania umowy,
              </li>
              <li style={LI}>nieudostępnienia źródła energii przez Zamawiającego.</li>
            </ol>
          </li>
          <li style={LI}>
            Strony ustalają, iż za datę zakończenia robót uważa się dzień wysłania wiadomości e-mail lub datę nadania
            przesyłki listowej poleconej zawierającą informację o zakończeniu wykonywania dzieła.
          </li>
          <li style={LI}>
            Wykonawca ma prawo powierzyć wykonanie dzieła innej osobie. W takim przypadku odpowiada za jej działania jak
            za własne.
          </li>
          <li style={LI}>
            Zamawiający zobowiązuje się do udostępnienia Wykonawcy na czas trwania umowy wszystkich pomieszczeń,
            powierzchni, w których mają być wykonane umówione prace, a także do bezpłatnego udostępnienia pomieszczenia
            sanitarnego, źródła wody, prądu i światła.
          </li>
          <li style={LI}>
            Pomieszczenia opisane powyżej zostaną udostępnione Wykonawcy nie później niż pierwszego dnia wykonywania
            niniejszej umowy do godziny 9:00.
          </li>
          <li style={LI}>
            Wykonawca może odstąpić od wykonania niniejszej umowy w sytuacji, gdy Zamawiający nie wywiąże się z obowiązku
            opisanego powyżej, przy czym zachowuje on prawo do całości wynagrodzenia, pomniejszonego o koszt zakupu
            materiałów, które nie zostały użyte do wykonania dzieła, a które nie zostały zamówione do wykonania niniejszej
            umowy.
          </li>
          <li style={LI}>Odbiór przedmiotu umowy musi być potwierdzony pisemnie protokołem odbioru.</li>
          <li style={LI}>
            Odbiór przedmiotu umowy dokonany zostanie w terminie 3 dni roboczych licząc od dnia, w którym Wykonawca
            poinformuje Zamawiającego o zakończeniu prac i terminie oraz godzinie ich oddania. Informacja o zakończeniu
            prac zostanie przekazana przez Wykonawcę Zamawiającemu za pośrednictwem poczty e-mail przesłanej na adres:{' '}
            <Fill v={u.zamawiajacyEmail} w={200} /> / lub listem poleconym przesłanym na adres{' '}
            <Fill v={u.zamawiajacyAdres} w={220} />.
          </li>
          <li style={LI}>
            Zamawiający zobowiązany jest, w obecności przedstawiciela Wykonawcy, do kontroli zgodności dostarczonego
            dzieła i wykonania usługi z przedmiotem zamówienia. Podpisanie protokołu jest równoznaczne z potwierdzeniem
            zgodności przedmiotu umowy ze złożonym zamówieniem.
          </li>
          <li style={LI}>
            W przypadku nieodebrania przedmiotu umowy w terminie opisanym powyżej, Strony uznają, iż doszło do odebrania
            przedmiotu umowy bez zastrzeżeń.
          </li>
          <li style={LI}>
            Wykonawca nie odpowiada za niewykonanie bądź nienależyte wykonanie umowy, jeżeli jest to spowodowane siłą
            wyższą bądź z przyczyn leżących po stronie Zamawiającego. Dla celów niniejszej umowy, siłą wyższą jest
            zdarzenie nadzwyczajne, zewnętrzne i niemożliwe do zapobieżenia i przewidzenia.
          </li>
          <li style={LI}>
            Przez dni robocze Strony rozumieją dni od poniedziałku do piątku z wyłączeniem dni ustawowo wolnych od pracy.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Wynagrodzenie">
        <ol style={OL}>
          <li style={LI}>
            Za wykonanie przedmiotu umowy Wykonawcy przysługuje wynagrodzenie w wysokości <Fill v={brutto} w={150} /> zł
            brutto, tj. (słownie: <Fill v={bruttoSlownie} w={300} /> brutto), płatne najpóźniej w terminie 3 dni od dnia
            zakończenia prac potwierdzonych protokołem odbioru, gotówką, kartą lub na rachunek bankowy nr{' '}
            <Fill v={konto} w={230} />, zgodnie z kosztorysem stanowiącym załącznik do niniejszej umowy.
          </li>
          <li style={LI}>
            Zamawiający wpłaci Wykonawcy w terminie {zadatekDni} dni od podpisania niniejszej umowy zadatek w wysokości{' '}
            <Fill v={has(u.zadatek) ? fmtPLN(u.zadatek) : ''} w={150} /> zł, o który zostanie pomniejszone wynagrodzenie
            końcowe.
          </li>
          {is23 && (
            <li style={LI}>
              Pozostała kwota płatna gotówką lub przelewem w dniu montażu, potwierdzenie przekazane ekipie montażowej.
            </li>
          )}
          {is23 && (
            <li style={LI}>Za brak zapłaty w terminie należne są odsetki umowne w wysokości 10% pozostałej kwoty wynagrodzenia.</li>
          )}
          <li style={LI}>Wykonawca zastrzega prawo własności przedmiotu dzieła, aż do zupełnego uiszczenia wynagrodzenia.</li>
          <li style={LI}>
            Wykonawca może podwyższyć wynagrodzenie w stosunku do kwoty wynikającej z kosztorysu ofertowego stanowiącego
            załącznik do niniejszej umowy, jeżeli prace nie były ujęte w kosztorysie, zaś konieczność ich wykonania
            wynikła w czasie wykonywania niniejszej umowy.
          </li>
          <li style={LI}>
            Wykonawca nie może żądać podwyższenia wynagrodzenia, jeżeli wykonał prace dodatkowe bez uzyskania zgody
            Zamawiającego. Bez uprzedniej zgody Zamawiającego mogą być za osobnym wynagrodzeniem wykonane jedynie roboty
            niezbędne ze względu na bezpieczeństwo ludzi lub mienia.
          </li>
          <li style={LI}>
            Jeśli wykonanie niniejszej umowy jest niemożliwe bez wykonania prac dodatkowych, których konieczności
            wykonania nie można było przewidzieć w chwili zawierania niniejszej umowy, zaś Zamawiający odmawia wyrażenia
            zgody na wykonanie tych prac, Wykonawca:
            <ol style={OL_ALPHA}>
              <li style={LI}>może od umowy odstąpić zachowując prawo do całości wynagrodzenia, lub</li>
              <li style={LI}>
                może żądać podwyższenia umówionego wynagrodzenia, jeżeli w czasie wykonywania prac zaistnieje konieczność
                przeprowadzenia dodatkowych prac.
              </li>
            </ol>
          </li>
          <li style={LI}>
            Zgody Zamawiającego nie wymaga wykonanie prac dodatkowych o wartości nieprzekraczającej <Fill v={prog} w={140} />{' '}
            zł (słownie: <Fill v={progSlownie} w={260} /> złotych).
          </li>
          <li style={LI}>
            Jeżeli w trakcie wykonywania prac remontowych koszty wykonania przekroczą kwotę ustaloną powyżej, Wykonawca
            może zgłosić ofertę zmiany umowy. W przypadku braku zgody Zamawiającego prace są nadal prowadzone według
            planu, jednakże Wykonawca nie ponosi odpowiedzialności za szkodę, jeśli jest ona wynikiem realizacji planów,
            gdy wystąpił z wnioskiem o ich zmianę.
          </li>
          <li style={LI}>
            Zgoda na wykonanie prac dodatkowych może zostać udzielona za pośrednictwem wiadomości przesłanej na adres
            e-mail: <Fill v={u.zamawiajacyEmail} w={200} />.
          </li>
        </ol>
      </DocSection>

      {showKary && (
        <DocSection n={nr()} title="Kary umowne">
          <ol style={OL}>
            <li style={LI}>
              W przypadku zwłoki w wykonaniu przedmiotu niniejszej umowy, Wykonawca obowiązany jest do zapłaty kary
              umownej w wysokości 0,1% umówionego wynagrodzenia za każdy dzień zwłoki.
            </li>
            <li style={LI}>
              W przypadku opóźnienia w zapłacie wynagrodzenia Zamawiający obowiązany jest do zapłaty kary umownej w
              wysokości 0,5% umówionego wynagrodzenia za każdy dzień opóźnienia.
            </li>
            <li style={LI}>
              W przypadku opóźnienia w wydaniu pomieszczeń, w których ma być wykonywana umowa, Zamawiający obowiązany jest
              do zapłaty kary umownej w wysokości 0,5% umówionego wynagrodzenia za każdy dzień opóźnienia.
            </li>
          </ol>
        </DocSection>
      )}

      <DocSection n={nr()} title="Postanowienia końcowe">
        <ol style={OL}>
          <li style={LI}>
            Zmiana postanowień niniejszej umowy wymaga zgody obu stron wyrażonej na piśmie, w formie aneksu do umowy, pod
            rygorem nieważności takiej zmiany.
          </li>
          <li style={LI}>
            Ewentualne spory wynikłe w związku z realizacją przedmiotu umowy Strony zobowiązują się rozwiązywać w drodze
            wspólnych negocjacji, a w przypadku niemożności ustalenia kompromisu będą rozstrzygane przez Sąd właściwy dla
            siedziby Wykonawcy.
          </li>
          <li style={LI}>
            W sprawach, których nie reguluje niniejsza umowa, będą miały zastosowanie odpowiednie przepisy kodeksu
            cywilnego oraz innych obowiązujących ustaw.
          </li>
          <li style={LI}>
            Niniejszą umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.
          </li>
          <li style={LI}>
            Niniejsza umowa nie stanowi wzorca umownego, zaś każdy z jej elementów podlega indywidualnym ustaleniom
            Zamawiającego i Wykonawcy.
          </li>
          {is23 && (
            <li style={LI}>
              Zamawiający przyjmuje nadto do wiadomości i akceptuje, iż wyroby Wykonawcy stanowią rzecz nieprefabrykowaną,
              wyprodukowaną według specyfikacji Zamawiającego lub służącą zaspokojeniu jego zindywidualizowanych potrzeb,
              co powoduje, że Zamawiającemu nie przysługuje prawo odstąpienia od umowy.
            </li>
          )}
          {is23 && (
            <li style={LI}>
              Nadto Zamawiający przyjmuje do wiadomości i akceptuje, że nie przysługuje mu prawo do odstąpienia od umowy w
              sytuacji, gdy Wykonawca wykonał w pełni usługę za wyraźną zgodą Zamawiającego, który został poinformowany
              przed rozpoczęciem świadczenia, że po spełnieniu świadczenia przez przedsiębiorcę utraci prawo odstąpienia
              od umowy.
            </li>
          )}
          <li style={LI}>Załączniki do niniejszej umowy stanowią jej integralną część.</li>
          {showOdstapienie14 && (
            <li style={LI}>
              W przypadku zawarcia umowy poza lokalem Wykonawcy, Zamawiającemu przysługuje prawo odstąpienia od umowy w
              terminie 14 dni od dnia zawarcia przedmiotowej umowy bez podania przyczyn stosownie do przepisów ustawy o
              prawach konsumenta.
            </li>
          )}
          {showOdstapienie14 && (
            <li style={LI}>
              Do zachowania terminu, o którym mowa powyżej, wystarczy wysłanie pisma zawierającego oświadczenie o
              odstąpieniu od umowy listem poleconym.
            </li>
          )}
        </ol>
      </DocSection>
    </>
  )
}

// ============================================================================
// Oswiadczenie klienta
// ============================================================================
function OswiadczenieBody({ u }: { u: Umowa }) {
  return (
    <>
      <div style={{ ...P, marginTop: 6 }}>
        Sporządzone w <Fill v={u.miejscowoscZawarcia} w={120} /> w dniu <Fill v={fmtDate(u.dataZawarcia)} w={90} />.
      </div>
      <div style={P}>
        Ja niżej podpisany <Fill v={u.zamawiajacyNazwa} w={260} /> oświadczam, że zostałem poinformowany w sposób dla
        mnie zrozumiały i jasny, iż:
      </div>
      <ol style={OL}>
        <li style={LI}>
          wyroby Wykonawcy wykonywane są z produktów natury i jako takie posiadają charakterystyczne dla danego kamienia
          naturalne zmiany barwy, odcieni i użylenia. Takie cechy jak: żyła krystaliczna, odcień barwy, muszla, plamka
          rdzy czy odcisk skamielin, nie dają podstawy do zwrotu zakupionego materiału ani nie powodują obniżenia ceny.
          Kamienie naturalne i ich konglomeraty posiadają w swej naturze mikropory i mikroszczeliny. Odcień i użylenie
          kamienia może różnić się od próbnika przedstawionego Zamawiającemu;
        </li>
        <li style={LI}>
          wyroby Wykonawcy stanowią rzecz nieprefabrykowaną, wyprodukowaną według specyfikacji konsumenta lub służącą
          zaspokojeniu jego zindywidualizowanych potrzeb, co powoduje, że Zamawiającemu nie przysługuje prawo odstąpienia
          od umowy;
        </li>
        <li style={LI}>
          zostałem poinformowany, iż po spełnieniu świadczenia przez Wykonawcę tracę prawo odstąpienia od umowy, w
          sytuacji gdy Wykonawca wykonał w pełni usługę za wyraźną moją zgodą;
        </li>
        <li style={LI}>
          do zawartej między stronami umowy nie mają zastosowania przepisy art. 27 i nast. ustawy z dnia 30 maja 2014
          roku o prawach konsumenta;
        </li>
        <li style={LI}>warunki umowy zostały ze mną uzgodnione indywidualnie i zostały przeze mnie zaakceptowane.</li>
      </ol>
    </>
  )
}

// ============================================================================
// Umowa prowizyjna
// ============================================================================
function ProwizyjnaBody({ u, firma }: { u: Umowa; firma: Firma }) {
  return (
    <>
      <div style={P}>
        zawarta w <Fill v={u.miejscowoscZawarcia ?? 'Łodzi'} w={120} /> w dniu <Fill v={fmtDate(u.dataZawarcia)} w={90} />{' '}
        pomiędzy:
      </div>
      <div style={P}>
        <span style={partyTitle}>{firma.nazwa}</span>, NIP: {fmtNIP(firma.nip)}, reprezentowaną przez {firma.wlasciciel},
        zwaną dalej „Zleceniodawcą”
      </div>
      <div style={{ ...P, textAlign: 'center', fontWeight: 700 }}>a</div>
      <div style={P}>
        <Fill v={u.zamawiajacyNazwa} w={300} />, <Fill v={u.zamawiajacyAdres} w={280} />, NIP:{' '}
        <Fill v={u.zamawiajacyNip} w={140} />, zwanym dalej „Zleceniobiorcą”.
      </div>
      <div style={P}>
        Zważywszy na zgodną wolę współpracy w zakresie pozyskiwania Klientów na świadczone przez Zleceniodawcę Usługi,
        Strony postanawiają zawrzeć poniższą umowę.
      </div>

      <DocSection title="§ 1  Przedmiot i zakres umowy">
        <ol style={OL}>
          <li style={LI}>
            Zleceniobiorca będzie pozyskiwać klientów oraz umożliwi Zleceniodawcy kontakt i zawarcie umów z klientem w
            zakresie usług oferowanych przez Zleceniodawcę.
          </li>
          <li style={LI}>
            Przekazywanie kontaktu lub zgłaszanie zapotrzebowań na wykonanie usług będzie następować wyłącznie drogą
            mailową na adres: <Fill v={firma.email} w={190} /> lub SMS na numer <Fill v={firma.telefon} w={140} />. Strony
            zgodnie oświadczają, że przekazanie kontaktu w inny sposób niż opisany powyżej nie stanowi realizacji umowy i
            nie powoduje powstania roszczenia o wynagrodzenie.
          </li>
          <li style={LI}>
            Przekazywane dane kontaktu muszą zawierać: numer telefonu pozyskiwanego klienta, jego imię i nazwisko oraz
            adres e-mail.
          </li>
          <li style={LI}>Zleceniobiorca zobowiązany jest do uzyskania zgody Klienta na przekazanie jego danych Zleceniodawcy.</li>
          <li style={LI}>
            Zleceniobiorca decyduje sam o swoich czynnościach i nie podlega żadnym poleceniom Zleceniodawcy.
            Zleceniobiorca nie jest upoważniony do zawierania umów w imieniu Zleceniodawcy, chyba że otrzymał odrębne
            pełnomocnictwo.
          </li>
          <li style={LI}>
            Zleceniobiorca jest zobowiązany do zachowania tajemnicy zarówno w trakcie trwania umowy, jak i po jej
            zakończeniu.
          </li>
        </ol>
      </DocSection>

      <DocSection title="§ 2  Prowizja, rekompensata kosztów">
        <ol style={OL}>
          <li style={LI}>
            Zleceniobiorca otrzyma za swoją pracę i wszystkie transakcje, w których pośredniczy i które zakończą się dla
            Zleceniodawcy zawarciem umowy (w tym również złożeniem zamówienia ze strony klienta), wynagrodzenie w formie
            prowizji.
          </li>
          <li style={LI}>
            Prowizja będzie wynosić 10% wartości umowy netto, którą podpisze Zleceniodawca z klientem (jako umowa
            traktowane jest również każde zamówienie złożone przez klienta) w wyniku działań Zleceniobiorcy na usługi
            opisane w § 1 pkt 1.
          </li>
          <li style={LI}>
            Warunkiem wypłaty prowizji jest spełnienie łącznie poniższych warunków:
            <ol style={OL_ALPHA}>
              <li style={LI}>przekazanie kontaktu zgodnie z § 1 pkt 2 umowy,</li>
              <li style={LI}>podpisanie przez Zleceniodawcę umowy z klientem,</li>
              <li style={LI}>zapłata całości ceny za usługę na rzecz Zleceniodawcy przez Klienta,</li>
              <li style={LI}>wystawienie FV lub rachunku uproszczonego przez Zleceniobiorcę.</li>
            </ol>
          </li>
          <li style={LI}>
            Wypłata prowizji nastąpi w ciągu 7 dni od daty uznania rachunku bankowego Zleceniodawcy wynagrodzeniem za
            świadczone na rzecz Klienta usługi, na podstawie prawidłowo wystawionej faktury lub rachunku uproszczonego.
          </li>
          <li style={LI}>
            Jeżeli nie dojdzie do całkowitej realizacji postanowień umowy z klientem (z winy nieleżącej po stronie
            Zleceniodawcy), Zleceniobiorcy zostanie wypłacona prowizja w wysokości 10% wartości netto zapłaconych przez
            klienta faktur.
          </li>
          <li style={LI}>
            Zleceniodawca zobowiązuje się niezwłocznie, lecz nie później niż w terminie 2 dni roboczych, do
            powiadomienia Zleceniobiorcy o wpływie wynagrodzenia od pozyskanego Klienta.
          </li>
        </ol>
      </DocSection>

      <DocSection title="§ 3  Okres trwania umowy, wypowiedzenie">
        <ol style={OL}>
          <li style={LI}>
            Umowa jest zawarta na czas nieokreślony i może zostać wypowiedziana z 1-miesięcznym okresem wypowiedzenia na
            koniec miesiąca kalendarzowego.
          </li>
          <li style={LI}>
            Wypowiedzenie to nie ma jednakże wpływu na prawo do otrzymania prowizji od umów i zamówień złożonych w trakcie
            trwania niniejszej umowy.
          </li>
          <li style={LI}>
            Umowa może być rozwiązana bez wypowiedzenia z ważnych powodów, a w szczególności w wypadku naruszenia przez
            drugą Stronę któregokolwiek z postanowień umowy.
          </li>
        </ol>
      </DocSection>

      <DocSection title="§ 4  Częściowa nieważność umowy, forma pisemna, właściwy sąd">
        <ol style={OL}>
          <li style={LI}>
            Zleceniodawca nie jest zobowiązany do zwrotu Zleceniobiorcy wydatków oraz kosztów związanych z wykonywaniem
            przez Zleceniobiorcę zobowiązań z niniejszej Umowy.
          </li>
          <li style={LI}>
            Zleceniobiorca nie może zbywać lub odstępować wierzytelności wobec Zleceniodawcy osobie trzeciej bez zgody
            Zleceniodawcy.
          </li>
          <li style={LI}>
            Zleceniobiorca zobowiązuje się do utrzymania w tajemnicy informacji poufnych Zleceniodawcy, którymi są
            wszelkie informacje nieudostępniane publicznie, a w szczególności zasady sprzedaży usług.
          </li>
          <li style={LI}>
            W przypadku nieważności jednego z ustaleń powyższej umowy pozostałe ustalenia pozostają wiążące. Strony
            zobowiązują się to ustalenie zastąpić takim, które będzie prawnie zgodne z powyższą umową.
          </li>
          <li style={LI}>
            Wszelkie zmiany i dodatkowe ustalenia powyższej umowy wymagają formy pisemnej pod rygorem nieważności.
          </li>
          <li style={LI}>
            Spory mogące wyniknąć z realizacji niniejszej umowy będą rozstrzygane przez Sąd Rejonowy właściwy dla
            siedziby Zleceniodawcy.
          </li>
          <li style={LI}>Umowę sporządzono w dwóch egzemplarzach, po jednym dla każdej ze Stron.</li>
        </ol>
      </DocSection>
    </>
  )
}

// ============================================================================
// Umowa wspolpracy (ekspozycja / sprzedawca)
// ============================================================================
function WspolpracyBody({ u, firma }: { u: Umowa; firma: Firma }) {
  const konto = has(firma.konto) ? fmtKonto(firma.konto as string) : ''
  const krotnosc = u.pola?.['krotnoscEkspozycji']
  let n = 0
  const nr = () => String(++n)
  return (
    <>
      <div style={P}>
        zawarta w <Fill v={u.miejscowoscZawarcia} w={120} /> w dniu <Fill v={fmtDate(u.dataZawarcia)} w={90} /> pomiędzy:
      </div>
      <div style={P}>
        <span style={partyTitle}>{firma.marka || firma.nazwa}</span> z siedzibą w {firma.miasto} ({firma.kod}) przy ul.{' '}
        {firma.ulica}, numer NIP: {fmtNIP(firma.nip)} reprezentowaną przez {firma.wlasciciel}, zwaną w dalszej części
        umowy „Wykonawcą”
      </div>
      <div style={{ ...P, textAlign: 'center', fontWeight: 700 }}>a</div>
      <div style={P}>
        <Fill v={u.zamawiajacyNazwa} w={340} />
      </div>
      <div style={P}>
        <Fill v={u.zamawiajacyAdres} w={340} />
      </div>
      <div style={P}>
        NIP: <Fill v={u.zamawiajacyNip} w={150} /> telefon: <Fill v={u.zamawiajacyTelefon} w={150} />
      </div>
      <div style={P}>zwanym w dalszej części umowy „Sprzedawcą”</div>
      <div style={P}>Zwanymi łącznie „Stronami”</div>

      <DocSection n={nr()} title="Przedmiot umowy">
        <ol style={OL}>
          <li style={LI}>
            Na podstawie niniejszej umowy Sprzedawca zobowiązuje się do:
            <ol style={OL_ALPHA}>
              <li style={LI}>
                przygotowania stoiska ekspozycyjnego prezentującego produkty oferowane przez Wykonawcę zgodnie z
                postanowieniami zawartymi w §2 niniejszej umowy i utrzymania go w terminach wskazanych w niniejszej
                umowie, a także ponoszenia wszelkich kosztów związanych z utrzymaniem stoiska,
              </li>
              <li style={LI}>
                nabywania i dalszego sprzedawania w zakresie prowadzonej działalności gospodarczej produktów (blatów,
                parapetów, schodów itp.) wytworzonych przez Wykonawcę, na warunkach określonych w niniejszej umowie,
              </li>
              <li style={LI}>
                dokonania w ciągu 24 miesięcy, licząc od dnia dostarczenia przez Wykonawcę produktów niezbędnych do
                wykonania stoiska ekspozycyjnego, zakupów produktów oferowanych przez Wykonawcę o wartości nie mniejszej
                niż <Fill v={krotnosc} w={80} /> krotność wartości ekspozycji netto.
              </li>
            </ol>
          </li>
          <li style={LI}>
            W przypadku niezłożenia zamówień określonych w punkcie 1 lit. c, Sprzedawca obowiązany będzie do zapłaty ceny
            równej wartości rynkowej stoiska ekspozycyjnego, która to wartość określona zostanie w wycenie stanowiącej
            załącznik do niniejszej umowy.
          </li>
          <li style={LI}>
            Na podstawie niniejszej umowy Wykonawca zobowiązuje się do:
            <ol style={OL_ALPHA}>
              <li style={LI}>
                sprzedania w promocyjnej cenie produktów niezbędnych do wykonania stoiska ekspozycyjnego prezentującego
                produkty Wykonawcy i będące w jego ofercie,
              </li>
              <li style={LI}>
                zapewnienia Sprzedawcy stałej sprzedaży produktów Wykonawcy, w asortymencie, ilościach, cenach i
                terminach uzgadnianych pomiędzy Stronami każdorazowo.
              </li>
            </ol>
          </li>
          <li style={LI}>
            Wykonawca w wykonaniu niniejszej umowy może posługiwać się podwykonawcami. Wybór podwykonawcy nie będzie
            wymagał akceptacji Sprzedawcy.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Warunki dostawy">
        <ol style={OL}>
          <li style={LI}>
            Produkty dostarczane Sprzedawcy dla jego klientów będą wytwarzane przez Wykonawcę na podstawie pomiarów z
            natury dokonanych przez Wykonawcę lub Sprzedawcę.
          </li>
          <li style={LI}>
            W przypadku dokonania pomiarów przez Sprzedawcę, odpowiedzialność za prawidłowość dokonanych pomiarów ponosi
            Sprzedawca.
          </li>
          <li style={LI}>
            Sprzedawca obowiązany jest każdorazowo dostarczyć zamówienie Wykonawcy na formularzu stanowiącym załącznik do
            niniejszej umowy.
          </li>
          <li style={LI}>
            Sprzedawca obowiązany jest do sprzedaży produktów w cenach detalicznych sugerowanych przez Wykonawcę.
            Ewentualne rabaty udzielane będą na koszt Sprzedawcy, chyba że Strony ustalą inaczej.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Stoisko ekspozycyjne">
        <ol style={OL}>
          <li style={LI}>
            Sprzedawca obowiązany jest do przygotowania i utrzymania stoiska ekspozycyjnego wykonanego z użyciem
            produktów Wykonawcy.
          </li>
          <li style={LI}>
            Przed wykonaniem stoiska ekspozycyjnego Sprzedawca obowiązany jest do przygotowania projektu stoiska
            ekspozycyjnego i przedstawienia projektu Wykonawcy. Wykonawca może zgłaszać poprawki do projektu, które winny
            być uwzględnione przez Sprzedawcę. Projekt stanowi załącznik do niniejszej umowy.
          </li>
          <li style={LI}>Sprzedawca umieści stoisko w swoim lokalu handlowym w miejscu uzgodnionym z Wykonawcą.</li>
          <li style={LI}>Wykonawca dostarczy Sprzedawcy produkty niezbędne do wykonania stoiska w obniżonej cenie.</li>
          <li style={LI}>
            Stoisko będzie wykonane i utrzymane w okresie obowiązywania niniejszej umowy, nie krócej jednak niż przez 12
            miesięcy od dostarczenia Sprzedawcy przez Wykonawcę produktów użytych do wykonania stoiska ekspozycyjnego.
          </li>
          <li style={LI}>
            W okresie 24 miesięcy, licząc od dnia dostarczenia przez Wykonawcę produktów niezbędnych do przygotowania
            stoiska z ekspozycją, Sprzedawca nie może zbyć eksponowanych produktów.
          </li>
          <li style={LI}>
            W przypadku zbycia eksponowanych produktów przed upływem okresu określonego w punkcie 6, Sprzedawca zapłaci
            Wykonawcy wartość rynkową ekspozycji określoną w wycenie stanowiącej załącznik do niniejszej umowy.
          </li>
          <li style={LI}>
            Sprzedawca obowiązany jest do umieszczenia na stoisku zawierającym ekspozycję następujących elementów:
            <ol style={OL_ALPHA}>
              <li style={LI}>katalogi prezentujące produkty Wykonawcy,</li>
              <li style={LI}>katalogi prezentujące portfolio Wykonawcy,</li>
              <li style={LI}>próbki materiałów używanych przez Wykonawcę.</li>
            </ol>
          </li>
          <li style={LI}>
            W przypadku uchybienia obowiązkowi opisanemu w punkcie 8, Sprzedawca obowiązany będzie do zapłaty kary
            umownej obliczonej w sposób opisany w punkcie 7 niniejszej umowy.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Oświadczenia stron">
        <ol style={OL}>
          <li style={LI}>
            Wykonawca oświadcza, iż posiada niezbędne umiejętności, wiedzę, środki, sprzęt i doświadczenie do
            dostarczenia produktów opisanych w niniejszej umowie i zobowiązuje się je wykonać z należytą starannością
            oraz aktualnym poziomem wiedzy i techniki.
          </li>
          <li style={LI}>
            Wykonawca oświadcza, a Sprzedawca przyjmuje do wiadomości i akceptuje, iż wyroby Wykonawcy wykonywane są z
            produktów natury i jako takie posiadają charakterystyczne dla danego kamienia naturalne zmiany barwy, odcieni
            i użylenia. Takie cechy jak: żyła krystaliczna, odcień barwy, muszla, plamka rdzy czy odcisk skamielin, nie
            dają podstawy do zwrotu zakupionego materiału ani nie powodują obniżenia ceny. Kamienie naturalne i ich
            konglomeraty posiadają w swej naturze mikropory i mikroszczeliny. Odcień i użylenie kamienia może różnić się
            od próbnika przedstawionego Sprzedawcy.
          </li>
          <li style={LI}>
            Sprzedawca oświadcza, iż posiada prawo do lokalu, w którym będzie umieszczone stoisko ekspozycyjne, i gotowy
            jest do ponoszenia kosztów utrzymania stoiska ekspozycyjnego w wyżej wymienionym lokalu.
          </li>
          <li style={LI}>
            Sprzedawca oświadcza, iż posiada ubezpieczenie ruchomości i nieruchomości zainstalowanych w punkcie
            handlowym, pozwalające na pokrycie strat w przypadku kradzieży lub uszkodzenia produktów wykorzystanych do
            przygotowania stoiska ekspozycyjnego.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Termin i sposób wykonania umowy">
        <ol style={OL}>
          <li style={LI}>
            Strony ustalają, iż produkty niezbędne do wykonania stoiska z ekspozycją oraz elementy, które mają zostać
            umieszczone na stoisku ekspozycyjnym, zostaną dostarczone do dnia <Fill v={fmtDate(u.terminZakonczenia)} w={130} />.
          </li>
          <li style={LI}>
            Strony ustalają, iż zamówienia produktów wytwarzanych przez Wykonawcę będą dokonywane na podstawie formularza
            zamówień stanowiącego załącznik do niniejszej umowy, zaś wypełniony formularz przesyłany będzie na adres
            e-mail: <Fill v={firma.email} w={190} />.
          </li>
          <li style={LI}>
            Wykonawca po otrzymaniu zamówienia obowiązany jest w terminie 3 dni roboczych licząc od dnia otrzymania
            zamówienia potwierdzić przyjęcie złożonego zamówienia, ceny zamówionych produktów oraz określić termin
            wykonania zamówionych produktów, przesyłając potwierdzenie na adres e-mail Sprzedawcy:{' '}
            <Fill v={u.zamawiajacyEmail} w={190} />.
          </li>
          <li style={LI}>
            Sprzedawca obowiązany jest do przesłania akceptacji warunków wykonania produktu w terminie 2 dni roboczych
            licząc od dnia przesłania potwierdzenia przyjęcia zamówienia przez Wykonawcę.
          </li>
          <li style={LI}>
            Sprzedawca obowiązany jest do zapłaty zadatku w wysokości <Fill v={u.pola?.['zadatekProcent']} w={70} /> %
            wartości zamówienia w terminie 3 dni roboczych licząc od dnia przesłania akceptacji warunków wykonania
            produktu.
          </li>
          <li style={LI}>
            Termin wykonania umowy ulega przedłużeniu o czas opóźnień Sprzedawcy w zapłacie zadatku lub o czas udzielania
            odpowiedzi przez Sprzedawcę na pytania Wykonawcy powstałe w toku wytwarzania produktów.
          </li>
          <li style={LI}>Odbiór zamówionych produktów przez Sprzedawcę musi być potwierdzony pisemnie protokołem odbioru.</li>
          <li style={LI}>
            Odbiór produktów dokonany zostanie w terminie 3 dni roboczych licząc od dnia, w którym Wykonawca poinformuje
            Sprzedawcę o zakończeniu wytwarzania produktów, przesyłając wiadomość na adres e-mail:{' '}
            <Fill v={u.zamawiajacyEmail} w={190} />.
          </li>
          <li style={LI}>
            Sprzedawca zobowiązany jest, w obecności przedstawiciela Wykonawcy, do kontroli zgodności dostarczonego
            produktu z treścią zamówienia. Podpisanie protokołu jest równoznaczne z potwierdzeniem zgodności produktu ze
            złożonym zamówieniem.
          </li>
          <li style={LI}>
            W przypadku nieodebrania produktu w terminie opisanym w punkcie 8, Strony uznają, iż doszło do odebrania
            produktu bez zastrzeżeń.
          </li>
          <li style={LI}>
            Wykonawca nie odpowiada za niewykonanie bądź nienależyte wykonanie umowy, jeżeli jest to spowodowane siłą
            wyższą bądź z przyczyn leżących po stronie Sprzedawcy. Dla celów niniejszej umowy siłą wyższą jest zdarzenie
            nadzwyczajne, zewnętrzne i niemożliwe do zapobieżenia i przewidzenia.
          </li>
          <li style={LI}>
            Przez dni robocze Strony rozumieją dni od poniedziałku do piątku z wyłączeniem dni ustawowo wolnych od pracy.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Zakaz konkurencji">
        <ol style={OL}>
          <li style={LI}>
            W okresie 24 miesięcy licząc od daty dostarczenia produktów do wykonania stoiska ekspozycyjnego, Sprzedawca
            nie będzie dokonywał zakupów towarów podobnych do towarów oferowanych przez Wykonawcę w przedsiębiorstwach
            konkurencyjnych.
          </li>
          <li style={LI}>
            W przypadku uchybienia postanowieniu określonemu w pkt 1 Sprzedawca obowiązany będzie do zapłaty kary umownej
            w wysokości dwukrotności kwoty obliczonej w sposób opisany w punkcie 7 sekcji „Stoisko ekspozycyjne”
            niniejszej umowy.
          </li>
          <li style={LI}>
            Obowiązek zapłaty kary umownej nie wyłącza możliwości dochodzenia przez Wykonawcę odszkodowania na zasadach
            ogólnych.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Wynagrodzenie">
        <ol style={OL}>
          <li style={LI}>Wynagrodzenie należne Wykonawcy określone zostanie każdorazowo na podstawie złożonego zamówienia.</li>
          <li style={LI}>
            Sprzedawca zapłaci całość ceny Wykonawcy najpóźniej na 7 dni po odbiorze produktu, przelewem na rachunek
            bankowy Wykonawcy o numerze <Fill v={konto} w={230} /> zgodnie z ceną potwierdzoną w chwili składania
            zamówienia.
          </li>
          <li style={LI}>Wykonawca zastrzega prawo własności produktów, aż do zapłaty całości ceny.</li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Kary umowne">
        <ol style={OL}>
          <li style={LI}>
            W przypadku zwłoki w wykonaniu przedmiotu niniejszej umowy, Wykonawca obowiązany jest do zapłaty kary umownej
            w wysokości 0,1% wartości umowy za każdy dzień zwłoki.
          </li>
          <li style={LI}>
            W przypadku opóźnienia w zapłacie wynagrodzenia Sprzedawca obowiązany jest do zapłaty kary umownej w
            wysokości 0,5% wartości umowy za każdy dzień opóźnienia.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Okres obowiązywania i rozwiązanie umowy">
        <ol style={OL}>
          <li style={LI}>Umowa została zawarta na czas określony, dwóch lat od dnia jej zawarcia.</li>
          <li style={LI}>
            Strony mogą w każdym czasie na mocy obustronnego porozumienia rozwiązać umowę za miesięcznym okresem
            wypowiedzenia z zachowaniem formy pisemnej pod rygorem nieważności.
          </li>
          <li style={LI}>
            Wykonawca ma prawo do rozwiązania umowy ze Sprzedawcą bez zachowania okresu wypowiedzenia (w trybie
            natychmiastowym za pisemnym oświadczeniem) w przypadku rażącego niewykonywania przez niego obowiązków
            wynikających z umowy, w tym przede wszystkim naruszenia zakazu konkurencji.
          </li>
        </ol>
      </DocSection>

      <DocSection n={nr()} title="Postanowienia końcowe">
        <ol style={OL}>
          <li style={LI}>
            Zmiana postanowień niniejszej umowy wymaga zgody obu stron wyrażonej na piśmie, w formie aneksu do umowy, pod
            rygorem nieważności takiej zmiany.
          </li>
          <li style={LI}>
            Ewentualne spory wynikłe w związku z realizacją przedmiotu Strony zobowiązują się rozwiązywać w drodze
            wspólnych negocjacji, a w przypadku niemożności ustalenia kompromisu będą rozstrzygane przez Sąd właściwy dla
            siedziby Wykonawcy.
          </li>
          <li style={LI}>
            W sprawach, których nie reguluje niniejsza umowa, będą miały zastosowanie odpowiednie przepisy kodeksu
            cywilnego oraz innych obowiązujących ustaw.
          </li>
          <li style={LI}>
            Niniejszą umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.
          </li>
          <li style={LI}>Załączniki do niniejszej umowy stanowią jej integralną część.</li>
        </ol>
      </DocSection>
    </>
  )
}

// ============================================================================
// Tytuly umow
// ============================================================================
const TYTUL: Record<Umowa['typ'], string> = {
  dzielo_23: 'UMOWA O DZIEŁO – 23% VAT',
  dzielo_8: 'UMOWA O DZIEŁO – 8% VAT',
  dzielo_8_23: 'UMOWA O DZIEŁO – 8/23% VAT',
  prowizyjna: 'UMOWA PROWIZYJNA',
  wspolpracy: 'UMOWA WSPÓŁPRACY',
  oswiadczenie: 'OŚWIADCZENIE',
}

// ============================================================================
// Komponent glowny
// ============================================================================
export function UmowaDoc({
  u,
  firma,
  klauzulaPodpis,
  klauzulaRodo,
  logoDataUrl,
}: {
  u: Umowa
  firma: Firma
  klauzulaPodpis: string
  klauzulaRodo: string
  logoDataUrl?: string
}) {
  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', margin: '4px 0 12px' }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', Fraunces, serif",
            fontWeight: 600,
            fontSize: '15pt',
            letterSpacing: '0.03em',
            color: '#12130f',
          }}
        >
          {TYTUL[u.typ]}
        </div>
        {has(u.numer) && (
          <div style={{ fontSize: '8.5pt', color: '#0f5c3f', fontWeight: 700, marginTop: 3 }}>{u.numer}</div>
        )}
      </div>

      {(u.typ === 'dzielo_23' || u.typ === 'dzielo_8' || u.typ === 'dzielo_8_23') && (
        <DzieloBody u={u} firma={firma} variant={u.typ} />
      )}
      {u.typ === 'oswiadczenie' && <OswiadczenieBody u={u} />}
      {u.typ === 'prowizyjna' && <ProwizyjnaBody u={u} firma={firma} />}
      {u.typ === 'wspolpracy' && <WspolpracyBody u={u} firma={firma} />}

      <StopkaPodpisow u={u} klauzulaPodpis={klauzulaPodpis} klauzulaRodo={klauzulaRodo} />
    </DocSheet>
  )
}
