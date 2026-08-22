/**
 * Fester Zeitschritt fuer die Logik, freies Tempo fuer die Darstellung.
 *
 * Warum nicht einfach `delta` aus requestAnimationFrame durchreichen: Auf
 * einem 144-Hz-Monitor liefe das Spiel dann anderthalbmal so schnell wie auf
 * 60 Hz, Kollisionen wuerden bei Rucklern uebersprungen, und Laeufe waeren
 * nicht mehr reproduzierbar. Mit festem Schritt rechnet die Logik immer in
 * 1/60-Sekunden-Scheiben - unabhaengig davon, wie oft gezeichnet wird.
 */
export const TICK_HZ = 60
export const TICK_DT = 1 / TICK_HZ

/**
 * Mehr als das holt die Schleife nach einem Hänger nicht auf. Ohne diese
 * Grenze fuehrt ein Tab-Wechsel von 10 Sekunden zu 600 Ticks am Stueck -
 * das Bild friert ein und der Spieler stirbt im Hintergrund ("Todesspirale").
 * Lieber Zeit verschlucken als das Spiel verlieren.
 */
const MAX_TICKS_PRO_BILD = 5

export type SchleifenHaken = {
  /** Ein Logikschritt. `dt` ist immer TICK_DT. */
  tick(dt: number): void
  /**
   * Zeichnen. `alpha` (0..1) ist der Anteil zwischen dem letzten und dem
   * naechsten Tick - damit laesst sich die Position interpolieren, sonst
   * ruckelt es bei 144 Hz sichtbar.
   */
  render(alpha: number): void
}

export class Schleife {
  private laeuft = false
  private letzteZeit = 0
  private speicher = 0
  private rafId = 0

  constructor(private haken: SchleifenHaken) {}

  start(): void {
    if (this.laeuft) return
    this.laeuft = true
    this.letzteZeit = performance.now()
    this.speicher = 0
    this.rafId = requestAnimationFrame(this.bild)
  }

  stop(): void {
    this.laeuft = false
    cancelAnimationFrame(this.rafId)
  }

  private bild = (jetzt: number): void => {
    if (!this.laeuft) return
    this.rafId = requestAnimationFrame(this.bild)

    // Sekunden statt Millisekunden - der Rest des Spiels rechnet in Sekunden.
    const verstrichen = (jetzt - this.letzteZeit) / 1000
    this.letzteZeit = jetzt
    this.speicher += verstrichen

    let ticks = 0
    while (this.speicher >= TICK_DT && ticks < MAX_TICKS_PRO_BILD) {
      this.haken.tick(TICK_DT)
      this.speicher -= TICK_DT
      ticks++
    }

    // Rueckstand ueber der Grenze wegwerfen, statt ihn ewig mitzuschleppen.
    if (this.speicher > TICK_DT * MAX_TICKS_PRO_BILD) this.speicher = 0

    this.haken.render(this.speicher / TICK_DT)
  }
}
