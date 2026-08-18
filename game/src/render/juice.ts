/**
 * Erschuetterung und Bildblitz.
 *
 * Das ist keine Politur, sondern die Gattung selbst: Ohne Wucht ist ein
 * Survivor-like eine Tabellenkalkulation, die sich selbst ausrechnet. Die
 * Zahlen sind dieselben, aber niemand spielt es zweimal.
 */

/** Groesster Ausschlag in virtuellen Bildpunkten. */
const MAX_VERSATZ = 16

/** Groesste Verdrehung im Bogenmass - klein halten, sonst wird einem schlecht. */
const MAX_WINKEL = 0.022

export type Erschuetterung = {
  x: number
  y: number
  winkel: number
}

const ergebnis: Erschuetterung = { x: 0, y: 0, winkel: 0 }

/**
 * Ausschlag aus dem Trauma-Wert (0..1).
 *
 * Zwei Entscheidungen stecken darin:
 *
 * 1. **Quadriert.** Ein linearer Ausschlag laesst schon kleine Treffer heftig
 *    wackeln, und die grossen Momente haben dann keine Steigerung mehr.
 *
 * 2. **Sinus statt Zufall.** Ein zufaelliger Versatz pro Bild flackert und
 *    liest sich als Fehler. Mehrere Sinuskurven mit unrunden Frequenzen
 *    ergeben eine Bewegung, die zittert, ohne zu stroben.
 */
export function erschuetterung(trauma: number, zeit: number): Erschuetterung {
  const staerke = trauma * trauma
  ergebnis.x = Math.sin(zeit * 47.3) * staerke * MAX_VERSATZ
  ergebnis.y = Math.sin(zeit * 53.9 + 1.7) * staerke * MAX_VERSATZ
  ergebnis.winkel = Math.sin(zeit * 41.1 + 3.1) * staerke * MAX_WINKEL
  return ergebnis
}
