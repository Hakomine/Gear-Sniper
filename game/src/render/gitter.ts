import type { Spielstand } from '../game/state'
import { FARBEN, mitAlpha } from './palette'

/**
 * Der Boden als Federnetz.
 *
 * Vorher lag hier ein regelmaessiges Raster aus duennen Linien auf einer
 * einfarbigen Flaeche - also genau die Standardszene, die jede Engine im
 * leeren Projekt zeigt. Es bewegte sich nie, es reagierte auf nichts, und es
 * war der groesste einzelne Grund, warum das Spiel nach Prototyp aussah.
 *
 * Jetzt ist es ein Netz aus Knoten, die jeweils eine Ruhelage, eine Auslenkung
 * und eine Geschwindigkeit haben. Jede Zersplitterung, jeder Bossangriff, jeder
 * Stoss drueckt sie auseinander, eine Federkraft zieht sie zurueck. Der Boden
 * *wellt*, wo etwas passiert ist - und leuchtet dabei auf.
 *
 * Der Griff stammt aus Geometry Wars, wo genau dieses Netz das halbe Bild
 * traegt. Er ist fuer dieses Projekt ideal, weil er reine Mathematik ist: kein
 * Bild, keine Datei, keine Lizenz.
 *
 * **Woher die Stoesse kommen:** aus `game/wellen.ts`. Die Simulation meldet
 * nur, wo etwas geknallt hat - dieselbe Trennung wie beim Ton. `src/game/`
 * bleibt browserfrei.
 */

/** Abstand zweier Knoten in Weltpunkten. */
const SCHRITT = 56

/**
 * Wie viele Knoten das Netz vorhaelt.
 *
 * Der sichtbare Weltausschnitt ist rund 950 x 535 Punkte gross, das sind 17 x
 * 10 Felder. Mit Rand fuer die Kamerabewegung und fuer Wellen, die von
 * ausserhalb hereinlaufen: 22 x 14.
 */
const SPALTEN = 22
const ZEILEN = 14

/** Federkraft zurueck in die Ruhelage und wie schnell die Bewegung ausklingt. */
const FEDER = 58
const DAEMPFUNG = 5.2

/** Wie weit ein Knoten hoechstens ausgelenkt wird - sonst zerreisst das Netz. */
const MAX_AUSLENKUNG = 46

/** Ab dieser Auslenkung leuchtet eine Linie hell auf. */
const GLUEH_SCHWELLE = 3

/** Jede vierte Linie ist die kraeftige - das gibt dem Netz einen Takt. */
const STARK_JEDE = 4

export class Federnetz {
  /** Auslenkung und Geschwindigkeit je Knoten, in zwei flachen Feldern. */
  private readonly dx = new Float32Array(SPALTEN * ZEILEN)
  private readonly dy = new Float32Array(SPALTEN * ZEILEN)
  private readonly vx = new Float32Array(SPALTEN * ZEILEN)
  private readonly vy = new Float32Array(SPALTEN * ZEILEN)

  /**
   * Welches Weltfeld gerade in der linken oberen Ecke steht.
   *
   * Das Netz ist an *Weltkoordinaten* verankert, nicht an der Kamera. Ohne das
   * wuerde eine Welle mit dem Spieler mitwandern statt an ihrem Ort zu bleiben
   * - und dann waere es wieder nur eine Tapete.
   */
  private ankerX = 0
  private ankerY = 0
  private erstesBild = true

  /**
   * Einen Stoss ins Netz geben.
   *
   * Nur die Knoten im Umkreis werden angefasst: Der Indexkasten wird vorher
   * ausgerechnet, statt ueber alle 308 zu laufen. Bei einer Kettenreaktion mit
   * dutzenden Zersplitterungen im selben Bild macht das den Unterschied.
   */
  stosse(weltX: number, weltY: number, staerke: number, radius: number): void {
    const vonS = Math.max(0, Math.floor((weltX - radius) / SCHRITT) - this.ankerX)
    const bisS = Math.min(SPALTEN - 1, Math.ceil((weltX + radius) / SCHRITT) - this.ankerX)
    const vonZ = Math.max(0, Math.floor((weltY - radius) / SCHRITT) - this.ankerY)
    const bisZ = Math.min(ZEILEN - 1, Math.ceil((weltY + radius) / SCHRITT) - this.ankerY)

    for (let z = vonZ; z <= bisZ; z++) {
      for (let sp = vonS; sp <= bisS; sp++) {
        const kx = (this.ankerX + sp) * SCHRITT
        const ky = (this.ankerY + z) * SCHRITT
        const ax = kx - weltX
        const ay = ky - weltY
        const d = Math.hypot(ax, ay)
        if (d > radius) continue

        // Weiche Abnahme nach aussen: Ein harter Rand liest sich als Kreis,
        // eine weiche Flanke als Welle.
        const anteil = 1 - d / radius
        const kraft = (staerke * anteil * anteil) / Math.max(18, d)
        const i = z * SPALTEN + sp
        this.vx[i] += ax * kraft
        this.vy[i] += ay * kraft
      }
    }
  }

  /**
   * Federn, daempfen, mitscrollen.
   *
   * Halb-implizit integriert: erst die Kraft auf die Geschwindigkeit, dann die
   * Geschwindigkeit auf die Auslenkung. Das ist bei Federn stabil, wo das
   * naive Verfahren aufschaukelt - und es sind dieselben zwei Zeilen.
   */
  tick(kameraX: number, kameraY: number, dt: number): void {
    // Nach einem Ruckler nicht in einem Schritt nachrechnen: Ein grosser
    // Zeitschritt sprengt jede Feder.
    const schritt = Math.min(dt, 1 / 30)

    const neuAnkerX = Math.round(kameraX / SCHRITT) - Math.floor(SPALTEN / 2)
    const neuAnkerY = Math.round(kameraY / SCHRITT) - Math.floor(ZEILEN / 2)
    if (this.erstesBild) {
      this.ankerX = neuAnkerX
      this.ankerY = neuAnkerY
      this.erstesBild = false
    } else if (neuAnkerX !== this.ankerX || neuAnkerY !== this.ankerY) {
      this.verschiebe(neuAnkerX, neuAnkerY)
    }

    for (let i = 0; i < this.dx.length; i++) {
      const ax = -this.dx[i] * FEDER - this.vx[i] * DAEMPFUNG
      const ay = -this.dy[i] * FEDER - this.vy[i] * DAEMPFUNG
      this.vx[i] += ax * schritt
      this.vy[i] += ay * schritt
      let nx = this.dx[i] + this.vx[i] * schritt
      let ny = this.dy[i] + this.vy[i] * schritt

      const laenge = Math.hypot(nx, ny)
      if (laenge > MAX_AUSLENKUNG) {
        nx = (nx / laenge) * MAX_AUSLENKUNG
        ny = (ny / laenge) * MAX_AUSLENKUNG
      }
      this.dx[i] = nx
      this.dy[i] = ny
    }
  }

  /**
   * Das Netz einen oder mehrere Knoten weiterschieben.
   *
   * Die Auslenkungen wandern mit, damit eine Welle an ihrem Weltort bleibt;
   * neu hereinkommende Reihen und Spalten starten in Ruhe. Ohne das Verschieben
   * kaeme jede Welle beim Laufen scheinbar mit - genau die Tapete, die das
   * Netz ersetzen soll.
   */
  private verschiebe(neuX: number, neuY: number): void {
    const vsX = neuX - this.ankerX
    const vsY = neuY - this.ankerY
    this.ankerX = neuX
    this.ankerY = neuY

    // Bei einem grossen Sprung - Neustart, Vorspulen im Test - lohnt kein
    // Umkopieren: Dann ist ohnehin nichts mehr an seinem Platz.
    if (Math.abs(vsX) >= SPALTEN || Math.abs(vsY) >= ZEILEN) {
      this.dx.fill(0)
      this.dy.fill(0)
      this.vx.fill(0)
      this.vy.fill(0)
      return
    }

    const kopie = (feld: Float32Array): void => {
      // Rueckwaerts oder vorwaerts, je nach Richtung - sonst ueberschreibt das
      // Kopieren seine eigene Quelle.
      const vor = vsX > 0 || vsY > 0
      for (let n = 0; n < SPALTEN * ZEILEN; n++) {
        const i = vor ? n : SPALTEN * ZEILEN - 1 - n
        const z = Math.floor(i / SPALTEN)
        const sp = i - z * SPALTEN
        const qz = z + vsY
        const qs = sp + vsX
        feld[i] =
          qz < 0 || qz >= ZEILEN || qs < 0 || qs >= SPALTEN ? 0 : feld[qz * SPALTEN + qs]
      }
    }
    kopie(this.dx)
    kopie(this.dy)
    kopie(this.vx)
    kopie(this.vy)
  }

  /**
   * Das Netz zeichnen: drei Durchgaenge.
   *
   * Duenne Linien, kraeftige Linien, und darueber die *heissen* Segmente -
   * jene, deren Knoten gerade ausgelenkt sind. Die leuchten additiv auf und
   * sind der eigentliche Effekt: Man sieht, wo eben etwas zersprungen ist,
   * auch wenn man gerade woanders hingeschaut hat.
   */
  zeichne(ctx: CanvasRenderingContext2D): void {
    this.linien(ctx, false)
    ctx.strokeStyle = FARBEN.gitter
    ctx.lineWidth = 1
    ctx.stroke()

    this.linien(ctx, true)
    ctx.strokeStyle = FARBEN.gitterStark
    ctx.lineWidth = 1.4
    ctx.stroke()

    /*
     * Die ausgelenkten Segmente drucken *staerker*, sie leuchten nicht.
     *
     * Hier stand ein additiver Durchgang - auf dem Nachtfeld glommen die
     * Stellen auf, an denen gerade etwas zersprungen ist. Auf Papier ist
     * `lighter` genau falsch herum: Es macht helles Papier noch heller, die
     * Linie verschwindet also genau dort, wo sie am meisten zu sagen haette.
     *
     * Im Druck heisst "hier ist etwas passiert" nicht mehr Licht, sondern mehr
     * Farbe: Die Walze hat an dieser Stelle staerker aufgetragen.
     */
    if (!this.heisseLinien(ctx)) return
    ctx.strokeStyle = mitAlpha(FARBEN.kontur, 0.55)
    ctx.lineWidth = 2.2
    ctx.stroke()
  }

  /** Waagerechte und senkrechte Zuege - `stark` waehlt jede vierte Linie. */
  private linien(ctx: CanvasRenderingContext2D, stark: boolean): void {
    ctx.beginPath()
    for (let z = 0; z < ZEILEN; z++) {
      if (((this.ankerY + z) % STARK_JEDE === 0) !== stark) continue
      for (let sp = 0; sp < SPALTEN; sp++) {
        const i = z * SPALTEN + sp
        const x = (this.ankerX + sp) * SCHRITT + this.dx[i]
        const y = (this.ankerY + z) * SCHRITT + this.dy[i]
        if (sp === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }
    for (let sp = 0; sp < SPALTEN; sp++) {
      if (((this.ankerX + sp) % STARK_JEDE === 0) !== stark) continue
      for (let z = 0; z < ZEILEN; z++) {
        const i = z * SPALTEN + sp
        const x = (this.ankerX + sp) * SCHRITT + this.dx[i]
        const y = (this.ankerY + z) * SCHRITT + this.dy[i]
        if (z === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }
  }

  /** Nur die ausgelenkten Segmente. Gibt zurueck, ob ueberhaupt eines dabei war. */
  private heisseLinien(ctx: CanvasRenderingContext2D): boolean {
    ctx.beginPath()
    let welche = 0

    for (let z = 0; z < ZEILEN; z++) {
      for (let sp = 0; sp < SPALTEN - 1; sp++) {
        const a = z * SPALTEN + sp
        const b = a + 1
        if (!this.heiss(a) && !this.heiss(b)) continue
        ctx.moveTo((this.ankerX + sp) * SCHRITT + this.dx[a], (this.ankerY + z) * SCHRITT + this.dy[a])
        ctx.lineTo(
          (this.ankerX + sp + 1) * SCHRITT + this.dx[b],
          (this.ankerY + z) * SCHRITT + this.dy[b],
        )
        welche++
      }
    }
    for (let sp = 0; sp < SPALTEN; sp++) {
      for (let z = 0; z < ZEILEN - 1; z++) {
        const a = z * SPALTEN + sp
        const b = a + SPALTEN
        if (!this.heiss(a) && !this.heiss(b)) continue
        ctx.moveTo((this.ankerX + sp) * SCHRITT + this.dx[a], (this.ankerY + z) * SCHRITT + this.dy[a])
        ctx.lineTo(
          (this.ankerX + sp) * SCHRITT + this.dx[b],
          (this.ankerY + z + 1) * SCHRITT + this.dy[b],
        )
        welche++
      }
    }
    return welche > 0
  }

  private heiss(i: number): boolean {
    return Math.abs(this.dx[i]) + Math.abs(this.dy[i]) > GLUEH_SCHWELLE
  }
}

/** Das eine Netz. Es gehoert der Darstellung, nicht dem Spielstand. */
const netz = new Federnetz()

/**
 * Je Bild: gemeldete Stoesse abholen, federn lassen, zeichnen.
 *
 * Der Puffer wird hier geleert und nicht in `main.ts` - anders als beim Ton,
 * wo der Klang aus der Datei daneben kommt. Hier ist der Verbraucher dieselbe
 * Schicht, also darf er auch aufraeumen.
 */
export function gitterBild(ctx: CanvasRenderingContext2D, s: Spielstand, dt: number): void {
  for (let i = 0; i < s.wellen.laenge; i++) {
    const w = s.wellen.lies(i)
    netz.stosse(w.x, w.y, w.staerke, w.radius)
  }
  s.wellen.leeren()

  netz.tick(s.kamera.x, s.kamera.y, dt)
  netz.zeichne(ctx)
}
