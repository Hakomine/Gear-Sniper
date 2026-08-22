/**
 * Was zu hören sein soll - als Meldung, nicht als Klang.
 *
 * `src/game/` kennt keinen Browser. Das ist keine Stilfrage: Darauf beruhen
 * die Tests ohne Fenster und `npm run perf`, das die reine Rechenlast misst.
 * Ein `AudioContext` in `state.ts` macht beides kaputt.
 *
 * Deshalb *meldet* die Simulation nur, was passiert ist. `main.ts` leert den
 * Puffer einmal pro Bild und gibt ihn an `audio/ton.ts` weiter, wo tatsaechlich
 * etwas erklingt. Nebenwirkung, die den Aufwand allein schon rechtfertigt: Ein
 * Test kann pruefen, *dass* gemeldet wurde, ohne je einen Ton zu hoeren.
 */
export type KlangId =
  | 'riss'
  | 'zersplittert'
  | 'schuss'
  | 'treffer'
  | 'kristall'
  | 'stufe'
  | 'stoss'
  | 'boss'
  | 'warnung'
  | 'einschlag'
  | 'zerbrochen'

/**
 * Wie viele Meldungen ein Bild fasst.
 *
 * Grosszuegig, aber endlich. Bei 1400 Gegnern und fuenf Waffen fallen in einem
 * Tick mehrere hundert Treffer an - alle zu behalten waere sinnlos, weil aus
 * ihnen ohnehin nur ein paar Stimmen werden. Was darueber hinausgeht, faellt
 * weg: Ein verschluckter Trefferklang unter dreihundert ist nicht hoerbar, ein
 * mitwachsendes Array in der heissen Schleife dagegen kostet echt.
 */
const KAPAZITAET = 256

export class Klangpuffer {
  /** Parallel gefuehrt statt als Objektliste - kein Muell pro Meldung. */
  private readonly ids: KlangId[] = new Array<KlangId>(KAPAZITAET).fill('treffer')
  private readonly staerken = new Float32Array(KAPAZITAET)
  private anzahl = 0
  /** Wie viele Meldungen der Deckel geschluckt hat - nur fuer Tests und Messung. */
  verworfen = 0

  melde(id: KlangId, staerke = 1): void {
    if (this.anzahl >= KAPAZITAET) {
      this.verworfen++
      return
    }
    this.ids[this.anzahl] = id
    this.staerken[this.anzahl] = staerke
    this.anzahl++
  }

  get laenge(): number {
    return this.anzahl
  }

  /** Was gemeldet wurde, in der Reihenfolge des Auftretens. */
  lies(i: number): { id: KlangId; staerke: number } {
    return { id: this.ids[i], staerke: this.staerken[i] }
  }

  /**
   * Zaehlt, wie oft eine Art gemeldet wurde. Fuer Tests - im Spiel laeuft
   * `main.ts` einmal ueber den Puffer und leert ihn danach.
   */
  zaehle(id: KlangId): number {
    let n = 0
    for (let i = 0; i < this.anzahl; i++) if (this.ids[i] === id) n++
    return n
  }

  leeren(): void {
    this.anzahl = 0
    this.verworfen = 0
  }
}
