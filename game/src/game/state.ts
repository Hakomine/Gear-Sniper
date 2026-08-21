import { Pool } from '../core/pool'
import { Rng } from '../core/rng'
import { RaumGitter } from '../core/spatialHash'
import { FARBEN, SELTENHEIT_FARBE } from '../render/palette'
import { xpFuerLevel } from './damage'
import { zerspringen } from './effects'
import type { GegnerArt } from './enemies'
import { Klangpuffer } from './klaenge'
import { aktualisiereKristalle, legeKristall } from './pickups'
import { bewegeSpieler, erzeugeSpieler, stosse, stossTick, verletzeSpieler } from './player'
import type { BossZustand } from './bosse'
import { bossTick, bossWelle } from './bosse'
import type { Charakter } from './charaktere'
import type { CharakterId } from './charaktere'
import {
  CHARAKTERE,
  charakterMit,
  freigeschaltetDurch,
  punkteFuer,
  SCHLIFF_MAX,
  SCHLIFF_NAEHE,
  SCHLIFF_ZERFALL,
} from './charaktere'
import { risseAblaufen } from './risse'
import type { Bewegung } from './gegnerVerhalten'
import { GEGNER_VERHALTEN } from './gegnerVerhalten'
import { entferneVerlorene, spawne, startWelle } from './spawner'
import type { Aufwertung } from './upgrades'
import { zieheAngebote } from './upgrades'
import { detoniere, VERHALTEN } from './verhalten'
import type { WaffenInstanz } from './weapons'
import { ruesteAus, WAFFE_START } from './weapons'
import {
  arbeiteKaskadeAb,
  DORNEN_PLATZ,
  GEIST_PLATZ,
  PLATZ_ANZAHL,
  SPLITTER_PLATZ,
  gegnerImUmkreis,
  legeEffekt,
  naechsterGegner,
  verletzeGegner,
} from './welt'

/**
 * Der gesamte Laufzustand in einem Objekt - und die Simulation darauf.
 *
 * Diese Datei kennt keinen Browser: kein `document`, kein `window`, kein
 * Canvas. Das ist keine Stilfrage, sondern zahlt sich dreifach aus - die
 * Logik ist ohne Browser testbar, die Performance laesst sich ohne Zeichnen
 * messen (`npm run perf`), und ein spaeteres Verpacken fuer Steam wird zur
 * Randnotiz statt zum Umbau.
 *
 * Die Import-Richtung ist sternfoermig: Diese Datei holt sich Funktionen aus
 * den Teilsystemen, die Teilsysteme holen sich von hier nur *Typen*. Dadurch
 * gibt es keine gegenseitigen Importe.
 */

export type Phase = 'titel' | 'laufend' | 'levelup' | 'pause' | 'tot'

/**
 * Ein Befehlssatz, in dem nichts gedrueckt ist.
 *
 * Damit ein neues Feld in `Befehle` nicht sieben Stellen in Tests und Messung
 * bricht - genau das ist gerade passiert, als Pause und senkrechte
 * Menuefuehrung dazukamen.
 */
export function leereBefehle(): Befehle {
  return {
    x: 0,
    y: 0,
    bestaetigen: false,
    links: false,
    rechts: false,
    hoch: false,
    runter: false,
    pause: false,
    wahl: -1,
  }
}

export type Spieler = {
  x: number
  y: number
  hp: number
  maxHp: number
  radius: number
  tempo: number
  level: number
  xp: number
  xpNaechste: number
  /** Restzeit der Unverwundbarkeit nach einem Treffer. */
  unverwundbar: number
  blitz: number
  /** Der Guertel. Hoechstens `MAX_WAFFEN` Stueck - siehe `weapons.ts`. */
  waffen: WaffenInstanz[]
  /** Passive Gegenstaende wirken ausschliesslich ueber diese Werte. */
  schadenMult: number
  abklingMult: number
  tempoMult: number
  magnetRadius: number
  kritChance: number
  kritFaktor: number
  /** Erfahrungs-Faktor - der Sammler bekommt mehr. */
  xpMult: number
  /** Wie viele Waffen dieser Charakter tragen kann. */
  maxWaffen: number

  // --- Charakter-Mechaniken -------------------------------------------------
  // Alle null, ausser der jeweilige Charakter setzt sie. Sie kosten damit eine
  // Abfrage pro Tick und keine Sonderfaelle im uebrigen Code.

  /** Schleiferin: Schadensbonus je Kill in der Naehe. */
  schliffProNah: number
  /** Aktuell aufgestapelter Schliff. */
  schliff: number
  /** Riss: Sekunden ohne Treffer. */
  stillstand: number
  /** Ab so vielen Sekunden ohne Treffer setzt der Geisterriss. 0 = nie. */
  stillstandSchwelle: number
  /** Koloss: Schaden je Sekunde an allem, was ihn beruehrt. */
  dornen: number

  // --- Stoss ----------------------------------------------------------------

  /** Restlaufzeit des Stosses. Groesser als 0 heisst: gerade unterwegs. */
  stossRest: number
  /** Restliche Abklingzeit. 0 heisst: bereit. */
  stossAbkling: number
  /** Richtung des laufenden Stosses, bereits mit Tempo multipliziert. */
  stossVx: number
  stossVy: number
  /** Wie schnell der Stoss nachlaedt. 1 ist normal, 2 doppelt so schnell. */
  stossLaden: number
  /**
   * Zuletzt gelaufene Richtung.
   *
   * Damit ein Stoss aus dem Stand nicht ins Leere geht: Gerade im Gedraenge
   * steht man oft einen Moment still, und ein verschluckter Knopfdruck fuehlt
   * sich wie ein Fehler des Spiels an, nicht wie einer des Spielers.
   */
  blickX: number
  blickY: number
}

export type Gegner = {
  id: number
  x: number
  y: number
  hp: number
  maxHp: number
  art: GegnerArt
  /** Aus der Art plus Zeitskalierung beim Spawn vorgerechnet. */
  radius: number
  tempo: number
  schaden: number
  xp: number
  masse: number
  blitz: number
  stossX: number
  stossY: number
  tot: boolean
  /**
   * Risse - ein Bit je Waffenplatz. Siehe `risse.ts`; bewusst eine Zahl und
   * kein `Set`, weil es davon bis zu 1400 Stueck gibt.
   */
  risseMaske: number
  risse: number
  risseZeit: number
  zersplittert: boolean
  /**
   * Arbeitsspeicher der Gegnerverhalten - siehe `gegnerVerhalten.ts`.
   *
   * Fuenf Zahlen je Gegner, bei 1400 Stueck also nichts. Ein eigenes
   * Zustandsobjekt je Art waere sauberer zu lesen und 1400 Allokationen
   * teurer; die Pools im ganzen Spiel existieren genau dafuer, das zu
   * vermeiden.
   *
   * `takt` ist ein Zaehler (Vorwarnung, Schusspause, Kreisphase), `zustand`
   * eine kleine Zahl (0 laeuft, 1 kuendigt an, 2 prescht), `merkX`/`merkY`
   * merken sich ein Ziel oder eine Bahn, `blick` ist die Ausrichtung des
   * Schildtraegers.
   */
  takt: number
  zustand: number
  merkX: number
  merkY: number
  blick: number
  /**
   * Nur bei Bossen gesetzt.
   *
   * Bosse laufen bewusst im normalen Gegner-Pool mit, statt einen eigenen zu
   * bekommen: So erben sie Risse, Zersplitterung, Rueckstoss und die gesamte
   * Trefferkette umsonst - und ein Boss geht nur mit mehreren *verschiedenen*
   * Waffen schnell zu Boden. Ein Nullzeiger an 1400 Objekten kostet nichts.
   */
  bossZustand: BossZustand | null
}

export type Geschoss = {
  x: number
  y: number
  vx: number
  vy: number
  schaden: number
  radius: number
  durchschlag: number
  leben: number
  rueckstoss: number
  krit: boolean
  /** Guertelplatz der abfeuernden Waffe - entscheidet ueber den Riss. */
  platz: number
  farbe: string
  /** Wendigkeit im Bogenmass je Sekunde. 0 = fliegt geradeaus. */
  zielsuche: number
  ziel: Gegner | null
  /** Zur Probe, ob `ziel` noch derselbe Gegner ist - Pools recyceln Objekte. */
  zielId: number
  /** Groesser als 0: knallt beim Aufschlag. */
  explosionsRadius: number
  /** Wie viele kleinere Granaten der Knall nachwirft. */
  nachwurf: number
  /** Springt nach einem Treffer weiter, statt zu vergehen. */
  prallt: boolean
  /**
   * Spaltet sich bei einem Kill in so viele neue Geschosse (Schwarmnadeln).
   *
   * Diese Flaggen sammeln sich am Geschoss, statt fuer jede Fusion einen
   * eigenen Typ zu bauen. Ein paar Nullen und `false` an einem gepoolten
   * Objekt kosten nichts - ein zweiter Pool mit eigener Kollisionsschleife
   * schon.
   */
  spaltet: number
  /** Reisst beim Aufschlag erst alles zusammen und detoniert dann (Kollaps). */
  kollaps: boolean
  /** IDs bereits getroffener Gegner - sonst trifft ein Durchschuss denselben mehrfach. */
  getroffen: Set<number>
}

/** Ein wirksames Feld: Sog des Sternenschluckers, Truemmerfeld nach dem Platzen. */
export type Zone = {
  art: 'sog' | 'knall'
  x: number
  y: number
  radius: number
  maxRadius: number
  leben: number
  maxLeben: number
  schaden: number
  sogKraft: number
  /** Restzeit bis zum naechsten Schadenstakt. */
  tickRest: number
  platz: number
  farbe: string
  /** Laesst beim Platzen ein Truemmerfeld zurueck (vollendeter Schlucker). */
  truemmer: boolean
  /** Gehoert einem Boss und verletzt den Spieler statt der Gegner. */
  feindlich: boolean
  /** Schlaegt bei jedem Schadenstakt Blitze zwischen den Gefangenen (Gewitterkern). */
  gewitter: boolean
  /**
   * Der Radius waechst ueber die Lebensdauer von null auf `maxRadius`.
   *
   * Fuer Schockringe: Getroffen wird nur, wer im wandernden Band steht - in
   * der Mitte ist man sicher. Das macht den Angriff ausweichbar statt
   * unentrinnbar.
   */
  wachsend: boolean
}

/** Rein optisch: Blitzbahn, Hiebbogen, Druckring. */
export type Effekt = {
  art: 'strich' | 'bogen' | 'ring'
  x: number
  y: number
  x2: number
  y2: number
  radius: number
  winkel: number
  spanne: number
  leben: number
  maxLeben: number
  farbe: string
  breite: number
  /** Vorwarnung eines Bossangriffs - wird gestrichelt und pulsierend gezeichnet. */
  warnung: boolean
}

/**
 * Bossgeschosse.
 *
 * Eigener Pool, obwohl `Geschoss` fast dasselbe Feld haette: Die Pruefung
 * laeuft gegen *einen* Spieler statt gegen 1400 Gegner - eine voellig andere
 * Schleife, und ein gemeinsames `feindlich`-Feld haette in beiden
 * Kollisionspfaden eine Abfrage erzwungen, die 99 % der Zeit falsch ist.
 */
export type FeindSchuss = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  schaden: number
  leben: number
  farbe: string
}

export type Kristall = {
  x: number
  y: number
  vx: number
  vy: number
  wert: number
  leben: number
  gezogen: boolean
}

export type Partikel = {
  x: number
  y: number
  vx: number
  vy: number
  leben: number
  maxLeben: number
  groesse: number
  farbe: string
  drehung: number
  drehTempo: number
}

export type SchadensZahl = {
  x: number
  y: number
  vy: number
  leben: number
  wert: number
  krit: boolean
}

/**
 * Was der Spieler in diesem Tick will - schon uebersetzt.
 *
 * Die Simulation bekommt Absichten, keine Tasten. Dadurch kann der
 * Performance-Test synthetische Eingaben einspeisen, ohne dass ein Browser
 * im Spiel ist.
 */
export type Befehle = {
  x: number
  y: number
  bestaetigen: boolean
  links: boolean
  rechts: boolean
  /**
   * Senkrechte Menuefuehrung.
   *
   * Das Levelup blaettert waagerecht durch drei Karten, das Pausenmenue
   * senkrecht durch eine Liste. Beide Richtungen getrennt zu fuehren ist
   * billiger, als eine Liste quer zu legen, damit sie zu den vorhandenen
   * Tasten passt.
   */
  hoch: boolean
  runter: boolean
  /** Escape oder Start - oeffnet und schliesst das Pausenmenue. */
  pause: boolean
  /** Direktwahl per Zifferntaste, sonst -1. */
  wahl: number
}

export type Statistik = {
  kills: number
  level: number
  zeit: number
  schaden: number
  zersplittert: number
  bosse: number
  /**
   * Schaden je Guertelplatz - Grundlage der Auswertung am Ende.
   *
   * Index `MAX_WAFFEN` sind die Scherben der Zersplitterung, `MAX_WAFFEN + 1`
   * der Geisterriss. Name und Farbe stehen daneben, damit die Zuordnung eine
   * Fusion ueberlebt: Verschwindet eine Waffe, bleibt ihr Balken trotzdem
   * beschriftet.
   */
  schadenProPlatz: number[]
  platzName: string[]
  platzFarbe: string[]
}

export type Spielstand = {
  phase: Phase
  zeit: number
  saat: number
  /** Alles, was den Lauf beeinflusst. */
  rng: Rng
  /** Nur Optik. Getrennt, damit eine neue Partikelwolke nicht den Lauf veraendert. */
  rngOptik: Rng
  spieler: Spieler
  gegner: Pool<Gegner>
  geschosse: Pool<Geschoss>
  zonen: Pool<Zone>
  effekte: Pool<Effekt>
  feindSchuesse: Pool<FeindSchuss>
  kristalle: Pool<Kristall>
  partikel: Pool<Partikel>
  zahlen: Pool<SchadensZahl>
  gitter: RaumGitter
  kamera: { x: number; y: number }
  /** Erschuetterung, 0..1. Quadriert in den Ausschlag - siehe render/juice.ts. */
  trauma: number
  /** Globaler Bildblitz, 0..1. */
  blitz: number
  /** 1 = normale Zeit, 0 = eingefroren. Rampt beim Levelup herunter. */
  zeitskala: number
  levelWartet: number
  spawnSpeicher: number
  naechsterSchwarm: number
  /** Wie viele Bosswellen schon kamen - bestimmt, wer als naechstes auftritt. */
  bossNummer: number
  /** Die naechste Karte ist die Bossbelohnung - bessere Seltenheiten. */
  bossKarte: boolean
  /** Mit wem dieser Lauf gespielt wird. */
  charakter: Charakter
  /** Welcher Charakter auf dem Titelbild gerade angewaehlt ist. */
  charakterWahl: number
  /**
   * Freigeschaltete Charaktere.
   *
   * Das ist das *einzige*, was einen Lauf ueberdauert - und bewusst kein Wert,
   * sondern nur Zugang. Gaebe es dauerhafte Aufwertungen, wuerde eine
   * Bestenliste nur noch messen, wer am laengsten gespielt hat.
   */
  offen: string[]
  /** Punkte des beendeten Laufs. */
  punkte: number
  /** Bester bisher gespeicherter Wert - kommt von aussen herein. */
  bestwert: number
  /** Was dieser Lauf gerade freigeschaltet hat. */
  neuFreigeschaltet: CharakterId[]
  /**
   * Sekunden seit dem Tod - der Sprung im Glas waechst daran heran.
   *
   * Muss im Spielstand stehen und nicht im Zeichencode: Der Zeichner ist
   * zustandslos und weiss nicht, wann der Lauf geendet hat.
   */
  totSeit: number
  /**
   * Was in diesem Tick zu hoeren sein soll.
   *
   * Nur Meldungen - die Simulation spielt nichts ab und kennt keinen Browser.
   * `main.ts` leert den Puffer je Bild. Siehe `klaenge.ts`.
   */
  klaenge: Klangpuffer
  /** Ausgewaehlter Eintrag im Pausenmenue. */
  pauseWahl: number
  /**
   * Ton aus.
   *
   * Steht hier und nicht im Zeichencode, weil das Pausenmenue ihn umschaltet -
   * und das Menue liegt in der Spiellogik, damit es ohne Browser pruefbar
   * bleibt. `main.ts` liest das Feld, schaltet den Klang stumm und merkt es
   * sich. Ein `boolean` ist kein Browserwissen.
   */
  tonAus: boolean
  angebote: Aufwertung[]
  auswahl: number
  /** Stufen der passiven Gegenstaende. Waffenstufen stehen an der Waffe. */
  stufen: Map<string, number>
  /** Halber Bildschirmdurchmesser - der Spawner braucht ihn, kennt aber kein Canvas. */
  sichtRadius: number
  statistik: Statistik
  naechsteId: number
}

/** Wie lange der Spieler nach einem Treffer unverwundbar ist. */
const UNVERWUNDBAR = 0.55

/** Dauer der Zeitlupe, mit der das Levelup-Menue hereinkommt. */
const LEVELUP_RAMPE = 0.22

/** Der groesste Gegnerradius - so weit muss der Vorfilter greifen. */
const GROESSTER_GEGNER = 22

export function erzeugeSpielstand(saat: number): Spielstand {
  const spieler = erzeugeSpieler()
  spieler.waffen = [ruesteAus(WAFFE_START, 0)]
  return {
    phase: 'titel',
    zeit: 0,
    saat,
    rng: new Rng(saat),
    rngOptik: new Rng(saat).fork(),
    spieler,
    gegner: new Pool<Gegner>(leererGegner, 512),
    geschosse: new Pool<Geschoss>(leeresGeschoss, 128),
    zonen: new Pool<Zone>(leereZone, 8),
    effekte: new Pool<Effekt>(leererEffekt, 64),
    feindSchuesse: new Pool<FeindSchuss>(leererFeindSchuss, 64),
    kristalle: new Pool<Kristall>(leererKristall, 256),
    partikel: new Pool<Partikel>(leeresPartikel, 512),
    zahlen: new Pool<SchadensZahl>(leereZahl, 64),
    gitter: new RaumGitter(72),
    kamera: { x: 0, y: 0 },
    trauma: 0,
    blitz: 0,
    zeitskala: 1,
    levelWartet: 0,
    spawnSpeicher: 0,
    naechsterSchwarm: 42,
    bossNummer: 0,
    bossKarte: false,
    charakter: charakterMit('splitter'),
    charakterWahl: 0,
    offen: ['splitter'],
    punkte: 0,
    bestwert: 0,
    neuFreigeschaltet: [],
    totSeit: 0,
    klaenge: new Klangpuffer(),
    pauseWahl: 0,
    tonAus: false,
    angebote: [],
    auswahl: 0,
    stufen: new Map(),
    sichtRadius: 700,
    statistik: leereStatistik(),
    naechsteId: 1,
  }
}

/** Lauf zuruecksetzen, ohne den Zustand neu anzulegen (die Pools bleiben warm). */
export function starteLauf(s: Spielstand, saat = s.saat, charakter = s.charakter): void {
  s.phase = 'laufend'
  s.zeit = 0
  s.saat = saat
  s.charakter = charakter
  s.rng = new Rng(saat)
  s.rngOptik = new Rng(saat).fork()
  Object.assign(s.spieler, erzeugeSpieler())
  s.spieler.waffen = [ruesteAus(WAFFE_START, 0)]
  // Der Charakter kommt *nach* der Grundausstattung: Er darf die Startwaffe
  // ersetzen, den Guertel verkleinern und Werte umschreiben.
  charakter.anwenden(s.spieler, s.rng)

  s.klaenge.leeren()
  s.gegner.alleFreigeben()
  s.geschosse.alleFreigeben()
  s.zonen.alleFreigeben()
  s.effekte.alleFreigeben()
  s.feindSchuesse.alleFreigeben()
  s.kristalle.alleFreigeben()
  s.partikel.alleFreigeben()
  s.zahlen.alleFreigeben()
  s.kamera.x = 0
  s.kamera.y = 0
  s.trauma = 0
  s.blitz = 0
  s.zeitskala = 1
  s.levelWartet = 0
  s.spawnSpeicher = 0
  s.naechsterSchwarm = 42
  s.bossNummer = 0
  s.bossKarte = false
  s.angebote = []
  s.auswahl = 0
  s.stufen.clear()
  s.statistik = leereStatistik()

  // Erst *nach* der frischen Statistik beschriften. Vorher stand das hier
  // oben - und die Zeile darueber warf alle Namen sofort wieder weg, weshalb
  // die Auswertung am Ende "Platz 1" statt "Splitterwerfer" anzeigte.
  beschrifteSonderplaetze(s.statistik)
  for (const w of s.spieler.waffen) {
    s.statistik.platzName[w.platz] = w.def.name
    s.statistik.platzFarbe[w.platz] = w.def.farbe
  }
  s.naechsteId = 1
  startWelle(s)
}

// ---------------------------------------------------------------------------
// Ein Tick
// ---------------------------------------------------------------------------

/**
 * Wiederverwendetes Ergebnisarray fuer Gitterabfragen.
 *
 * ACHTUNG: Nur fuer Abfragen *dieser* Datei. Wer daraus eine zweite Abfrage
 * startet, waehrend hier noch iteriert wird, ueberschreibt die Liste unter den
 * eigenen Fuessen. Deshalb haben `welt.ts` und `verhalten.ts` eigene Arrays.
 */
const kandidaten: number[] = []

/** Eigenes Array fuer die Zonen - laeuft ausserhalb der Geschossschleife. */
const zonenTreffer: Gegner[] = []

export function tick(s: Spielstand, b: Befehle, dt: number): void {
  switch (s.phase) {
    case 'titel': {
      if (b.links) s.charakterWahl = (s.charakterWahl + CHARAKTERE.length - 1) % CHARAKTERE.length
      if (b.rechts) s.charakterWahl = (s.charakterWahl + 1) % CHARAKTERE.length
      if (!b.bestaetigen) return
      const gewaehlt = CHARAKTERE[s.charakterWahl]
      // Gesperrte lassen sich anschauen, aber nicht starten - die Bedingung
      // steht auf der Karte, damit man ein Ziel hat statt einer Sperre.
      if (s.offen.includes(gewaehlt.id)) starteLauf(s, s.saat, gewaehlt)
      return
    }

    case 'tot':
      s.totSeit += dt
      // Zurueck zur Auswahl statt sofort neu: Nach einem Lauf will man oft
      // einen anderen Charakter probieren - genau dafuer sind sie da.
      if (b.bestaetigen) s.phase = 'titel'
      return

    case 'pause':
      pauseTick(s, b)
      return

    case 'levelup':
      levelupTick(s, b, dt)
      return

    case 'laufend':
      laufendTick(s, b, dt)
      return
  }
}

/**
 * Was im Pausenmenue steht.
 *
 * Als Kennungen und nicht als Beschriftungen: Die Texte liegen in
 * `ui/strings.ts`, damit eine Uebersetzung ein Dateitausch bleibt und keine
 * Suchaktion durch die Spiellogik.
 */
export type PauseEintrag = 'weiter' | 'ton' | 'aufgeben' | 'auswahl'

export const PAUSE_EINTRAEGE: readonly PauseEintrag[] = ['weiter', 'ton', 'aufgeben', 'auswahl']

/**
 * Das Pausenmenue.
 *
 * Kein `dt`: Hier laeuft nichts. Genau das ist der Punkt einer Pause - und der
 * Grund, warum sie in der Spiellogik steht statt im Zeichencode. Waere sie im
 * Zeichencode, liefe die Simulation dahinter weiter.
 */
function pauseTick(s: Spielstand, b: Befehle): void {
  // Escape schliesst wieder - dieselbe Taste hin und zurueck.
  if (b.pause) {
    s.phase = 'laufend'
    return
  }

  const anzahl = PAUSE_EINTRAEGE.length
  if (b.hoch) s.pauseWahl = (s.pauseWahl + anzahl - 1) % anzahl
  if (b.runter) s.pauseWahl = (s.pauseWahl + 1) % anzahl
  if (b.wahl >= 0 && b.wahl < anzahl) s.pauseWahl = b.wahl
  if (!b.bestaetigen) return

  switch (PAUSE_EINTRAEGE[s.pauseWahl]) {
    case 'weiter':
      s.phase = 'laufend'
      return
    case 'ton':
      s.tonAus = !s.tonAus
      return
    case 'aufgeben':
      beendeLauf(s)
      return
    case 'auswahl':
      // Auch dieser Weg wertet den Lauf aus. Sonst waere die Charakterwahl das
      // Schlupfloch, durch das ein schlechter Lauf spurlos verschwindet.
      beendeLauf(s)
      s.phase = 'titel'
      return
  }
}

function laufendTick(s: Spielstand, b: Befehle, dt: number): void {
  // Vor allem anderen: Wer Escape drueckt, will *jetzt* anhalten und nicht
  // erst nach dem naechsten Treffer.
  if (b.pause) {
    s.phase = 'pause'
    s.pauseWahl = 0
    return
  }

  // Zeitlupe beim Levelup: Die Simulation rampt herunter, statt hart zu
  // stehen. Ein harter Schnitt mitten im Getuemmel liest sich als Ruckler,
  // eine Rampe von gut zwei Zehnteln als Absicht.
  if (s.levelWartet > 0) {
    s.levelWartet -= dt
    s.zeitskala = Math.max(0, s.levelWartet / LEVELUP_RAMPE)
    if (s.levelWartet <= 0) {
      aktualisiereOptik(s, dt)
      oeffneLevelup(s)
      return
    }
  }

  const sdt = dt * s.zeitskala
  s.zeit += sdt
  s.statistik.zeit = s.zeit

  // Erst ausloesen, dann laufen lassen: Ein Stoss soll noch in dem Tick
  // wirken, in dem die Taste faellt.
  const sp = s.spieler
  if (b.x !== 0 || b.y !== 0) {
    sp.blickX = b.x
    sp.blickY = b.y
  }
  if (b.bestaetigen && stosse(sp, b.x, b.y, sp.blickX, sp.blickY)) s.klaenge.melde('stoss')
  stossTick(sp, sdt)

  bewegeSpieler(sp, b.x, b.y, sdt)
  spawne(s, sdt)
  bossWelle(s)

  // Das Gitter wird zweimal gebaut: einmal fuer das Auseinanderdruecken der
  // Gegner, danach erneut mit den neuen Positionen fuer die Treffer. Ein
  // veraltetes Gitter bei der Trefferpruefung wuerde vereinzelt Schuesse
  // durchrutschen lassen - der Neuaufbau kostet weniger als dieser Fehler.
  gitterAufbauen(s)
  bewegeGegner(s, sdt)

  gitterAufbauen(s)
  feuereWaffen(s, sdt)
  bewegeGeschosse(s, sdt)
  zonenTick(s, sdt)
  bewegeFeindSchuesse(s, sdt)
  spielerKollision(s, sdt)

  // Vor dem Aufraeumen: Zersplitterte Gegner sollen noch ihre Kristalle
  // fallen lassen und in die Statistik zaehlen.
  arbeiteKaskadeAb(s)
  raeumeTote(s)
  entferneVerlorene(s)

  const ausbeute = aktualisiereKristalle(s, sdt)
  if (ausbeute > 0) {
    s.klaenge.melde('kristall')
    gibXp(s, ausbeute)
  }

  charakterTick(s, sdt)
  aktualisiereOptik(s, dt)
  folgeKamera(s, dt)

  if (s.spieler.hp <= 0) beendeLauf(s)
}

/**
 * Den Lauf abschliessen: Punkte, Freischaltungen, Bestwert.
 *
 * Herausgezogen, weil es seit dem Pausenmenue zwei Wege hierher gibt - Tod und
 * Aufgeben. Aufgeben fuehrt bewusst denselben Weg: Wer aufgibt, bekommt seine
 * Punkte und seine Freischaltungen, und der Lauf steht in der Wertung. Waere
 * es ein blosser Ausstieg, waere es der bequeme Weg, einen schlechten Lauf aus
 * der Bestenliste herauszuhalten.
 */
export function beendeLauf(s: Spielstand): void {
  s.klaenge.melde('zerbrochen')
  s.phase = 'tot'
  s.totSeit = 0
  s.trauma = 1
  s.blitz = 0.9
  s.punkte = punkteFuer(s.statistik, s.charakter.punkteFaktor)
  s.neuFreigeschaltet = freigeschaltetDurch(s.statistik, s.spieler).filter(
    (id) => !s.offen.includes(id),
  )
  for (const id of s.neuFreigeschaltet) s.offen.push(id)
  s.bestwert = Math.max(s.bestwert, s.punkte)
}

/**
 * Exportiert, weil die Kaskade und alle Verhalten darauf angewiesen sind:
 * Ohne aktuelles Gitter liefert jede Umkreisabfrage eine leere Liste - und
 * zwar lautlos. Wer die Simulation ausserhalb von `tick` benutzt (Tests,
 * Messungen), muss es vorher bauen.
 */
export function gitterAufbauen(s: Spielstand): void {
  const gitter = s.gitter
  gitter.leeren()
  const liste = s.gegner.aktiv
  // Der Index in `aktiv` ist der Schluessel. Er gilt nur, solange nichts
  // entfernt wird - deshalb laeuft `raeumeTote` erst nach allen Abfragen.
  for (let i = 0; i < liste.length; i++) gitter.einfuegen(liste[i].x, liste[i].y, i)
}

/** Wie stark sich ueberlappende Gegner auseinanderschieben. */
const TRENN_KRAFT = 165

/** Wiederverwendet, damit die Verhalten pro Tick nichts anlegen. */
const wunsch: Bewegung = { vx: 0, vy: 0 }

function bewegeGegner(s: Spielstand, dt: number): void {
  const liste = s.gegner.aktiv

  for (let i = 0; i < liste.length; i++) {
    const g = liste[i]
    risseAblaufen(g, dt)

    // Bosse bewegen sich nach eigenem Muster und draengen sich nicht: Sie sind
    // zu gross und zu schwer, um von der Trennkraft sinnvoll geschoben zu
    // werden - die anderen Gegner weichen ihnen ohnehin aus, weil der Boss im
    // Gitter steht.
    if (g.bossZustand !== null) {
      bossTick(s, g, dt)
      g.x += g.stossX * dt
      g.y += g.stossY * dt
      const bremse = Math.exp(-9 * dt)
      g.stossX *= bremse
      g.stossY *= bremse
      if (g.blitz > 0) g.blitz -= dt
      continue
    }

    // Was der Gegner *will* - je nach Art. Das Auseinanderdruecken kommt
    // danach unveraendert obendrauf: Die Wunschrichtung ist das Neue, die
    // Trennkraft ist gemessen und bleibt, wie sie ist.
    GEGNER_VERHALTEN[g.art.verhalten].bewege(s, g, dt, wunsch)
    let vx = wunsch.vx
    let vy = wunsch.vy

    // Auseinanderdruecken. Ohne das laufen alle Gegner exakt uebereinander,
    // und aus tausend Feinden wird optisch einer: Man sieht die Gefahr nicht
    // mehr und trifft mit einem Schuss alles.
    //
    // Reizvoll waere, hier auch die Zahl der *angesehenen* Kandidaten zu
    // deckeln - der Aufwand pro Gegner haenge dann nicht mehr an der Dichte.
    // Gemessen ist das ein klarer Rueckschritt (11,7 statt 4,5 ms pro Tick):
    // Wird die Trennkraft beschnitten, verklumpen die Gegner, und dann
    // liefert *jede* Gitterabfrage riesige Kandidatenlisten. Das
    // Auseinanderdruecken bezahlt seine eigene Rechenzeit. Nicht deckeln.
    const sichtweite = g.radius * 2.1
    s.gitter.abfragen(g.x, g.y, sichtweite, kandidaten)
    let geprueft = 0
    for (let k = 0; k < kandidaten.length && geprueft < 6; k++) {
      const j = kandidaten[k]
      if (j === i) continue
      const a = liste[j]
      if (a === undefined) continue
      const ax = g.x - a.x
      const ay = g.y - a.y
      const d2 = ax * ax + ay * ay
      const mindest = g.radius + a.radius
      if (d2 > mindest * mindest || d2 === 0) continue
      const d = Math.sqrt(d2)
      const kraft = ((mindest - d) / mindest) * TRENN_KRAFT
      vx += (ax / d) * kraft
      vy += (ay / d) * kraft
      geprueft++
    }

    g.x += (vx + g.stossX) * dt
    g.y += (vy + g.stossY) * dt
    // Rueckstoss aus Treffern klingt exponentiell ab.
    const daempfung = Math.exp(-9 * dt)
    g.stossX *= daempfung
    g.stossY *= daempfung
    if (g.blitz > 0) g.blitz -= dt
  }
}

/**
 * Waffen ausloesen.
 *
 * Diese Funktion weiss nichts mehr darueber, *wie* eine Waffe wirkt - das
 * steht in `verhalten.ts`. Sie kennt nur den Takt.
 */
function feuereWaffen(s: Spielstand, dt: number): void {
  const sp = s.spieler
  for (let i = 0; i < sp.waffen.length; i++) {
    const w = sp.waffen[i]
    const v = VERHALTEN[w.def.verhalten]

    v.dauernd?.(s, w, dt)
    if (v.feuern === undefined) continue

    w.abkling -= dt
    if (w.abkling > 0) continue

    // Kein Ziel: nicht feuern, aber auch keinen Vorrat aufstauen, der sich
    // spaeter auf einen Schlag entlaedt.
    const gefeuert = v.feuern(s, w)
    // Der Schussklang steht hier und nicht in den sechs Feuerfunktionen: eine
    // Stelle, an der wirklich *eine* Waffe ausloest.
    if (gefeuert) s.klaenge.melde('schuss')
    w.abkling = gefeuert ? w.werte.abklingzeit * sp.abklingMult : 0
  }
}

function bewegeGeschosse(s: Spielstand, dt: number): void {
  const geschosse = s.geschosse.aktiv
  const gegner = s.gegner.aktiv

  for (let i = geschosse.length - 1; i >= 0; i--) {
    const p = geschosse[i]

    if (p.zielsuche > 0) lenke(s, p, dt)

    p.x += p.vx * dt
    p.y += p.vy * dt
    p.leben -= dt
    if (p.leben <= 0) {
      // Eine Granate, die niemanden trifft, knallt trotzdem.
      if (p.explosionsRadius > 0) einschlag(s, p)
      s.geschosse.freigeben(i)
      continue
    }

    s.gitter.abfragen(p.x, p.y, p.radius + GROESSTER_GEGNER, kandidaten)
    let verbraucht = false

    for (let k = 0; k < kandidaten.length; k++) {
      const g = gegner[kandidaten[k]]
      if (g === undefined || g.tot || p.getroffen.has(g.id)) continue

      const dx = g.x - p.x
      const dy = g.y - p.y
      const reichweite = g.radius + p.radius
      if (dx * dx + dy * dy > reichweite * reichweite) continue

      const laenge = Math.hypot(p.vx, p.vy) || 1
      if (p.explosionsRadius > 0) {
        // Der Knall verteilt den Schaden - das Geschoss selbst richtet
        // nichts aus, sonst zaehlte der Treffer doppelt.
        einschlag(s, p)
        verbraucht = true
        break
      }

      verletzeGegner(
        s,
        g,
        p.schaden,
        p.platz,
        p.krit,
        (p.vx / laenge) * p.rueckstoss,
        (p.vy / laenge) * p.rueckstoss,
      )
      p.getroffen.add(g.id)
      // Schwarmnadeln teilen sich bei jedem Kill. Die Kette endet von selbst,
      // weil jede Tochter eine Teilung weniger mitbekommt.
      if (g.tot && p.spaltet > 0) spalte(s, p)

      if (p.durchschlag > 0) {
        p.durchschlag--
        continue
      }
      // Vollendete Pfeile prallen zum naechsten Gegner weiter, statt zu
      // vergehen. Klappt das nicht, ist das Geschoss verbraucht.
      if (p.prallt && prallWeiter(s, p)) break
      verbraucht = true
      break
    }

    if (verbraucht) s.geschosse.freigeben(i)
  }
}

/** Zielsuche: das Geschoss dreht sich hoechstens `zielsuche` je Sekunde. */
function lenke(s: Spielstand, p: Geschoss, dt: number): void {
  // Ueber eine oertliche Variable, nicht ueber das Feld: TypeScript kann eine
  // veraenderliche Eigenschaft nach der Pruefung nicht als "nicht null"
  // fuehren - jeder Funktionsaufruf koennte sie ja wieder gesetzt haben.
  let ziel = p.ziel

  // Pools recyceln Objekte - die ID beweist, dass es noch dasselbe Ziel ist.
  if (ziel === null || ziel.id !== p.zielId || ziel.tot) {
    ziel = naechsterGegner(s, p.x, p.y, 420)
    p.ziel = ziel
    p.zielId = ziel === null ? -1 : ziel.id
    if (ziel === null) return
  }

  const tempo = Math.hypot(p.vx, p.vy) || 1
  const jetzt = Math.atan2(p.vy, p.vx)
  let ab = Math.atan2(ziel.y - p.y, ziel.x - p.x) - jetzt
  while (ab > Math.PI) ab -= Math.PI * 2
  while (ab < -Math.PI) ab += Math.PI * 2

  const max = p.zielsuche * dt
  const neuWinkel = jetzt + Math.max(-max, Math.min(max, ab))
  p.vx = Math.cos(neuWinkel) * tempo
  p.vy = Math.sin(neuWinkel) * tempo
}

/** Nach einem Treffer auf den naechsten noch nicht getroffenen Gegner umlenken. */
function prallWeiter(s: Spielstand, p: Geschoss): boolean {
  gegnerImUmkreis(s, p.x, p.y, 280, zonenTreffer)
  let bester: Gegner | null = null
  let bestD2 = Infinity

  for (let i = 0; i < zonenTreffer.length; i++) {
    const g = zonenTreffer[i]
    if (p.getroffen.has(g.id)) continue
    const d2 = (g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y)
    if (d2 < bestD2) {
      bestD2 = d2
      bester = g
    }
  }
  if (bester === null) return false

  const tempo = Math.hypot(p.vx, p.vy) || 1
  const winkel = Math.atan2(bester.y - p.y, bester.x - p.x)
  p.vx = Math.cos(winkel) * tempo
  p.vy = Math.sin(winkel) * tempo
  p.ziel = bester
  p.zielId = bester.id
  return true
}

/**
 * Sog und Truemmerfelder.
 *
 * Laeuft ausserhalb der Geschossschleife und darf deshalb selbst Abfragen
 * starten - mit eigenem Ergebnisarray.
 */
function zonenTick(s: Spielstand, dt: number): void {
  const liste = s.zonen.aktiv

  for (let i = liste.length - 1; i >= 0; i--) {
    const z = liste[i]
    z.leben -= dt

    if (z.leben <= 0) {
      if (z.art === 'sog') platzeSingularitaet(s, z)
      s.zonen.freigeben(i)
      continue
    }

    if (z.feindlich) {
      feindZone(s, z, dt)
      continue
    }

    z.tickRest -= dt
    const taktet = z.tickRest <= 0
    if (taktet) z.tickRest = 0.22

    gegnerImUmkreis(s, z.x, z.y, z.radius, zonenTreffer)
    for (let k = 0; k < zonenTreffer.length; k++) {
      const g = zonenTreffer[k]

      if (z.sogKraft > 0) {
        const dx = z.x - g.x
        const dy = z.y - g.y
        const d = Math.hypot(dx, dy) || 1
        // Naeher am Zentrum zieht es staerker - dadurch entsteht der Klumpen,
        // der die Detonation danach so lohnend macht.
        const zug = z.sogKraft * (1 - Math.min(1, d / z.radius) * 0.4)
        g.stossX += (dx / d) * zug * dt
        g.stossY += (dy / d) * zug * dt
      }

      if (taktet) verletzeGegner(s, g, z.schaden, z.platz, false, 0, 0)
    }

    // Gewitterkern: Blitze zwischen den Gefangenen. Rein optisch - der Schaden
    // kommt schon aus dem Zonentakt. Ohne die Boegen saehe die Fusion aus wie
    // ein gewoehnliches schwarzes Loch, und der Spieler wuesste nicht, wofuer
    // er zwei ausgereizte Waffen hergegeben hat.
    if (z.gewitter && taktet && zonenTreffer.length > 1) {
      const bis = Math.min(5, zonenTreffer.length - 1)
      for (let k = 0; k < bis; k++) {
        const a = zonenTreffer[k]
        const bb = zonenTreffer[k + 1]
        const e = legeEffekt(s, 'strich', a.x, a.y, 0, 0.16, z.farbe, 2)
        if (e === null) break
        e.x2 = bb.x
        e.y2 = bb.y
      }
    }
  }
}

/** Das Loch platzt: alles im Umkreis bekommt die volle Ladung. */
function platzeSingularitaet(s: Spielstand, z: Zone): void {
  detoniere(s, z.x, z.y, z.radius, z.schaden * 6, z.platz, z.farbe)
  s.trauma = Math.min(1, s.trauma + 0.35)
  s.blitz = Math.max(s.blitz, 0.45)

  if (!z.truemmer) return
  // Vollendet bleibt ein Truemmerfeld stehen, das weiter Schaden tickt.
  const t = s.zonen.nimm()
  t.art = 'knall'
  t.x = z.x
  t.y = z.y
  t.radius = z.radius * 0.8
  t.maxRadius = t.radius
  t.leben = 4
  t.maxLeben = 4
  t.schaden = z.schaden * 0.5
  t.sogKraft = 0
  t.tickRest = 0
  t.platz = z.platz
  t.farbe = z.farbe
  t.truemmer = false
}

function raeumeTote(s: Spielstand): void {
  const liste = s.gegner.aktiv
  for (let i = liste.length - 1; i >= 0; i--) {
    const g = liste[i]
    if (!g.tot) continue

    legeKristall(s, g.x, g.y, g.xp)
    zerspringen(s, g.x, g.y, g.radius, g.art.farbe)
    s.statistik.kills++

    /*
     * Was der Gegner beim Sterben noch anstellt - der Teiler zerfaellt hier in
     * zwei Kleine.
     *
     * Die Schleife laeuft rueckwaerts, und `legeGegner` haengt hinten an. Der
     * naechste `freigeben(i)` tauscht das letzte Element auf Platz `i` - ein
     * eben gesetztes Bruchstueck kann also auf einem schon besuchten Index
     * landen. Das ist harmlos, weil es nicht tot ist und im naechsten Tick
     * ganz normal drankommt; nur mitdenken muss man es.
     */
    GEGNER_VERHALTEN[g.art.verhalten].beiTod?.(s, g)

    // Schleiferin: Nur Kills in Reichweite zaehlen. Das ist der ganze Punkt -
    // der Bonus zwingt dazu, im Gedraenge zu bleiben statt es zu umlaufen.
    const sp = s.spieler
    if (sp.schliffProNah > 0) {
      const dx = g.x - sp.x
      const dy = g.y - sp.y
      if (dx * dx + dy * dy <= SCHLIFF_NAEHE * SCHLIFF_NAEHE) {
        sp.schliff = Math.min(SCHLIFF_MAX, sp.schliff + sp.schliffProNah)
      }
    }
    s.trauma = Math.min(1, s.trauma + 0.012)

    if (g.bossZustand !== null) {
      s.klaenge.melde('boss')
      s.statistik.bosse++
      s.trauma = 1
      s.blitz = 0.9
      // Ein Boss muss sich lohnen: eine Karte sofort, mit deutlich besseren
      // Seltenheiten. Sie kommt zusaetzlich zum normalen Aufstieg.
      s.bossKarte = true
      if (s.levelWartet <= 0 && s.phase === 'laufend') s.levelWartet = LEVELUP_RAMPE
      g.bossZustand = null
    }

    s.gegner.freigeben(i)
  }
}

/**
 * Ein Treffer am Spieler - egal woher.
 *
 * Gebuendelt, weil es inzwischen drei Quellen gibt (Beruehrung, Bossgeschoss,
 * Schockring) und alle dieselben Unverwundbarkeitsfenster brauchen. Ohne das
 * koennte ein Schockring waehrend der Gnadenfrist trotzdem treffen, und der
 * Spieler stuerbe an etwas, gegen das er sich nicht wehren konnte.
 */
function trefferAmSpieler(s: Spielstand, schaden: number): void {
  const sp = s.spieler
  if (sp.unverwundbar > 0) return

  // Ein Treffer setzt den Stillstand zurueck - das ist die ganze Spannung des
  // Riss-Charakters: Sauber bleiben zahlt sich aus, ein Fehler kostet sofort.
  sp.stillstand = 0

  verletzeSpieler(sp, schaden)
  s.klaenge.melde('einschlag')
  sp.unverwundbar = UNVERWUNDBAR
  sp.blitz = 1
  s.trauma = Math.min(1, s.trauma + 0.45)
  s.blitz = Math.max(s.blitz, 0.5)
}

/** Bossgeschosse fliegen und pruefen gegen den Spieler - nicht gegen die Gegner. */
function bewegeFeindSchuesse(s: Spielstand, dt: number): void {
  const liste = s.feindSchuesse.aktiv
  const sp = s.spieler

  for (let i = liste.length - 1; i >= 0; i--) {
    const p = liste[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.leben -= dt
    if (p.leben <= 0) {
      s.feindSchuesse.freigeben(i)
      continue
    }

    const dx = p.x - sp.x
    const dy = p.y - sp.y
    const reichweite = p.radius + sp.radius
    if (dx * dx + dy * dy > reichweite * reichweite) continue

    trefferAmSpieler(s, p.schaden)
    s.feindSchuesse.freigeben(i)
  }
}

function spielerKollision(s: Spielstand, dt: number): void {
  const sp = s.spieler
  if (sp.unverwundbar > 0) {
    sp.unverwundbar -= dt
    return
  }

  s.gitter.abfragen(sp.x, sp.y, sp.radius + GROESSTER_GEGNER, kandidaten)
  const liste = s.gegner.aktiv

  for (let k = 0; k < kandidaten.length; k++) {
    const g = liste[kandidaten[k]]
    if (g === undefined || g.tot) continue
    const dx = g.x - sp.x
    const dy = g.y - sp.y
    const reichweite = g.radius + sp.radius
    if (dx * dx + dy * dy > reichweite * reichweite) continue

    trefferAmSpieler(s, g.schaden)
    return
  }
}

function aktualisiereOptik(s: Spielstand, dt: number): void {
  // Optik laeuft in echter Zeit, nicht in Spielzeit: Waehrend der Zeitlupe
  // sollen Partikel weiterlaufen, sonst friert das Bild sichtbar ein.
  const partikel = s.partikel.aktiv
  for (let i = partikel.length - 1; i >= 0; i--) {
    const p = partikel[i]
    p.leben -= dt
    if (p.leben <= 0) {
      s.partikel.freigeben(i)
      continue
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.drehung += p.drehTempo * dt
    const bremse = Math.exp(-4.5 * dt)
    p.vx *= bremse
    p.vy *= bremse
  }

  const effekte = s.effekte.aktiv
  for (let i = effekte.length - 1; i >= 0; i--) {
    effekte[i].leben -= dt
    if (effekte[i].leben <= 0) s.effekte.freigeben(i)
  }

  const zahlen = s.zahlen.aktiv
  for (let i = zahlen.length - 1; i >= 0; i--) {
    const z = zahlen[i]
    z.leben -= dt
    if (z.leben <= 0) {
      s.zahlen.freigeben(i)
      continue
    }
    z.y += z.vy * dt
    z.vy += 60 * dt
  }

  s.trauma = Math.max(0, s.trauma - dt * 1.5)
  s.blitz = Math.max(0, s.blitz - dt * 4)
  if (s.spieler.blitz > 0) s.spieler.blitz -= dt * 3
}

function folgeKamera(s: Spielstand, dt: number): void {
  // Weich nachziehen statt starr kleben. Eine fest zentrierte Kamera nimmt
  // dem Ausweichen jedes Gefuehl von Tempo.
  const faktor = 1 - Math.exp(-11 * dt)
  s.kamera.x += (s.spieler.x - s.kamera.x) * faktor
  s.kamera.y += (s.spieler.y - s.kamera.y) * faktor
}

// ---------------------------------------------------------------------------
// Levelup
// ---------------------------------------------------------------------------

export function gibXp(s: Spielstand, menge: number): void {
  const sp = s.spieler
  sp.xp += menge * sp.xpMult
  if (sp.xp < sp.xpNaechste || s.levelWartet > 0) return

  sp.xp -= sp.xpNaechste
  sp.level++
  sp.xpNaechste = xpFuerLevel(sp.level)
  s.statistik.level = sp.level
  s.blitz = Math.max(s.blitz, 0.55)
  s.levelWartet = LEVELUP_RAMPE
  s.klaenge.melde('stufe')
}

function oeffneLevelup(s: Spielstand): void {
  s.angebote = zieheAngebote(s, 3)
  s.auswahl = 0
  s.zeitskala = 0
  s.levelWartet = 0
  s.phase = 'levelup'
}

function levelupTick(s: Spielstand, b: Befehle, dt: number): void {
  // Die Optik laeuft weiter, damit das Bild hinter den Karten nicht tot wirkt.
  aktualisiereOptik(s, dt)

  if (s.angebote.length === 0) {
    schliesseLevelup(s)
    return
  }

  if (b.links) s.auswahl = (s.auswahl + s.angebote.length - 1) % s.angebote.length
  if (b.rechts) s.auswahl = (s.auswahl + 1) % s.angebote.length

  let gewaehlt = -1
  if (b.wahl >= 0 && b.wahl < s.angebote.length) gewaehlt = b.wahl
  else if (b.bestaetigen) gewaehlt = s.auswahl
  if (gewaehlt < 0) return

  s.angebote[gewaehlt].anwenden(s)
  schliesseLevelup(s)
}

function schliesseLevelup(s: Spielstand): void {
  s.angebote = []
  s.bossKarte = false
  s.zeitskala = 1
  s.phase = 'laufend'
  // Kurze Gnadenfrist: Direkt aus dem Menue in einen Treffer zu laufen, ohne
  // reagieren zu koennen, fuehlt sich nach Betrug an.
  s.spieler.unverwundbar = Math.max(s.spieler.unverwundbar, 0.35)
}

// ---------------------------------------------------------------------------
// Fabriken fuer die Pools
// ---------------------------------------------------------------------------
// Die Werte hier sind bedeutungslos - wer ein Objekt aus dem Pool nimmt,
// ueberschreibt jedes Feld.

function leererGegner(): Gegner {
  return {
    id: 0,
    x: 0,
    y: 0,
    hp: 1,
    maxHp: 1,
    art: null as unknown as GegnerArt,
    radius: 8,
    tempo: 0,
    schaden: 0,
    xp: 0,
    masse: 1,
    blitz: 0,
    stossX: 0,
    stossY: 0,
    tot: false,
    bossZustand: null,
    risseMaske: 0,
    risse: 0,
    risseZeit: 0,
    zersplittert: false,
    takt: 0,
    zustand: 0,
    merkX: 0,
    merkY: 0,
    blick: 0,
  }
}

function leeresGeschoss(): Geschoss {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    schaden: 0,
    radius: 3,
    durchschlag: 0,
    leben: 0,
    rueckstoss: 0,
    krit: false,
    platz: 0,
    farbe: FARBEN.geschoss,
    zielsuche: 0,
    ziel: null,
    zielId: -1,
    explosionsRadius: 0,
    nachwurf: 0,
    prallt: false,
    spaltet: 0,
    kollaps: false,
    getroffen: new Set<number>(),
  }
}

function leereZone(): Zone {
  return {
    art: 'sog',
    x: 0,
    y: 0,
    radius: 0,
    maxRadius: 0,
    leben: 0,
    maxLeben: 1,
    schaden: 0,
    sogKraft: 0,
    tickRest: 0,
    platz: 0,
    farbe: FARBEN.text,
    truemmer: false,
    feindlich: false,
    wachsend: false,
    gewitter: false,
  }
}

function leererFeindSchuss(): FeindSchuss {
  return { x: 0, y: 0, vx: 0, vy: 0, radius: 6, schaden: 0, leben: 0, farbe: FARBEN.gefahr }
}

function leererEffekt(): Effekt {
  return {
    art: 'ring',
    x: 0,
    y: 0,
    x2: 0,
    y2: 0,
    radius: 0,
    winkel: 0,
    spanne: 0,
    leben: 0,
    maxLeben: 1,
    farbe: FARBEN.text,
    breite: 2,
    warnung: false,
  }
}

function leererKristall(): Kristall {
  return { x: 0, y: 0, vx: 0, vy: 0, wert: 1, leben: 0, gezogen: false }
}

function leeresPartikel(): Partikel {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    leben: 0,
    maxLeben: 1,
    groesse: 2,
    farbe: '#fff',
    drehung: 0,
    drehTempo: 0,
  }
}

function leereZahl(): SchadensZahl {
  return { x: 0, y: 0, vy: 0, leben: 0, wert: 0, krit: false }
}

/**
 * Eine feindliche Zone - Schockringe des Bosses.
 *
 * Waechst sie, trifft nur das wandernde Band: In der Mitte ist man sicher.
 * Genau das macht den Angriff ausweichbar statt unentrinnbar, und dieser
 * Unterschied entscheidet, ob ein Boss schwer oder nur unfair wirkt.
 */
function feindZone(s: Spielstand, z: Zone, dt: number): void {
  const anteil = 1 - z.leben / z.maxLeben
  if (z.wachsend) z.radius = z.maxRadius * anteil

  const sp = s.spieler
  const abstand = Math.hypot(sp.x - z.x, sp.y - z.y)

  if (z.wachsend) {
    // Bandbreite grosszuegig genug, dass niemand zwischen zwei Bildern
    // hindurchrutscht, und schmal genug, dass Ausweichen zaehlt.
    const band = 26
    if (Math.abs(abstand - z.radius) > band + sp.radius) return
    trefferAmSpieler(s, z.schaden)
    return
  }

  if (abstand > z.radius + sp.radius) return
  z.tickRest -= dt
  if (z.tickRest > 0) return
  z.tickRest = 0.4
  trefferAmSpieler(s, z.schaden)
}

/**
 * Was beim Aufschlag einer Granate passiert.
 *
 * Der Kollaps reisst erst zusammen und detoniert dann - deshalb legt er ein
 * kurzlebiges Sog-Feld statt sofort zu knallen. Der Knall kommt, wenn das Feld
 * vergeht (`platzeSingularitaet`), und trifft dann einen Klumpen statt einer
 * verteilten Menge. Genau dieser Umweg ist der Unterschied zur Bazooka.
 */
function einschlag(s: Spielstand, p: Geschoss): void {
  if (!p.kollaps) {
    detoniere(s, p.x, p.y, p.explosionsRadius, p.schaden, p.platz, p.farbe, p.nachwurf)
    return
  }

  const z = s.zonen.nimm()
  z.art = 'sog'
  z.x = p.x
  z.y = p.y
  z.radius = p.explosionsRadius
  z.maxRadius = z.radius
  z.leben = 0.65
  z.maxLeben = 0.65
  // Der Sog selbst tut wenig weh - die Rechnung kommt beim Platzen.
  z.schaden = p.schaden * 0.2
  z.sogKraft = 900
  z.tickRest = 0
  z.platz = p.platz
  z.farbe = p.farbe
  z.truemmer = false
  z.feindlich = false
  z.wachsend = false
  z.gewitter = false
}

/** Eine Nadel teilt sich - jede Tochter mit einer Teilung weniger. */
function spalte(s: Spielstand, p: Geschoss): void {
  const tempo = Math.hypot(p.vx, p.vy) || 1
  for (let i = 0; i < p.spaltet; i++) {
    if (s.geschosse.anzahl > 400) return
    const winkel = s.rng.range(0, Math.PI * 2)
    const kind = s.geschosse.nimm()
    kind.x = p.x
    kind.y = p.y
    kind.vx = Math.cos(winkel) * tempo
    kind.vy = Math.sin(winkel) * tempo
    kind.schaden = Math.max(1, Math.floor(p.schaden * 0.6))
    kind.krit = false
    kind.radius = p.radius * 0.85
    kind.durchschlag = 0
    kind.leben = p.leben * 0.7
    kind.rueckstoss = p.rueckstoss * 0.6
    kind.platz = p.platz
    kind.farbe = p.farbe
    kind.zielsuche = p.zielsuche
    kind.ziel = null
    kind.zielId = -1
    kind.explosionsRadius = 0
    kind.nachwurf = 0
    kind.prallt = false
    kind.spaltet = p.spaltet - 1
    kind.kollaps = false
    kind.getroffen.clear()
  }
}

function leereStatistik(): Statistik {
  return {
    kills: 0,
    level: 1,
    zeit: 0,
    schaden: 0,
    zersplittert: 0,
    bosse: 0,
    // Drei Plaetze mehr als Waffen: Scherben, Geisterriss und Dornen.
    schadenProPlatz: new Array(PLATZ_ANZAHL).fill(0),
    platzName: new Array(PLATZ_ANZAHL).fill(''),
    platzFarbe: new Array(PLATZ_ANZAHL).fill(FARBEN.textSchwach),
  }
}

/**
 * Namen der Sonderplaetze eintragen.
 *
 * Die Scherben bekommen einen eigenen Balken in der Auswertung - man soll
 * sehen, wie viel die Kernregel tatsaechlich beitraegt, statt es zu glauben.
 */
function beschrifteSonderplaetze(st: Statistik): void {
  st.platzName[SPLITTER_PLATZ] = 'Scherben'
  st.platzFarbe[SPLITTER_PLATZ] = FARBEN.treffer
  st.platzName[GEIST_PLATZ] = 'Geisterriss'
  st.platzFarbe[GEIST_PLATZ] = SELTENHEIT_FARBE.legendaer
  st.platzName[DORNEN_PLATZ] = 'Dornen'
  st.platzFarbe[DORNEN_PLATZ] = FARBEN.gefahr
}

/**
 * Charakter-Mechaniken: Schliff und Stillstand.
 *
 * Beide sind reine Zeitzaehler und kosten bei allen anderen Charakteren genau
 * eine Abfrage - deshalb stehen sie hier und nicht als Sonderfaelle verstreut
 * im uebrigen Code.
 */
function charakterTick(s: Spielstand, dt: number): void {
  const sp = s.spieler

  if (sp.schliffProNah > 0 && sp.schliff > 0) {
    sp.schliff = Math.max(0, sp.schliff - SCHLIFF_ZERFALL * dt)
  }

  if (sp.stillstandSchwelle > 0) sp.stillstand += dt

  // Koloss: verletzt alles, was ihn beruehrt. Eigener Durchgang, weil die
  // normale Spielerkollision nach dem ersten Treffer abbricht - hier soll
  // dagegen der ganze Pulk etwas abbekommen.
  if (sp.dornen > 0) {
    gegnerImUmkreis(s, sp.x, sp.y, sp.radius + 16, zonenTreffer)
    for (let i = 0; i < zonenTreffer.length; i++) {
      const g = zonenTreffer[i]
      const dx = g.x - sp.x
      const dy = g.y - sp.y
      const laenge = Math.hypot(dx, dy) || 1
      verletzeGegner(
        s,
        g,
        sp.dornen * dt,
        DORNEN_PLATZ,
        false,
        (dx / laenge) * 40,
        (dy / laenge) * 40,
      )
    }
  }
}
