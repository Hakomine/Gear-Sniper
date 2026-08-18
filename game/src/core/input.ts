/**
 * Eingabe als *Absichten*, nicht als Tasten.
 *
 * Das Spiel fragt nie "ist W gedrueckt", sondern "will der Spieler nach oben".
 * Das kostet jetzt eine Zuordnungstabelle und spart spaeter drei Dinge:
 * frei belegbare Tasten, Gamepad ohne Sonderbehandlung im Spielcode, und ein
 * Menue, das mit Tastatur *und* Stick bedienbar ist.
 *
 * Gamepad ist von Anfang an dabei und die Maus nirgends Pflicht - fuer ein
 * Survivor-like ist das Steam Deck der wichtigste Verkaufsort, und "Deck
 * Verified" nachtraeglich zu erkaempfen ist deutlich teurer, als es jetzt
 * gleich mitzunehmen.
 *
 * Diese Datei ist neben `main.ts` und `render/` die einzige, die den Browser
 * kennen darf.
 */
export type Aktion =
  | 'hoch'
  | 'runter'
  | 'links'
  | 'rechts'
  | 'bestaetigen'
  | 'zurueck'
  | 'pause'
  | 'wahl1'
  | 'wahl2'
  | 'wahl3'

const TASTEN: Record<string, Aktion> = {
  KeyW: 'hoch',
  ArrowUp: 'hoch',
  KeyS: 'runter',
  ArrowDown: 'runter',
  KeyA: 'links',
  ArrowLeft: 'links',
  KeyD: 'rechts',
  ArrowRight: 'rechts',
  Space: 'bestaetigen',
  Enter: 'bestaetigen',
  Escape: 'zurueck',
  KeyP: 'pause',
  Digit1: 'wahl1',
  Digit2: 'wahl2',
  Digit3: 'wahl3',
}

/** Standard-Belegung (Xbox-Layout). Index = Knopfnummer der Gamepad-API. */
const KNOEPFE: Record<number, Aktion> = {
  0: 'bestaetigen', // A
  1: 'zurueck', // B
  9: 'pause', // Start
  12: 'hoch', // Steuerkreuz
  13: 'runter',
  14: 'links',
  15: 'rechts',
}

/** Unter diesem Ausschlag gilt der Stick als losgelassen - er ruht selten exakt bei 0. */
const TOTZONE = 0.24

export class Eingabe {
  private gehalten = new Set<Aktion>()
  private getipptJetzt = new Set<Aktion>()
  private knopfVorher = new Set<Aktion>()
  private stickX = 0
  private stickY = 0

  /** Nur fuer Menues - das Spiel selbst kommt ohne Maus aus. */
  zeigerX = 0
  zeigerY = 0
  private zeigerGeklicktJetzt = false

  verbinden(ziel: Window = window): void {
    ziel.addEventListener('keydown', this.beiKeyDown)
    ziel.addEventListener('keyup', this.beiKeyUp)
    ziel.addEventListener('blur', this.beiBlur)
    ziel.addEventListener('mousemove', this.beiMausBewegung)
    ziel.addEventListener('mousedown', this.beiMausKlick)
  }

  trennen(ziel: Window = window): void {
    ziel.removeEventListener('keydown', this.beiKeyDown)
    ziel.removeEventListener('keyup', this.beiKeyUp)
    ziel.removeEventListener('blur', this.beiBlur)
    ziel.removeEventListener('mousemove', this.beiMausBewegung)
    ziel.removeEventListener('mousedown', this.beiMausKlick)
  }

  private beiKeyDown = (e: KeyboardEvent): void => {
    const aktion = TASTEN[e.code]
    if (aktion === undefined) return
    // Pfeiltasten und Leertaste scrollen sonst die Seite.
    e.preventDefault()
    // Die Tastenwiederholung des Systems darf nicht als neuer Tipp zaehlen,
    // sonst blaettert ein gehaltener Knopf durch das ganze Levelup-Menue.
    if (!e.repeat) this.getipptJetzt.add(aktion)
    this.gehalten.add(aktion)
  }

  private beiKeyUp = (e: KeyboardEvent): void => {
    const aktion = TASTEN[e.code]
    if (aktion !== undefined) this.gehalten.delete(aktion)
  }

  /**
   * Fenster verliert den Fokus: alles loslassen. Sonst laeuft die Figur nach
   * einem Alt-Tab mit gedrueckter Taste endlos weiter, weil das keyup-Ereignis
   * nie beim Spiel ankommt.
   */
  private beiBlur = (): void => {
    this.gehalten.clear()
    this.getipptJetzt.clear()
  }

  private beiMausBewegung = (e: MouseEvent): void => {
    this.zeigerX = e.clientX
    this.zeigerY = e.clientY
  }

  private beiMausKlick = (): void => {
    this.zeigerGeklicktJetzt = true
  }

  /** Am Anfang jedes Ticks aufrufen: liest das Gamepad ein. */
  pollen(): void {
    this.stickX = 0
    this.stickY = 0
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return

    const pads = navigator.getGamepads()
    const jetzt = new Set<Aktion>()

    for (const pad of pads) {
      if (!pad) continue

      const ax = pad.axes[0] ?? 0
      const ay = pad.axes[1] ?? 0
      if (Math.abs(ax) > TOTZONE) this.stickX += ax
      if (Math.abs(ay) > TOTZONE) this.stickY += ay

      for (const [index, aktion] of Object.entries(KNOEPFE)) {
        if (pad.buttons[Number(index)]?.pressed) jetzt.add(aktion)
      }
    }

    // Flanke selbst bilden - die Gamepad-API kennt kein "gerade gedrueckt".
    for (const aktion of jetzt) {
      if (!this.knopfVorher.has(aktion)) this.getipptJetzt.add(aktion)
      this.gehalten.add(aktion)
    }
    for (const aktion of this.knopfVorher) {
      if (!jetzt.has(aktion)) this.gehalten.delete(aktion)
    }
    this.knopfVorher = jetzt
  }

  /** Am Ende jedes Ticks aufrufen: verbraucht die Flanken. */
  tickEnde(): void {
    this.getipptJetzt.clear()
    this.zeigerGeklicktJetzt = false
  }

  gedrueckt(aktion: Aktion): boolean {
    return this.gehalten.has(aktion)
  }

  /** Nur in dem Tick wahr, in dem die Taste heruntergeht. */
  getippt(aktion: Aktion): boolean {
    return this.getipptJetzt.has(aktion)
  }

  geklickt(): boolean {
    return this.zeigerGeklicktJetzt
  }

  /**
   * Bewegungsrichtung, Laenge hoechstens 1.
   *
   * Ohne die Normierung waere Diagonallaufen um Faktor 1,41 schneller - ein
   * Fehler, den man in fertigen Spielen erstaunlich oft findet und der die
   * ganze Balance verzieht, weil alle nur noch schraeg laufen.
   */
  bewegung(aus: { x: number; y: number }): { x: number; y: number } {
    let x = this.stickX
    let y = this.stickY
    if (this.gedrueckt('links')) x -= 1
    if (this.gedrueckt('rechts')) x += 1
    if (this.gedrueckt('hoch')) y -= 1
    if (this.gedrueckt('runter')) y += 1

    const laenge = Math.hypot(x, y)
    if (laenge > 1) {
      x /= laenge
      y /= laenge
    }
    aus.x = x
    aus.y = y
    return aus
  }
}
