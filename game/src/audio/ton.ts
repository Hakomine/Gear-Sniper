import type { KlangId, Klangpuffer } from '../game/klaenge'

/**
 * Ton aus Code.
 *
 * Das ganze Spiel zeichnet sich selbst: keine Bilder, keine Schriften, keine
 * Assets. Der Ton entsteht genauso - Oszillator, Rauschen, Huellkurve, mehr
 * ist es nicht. Kein Sample, keine Lizenzfrage, keine Ladezeit, und der
 * fertige Build bleibt ein paar hundert Kilobyte gross.
 *
 * Warum ueberhaupt: Ein Treffer mit Bild, aber ohne Klang fuehlt sich steril
 * an. Rueckmeldung muss Augen *und* Ohren treffen, sonst fehlt die Haelfte -
 * und genau das war gemeint mit "irgendwas fehlt".
 *
 * Diese Datei kennt den Browser und darf das: Sie liegt ausserhalb von
 * `src/game/`, wie `render/` und `main.ts` auch.
 */

/** Wie viele Stimmen hoechstens gleichzeitig laufen. */
const MAX_STIMMEN = 24

/**
 * Mindestpause je Klangart in Sekunden.
 *
 * Ohne sie wird aus fuenf Waffen an 1400 Gegnern ein Rauschteppich: Es fallen
 * mehrere hundert Treffer pro Sekunde an, und gestapelt ergibt das kein
 * Getuemmel, sondern weisses Rauschen bei voller Lautstaerke.
 */
const PAUSE: Record<KlangId, number> = {
  riss: 0.045,
  zersplittert: 0.05,
  schuss: 0.06,
  treffer: 0.04,
  kristall: 0.035,
  stufe: 0.2,
  stoss: 0.1,
  boss: 0.4,
  warnung: 0.12,
  einschlag: 0.15,
  zerbrochen: 0.5,
}

/** Grundlautstaerke je Art - zusammen ergeben sie die Mischung. */
const PEGEL: Record<KlangId, number> = {
  riss: 0.1,
  zersplittert: 0.34,
  schuss: 0.12,
  treffer: 0.06,
  kristall: 0.1,
  stufe: 0.3,
  stoss: 0.18,
  boss: 0.4,
  warnung: 0.16,
  einschlag: 0.34,
  zerbrochen: 0.5,
}

export class Ton {
  private ctx: AudioContext | null = null
  /** Einmal gescheitert, nie wieder versucht - siehe `wecken`. */
  private tot = false
  private summe: GainNode | null = null
  private rauschen: AudioBuffer | null = null
  private zuletzt = new Map<KlangId, number>()
  private stimmen = 0
  /** Steigt beim Einsammeln und faellt danach zurueck - siehe `kristall`. */
  private kristallStufe = 0
  private kristallZeit = 0
  stumm = false

  /**
   * Erst beim ersten Tastendruck anlegen.
   *
   * Browser starten einen `AudioContext` ohne Zutun des Nutzers stumm. Wer ihn
   * beim Laden anlegt, bekommt einen, der dauerhaft schweigt - und sucht den
   * Fehler dann in der Synthese.
   */
  wecken(): void {
    if (this.tot) return
    if (this.ctx !== null) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Konstruktor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Konstruktor === undefined) {
      this.tot = true
      return
    }

    try {
      this.baueAuf(Konstruktor)
    } catch {
      /*
       * Kein Ton ist ein Schoenheitsfehler - ein Spiel, das deshalb stehen
       * bleibt, ist kaputt. Genau das ist passiert: Im Testbrowser ohne
       * Audiogeraet flog `new AudioContext()`, die Ausnahme riss den ganzen
       * Tick mit, und der Lauf fror ein. Ab hier bleibt es stumm und laeuft.
       */
      this.tot = true
    }
  }

  private baueAuf(Konstruktor: typeof AudioContext): void {
    const ctx = new Konstruktor()
    const summe = ctx.createGain()
    summe.gain.value = 0.55
    summe.connect(ctx.destination)

    // Ein Sekundenpuffer weisses Rauschen, aus dem sich jeder Bruchklang
    // bedient. Ihn je Treffer neu zu fuellen waere die teuerste Zeile im
    // ganzen Spiel.
    const laenge = Math.floor(ctx.sampleRate)
    const puffer = ctx.createBuffer(1, laenge, ctx.sampleRate)
    const daten = puffer.getChannelData(0)
    for (let i = 0; i < laenge; i++) daten[i] = Math.random() * 2 - 1

    this.ctx = ctx
    this.summe = summe
    this.rauschen = puffer
  }

  /** Einmal je Bild: alles abspielen, was die Simulation gemeldet hat. */
  spiele(puffer: Klangpuffer): void {
    const ctx = this.ctx
    if (ctx === null || this.stumm || this.tot) return
    const jetzt = ctx.currentTime

    try {
      for (let i = 0; i < puffer.laenge; i++) {
        const { id, staerke } = puffer.lies(i)
        const letzte = this.zuletzt.get(id) ?? -99
        if (jetzt - letzte < PAUSE[id]) continue
        if (this.stimmen >= MAX_STIMMEN) break
        this.zuletzt.set(id, jetzt)
        this.erzeuge(id, staerke, jetzt)
      }
    } catch {
      // Dieselbe Regel wie beim Aufbau: Der Lauf hat Vorrang vor dem Klang.
      this.tot = true
    }
  }

  private erzeuge(id: KlangId, staerke: number, jetzt: number): void {
    // Tonhoehe streuen. Ohne das ermuedet derselbe Klang nach zwanzig
    // Wiederholungen zu einem Piepen - und hier fallen dutzende pro Sekunde an.
    const wackel = 1 + (Math.random() - 0.5) * 0.24
    const pegel = PEGEL[id] * Math.min(1.4, staerke)

    switch (id) {
      case 'riss':
        this.klick(1800 * wackel, 0.045, pegel, jetzt, 'square')
        return
      case 'treffer':
        this.klick(420 * wackel, 0.04, pegel, jetzt, 'triangle')
        return
      case 'schuss':
        this.klick(240 * wackel, 0.09, pegel, jetzt, 'sawtooth', 90)
        return
      case 'stoss':
        this.rausch(0.16, pegel, jetzt, 900 * wackel, 3200)
        return
      case 'zersplittert':
        // Der Klang des Spiels: ein harter Anschlag, darueber brechendes Glas.
        this.rausch(0.34, pegel, jetzt, 2400 * wackel, 9000)
        this.klick(1200 * wackel, 0.12, pegel * 0.5, jetzt, 'triangle', 300)
        return
      case 'einschlag':
        this.rausch(0.22, pegel, jetzt, 120, 700)
        this.klick(90, 0.2, pegel * 0.8, jetzt, 'sine', 40)
        return
      case 'zerbrochen':
        this.rausch(1.4, pegel, jetzt, 1600, 6000)
        this.klick(70, 1.1, pegel * 0.7, jetzt, 'sine', 28)
        return
      case 'boss':
        this.klick(58 * wackel, 0.9, pegel, jetzt, 'sawtooth', 34)
        return
      case 'warnung':
        this.klick(880 * wackel, 0.06, pegel, jetzt, 'square')
        return
      case 'stufe':
        // Ein aufsteigender Dreiklang, damit ein Aufstieg wie einer klingt.
        for (let k = 0; k < 3; k++) {
          this.klick(440 * Math.pow(1.26, k), 0.16, pegel * 0.7, jetzt + k * 0.07, 'triangle')
        }
        return
      case 'kristall': {
        /*
         * Steigt, solange man sammelt, und faellt nach einer Pause zurueck.
         *
         * Das ist der Griff, mit dem dieses Genre seinen staerksten Moment
         * baut: Ein ganzes Feld Kristalle einzusammeln soll nicht zwanzigmal
         * gleich klingen, sondern *ansteigen*.
         */
        if (jetzt - this.kristallZeit > 0.6) this.kristallStufe = 0
        this.kristallZeit = jetzt
        this.kristallStufe = Math.min(18, this.kristallStufe + 1)
        const hoehe = 620 * Math.pow(1.055, this.kristallStufe)
        this.klick(hoehe, 0.07, pegel, jetzt, 'sine')
        return
      }
    }
  }

  /** Ein Ton mit Huellkurve. `bis` laesst ihn abwaerts gleiten. */
  private klick(
    hz: number,
    dauer: number,
    pegel: number,
    start: number,
    form: OscillatorType,
    bis?: number,
  ): void {
    const ctx = this.ctx
    const summe = this.summe
    if (ctx === null || summe === null) return

    const osz = ctx.createOscillator()
    const huelle = ctx.createGain()
    osz.type = form
    osz.frequency.setValueAtTime(hz, start)
    if (bis !== undefined) osz.frequency.exponentialRampToValueAtTime(Math.max(20, bis), start + dauer)

    // Kurze Rampe hinein statt hartem Einsatz: Ein Sprung im Signal knackst
    // hoerbar, und bei dutzenden Klaengen pro Sekunde summiert sich das.
    huelle.gain.setValueAtTime(0.0001, start)
    huelle.gain.exponentialRampToValueAtTime(Math.max(0.0002, pegel), start + 0.006)
    huelle.gain.exponentialRampToValueAtTime(0.0001, start + dauer)

    osz.connect(huelle)
    huelle.connect(summe)
    this.starte(osz, start, dauer)
  }

  /** Gefiltertes Rauschen - alles, was bricht und berstet. */
  private rausch(dauer: number, pegel: number, start: number, hz: number, offen: number): void {
    const ctx = this.ctx
    const summe = this.summe
    if (ctx === null || summe === null || this.rauschen === null) return

    const quelle = ctx.createBufferSource()
    quelle.buffer = this.rauschen
    // Zufaelliger Einstieg in den Puffer, damit nicht jeder Bruch dieselbe
    // Rauschfolge ist - dieselbe Ueberlegung wie beim Streuen der Tonhoehe.
    const versatz = Math.random() * (this.rauschen.duration - dauer - 0.01)

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(offen, start)
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, hz), start + dauer)
    filter.Q.value = 1.1

    const huelle = ctx.createGain()
    huelle.gain.setValueAtTime(Math.max(0.0002, pegel), start)
    huelle.gain.exponentialRampToValueAtTime(0.0001, start + dauer)

    quelle.connect(filter)
    filter.connect(huelle)
    huelle.connect(summe)

    this.stimmen++
    quelle.onended = () => {
      this.stimmen--
    }
    quelle.start(start, Math.max(0, versatz), dauer)
    quelle.stop(start + dauer)
  }

  private starte(knoten: OscillatorNode, start: number, dauer: number): void {
    this.stimmen++
    knoten.onended = () => {
      this.stimmen--
    }
    knoten.start(start)
    knoten.stop(start + dauer)
  }
}
