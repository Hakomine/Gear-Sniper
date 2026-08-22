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
  /*
   * Das Spielfeld ist **heller als die Figuren darauf**.
   *
   * Vorher war der Grund fast schwarz und alles darauf ebenfalls dunkel - es
   * gab keine Ebene, nur Umrisse, und im Getuemmel verschwamm alles zu einer
   * Flaeche. Die Umkehr ist der eigentliche Griff dieser Bildsprache: Ein
   * mittelheller Grund traegt gefuellte Koerper mit dunkler Kontur, und jede
   * Silhouette schneidet sich von selbst frei.
   */
  grund: '#2a2f3e',
  gitter: '#242938',
  gitterStark: '#1d2130',

  /**
   * Die Kontur. Eine einzige dunkle Farbe um *alles*, was lebt.
   *
   * Sie ist der Grund, warum tausend Koerper im Pulk noch tausend Koerper
   * bleiben und nicht zu einem Teppich verschmelzen.
   */
  kontur: '#12151e',
  schatten: 'rgba(12, 14, 20, 0.42)',

  spieler: '#fff3d6',
  spielerKern: '#ffffff',
  spielerRing: '#ffd24a',
  geschoss: '#fff3d6',

  // Gegner: siehe enemies.ts - Form ist die Ansage, das hier ist nur Anstrich.
  splitter: '#ff7a45',
  brocken: '#8b6f4e',
  elite: '#c86bff',

  kristall: '#4fe0ff',
  kristallKern: '#d6f6ff',

  text: '#f2f4f9',
  textSchwach: '#98a1b5',
  textHervor: '#ffd24a',

  gefahr: '#ff4d5e',
  heilung: '#6ee7a8',
  krit: '#ffd24a',
  treffer: '#fff3d6',

  /**
   * Karten liegen **ueber** dem Feld, also sind sie heller als es.
   *
   * Vorher standen sie bei fast derselben Farbe wie der Grund - dadurch
   * flimmerte das Getuemmel durch jedes Menue und nichts wirkte vorne oder
   * hinten.
   */
  kartenGrund: '#394054',
  kartenGrundTief: '#2f3546',
  kartenRand: '#12151e',
  kartenRandAktiv: '#ffd24a',
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
