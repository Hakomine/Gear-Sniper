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
   * Tinte auf Papier. Vier Werte, und jeder sagt etwas.
   *
   * Die Bildsprache hat dreimal die Richtung gewechselt, und der dritte
   * Wechsel ist der einzige, der aus einer *Diagnose* kam statt aus einem
   * Geschmacksurteil.
   *
   * Zuerst war der Grund fast schwarz und alles darauf ebenfalls dunkel - es
   * gab keine Ebene, nur Umrisse. Dann wurde der Grund mittelhell, damit
   * gefuellte Koerper mit dunkler Kontur sich freischneiden; das hat
   * funktioniert, sah aber nach Aufklebern auf Millimeterpapier aus. Dann kam
   * Nacht plus Leuchten - und die Rueckmeldung war, dass es damit *noch mehr*
   * nach Maschine aussieht.
   *
   * Das war kein Geschmacksurteil, sondern nachweisbar. Die dokumentierte
   * Handschrift maschinell erzeugter Gestaltung ist woertlich "neon-on-dark
   * (cyan/violet) with glowing card borders" - also genau das, was hier stand.
   * Wer diese Palette waehlt, waehlt die statistische Voreinstellung, und man
   * sieht ihr das an.
   *
   * Jetzt: Druck. Ein Verfahren, das nur Tinte kennt und Papier - und das
   * deshalb gar nicht leuchten *kann*. Farbton ist ab hier keine Dekoration
   * mehr, sondern eine von vier Aussagen:
   *
   *   Tinte    - die Welt, die Gegner, alles Feste
   *   Papier   - der Bruch, das Fehlende, und der Spieler
   *   Zinnober - es kann dir wehtun
   *   Ocker    - es ist gut fuer dich
   *
   * Vier statt dreizehn. Der Spieler ist damit ein *weisses Loch* in einer
   * schwarzen Masse, und das ist bei 1400 Gegnern die staerkste Lesbarkeit,
   * die es gibt - ohne eine einzige zusaetzliche Farbe.
   */

  /** Warmes, leicht gealtertes Weiss. Reines #fff waere Bildschirm, nicht Papier. */
  grund: '#e9e3d5',
  /** Flecken, Korn, der Schatten unter einem Schnipsel. */
  grundTief: '#d8cfbb',
  /** Die gedruckten Hilfslinien - so blass, dass sie das Feld nicht zustellen. */
  gitter: '#cfc5ae',
  gitterStark: '#b8ab90',

  /**
   * Die Tinte. Ein einziges warmes Schwarz um *alles*, was lebt.
   *
   * Bewusst nicht `#000000`: Reines Schwarz gibt es im Druck nicht, und das
   * Auge liest es sofort als Bildschirm. Ein Schwarz mit einem Rest Braun
   * darin liest sich als Farbe, die einmal fluessig war.
   */
  kontur: '#16120f',
  schatten: 'rgba(22, 18, 15, 0.22)',

  /**
   * Der Spieler ist Papier.
   *
   * Er ist das einzige Ding im Bild, aus dem die Tinte *herausgenommen*
   * wurde - und damit findet man ihn in jeder Masse sofort, ohne dass er
   * heller, groesser oder bunter sein muss als alles andere.
   */
  spieler: '#f6f2e8',
  spielerKern: '#ffffff',
  spielerRing: '#c28a24',
  geschoss: '#16120f',

  /*
   * Gegnerkoerper: drei Tintendichten, kein Farbton.
   *
   * Im Linolschnitt ist das die echte Abstufung - wie satt die Walze
   * aufgetragen hat. Ein schwerer Brocken ist voll durchgedruckt, ein
   * Splitter nur angetupft.
   */
  koerperLeicht: '#625849',
  koerperMittel: '#3a332b',
  koerperSchwer: '#16120f',

  kristall: '#c28a24',
  kristallKern: '#e6c377',

  text: '#16120f',
  textSchwach: '#6b6153',
  textHervor: '#c28a24',

  /*
   * Die beiden Druckfarben - die einzigen gesaettigten Toene im ganzen Spiel.
   *
   * Zwei, weil eine Presse zwei Durchgaenge macht. Jede weitere Farbe
   * entwertet die vorhandenen: Wenn alles etwas bedeutet, bedeutet nichts
   * mehr etwas.
   */
  /** Zinnober. Alles, was dir wehtun kann - Vorwarnung, Schuss, Boss, Kern. */
  gefahr: '#c4362b',
  /** Ocker. Alles, was dir guttut - Kristalle, Krit, Schreine, Stufe. */
  heilung: '#c28a24',
  krit: '#c28a24',
  /** Ein Treffer nimmt Tinte weg, er legt keine drauf. */
  treffer: '#f6f2e8',
  /**
   * Ein offener Riss - die Kernregel, und deshalb das Auffaelligste im Bild.
   *
   * Er ist *keine Farbe*, sondern eine Kerbe: eine Stelle, an der die Tinte
   * fehlt. Damit ist das, wonach das Spiel benannt ist, endlich auch das,
   * was man zuerst sieht.
   */
  riss: '#f6f2e8',

  /**
   * Karten sind Papierschnipsel, keine Platten.
   *
   * Vorher: dunkles Glas mit leuchtender Oberkante - laut Recherche woertlich
   * "glowing card borders", der zweite Teil derselben Handschrift. Jetzt
   * liegt schlicht ein Stueck Papier auf dem Papier, ein wenig heller, mit
   * gerissener Kante und einem Schatten darunter.
   */
  kartenGrund: '#f2ede1',
  kartenGrundTief: '#e2dacb',
  kartenRand: '#16120f',
  kartenRandAktiv: '#c4362b',
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
  /*
   * Seltenheit im Druck: nicht vier Farben, sondern vier Tiefen.
   *
   * Die gewohnte Skala grau -> blau -> violett -> gold braucht vier
   * Farbtoene, und dieses Spiel hat nur zwei. Statt sie zu erfinden, sagt
   * hier die *Menge Tinte*, was eine Karte wert ist: Gewoehnliches ist
   * blass gedruckt, Legendaeres steht im Ocker der Presse, und die Fusion
   * bekommt als einzige den Zinnober - sie ist der Sonderfall, den es
   * hoechstens einmal je Lauf gibt.
   */
  gewoehnlich: '#8a8072',
  selten: '#4f4639',
  episch: '#16120f',
  legendaer: '#c28a24',
  fusion: '#c4362b',
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
