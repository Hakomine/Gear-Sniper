import { FARBEN } from '../render/palette'
import type { GegnerVerhaltenId } from './gegnerVerhalten'

/**
 * Gegner als Daten.
 *
 * Ein neuer Gegnertyp ist ein Eintrag in dieser Tabelle - kein neuer Code.
 * In diesem Genre *ist* die Inhaltsmenge das Produkt: Wer fuer jeden Gegner
 * eine Klasse schreibt, baut nach dem zwanzigsten keine mehr.
 */
/**
 * Neun Formen fuer neun Arten.
 *
 * Eine Art, die aussieht wie eine andere, ist im Pulk keine eigene Art mehr -
 * und der ganze Zweck der neuen Gegner ist, dass man sie *unterscheidet*.
 * Deshalb bekommt jede ihre eigene Silhouette, und die Silhouette sagt, was
 * sie tut: Das Kreuz flickt, der Doppelrahmen wird zwei, der Halbmond deckt.
 */
export type Form =
  | 'dreieck'
  | 'quadrat'
  | 'sechseck'
  | 'raute'
  | 'pfeil'
  | 'stern'
  | 'kreuz'
  | 'halbmond'
  | 'doppelquadrat'

export type GegnerArt = {
  readonly id: string
  readonly name: string
  /** Die eigentliche Ansage an den Spieler - siehe palette.ts. */
  readonly form: Form
  /**
   * Wie er sich benimmt.
   *
   * Bis hierher hatten *alle* Arten dasselbe Verhalten - Richtung zum
   * Spieler, Tempo drauf. Drei Arten, ein Muster: Genau daran lag es, dass
   * sich der Lauf nach zehn Minuten anfuehlte wie nach einer.
   */
  readonly verhalten: GegnerVerhaltenId
  /**
   * Der Koerper - eine von drei Helligkeiten aus der kuehlen Familie.
   *
   * Bewusst **kein Farbton**. Vorher trug jede Art ihren eigenen gesaettigten
   * Ton; dreizehn davon auf aehnlicher Helligkeit ergaben ein Feld, das aussah
   * wie ein Farbwaehler. Nichts trat zurueck, also trat auch nichts hervor.
   * Die Helligkeit sagt jetzt nur noch, wie schwer der Brocken ist.
   */
  readonly farbe: string
  /**
   * Der leuchtende Kern - hier wohnt der Farbton, und nur hier.
   *
   * Er ist knapp bemessen: Nur Arten, die eine *Entscheidung* verlangen,
   * bekommen einen auffaelligen. Der Kitt loescht Risse, also muss man ihn
   * zuerst wegmachen; der Speier trifft aus der Ferne, also muss man zu ihm
   * hin; der Stuermer kuendigt eine Bahn an. Alle anderen tragen ein
   * neutrales Stahlblau, das nur sagt "lebt".
   *
   * Wenn alles leuchtet, sagt Leuchten nichts mehr.
   */
  /**
   * Die Farbe der Schraffur - der einzige Ort, an dem ein Farbton lebt.
   *
   * Bis Runde 6 hiess das Feld dasselbe und meinte einen leuchtenden
   * Innenkern. Im Druck gibt es kein Leuchten: Es ist jetzt die Farbe, in der
   * die Schnitte quer ueber den Koerper laufen. Papierfarbe heisst "weniger
   * Tinte, sonst nichts"; Zinnober heisst "der hier ist dein Problem".
   */
  readonly kern: string
  readonly radius: number
  readonly hp: number
  readonly tempo: number
  /** Schaden bei Beruehrung. */
  readonly schaden: number
  readonly xp: number
  /** Wie stark Rueckstoss wirkt: hoch = laesst sich kaum wegschubsen. */
  readonly masse: number
  /** Ab welcher Laufzeit (Sekunden) dieser Typ ueberhaupt auftaucht. */
  readonly abSekunde: number
  /** Relative Haeufigkeit zu Beginn. */
  readonly gewicht: number
  /**
   * Relative Haeufigkeit nach zehn Minuten.
   *
   * Dazwischen wird linear ueberblendet. Ohne diese zweite Zahl bleibt die
   * Mischung ueber den ganzen Lauf gleich, und dann besteht auch Minute zehn
   * noch ueberwiegend aus Splittern - viel Menge, keine Bedrohung.
   */
  readonly gewichtSpaet: number

  /**
   * Traegt diese Art ein Auge?
   *
   * Ein Auge macht aus einer Form eine Kreatur - der Griff von Binding of
   * Isaac, Downwell und Rain World, und er kostet zwei Kreise. Er darf aber
   * nicht jedem gehoeren: Bekaeme der Splitter eins, saessen bei vollem Feld
   * tausend Augen im Bild, und aus Charakter wuerde Rauschen.
   *
   * Deshalb nur die Schweren. Der Pulk bleibt anonym, und *genau deshalb*
   * wirkt das Grosse lebendig: Was einen ansieht, ist jemand; was einen nicht
   * ansieht, ist Masse.
   *
   * Eine Gestaltungsentscheidung je Art und keine Radiusabfrage im Zeichner -
   * damit eine neue Gegnerart sie bewusst treffen muss.
   */
  readonly auge: boolean
}

export const GEGNER_ARTEN = [
  {
    id: 'splitter',
    name: 'Splitter',
    form: 'dreieck',
    verhalten: 'jaeger',
    farbe: FARBEN.koerperLeicht,
    kern: FARBEN.grund,
    radius: 9,
    hp: 10,
    tempo: 78,
    schaden: 7,
    xp: 1,
    masse: 1,
    abSekunde: 0,
    gewicht: 100,
    gewichtSpaet: 18,
    auge: false,
  },
  {
    id: 'brocken',
    name: 'Brocken',
    form: 'quadrat',
    verhalten: 'jaeger',
    farbe: FARBEN.koerperSchwer,
    kern: FARBEN.grund,
    radius: 15,
    hp: 58,
    tempo: 42,
    schaden: 14,
    xp: 4,
    masse: 3.2,
    abSekunde: 55,
    gewicht: 34,
    gewichtSpaet: 55,
    auge: true,
  },
  {
    id: 'elite',
    name: 'Kantiger',
    form: 'sechseck',
    verhalten: 'jaeger',
    farbe: FARBEN.koerperMittel,
    kern: FARBEN.grund,
    radius: 20,
    hp: 165,
    tempo: 58,
    schaden: 22,
    xp: 14,
    masse: 5,
    abSekunde: 130,
    gewicht: 9,
    gewichtSpaet: 62,
    auge: false,
  },
  {
    id: 'schwaermer',
    name: 'Schwärmer',
    form: 'raute',
    verhalten: 'schwaermer',
    farbe: FARBEN.koerperLeicht,
    kern: FARBEN.grund,
    radius: 10,
    hp: 22,
    tempo: 104,
    schaden: 9,
    xp: 3,
    masse: 1.1,
    abSekunde: 40,
    gewicht: 26,
    gewichtSpaet: 30,
    auge: false,
  },
  {
    id: 'stuermer',
    name: 'Stürmer',
    form: 'pfeil',
    verhalten: 'stuermer',
    farbe: FARBEN.koerperMittel,
    kern: FARBEN.gefahr,
    radius: 13,
    hp: 46,
    tempo: 62,
    schaden: 18,
    xp: 6,
    masse: 2.2,
    abSekunde: 80,
    gewicht: 16,
    gewichtSpaet: 34,
    auge: false,
  },
  {
    id: 'speier',
    name: 'Speier',
    form: 'stern',
    verhalten: 'speier',
    farbe: FARBEN.koerperMittel,
    kern: FARBEN.gefahr,
    radius: 12,
    hp: 40,
    tempo: 54,
    schaden: 15,
    xp: 7,
    masse: 1.6,
    abSekunde: 120,
    gewicht: 10,
    gewichtSpaet: 26,
    auge: true,
  },
  {
    id: 'teiler',
    name: 'Teiler',
    form: 'doppelquadrat',
    verhalten: 'teiler',
    farbe: FARBEN.koerperLeicht,
    kern: FARBEN.grund,
    radius: 16,
    hp: 70,
    tempo: 50,
    schaden: 13,
    xp: 5,
    masse: 2.8,
    abSekunde: 180,
    gewicht: 8,
    gewichtSpaet: 30,
    auge: true,
  },
  {
    /*
     * Kommt nie von selbst - `gewicht` und `abSekunde` sind so gesetzt, dass
     * der Spawner ihn nicht zieht. Er entsteht ausschliesslich, wenn ein
     * Teiler zerfaellt, und traegt deshalb selbst *nicht* das Teiler-Verhalten:
     * Sonst waere ein Teiler eine Lawine ohne Ende.
     */
    id: 'teilerklein',
    name: 'Bruchstück',
    form: 'quadrat',
    verhalten: 'jaeger',
    farbe: FARBEN.koerperLeicht,
    kern: FARBEN.grund,
    radius: 9,
    hp: 18,
    tempo: 96,
    schaden: 8,
    xp: 2,
    masse: 1,
    abSekunde: 1e9,
    gewicht: 0,
    gewichtSpaet: 0,
    auge: false,
  },
  {
    id: 'kitt',
    name: 'Kitt',
    form: 'kreuz',
    verhalten: 'kitt',
    farbe: FARBEN.koerperMittel,
    kern: FARBEN.gefahr,
    radius: 14,
    hp: 62,
    tempo: 64,
    schaden: 11,
    xp: 12,
    masse: 2,
    abSekunde: 210,
    gewicht: 5,
    gewichtSpaet: 11,
    auge: true,
  },
  {
    id: 'schild',
    name: 'Schildträger',
    form: 'halbmond',
    verhalten: 'schild',
    farbe: FARBEN.koerperSchwer,
    kern: FARBEN.grund,
    radius: 18,
    hp: 130,
    tempo: 46,
    schaden: 20,
    xp: 11,
    masse: 4.5,
    abSekunde: 300,
    gewicht: 4,
    gewichtSpaet: 14,
    auge: true,
  },
] as const satisfies readonly GegnerArt[]

/**
 * Wie zaeh, wie schnell und wie gefaehrlich Gegner mit der Laufzeit werden.
 *
 * Das ist die eigentliche Schwierigkeitskurve - nicht die Spawnrate. Wenn nur
 * die Menge steigt, raeumt eine aufgewertete Waffe jeden Teppich muehelos weg.
 *
 * Die Kurve war zuerst linear (1 + zeit/68) und damit weit hinter dem
 * Spieler: Gemessen ueberlebte eine Figur, die sich **gar nicht bewegt**, zehn
 * Minuten mit 16.000 Kills. In einem Spiel, das nur aus Ausweichen besteht,
 * ist das der Totalschaden. Fuenf Waffen mal fuenf Stufen wachsen ueberlinear,
 * also muss die Gegenseite es auch.
 *
 * Der quadratische Anteil ist bewusst der kleinere: Er greift spuerbar erst ab
 * der dritten Minute und laesst die ersten beiden Minuten in Ruhe - dort soll
 * der Spieler seinen Bau finden, nicht sofort sterben.
 */
export function hpFaktor(zeit: number): number {
  const min = zeit / 60
  return 1 + min * 1.5 + min * min * 0.55
}

export function tempoFaktor(zeit: number): number {
  // Deutlich flacher als die Trefferpunkte: Gegner, die schneller laufen als
  // der Spieler, nehmen ihm jede Handlungsmoeglichkeit.
  return Math.min(1.35, 1 + zeit / 420)
}

/**
 * Beruehrungsschaden ueber die Zeit.
 *
 * Ohne ihn wird ein Treffer spaet im Lauf bedeutungslos, sobald der Spieler
 * zwei Panzerplatten getragen hat - und damit auch das Ausweichen.
 */
export function schadenFaktor(zeit: number): number {
  return 1 + zeit / 150
}

/** Wann die Mischung vollstaendig auf die spaeten Gewichte umgestellt ist. */
const MISCHUNG_ENDE = 600

/**
 * Haeufigkeit einer Art zum Zeitpunkt `zeit`.
 *
 * Der Lauf beginnt als Splitterteppich und endet als Elite-Aufmarsch. Das ist
 * die zweite Haelfte der Schwierigkeitskurve: Nur zaehere Gegner zu machen
 * reicht nicht, es muessen auch andere kommen. Nebenbei loest es die
 * Zersplitterung haeufiger aus - Splitter sterben vor dem dritten Riss,
 * Elite-Gegner leben lange genug, um alle drei zu sammeln.
 */
export function gewichtFuer(art: GegnerArt, zeit: number): number {
  const t = Math.min(1, zeit / MISCHUNG_ENDE)
  return art.gewicht + (art.gewichtSpaet - art.gewicht) * t
}

/** Alle Typen, die zu diesem Zeitpunkt vorkommen duerfen. */
export function verfuegbareArten(zeit: number): GegnerArt[] {
  return GEGNER_ARTEN.filter((a) => zeit >= a.abSekunde)
}

/**
 * Woher ein Treffer am Spieler kam - als Bitnummer.
 *
 * Gebraucht wird das nur von der Kernscherbe, die selbst aus Glas ist: Drei
 * Treffer von drei *verschiedenen* Quellen lassen sie zerspringen. Damit ist
 * die Frage "wer hat mich getroffen" zum ersten Mal eine, die das Spiel
 * beantworten muss - und die Antwort ist dieselbe Bitmaske, mit der Gegner
 * ihre Risse zaehlen.
 *
 * Zwei Nummern hinter den Arten sind reserviert: Bosse bringen ihre `GegnerArt`
 * zur Laufzeit selbst mit und stehen deshalb nicht in `GEGNER_ARTEN`, und
 * Bosszonen haben ueberhaupt keinen Koerper.
 */
export const QUELLE_BOSS = GEGNER_ARTEN.length
export const QUELLE_UMWELT = GEGNER_ARTEN.length + 1

/**
 * Eine `Map` statt `indexOf`: Sie wird einmal gebaut und danach in konstanter
 * Zeit gelesen. Bei zehn Eintraegen ist der Unterschied klein - aber diese
 * Funktion liegt an einer Trefferstelle, und dort ist "klein und immer" die
 * Sorte Kosten, die dieses Projekt an anderer Stelle konsequent vermeidet.
 */
const ART_INDEX = new Map<GegnerArt, number>(GEGNER_ARTEN.map((a, i) => [a, i]))

export function artIndex(art: GegnerArt): number {
  return ART_INDEX.get(art) ?? QUELLE_BOSS
}
