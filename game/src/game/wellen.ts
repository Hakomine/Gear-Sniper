/**
 * Stösse ins Feld - als Meldung, nicht als Zeichnung.
 *
 * Dasselbe Muster wie `klaenge.ts`, aus demselben Grund: `src/game/` kennt
 * keinen Browser, und darauf beruhen die Tests ohne Fenster und `npm run perf`.
 * Die Simulation *meldet* nur, wo etwas geknallt hat; `render/gitter.ts` leert
 * den Puffer je Bild und schiebt damit sein Federnetz an.
 *
 * Der Nutzen ist die halbe Bildsprache dieser Runde: Ein Boden, der bei jeder
 * Zersplitterung wellt, ist keine Zeichnung mehr, sondern eine Oberflaeche.
 * Und weil das Netz rein optisch ist, laeuft es ueber `rngOptik`-freie Physik -
 * es veraendert den Lauf nicht und muss deshalb auch nicht deterministisch
 * sein.
 */

/**
 * Wie viele Stoesse ein Bild fasst.
 *
 * Eine Kettenreaktion kann in einem Tick dutzende Zersplitterungen ausloesen.
 * Alle ins Netz zu geben waere sinnlos - ab einem gewissen Punkt wellt es
 * ohnehin ueberall. Was darueber hinausgeht, faellt weg.
 */
const KAPAZITAET = 64

export class Wellenpuffer {
  /** Parallel gefuehrte Felder statt einer Objektliste - kein Muell je Meldung. */
  private readonly xs = new Float32Array(KAPAZITAET)
  private readonly ys = new Float32Array(KAPAZITAET)
  private readonly staerken = new Float32Array(KAPAZITAET)
  private readonly radien = new Float32Array(KAPAZITAET)
  private anzahl = 0
  /** Wie viele der Deckel geschluckt hat - nur fuer Tests. */
  verworfen = 0

  /**
   * Einen Stoss melden.
   *
   * `staerke` ist der Ausschlag in Weltpunkten, `radius` wie weit er reicht.
   * Beides in denselben Einheiten wie alles andere im Spiel, damit man am
   * Aufrufort abschaetzen kann, was passiert.
   */
  melde(x: number, y: number, staerke: number, radius: number): void {
    if (this.anzahl >= KAPAZITAET) {
      this.verworfen++
      return
    }
    this.xs[this.anzahl] = x
    this.ys[this.anzahl] = y
    this.staerken[this.anzahl] = staerke
    this.radien[this.anzahl] = radius
    this.anzahl++
  }

  get laenge(): number {
    return this.anzahl
  }

  lies(i: number): { x: number; y: number; staerke: number; radius: number } {
    return { x: this.xs[i], y: this.ys[i], staerke: this.staerken[i], radius: this.radien[i] }
  }

  leeren(): void {
    this.anzahl = 0
    this.verworfen = 0
  }
}
