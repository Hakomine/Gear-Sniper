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
   * Nachtfeld: Der Grund traegt nichts, das Licht darauf traegt alles.
   *
   * Die Bildsprache hat zweimal die Richtung gewechselt, und beide Male aus
   * einem gemessenen Grund. Zuerst war der Grund fast schwarz und alles
   * darauf ebenfalls dunkel - es gab keine Ebene, nur Umrisse, und im
   * Getuemmel verschwamm alles zu einer Flaeche. Dann wurde der Grund
   * mittelhell, damit gefuellte Koerper mit dunkler Kontur sich von selbst
   * freischneiden. Das hat funktioniert, sah aber weiterhin nach Aufklebern
   * auf Millimeterpapier aus - weil nichts *emittierte*.
   *
   * Jetzt ist der Grund wieder Nacht, aber diesmal mit der Glut-Schicht
   * darueber (`render/glut.ts`): Koerper bleiben dunkel und konturiert, ihr
   * *Zustand* leuchtet. Damit gilt endlich die Regel, die hier seit der
   * ersten Runde steht: Die Form sagt, was es ist, die Farbe sagt, wie es
   * ihm geht.
   */
  grund: '#070912',
  grundTief: '#04050b',
  gitter: '#1b2740',
  gitterStark: '#2b4570',

  /**
   * Die Kontur. Eine einzige dunkle Farbe um *alles*, was lebt.
   *
   * Sie ist der Grund, warum tausend Koerper im Pulk noch tausend Koerper
   * bleiben und nicht zu einem Teppich verschmelzen - und auf dem Nachtfeld
   * trennt sie jetzt Leuchtendes voneinander statt Flaechen.
   */
  kontur: '#03040a',
  schatten: 'rgba(2, 3, 8, 0.55)',

  spieler: '#fff6e2',
  spielerKern: '#ffffff',
  spielerRing: '#ffcb3d',
  geschoss: '#cfe9ff',

  /*
   * Gegnerkoerper: eine kuehle Familie aus drei Helligkeiten, kein Farbton.
   *
   * Vorher trug jede Art ihren eigenen gesaettigten Ton - dreizehn davon auf
   * aehnlicher Helligkeit, und im Screenshot sah das Feld aus wie ein
   * Farbwaehler. Nichts trat zurueck, also trat auch nichts hervor.
   *
   * Jetzt sagt die *Form*, um welche Art es sich handelt (dafuer gibt es neun
   * verschiedene), und der Farbton ist ausschliesslich Zustand. Die drei
   * Stufen sagen nur, wie schwer der Brocken ist.
   */
  koerperLeicht: '#4c5d7e',
  koerperMittel: '#374663',
  koerperSchwer: '#28324c',

  kristall: '#4fe0ff',
  kristallKern: '#e8fbff',

  text: '#eef2fb',
  textSchwach: '#8291ad',
  textHervor: '#ffcb3d',

  /*
   * Zustandsfarben - die einzigen gesaettigten Toene im ganzen Spiel.
   *
   * Sie sind knapp gehalten, weil jede weitere die vorhandenen entwertet: Wenn
   * alles leuchtet, sagt Leuchten nichts mehr. Ein Test haelt fest, dass keine
   * zwei zu nah beieinander liegen.
   */
  gefahr: '#ff3a52',
  heilung: '#4fe6a0',
  krit: '#ffcb3d',
  treffer: '#fff6e2',
  /** Ein offener Riss - die Kernregel, und deshalb die auffaelligste Farbe. */
  riss: '#7fd4ff',

  /**
   * Karten liegen **ueber** dem Feld: dunkles Glas, das eine Kante faengt.
   *
   * Auf dem Nachtfeld waeren helle Platten Scheinwerfer und wuerden das
   * Getuemmel dahinter erschlagen. Stattdessen sind sie nur wenig heller als
   * der Grund und tragen ihr Gewicht ueber eine leuchtende Oberkante - so
   * bleibt der Lauf sichtbar und die Karte trotzdem vorne.
   */
  kartenGrund: '#131a2c',
  kartenGrundTief: '#0d1322',
  kartenRand: '#03040a',
  kartenRandAktiv: '#ffcb3d',
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
 * Schrift - drei Rollen, nicht eine.
 *
 * Vorher stand hier genau ein Eintrag, und Titel, Fließtext und Zahlen teilten
 * ihn sich: eine Monospace fuer alles. Das ist der zuverlaessigste Hinweis
 * darauf, dass eine Oberflaeche von jemandem gebaut wurde, der Code schreibt -
 * Monospace im Fließtext kommt in keinem Spiel vor, das jemand verkauft.
 *
 * Die Anzeigeschrift wird **mitgeliefert** (`public/schrift/`, SIL Open Font
 * License, Lizenztext daneben). Das bricht mit "keine Asset-Dateien", und das
 * ist die Sache wert: 22 kB liegen lokal im Projekt, werden nicht nachgeladen
 * und funktionieren im spaeteren Steam-Paket genauso wie im Browser. Der erste
 * Bildaufbau wartet in `main.ts` auf `document.fonts.ready`, sonst blitzt ein
 * Bild in der Ersatzschrift auf.
 *
 * **Zahlen bleiben Monospace.** Uhr, Punkte und Trefferzahlen zaehlen hoch,
 * und in einer Proportionalschrift springt dabei die ganze Zeile - das ist
 * genau der Grund, aus dem es Tabellenziffern gibt.
 */
const GROTESK = '"Space Grotesk", "Segoe UI", system-ui, sans-serif'

export const SCHRIFT = {
  /** Ueberschriften, Titel, Namen - alles, was groß steht. */
  anzeige: GROTESK,
  /** Fließtext auf Karten und Platten. */
  text: GROTESK,
  /** Nur Zahlen. */
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
