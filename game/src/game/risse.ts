import type { Gegner } from './state'

/**
 * Risse und Zersplitterung - die eigene Regel dieses Spiels.
 *
 * Gegner sind hier Glas, kein Fleisch. Jede Waffe hinterlaesst einen Riss,
 * aber nur eine Waffe, die noch keinen gesetzt hat: Fuenf Treffer derselben
 * Waffe bleiben ein Riss. Drei Risse von drei *verschiedenen* Waffen lassen
 * den Gegner zerspringen, und die Scherben reissen die Nachbarn mit.
 *
 * Warum diese Regel und nicht noch ein Multiplikator: Sie macht aus "welche
 * Waffe hat die groesste Zahl" die Frage "was passt zu dem, was ich schon
 * trage". Der staerkste Bau ist damit eine Mischung, nicht fuenfmal dasselbe -
 * und genau das ist der Reiz, den das Genre braucht.
 *
 * Diese Datei fuehrt nur Buch. Schaden auszuteilen ist Sache von `welt.ts`,
 * sonst muessten sich beide Dateien gegenseitig importieren.
 */

/** Wie lange ein Riss offen bleibt, wenn nichts nachkommt. */
export const RISS_FENSTER = 1.6

/** Kuerzestes Rissfenster, das es geben darf - siehe `rissSetzen`. */
export const RISS_MINDEST = 0.45

/** Ab so vielen verschiedenen Waffen zersplittert der Gegner. */
export const RISS_SCHWELLE = 3

/** Wie viel mehr Schaden ein Gegner je offenem Riss nimmt. */
export const RISS_BONUS = 0.3

/**
 * Wie hart das Zersplittern zuschlaegt - Anteil der vollen Trefferpunkte.
 *
 * Bewusst *kein* garantierter Sofort-Tod, obwohl das griffiger klaenge: Ein
 * Elite-Gegner mit dreitausend Trefferpunkten waere sonst erledigt, sobald ihn
 * drei Waffen streifen. Damit waere der zaeheste Gegnertyp ab der ersten
 * Minute bedeutungslos. 60 Prozent toeten alles Normale ohnehin - es ist die
 * Zahl, die sich wie ein Sofort-Tod anfuehlt, ohne einer zu sein.
 */
export const ZERSPLITTER_ANTEIL = 0.6

/**
 * Was eine Zersplitterung an einem Boss abraeumt.
 *
 * Deutlich weniger - und dafuer beliebig oft. Gemessen mit den vollen 60
 * Prozent fiel jeder Boss in ungefaehr zwoelf Sekunden, weil ein einziger
 * Splitter mehr als die Haelfte seiner Leiste nahm und die zweite Phase
 * praktisch uebersprungen wurde. Ein Boss soll die Kernregel *belohnen*, nicht
 * an ihr zerplatzen.
 *
 * Der Boss darf dafuer als Einziger mehrfach zerspringen: Die Risse werden
 * danach geloescht und muessen komplett neu gesetzt werden. Damit wird der
 * gemischte Bau ueber den ganzen Kampf hinweg belohnt statt einmal am Anfang.
 */
export const BOSS_ZERSPLITTER_ANTEIL = 0.15

/** Wie weit die Scherben fliegen. */
export const ZERSPLITTER_RADIUS = 88

/** Wie viel vom Splitterschaden bei den Nachbarn ankommt. */
export const ZERSPLITTER_NACHBAR_ANTEIL = 0.45

/**
 * Wie tief sich eine Kettenreaktion fortpflanzen darf.
 *
 * Ohne Grenze laeuft sie in einem dichten Pulk durch das halbe Feld. Drei
 * Stufen sind spuerbar spektakulaer und trotzdem berechenbar. Genau hier
 * liesse sich spaeter eine sehr gute legendaere Aufwertung ansetzen: eine
 * Stufe mehr.
 */
export const KASKADE_MAX_TIEFE = 3

/**
 * Was Risse tragen kann.
 *
 * Lange war das ausschliesslich ein `Gegner`. Mit der Kernscherbe zeigt die
 * Kernregel zum ersten Mal auf den *Spieler*: Sie ist selbst aus Glas, und
 * drei Treffer von drei verschiedenen Gegnerarten lassen sie zerspringen.
 *
 * Beide Seiten tragen ohnehin genau diese drei Felder, deshalb reicht der
 * schmale Typ. Er ist auch die ehrlichere Ansage als ein zweiter Satz
 * Riss-Funktionen: Es gibt *eine* Buchfuehrung fuer Risse im ganzen Spiel, und
 * wer sie fuehrt, ist ihr egal.
 */
export type Rissbar = {
  risseMaske: number
  risse: number
  risseZeit: number
}

/**
 * Das Rissfenster der Kernscherbe.
 *
 * Deutlich laenger als das der Gegner, und das muss so sein: Nach einem
 * Treffer ist der Spieler 0,55 s unverwundbar, drei Treffer brauchen also
 * mindestens 1,1 s - mit 1,6 s Fenster waere die Mechanik entweder nie zu
 * sehen oder nur durch pures Pech. Vier Sekunden sind erreichbar, aber nicht
 * geschenkt.
 */
export const GLAS_FENSTER = 4

/**
 * Einen Riss setzen. Gibt zurueck, ob es ein *neuer* war.
 *
 * `platz` ist der Guertelplatz der Waffe, nicht der einzelne Treffer - so
 * zaehlt eine Waffe genau einmal, egal wie oft sie trifft. Explosionen und
 * Splitter erben den Platz ihres Verursachers, sonst waeren Bazooka-Geschoss
 * und Bazooka-Knall zwei verschiedene Waffen und die Regel waere ausgehebelt.
 *
 * Am Spieler steht statt des Guertelplatzes der Index der *Gegnerart* - siehe
 * `artIndex` in `enemies.ts`. Dieselbe Rechnung, andere Richtung.
 */
export function rissSetzen(g: Rissbar, platz: number, zusatz = 0): boolean {
  // Ein Bit je Guertelplatz. Ein `Set` pro Gegner waere bei 1400 Gegnern
  // genau die Sorte Muell, die die Pools an anderer Stelle vermeiden - fuenf
  // Plaetze passen in fuenf Bits, und Pruefen wie Setzen sind je eine
  // Operation.
  const bit = 1 << platz
  /*
   * `zusatz` kommt vom Spieler und kann in beide Richtungen gehen.
   *
   * Er steht als Parameter da und nicht als Blick in den Spielstand, damit
   * diese Datei rein bleibt: Sie rechnet Risse, sie kennt keinen Spieler.
   * Positiv ist er beim Gegenstand "Nachhall", negativ bei der Verhexung
   * "Enge" - dieselbe Zeile, beide Richtungen, keine zweite Stelle zum
   * Vergessen.
   *
   * Die Untergrenze ist kein Zierrat: Ein Fenster von null Sekunden hiesse,
   * dass die Kernregel gar nicht mehr ausloest, und ein Lauf ohne
   * Zersplitterung ist kein schwerer Lauf, sondern ein kaputter.
   */
  g.risseZeit = Math.max(RISS_MINDEST, RISS_FENSTER + zusatz)

  if ((g.risseMaske & bit) !== 0) return false
  g.risseMaske |= bit
  g.risse++
  return true
}

/** Schadensfaktor aus den offenen Rissen. */
export function rissBonus(g: Gegner): number {
  return 1 + g.risse * RISS_BONUS
}

export function zersplitterBereit(g: Gegner): boolean {
  return g.risse >= RISS_SCHWELLE && !g.zersplittert
}

/** Risse verfallen lassen. Wird einmal je Gegner und Tick aufgerufen. */
export function risseAblaufen(g: Rissbar, dt: number): void {
  if (g.risseZeit <= 0) return
  g.risseZeit -= dt
  if (g.risseZeit > 0) return
  risseLoeschen(g)
}

export function risseLoeschen(g: Rissbar): void {
  g.risseMaske = 0
  g.risse = 0
  g.risseZeit = 0
}
