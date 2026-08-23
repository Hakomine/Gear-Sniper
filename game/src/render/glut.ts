/**
 * Die Glut: alles Leuchtende noch einmal, weich und additiv obendrauf.
 *
 * Der Grund, warum flaches Canvas 2D nach Prototyp aussieht, ist nicht die
 * Formensprache und nicht die Palette - es ist, dass **nichts emittiert**.
 * Jede Form wird gefuellt und umrandet, fertig; Licht gibt es nicht. Ein
 * Kristall, ein Laser und ein Riss sehen dadurch aus wie Aufkleber, nicht wie
 * Dinge, die strahlen.
 *
 * Echtes Bloom, ohne Shader, ohne Bibliothek und ohne den Zeichencode zweimal
 * zu durchlaufen:
 *
 * 1. Waehrend des Weltdurchgangs schieben leuchtende Dinge nur ihre *Daten*
 *    hierher - Ort, Radius, Farbe, Staerke. Der Formcode laeuft nicht erneut.
 * 2. Alles wandert auf eine Nebenleinwand in **Viertelaufloesung**. Ein
 *    Leuchtpunkt ist dort ein einziges `drawImage` eines vorgerenderten
 *    Verlaufsplaettchens - nicht ein Verlauf, der je Punkt neu gebaut wird.
 * 3. Weichzeichnen passiert auf der *kleinen* Leinwand, wo es fast nichts
 *    kostet.
 * 4. Einmal mit `lighter` in voller Groesse zurueck.
 *
 * **Was nicht leuchtet:** gewoehnliche Gegnerkoerper. Bei 1400 Stueck waere
 * das eine Lichtsuppe, in der nichts mehr zu erkennen ist - und damit genau
 * der Fehler, den die Farbdisziplin gerade behoben hat. Es leuchtet, was
 * einen *Zustand* meldet.
 */

/** Wie stark die Nebenleinwand kleiner ist als das Bild. */
const TEILER = 4

/**
 * Wie viele Leuchtpunkte ein Bild hoechstens traegt.
 *
 * Grosszuegig, aber endlich - dieselbe Haltung wie beim Klang- und
 * Wellenpuffer. Bei einer Kettenreaktion im vollen Feld faellt sonst genau
 * dann Arbeit an, wenn ohnehin am wenigsten Zeit ist.
 */
const MAX_PUNKTE = 900

/** Kantenlaenge eines Verlaufsplaettchens. */
const PLAETTCHEN = 64

export class Glut {
  private readonly leinwand: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private breite = 0
  private hoehe = 0

  /** Parallel gefuehrte Felder statt Objekten - kein Muell je Leuchtpunkt. */
  private readonly xs = new Float32Array(MAX_PUNKTE)
  private readonly ys = new Float32Array(MAX_PUNKTE)
  private readonly radien = new Float32Array(MAX_PUNKTE)
  private readonly staerken = new Float32Array(MAX_PUNKTE)
  private readonly farben: string[] = new Array<string>(MAX_PUNKTE).fill('#ffffff')
  private anzahl = 0

  /**
   * Ein Plaettchen je Farbe, faul erzeugt.
   *
   * Es gibt rund fuenfzehn Farben im ganzen Spiel. Sie einmal zu rendern und
   * danach nur noch zu kopieren ist der Unterschied zwischen "hunderte
   * Verlaufsobjekte pro Bild" und "hunderte `drawImage`".
   */
  private readonly plaettchen = new Map<string, HTMLCanvasElement>()

  constructor() {
    this.leinwand = document.createElement('canvas')
    const ctx = this.leinwand.getContext('2d')
    if (ctx === null) throw new Error('Glut-Leinwand nicht verfügbar')
    this.ctx = ctx
  }

  /** Groesse an das Bild anpassen. Wird beim Fensterwechsel aufgerufen. */
  passeAn(breite: number, hoehe: number): void {
    this.breite = Math.max(1, Math.round(breite / TEILER))
    this.hoehe = Math.max(1, Math.round(hoehe / TEILER))
    this.leinwand.width = this.breite
    this.leinwand.height = this.hoehe
  }

  /**
   * Einen Leuchtpunkt anmelden - in **Weltkoordinaten**.
   *
   * Der Aufrufer muss nichts umrechnen: Die Nebenleinwand uebernimmt beim
   * Aufloesen dieselbe Kameramatrix, nur durch den Teiler geteilt. Die
   * Umrechnung ein zweites Mal von Hand nachzubauen waere eine zweite
   * Wahrheit, die beim naechsten Kameraeingriff auseinanderlaeuft - und diese
   * Runde baut gerade drei davon ein.
   */
  melde(x: number, y: number, radius: number, farbe: string, staerke = 1): void {
    if (this.anzahl >= MAX_PUNKTE) return
    this.xs[this.anzahl] = x
    this.ys[this.anzahl] = y
    this.radien[this.anzahl] = radius
    this.farben[this.anzahl] = farbe
    this.staerken[this.anzahl] = staerke
    this.anzahl++
  }

  get laenge(): number {
    return this.anzahl
  }

  /**
   * Alles Gemeldete weichzeichnen und additiv zurueckgeben.
   *
   * Wird nach dem Weltdurchgang aufgerufen, wenn die Zielleinwand wieder in
   * Bildkoordinaten steht. `welt` ist die Kameramatrix, wie sie *waehrend* des
   * Durchgangs galt - daraus baut die Nebenleinwand dieselbe Sicht in
   * Viertelgroesse.
   */
  aufloesen(
    ziel: CanvasRenderingContext2D,
    breite: number,
    hoehe: number,
    welt: DOMMatrix,
    pixelSkala: number,
  ): void {
    if (this.anzahl === 0) return
    if (this.breite === 0) this.passeAn(breite, hoehe)

    const g = this.ctx
    /*
     * Die Kameramatrix gilt fuer echte Bildpunkte. Hier gebraucht wird sie
     * fuer die Nebenleinwand, also durch die Pixeldichte *und* durch den
     * Teiler. Weil beides reine Skalierungen sind, die *vor* allem anderen
     * angewendet wurden, genuegt es, alle sechs Komponenten zu teilen.
     */
    const k = pixelSkala * TEILER
    g.setTransform(welt.a / k, welt.b / k, welt.c / k, welt.d / k, welt.e / k, welt.f / k)
    g.globalCompositeOperation = 'source-over'
    g.clearRect(-1e6, -1e6, 2e6, 2e6)
    g.globalCompositeOperation = 'lighter'

    for (let i = 0; i < this.anzahl; i++) {
      const bild = this.holePlaettchen(this.farben[i])
      // Der Radius wird grosszuegig genommen: Ein Leuchten, das genau so gross
      // ist wie der Koerper, sieht aus wie eine Umrandung. Es soll darueber
      // hinausreichen.
      const r = this.radien[i] * 2.6
      if (r < 0.5) continue
      g.globalAlpha = Math.min(1, this.staerken[i])
      g.drawImage(bild, this.xs[i] - r, this.ys[i] - r, r * 2, r * 2)
    }
    g.globalAlpha = 1

    // Weichzeichnen auf der kleinen Leinwand: 320 x 180 statt 1280 x 720 sind
    // ein Sechzehntel der Bildpunkte, und genau deshalb ist echtes Bloom hier
    // ueberhaupt bezahlbar.
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'copy'
    g.filter = 'blur(3px)'
    g.drawImage(this.leinwand, 0, 0)
    g.filter = 'none'
    g.globalCompositeOperation = 'source-over'

    ziel.save()
    ziel.globalCompositeOperation = 'lighter'
    // Beim Hochskalieren glaettet der Browser ohnehin - das ist der zweite,
    // kostenlose Weichzeichner.
    ziel.drawImage(this.leinwand, 0, 0, breite, hoehe)
    ziel.restore()

    this.anzahl = 0
  }

  /** Verwerfen, ohne zu zeichnen - fuer Bilder, in denen keine Welt lief. */
  leeren(): void {
    this.anzahl = 0
  }

  private holePlaettchen(farbe: string): HTMLCanvasElement {
    const fertig = this.plaettchen.get(farbe)
    if (fertig !== undefined) return fertig

    const c = document.createElement('canvas')
    c.width = PLAETTCHEN
    c.height = PLAETTCHEN
    const k = c.getContext('2d')
    if (k === null) throw new Error('Glut-Plättchen nicht verfügbar')

    const m = PLAETTCHEN / 2
    const v = k.createRadialGradient(m, m, 0, m, m, m)
    /*
     * Die Kurve ist der ganze Unterschied zwischen "leuchtet" und "hat einen
     * grauen Hof". Ein linearer Verlauf ergibt eine Scheibe mit weichem Rand;
     * ein steiler Abfall am Anfang und ein langer Ausklang ergeben einen
     * Lichtpunkt mit Streuung - so, wie eine Kamera Licht sieht.
     */
    v.addColorStop(0, mitAlphaRoh(farbe, 1))
    v.addColorStop(0.18, mitAlphaRoh(farbe, 0.55))
    v.addColorStop(0.45, mitAlphaRoh(farbe, 0.16))
    v.addColorStop(1, mitAlphaRoh(farbe, 0))
    k.fillStyle = v
    k.fillRect(0, 0, PLAETTCHEN, PLAETTCHEN)

    this.plaettchen.set(farbe, c)
    return c
  }
}

/**
 * Wie `mitAlpha` in `palette.ts`, aber ohne Zwischenspeicher.
 *
 * Eigene Fassung, weil sie genau viermal je Farbe laeuft - beim Bau des
 * Plaettchens - und der Zwischenspeicher dort nur Eintraege sammeln wuerde,
 * die nie wieder gebraucht werden.
 */
function mitAlphaRoh(hex: string, alpha: number): string {
  const zahl = parseInt(hex.slice(1), 16)
  return `rgba(${(zahl >> 16) & 255},${(zahl >> 8) & 255},${zahl & 255},${alpha})`
}

/** Die eine Glut-Schicht. Sie gehoert der Darstellung, nicht dem Spielstand. */
export const glut = new Glut()
