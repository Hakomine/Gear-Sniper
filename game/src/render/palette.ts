/**
 * Die gesamte Farbidentitaet des Spiels an einer Stelle.
 *
 * Reine Daten, kein Browser-Zugriff - deshalb darf auch die Spiellogik hier
 * hineingreifen, wenn ein Gegnertyp seine Farbe braucht.
 *
 * Regel, die den Stil zusammenhaelt: **Die Form sagt, was es ist. Die Farbe
 * sagt, in welchem Zustand es ist.** Bei tausend Gegnern gleichzeitig kann
 * man Farben nicht mehr auseinanderhalten, Umrisse aber sehr wohl. Wer die
 * Bedrohung an der Farbe festmacht, baut ein Spiel, das im Getuemmel
 * unlesbar wird.
 */
export const FARBEN = {
  grund: '#05060a',
  gitter: '#0e1524',
  gitterStark: '#16203a',

  spieler: '#5ef2c4',
  spielerKern: '#ffffff',
  geschoss: '#ffe066',

  // Gegner: siehe enemies.ts - Form ist die Ansage, das hier ist nur Anstrich.
  splitter: '#ff5c7a',
  brocken: '#8f7bff',
  elite: '#ff9d3d',

  kristall: '#4fc3ff',
  kristallKern: '#d6f2ff',

  text: '#e8ecf5',
  textSchwach: '#79839a',
  textHervor: '#5ef2c4',

  gefahr: '#ff4d5e',
  heilung: '#5ef2c4',
  krit: '#ffd23f',
  treffer: '#ffffff',

  kartenGrund: '#0d1322',
  kartenRand: '#243352',
  kartenRandAktiv: '#5ef2c4',
} as const

export type FarbName = keyof typeof FARBEN

/**
 * Seltenheitsfarben.
 *
 * Die Abstufung grau-blau -> blau -> violett -> gold ist bewusst die, die
 * jeder Spieler aus anderen Spielen schon kennt. Eine eigene Skala zu
 * erfinden waere originell und wuerde nur dazu fuehren, dass niemand auf einen
 * Blick sieht, was eine Karte wert ist.
 */
export const SELTENHEIT_FARBE = {
  gewoehnlich: '#8d99b3',
  selten: '#4fa3ff',
  episch: '#b46bff',
  legendaer: '#ffb020',
  // Fusionen bekommen ein helles Weissgold: Sie stehen ueber allem anderen
  // und sollen auf einer Karte sofort als Sonderfall lesbar sein.
  fusion: '#fff2c4',
} as const


/**
 * Schrift.
 *
 * Bewusst nur Systemschriften: Eine Webschrift muesste nachgeladen werden,
 * waere im spaeter verpackten Spiel eine Datei mehr und ist beim ersten Bild
 * noch nicht da. Monospace passt ausserdem zur geometrischen Bildsprache und
 * laesst Zahlen nicht springen, wenn sie hochzaehlen.
 */
export const SCHRIFT = {
  mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace',
} as const

/**
 * Farbe mit Deckkraft. Baut den `rgba(...)`-String aus einem Hex-Wert.
 *
 * Wird pro Bild hunderte Male gebraucht (Partikel verblassen, Glut pulsiert),
 * deshalb ein kleiner Zwischenspeicher: Ohne ihn entstehen pro Sekunde
 * zehntausende Strings, und genau die Sorte Muell soll der Pool ja vermeiden.
 */
const alphaCache = new Map<string, string>()

export function mitAlpha(hex: string, alpha: number): string {
  // Auf 2 Stellen runden: 100 Stufen sind optisch nicht unterscheidbar,
  // begrenzen den Zwischenspeicher aber auf eine handliche Groesse.
  const a = Math.max(0, Math.min(1, alpha))
  const stufe = Math.round(a * 100)
  const schluessel = hex + stufe
  const fertig = alphaCache.get(schluessel)
  if (fertig !== undefined) return fertig

  const zahl = parseInt(hex.slice(1), 16)
  const r = (zahl >> 16) & 255
  const g = (zahl >> 8) & 255
  const b = zahl & 255
  const wert = `rgba(${r},${g},${b},${stufe / 100})`
  alphaCache.set(schluessel, wert)
  return wert
}
