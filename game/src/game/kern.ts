import { FARBEN } from '../render/palette'
import type { BossArt, BossZustand } from './bosse'
import { verfuegbareArten } from './enemies'
import { risseLoeschen } from './risse'
import { legeGegner } from './spawner'
import type { Gegner, Spielstand } from './state'
import { legeEffekt, legeZone } from './welt'

/**
 * Der Kern - das Ende des Laufs.
 *
 * Bis hierher hoerte ein Lauf auf, wenn man starb, und sonst nie. Etappen und
 * Bosse gaben ihm einen Takt, aber kein Ziel, und eine Bestenliste ohne Ziel
 * misst am Ende Sitzfleisch: Die hoechste Punktzahl gehoert dem, der am
 * laengsten stillhalten konnte. Genau der Fehler, den dieses Spiel bei den
 * dauerhaften Aufwertungen bewusst vermeidet.
 *
 * Nach der sechsten Etappe steht deshalb ein Tor mit zwei Seiten: **zum Kern**
 * - hier endet der Lauf, so oder so - oder **tiefer ins Feld**, mit einer
 * Stufe Zerruettung. Der Ausstieg ist eine Entscheidung, kein Zeitablauf.
 *
 * ## Warum er anders ist als jeder andere Boss
 *
 * **Gewoehnlicher Schaden kratzt ihn kaum. Nur Zersplitterung toetet ihn.**
 *
 * - Er nimmt ein Zehntel des normalen Schadens.
 * - Jede Zersplitterung nimmt ihm zwoelf Prozent seiner vollen Trefferpunkte.
 * - Alle sechs Sekunden **kittet er sich selbst**: alle Risse weg, mit
 *   Vorwarnung.
 *
 * Damit ist der Endkampf eine Pruefung auf die eine Regel, die das Spiel die
 * ganze Zeit lehrt. Die zehn Prozent sind die Fairness-Klausel: Ein Bau ohne
 * Mischung schafft ihn auch, nur langsam. Es gibt keine Sackgasse, in der ein
 * Lauf unloesbar wird - das waere die schlechteste Art, ein Ende zu bauen.
 *
 * Drei **Schalen** statt zweier Phasen. Jede bricht mit einem
 * Unverwundbarkeitsfenster, einem Ring aus Gegnern und einem Angriff mehr.
 */

/** Nach welcher Etappe das Kern-Tor steht. */
export const KERN_ETAPPE = 6

/** Was ein Sieg an Punkten einbringt. */
export const KERN_PUNKTE = 4000

/** Sekunden zwischen zwei Selbstkittungen und wie lange sie vorher ansagt. */
export const KERN_KITT_TAKT = 6
export const KERN_KITT_WARNUNG = 1.2

/** Wie lange er nach einem Schalenbruch unverwundbar bleibt. */
export const SCHALEN_GNADE = 2

/** Wie viele Gegner ein brechender Schale ausspuckt. */
const SCHALEN_RING = 30

/** Die Bruchwelle: Radius, Lebensdauer und wie breit ihre Luecke ist. */
const WELLE_RADIUS = 620
const WELLE_DAUER = 1.6
const WELLE_LUECKE = 0.42

export const KERN: BossArt = {
  id: 'kern',
  name: 'Der Kern',
  farbe: '#ffd24a',
  radius: 88,
  /*
   * Bewusst niedrig fuer einen Endgegner - und das ist kein Versehen.
   *
   * Seine Zaehigkeit steckt nicht in der Zahl, sondern in der Daempfung: Bei
   * einem Zehntel Schaden entspricht das effektiv dem Zwanzigfachen. Die Zahl
   * niedrig zu halten ist wichtig, weil die *Zersplitterung* einen festen
   * Anteil davon abraeumt - waere sie riesig, waere auch der Anteil riesig,
   * und der Kampf haette zwei voellig verschiedene Laengen je nach Bau.
   */
  hp: 2600,
  tempo: 26,
  schaden: 46,
  xp: 900,
  angriffe: ['bruchwelle', 'ringe', 'speichen', 'ruf', 'sturm'],
  // Die Schalen ersetzen den Phasenwechsel. Die Schwelle steht so, dass sie
  // nie greift - sonst liefe beides uebereinander.
  phaseSchwelle: -1,
  takt: 2.2,
  daempfung: 0.1,
  splitterAnteil: 0.12,
  kittTakt: KERN_KITT_TAKT,
  schalen: 3,
  istKern: true,
}

/**
 * Welche Angriffe der Kern in seiner aktuellen Schale schon kann.
 *
 * Er faengt mit zweien an und bekommt je gebrochener Schale einen dazu. Ein
 * Endgegner, der von der ersten Sekunde an alles auffaehrt, ist nicht schwer,
 * sondern unlesbar - man lernt nichts, man wird nur ueberrollt.
 */
export function kernAngriffe(z: BossZustand): number {
  const gebrochen = (z.art.schalen ?? 0) - z.schale
  return Math.min(z.art.angriffe.length, 2 + gebrochen)
}

/**
 * Die Selbstkittung: Vorwarnung, dann sind alle Risse weg.
 *
 * Der eigentliche Kampf. Drei verschiedene Waffen muessen *innerhalb* eines
 * Kittfensters greifen - wer sechs Waffen traegt, hat es leicht, wer zwei
 * ausgereizte traegt, muss die Zersplitterung anders herstellen. Genau die
 * Frage, die das ganze Spiel stellt, einmal ohne Ausweg.
 */
export function kittTick(s: Spielstand, g: Gegner, z: BossZustand, dt: number): void {
  if (z.art.kittTakt === undefined) return
  z.kittRest -= dt

  if (!z.kittGemeldet && z.kittRest <= KERN_KITT_WARNUNG) {
    z.kittGemeldet = true
    s.klaenge.melde('warnung', 0.9)
    const e = legeEffekt(s, 'ring', g.x, g.y, g.radius * 3.4, KERN_KITT_WARNUNG, '#63d4ff', 5)
    if (e !== null) e.warnung = true
  }

  if (z.kittRest > 0) return
  z.kittRest = z.art.kittTakt
  z.kittGemeldet = false
  // Nichts anderes - kein Schaden, keine Heilung. Er nimmt einem genau das
  // weg, worauf man hingearbeitet hat.
  risseLoeschen(g)
  legeEffekt(s, 'ring', g.x, g.y, g.radius * 1.6, 0.4, '#63d4ff', 4)
}

/**
 * Eine Schale bricht.
 *
 * Unverwundbar, ein Ring aus Gegnern, ein Angriff mehr - und das Bild wackelt.
 * Der Ring ist der Grund, warum ein Schalenbruch etwas *aendert* statt nur
 * eine Zahl zu senken: Er stellt den Spieler in einen frischen Pulk, mitten in
 * dem Moment, in dem er glaubt, gewonnen zu haben.
 */
export function schalenBruch(s: Spielstand, g: Gegner, z: BossZustand): void {
  z.schale--
  z.unverwundbar = SCHALEN_GNADE
  z.telegraf = 0
  z.angriff = null
  z.abkling = SCHALEN_GNADE
  z.kittRest = z.art.kittTakt ?? 0
  z.kittGemeldet = false

  s.blitz = Math.max(s.blitz, 0.85)
  s.trauma = 1
  s.klaenge.melde('boss', 1.3)
  legeEffekt(s, 'ring', g.x, g.y, g.radius * 6, 0.9, KERN.farbe, 6)

  const arten = verfuegbareArten(s.zeit)
  const art = arten[arten.length - 1]
  for (let i = 0; i < SCHALEN_RING; i++) {
    const w = (i / SCHALEN_RING) * Math.PI * 2
    const r = 240 + (i % 3) * 45
    // Blank, ohne Zeichen: Ein Ring aus dreissig gezeichneten Gegnern waere
    // keine Ansage mehr, sondern eine Wand.
    legeGegner(s, art, s.spieler.x + Math.cos(w) * r, s.spieler.y + Math.sin(w) * r)
  }
}

/**
 * Die Bruchwelle - der einzige Angriff, durch den man hindurch muss.
 *
 * Ein wachsender Ring mit *einer* Luecke. Ausweichen im ueblichen Sinn geht
 * nicht: Der Ring holt jeden ein, egal wie weit man laeuft. Man muss die
 * Luecke finden - oder hindurchstossen, und dann kostet es die Abklingzeit des
 * Stosses. Damit hat der Endgegner einen Angriff, der die beiden Verben des
 * Spiels gegeneinander stellt, statt nur Schaden zu verteilen.
 */
export function bruchwelle(s: Spielstand, g: Gegner, z: BossZustand): void {
  const welle = legeZone(s, 'knall', g.x, g.y, WELLE_RADIUS, WELLE_DAUER, z.art.schaden, -1, KERN.farbe)
  welle.feindlich = true
  welle.wachsend = true
  // Die Luecke zeigt bewusst *nicht* auf den Spieler: Sonst waere der Angriff
  // geschenkt. Sie liegt zufaellig, und man hat die Wachstumszeit, sie zu
  // erreichen.
  welle.luecke = s.rng.next() * Math.PI * 2
  welle.lueckeBreite = WELLE_LUECKE
  s.trauma = Math.min(1, s.trauma + 0.25)
}

/** Die Luecke ankuendigen, bevor die Welle laeuft. */
export function kuendigeBruchwelleAn(s: Spielstand, g: Gegner): void {
  const e = legeEffekt(s, 'ring', g.x, g.y, WELLE_RADIUS * 0.5, 1.1, FARBEN.gefahr, 5)
  if (e !== null) e.warnung = true
}
