import { tagesSaat } from '../core/rng'
import type { Charakter } from '../game/charaktere'
import { CHARAKTERE } from '../game/charaktere'
import type { PauseEintrag, Spielstand } from '../game/state'
import { PAUSE_EINTRAEGE } from '../game/state'
import { charakterAnzeige, CHRONIK_SICHTBAR } from '../game/chronik'
import { tuerMit } from '../game/etappen'
import type { Aufwertung } from '../game/upgrades'
import { VERHEXUNGEN, verhexungsFaktor } from '../game/verhexungen'
import { SELTENHEIT_NAME } from '../game/weapons'
import { DORNEN_PLATZ, GEIST_PLATZ, SPLITTER_PLATZ } from '../game/welt'
import { massivePlatte, randSpruenge, schraegBalken, sprungOverlay } from '../render/glas'
import { FARBEN, mitAlpha, SCHRIFT, SELTENHEIT_FARBE } from '../render/palette'
import { kommaText, TEXTE, zahlText, zeitText } from './strings'

/**
 * Titel-, Levelup- und Todesbildschirm.
 *
 * Alles hier ist aus Glas: kantige Platten statt abgerundeter Karten,
 * Bruchlinien statt gleichmaessiger Rahmen, ein Titel mit einem Sprung
 * mittendurch. Das Spiel heisst Scherbenfeld - die Oberflaeche soll aussehen,
 * als gehoere sie dazu, und nicht wie eine Vorlage.
 *
 * Alle drei lesen den Spielstand nur. Die Auswahl selbst passiert in
 * `state.ts`, damit sie ohne Browser testbar bleibt.
 */

// ---------------------------------------------------------------------------
// Titelbild mit Charakterwahl
// ---------------------------------------------------------------------------

export function zeichneTitel(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  schleier(ctx, breite, hoehe, 0.78)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  gesprungenerTitel(ctx, breite / 2, 108)

  const gewaehlt = CHARAKTERE[s.charakterWahl] ?? CHARAKTERE[0]
  const offen = s.offen.includes(gewaehlt.id)
  zeichneCharakterPlatte(ctx, gewaehlt, offen, breite / 2, 200)
  zeichneVerhexungen(ctx, s, breite / 2, 496)
  // Links die Tagesscherbe, rechts die Chronik - beide in den Raum neben der
  // Charakterplatte, der sonst leer stand, und buendig mit deren Oberkante.
  zeichneTagesscherbe(ctx, s, 26, 200)
  zeichneChronik(ctx, s, breite - 26 - SEITE_B, 200)
  zeichnePunkte(ctx, s, breite / 2, hoehe - 132)

  // Ausrichtung zuruecksetzen: Die Chronik zeichnet ihre Zeilen linksbuendig,
  // und `textAlign` ist Zustand am Kontext - ohne diese Zeile stand die
  // Hinweiszeile darunter nach rechts verschoben.
  ctx.textAlign = 'center'
  ctx.font = `400 16px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.charakterHinweis, breite / 2, hoehe - 42)

  ctx.textBaseline = 'alphabetic'
}

/**
 * Der Titel, von einem Sprung geteilt.
 *
 * Die beiden Haelften sind gegeneinander versetzt, als waere die Schrift
 * selbst gebrochen. Zweimal beschnitten gezeichnet - billiger und schaerfer,
 * als die Buchstaben von Hand nachzubauen.
 */
function gesprungenerTitel(ctx: CanvasRenderingContext2D, mx: number, my: number): void {
  /*
   * Der Titel wird von einem gesprungenen Druckstock gedruckt.
   *
   * Das ist das Bild, das spaeter auf die Steam-Seite kommt, und es muss das
   * staerkste im ganzen Spiel sein. Zwei Fassungen davor sind gescheitert: die
   * erste hat das Wort waagerecht durchgeschnitten und die Haelften versetzt -
   * gemeint als Sprung im Glas, gelesen als Durchstreichung, und ein Strich
   * durch Text heisst ueberall *ungueltig*. Die zweite war schlicht gesetzte
   * Schrift mit Versatzschatten, also genau das, was jede Vorlage macht.
   *
   * Jetzt tut das Wort, was das Spiel tut: Es zerbricht. Der Stock ist
   * gesprungen, die Teile sitzen nicht mehr genau, und quer durch die
   * Buchstaben laufen Kerben, in denen keine Tinte liegt.
   *
   * Umgesetzt ueber eine Nebenleinwand: Text einmal setzen, dann bandweise mit
   * Versatz zurueckkopieren. Damit bleiben es echte Buchstabenformen aus der
   * mitgelieferten Schrift - zwoelf von Hand gebaute Glyphen waeren Wochen
   * Arbeit und saehen schlechter aus - in einem Zustand, den keine
   * Schriftdatei liefert.
   */
  const text = TEXTE.titel
  ctx.textAlign = 'center'

  const stock = druckstock(ctx, text)
  if (stock === null) {
    // Ohne Nebenleinwand lieber schlicht als gar nicht: Ein fehlendes
    // Titelbild waere schlimmer als ein ungebrochenes.
    ctx.font = `700 ${TITEL_GROESSE}px ${SCHRIFT.anzeige}`
    ctx.fillStyle = FARBEN.kontur
    ctx.fillText(text, mx, my)
  } else {
    const x = mx - stock.width / 2
    const y = my - stock.height / 2

    /*
     * Drei Baender, jedes um ein paar Punkte verschoben.
     *
     * Waagerecht geschnitten und nicht schraeg: Ein schraeger Schnitt durch
     * Grossbuchstaben laesst einzelne Buchstaben kippen und liest sich als
     * Fehler. Ein waagerechter Versatz liest sich als *Druck*, weil genau das
     * passiert, wenn ein Stock in Stuecken auf dem Karren liegt.
     */
    for (let i = 0; i < BAENDER.length; i++) {
      const [von, bis, dx, dy] = BAENDER[i]
      const h = stock.height * (bis - von)
      ctx.drawImage(
        stock,
        0, stock.height * von, stock.width, h,
        x + dx, y + stock.height * von + dy, stock.width, h,
      )
    }
  }

  ctx.font = `400 19px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.untertitel, mx, my + 62)
}

/** Schriftgroesse des Titels - an zwei Stellen gebraucht. */
const TITEL_GROESSE = 78

/**
 * Die Baender, in die der Stock gesprungen ist.
 *
 * Je Eintrag: von, bis (Anteil der Hoehe), Versatz waagerecht, Versatz
 * senkrecht. Von Hand gesetzt und nicht gewuerfelt - das Titelbild ist das
 * eine Bild im Spiel, das jedes Mal gleich aussehen muss, und drei Zahlenpaare
 * sind ehrlicher als ein Saatwert, der so lange gedreht wird, bis es passt.
 *
 * Die Versaetze sind klein. Ein Wort, das um zwanzig Punkte auseinanderfaellt,
 * ist nicht mehr zu lesen, und ein Titel, den man buchstabieren muss, hat
 * seine Aufgabe verfehlt.
 */
const BAENDER: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0.38, -3, 0],
  [0.38, 0.72, 4, 1],
  [0.72, 1, -1, 3],
]

/**
 * Der Druckstock: das Wort einmal gesetzt, mit Kerben darin.
 *
 * Einmal gebaut und behalten. Ihn je Bild neu zu setzen waere dieselbe Sorte
 * Verschwendung, die die Pools im ganzen Projekt vermeiden - und das Titelbild
 * laeuft, solange niemand eine Taste drueckt.
 */
let titelStock: HTMLCanvasElement | null = null

function druckstock(ctx: CanvasRenderingContext2D, text: string): HTMLCanvasElement | null {
  if (titelStock !== null) return titelStock

  ctx.font = `700 ${TITEL_GROESSE}px ${SCHRIFT.anzeige}`
  const breite = Math.ceil(ctx.measureText(text).width) + 40
  const hoehe = TITEL_GROESSE + 40

  const c = document.createElement('canvas')
  c.width = breite
  c.height = hoehe
  const k = c.getContext('2d')
  if (k === null) return null

  k.font = `700 ${TITEL_GROESSE}px ${SCHRIFT.anzeige}`
  k.textAlign = 'center'
  k.textBaseline = 'middle'
  k.fillStyle = FARBEN.kontur
  k.fillText(text, breite / 2, hoehe / 2)

  /*
   * Die Kerben - und hier steckt der eigentliche Griff.
   *
   * Sie werden mit `destination-out` gezeichnet, nehmen die Tinte also
   * *weg*, statt eine helle Linie darauf zu legen. Damit ist die Kerbe auch
   * dann Papier, wenn der Titel spaeter auf einem anderen Grund steht - und
   * genau das ist der Unterschied zwischen "durchgestrichen" und "gebrochen".
   */
  k.globalCompositeOperation = 'destination-out'
  k.lineCap = 'round'
  k.lineJoin = 'round'
  for (const [x1, y1, x2, y2, b] of KERBEN) {
    k.beginPath()
    k.moveTo(breite * x1, hoehe * y1)
    // Der Knick sitzt nicht in der Mitte: Genau mittig geknickt liest sich als
    // Zickzack-Muster, leicht daneben als Sprung.
    k.lineTo(breite * (x1 + (x2 - x1) * 0.42), hoehe * (y1 + (y2 - y1) * 0.42) - 4)
    k.lineTo(breite * x2, hoehe * y2)
    k.lineWidth = b
    k.stroke()
  }

  titelStock = c
  return c
}

/**
 * Wo die Kerben durch das Wort laufen.
 *
 * Je Eintrag: Anfang und Ende als Anteil von Breite und Hoehe, dann die
 * Breite der Kerbe. Zwei kraeftige, die durch das ganze Wort gehen, und zwei
 * feine als Ausfransung - so sieht ein gesprungener Stock aus, und nicht wie
 * zwei parallele Striche.
 */
const KERBEN: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [-0.02, 0.34, 1.02, 0.44, 5],
  [-0.02, 0.71, 1.02, 0.63, 4],
  [0.18, 0.2, 0.31, 0.8, 2],
  [0.62, 0.18, 0.71, 0.82, 2],
]

/** Breite der beiden Seitenplatten auf dem Titelbild. */
const SEITE_B = 300

/**
 * Die Chronik: die besten fuenf Laeufe mit ihrer Geschichte.
 *
 * Ein Bestwert allein sagt, wie hoch jemand gekommen ist, nicht *wie*. Erst
 * mit Charakter, Etappe, Zerruettung und der Zahl der Verhexungen daneben
 * wird aus einer Zahl ein Vergleich - und genau das ist der Punkt einer
 * Bestenliste.
 */
function zeichneChronik(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  x: number,
  y: number,
): void {
  // Dieselbe Hoehe wie die Charakterplatte - die drei stehen als eine Reihe.
  massivePlatte(ctx, x, y, SEITE_B, PLATTE_H, {
    grund: FARBEN.kartenGrundTief,
    kontur: FARBEN.kontur,
    akzent: FARBEN.spielerRing,
    ecke: 16,
  })

  ctx.textAlign = 'left'
  ctx.font = `700 12px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.spielerRing
  ctx.fillText(TEXTE.chronik, x + 18, y + 26)

  if (s.chronik.length === 0) {
    ctx.font = `400 14px ${SCHRIFT.text}`
    ctx.fillStyle = FARBEN.textSchwach
    ctx.fillText(TEXTE.chronikLeer, x + 18, y + 58)
    return
  }

  let zy = y + 58
  for (let i = 0; i < Math.min(CHRONIK_SICHTBAR, s.chronik.length); i++) {
    const e = s.chronik[i]
    const c = charakterAnzeige(e.charakter)

    // Der Kranz vor dem Namen markiert einen Sieg ueber den Kern - das
    // Einzige, was ein Lauf erreichen kann und nicht nur ansammelt.
    ctx.font = `700 16px ${SCHRIFT.mono}`
    ctx.fillStyle = FARBEN.text
    ctx.fillText(zahlText(e.punkte), x + 18, zy)

    ctx.textAlign = 'right'
    ctx.font = `600 12px ${SCHRIFT.text}`
    ctx.fillStyle = c.farbe
    ctx.fillText(c.name, x + SEITE_B - 18, zy - 2)

    // Die Marke fuer einen Sieg wird gezeichnet, nicht getippt: Ein Zeichen wie
    // "◈" liegt ausserhalb des mitgelieferten Schriftschnitts und faellt damit
    // auf irgendeine Systemschrift zurueck - genau die Unschaerfe, die diese
    // Runde loswerden soll. Eine Raute aus vier Linien sieht ueberall gleich aus.
    if (e.gewonnen) {
      const mx = x + SEITE_B - 26 - ctx.measureText(c.name).width
      ctx.beginPath()
      ctx.moveTo(mx, zy - 8)
      ctx.lineTo(mx + 5, zy - 3)
      ctx.lineTo(mx, zy + 2)
      ctx.lineTo(mx - 5, zy - 3)
      ctx.closePath()
      ctx.fillStyle = FARBEN.spielerRing
      ctx.fill()
    }

    ctx.font = `400 11px ${SCHRIFT.mono}`
    ctx.fillStyle = FARBEN.textSchwach
    // Wehrhaft gegen halbe Eintraege: `leseChronik` raeumt zwar auf, was aus
    // dem Speicher kommt - aber ein Zeichner, der an einem fehlenden Feld
    // abbricht, nimmt den *ganzen* Bildschirm mit. Genau das ist beim ersten
    // Screenshot passiert: Ein unvollstaendiger Testeintrag hat die
    // Charakterreihe darunter verschluckt.
    const teile = [`E${e.etappe ?? 1}`]
    if ((e.zerruettung ?? 0) > 0) teile.push(`Z${e.zerruettung}`)
    const hexen = e.verhexungen?.length ?? 0
    if (hexen > 0) teile.push(`${hexen}×V`)
    if (e.tag) teile.push('Tag')
    ctx.fillText(teile.join(' · '), x + SEITE_B - 18, zy + 13)

    ctx.textAlign = 'left'
    zy += 38
  }
}

/**
 * Die Tagesscherbe.
 *
 * Ein Saatwert aus dem Datum, ein Versuch, fuer alle derselbe. Das Spiel
 * benutzt nirgends `Math.random()`, deshalb ergibt derselbe Wert wirklich
 * dieselben Gegner, Tueren und Schreine - das ist die naechste Verwandte
 * einer Online-Bestenliste, die ohne Server moeglich ist.
 */
function zeichneTagesscherbe(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  x: number,
  y: number,
): void {
  const h = 116
  const offen = s.tagStand !== tagesSaat()
  massivePlatte(ctx, x, y, SEITE_B, h, {
    grund: offen ? FARBEN.kartenGrund : FARBEN.kartenGrundTief,
    kontur: FARBEN.kontur,
    akzent: offen ? FARBEN.kristall : FARBEN.textSchwach,
    aktiv: offen,
    ecke: 16,
  })

  ctx.textAlign = 'left'
  ctx.font = `700 12px ${SCHRIFT.text}`
  ctx.fillStyle = offen ? FARBEN.kristall : FARBEN.textSchwach
  ctx.fillText(TEXTE.tagesscherbe, x + 18, y + 26)

  ctx.font = `400 13px ${SCHRIFT.text}`
  ctx.fillStyle = offen ? FARBEN.text : FARBEN.textSchwach
  umbrochenerLinks(
    ctx,
    offen ? TEXTE.tagesscherbeFrei : TEXTE.tagesscherbeWeg,
    x + 18,
    y + 56,
    SEITE_B - 36,
    18,
  )
}

/** Kachelmasse der Verhexungsreihe. */
const HEX_B = 150
const HEX_H = 52
const HEX_LUECKE = 8

/**
 * Die Verhexungsreihe unter der Charakterwahl.
 *
 * Sie steht bewusst auf dem Titelbild und nicht in einem eigenen Menue: Wer
 * sie nicht sieht, benutzt sie nie, und dann ist der Regler umsonst gebaut.
 * Aus, ist sie eine graue Leiste, die niemanden stoert; an, faerbt sie sich
 * und der Punktefaktor darunter steigt sichtbar mit.
 *
 * Der Faktor steht in derselben Zeile wie die Wirkung der gerade angewaehlten:
 * Man liest den Preis und den Lohn nebeneinander, genau wie auf den Tueren.
 */
function zeichneVerhexungen(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  mx: number,
  y: number,
): void {
  const n = VERHEXUNGEN.length
  const gesamt = n * HEX_B + (n - 1) * HEX_LUECKE
  const aktiveReihe = s.titelZeile === 1
  let x = mx - gesamt / 2

  ctx.textAlign = 'center'
  ctx.font = `700 12px ${SCHRIFT.text}`
  ctx.fillStyle = aktiveReihe ? FARBEN.spielerRing : FARBEN.textSchwach
  ctx.fillText(TEXTE.verhexungen, mx, y - 16)

  for (let i = 0; i < n; i++) {
    const v = VERHEXUNGEN[i]
    const an = s.verhexungen.includes(v.id)
    const hier = aktiveReihe && i === s.verhexungWahl

    massivePlatte(ctx, x, y, HEX_B, HEX_H, {
      grund: an ? FARBEN.kartenGrund : FARBEN.kartenGrundTief,
      kontur: FARBEN.kontur,
      akzent: an ? v.farbe : FARBEN.kartenRand,
      aktiv: hier,
      ecke: 12,
    })

    ctx.font = `700 15px ${SCHRIFT.text}`
    ctx.fillStyle = an ? v.farbe : FARBEN.textSchwach
    ctx.fillText(v.name, x + HEX_B / 2, y + 24)
    ctx.font = `600 12px ${SCHRIFT.mono}`
    ctx.fillStyle = an ? FARBEN.text : FARBEN.textSchwach
    ctx.fillText(`+${Math.round(v.bonus * 100)} %`, x + HEX_B / 2, y + 42)

    x += HEX_B + HEX_LUECKE
  }

  // Die Wirkung der gerade angewaehlten - und was der ganze Stapel bringt.
  const faktor = verhexungsFaktor(s.verhexungen)
  const fokus = VERHEXUNGEN[s.verhexungWahl]
  ctx.font = `400 14px ${SCHRIFT.text}`
  ctx.fillStyle = aktiveReihe ? FARBEN.text : FARBEN.textSchwach
  const zeile =
    aktiveReihe && fokus !== undefined
      ? `${fokus.wirkung}  ·  Punkte ×${kommaText(faktor, 2)}`
      : s.verhexungen.length === 0
        ? TEXTE.verhexungKeine
        : `${s.verhexungen.length} gewählt  ·  Punkte ×${kommaText(faktor, 2)}`
  ctx.fillText(zeile, mx, y + HEX_H + 18)
}

/** Groesse der Charakterplatte auf dem Titelbild. */
const PLATTE_B = 560
const PLATTE_H = 258

function zeichneCharakterPlatte(
  ctx: CanvasRenderingContext2D,
  c: Charakter,
  offen: boolean,
  mx: number,
  y: number,
): void {
  const x = mx - PLATTE_B / 2
  const saat = c.id.length * 37 + c.name.charCodeAt(0)
  const rand = offen ? c.farbe : FARBEN.textSchwach

  ctx.save()

  massivePlatte(ctx, x, y, PLATTE_B, PLATTE_H, {
    grund: offen ? FARBEN.kartenGrund : FARBEN.kartenGrundTief,
    kontur: FARBEN.kontur,
    akzent: rand,
    aktiv: offen,
  })
  // Die Sprünge sitzen im oberen Streifen, weit ueber jeder Textzeile.
  randSpruenge(ctx, x, y, PLATTE_B, 26, saat, mitAlpha(rand, 0.45))

  // Das Wappen: derselbe Koerper, den man gleich spielt, in Gross.
  zeichneWappen(ctx, c, offen, x + 82, y + PLATTE_H / 2 + 6)

  ctx.textAlign = 'center'
  ctx.font = `700 34px ${SCHRIFT.anzeige}`
  ctx.fillStyle = offen ? c.farbe : FARBEN.textSchwach
  ctx.fillText(c.name, mx + 46, y + 52)

  if (!offen && c.bedingung !== null) {
    ctx.font = `700 13px ${SCHRIFT.text}`
    ctx.fillStyle = FARBEN.gefahr
    ctx.fillText(TEXTE.gesperrt, mx + 46, y + 92)
    ctx.font = `400 17px ${SCHRIFT.text}`
    ctx.fillStyle = FARBEN.textSchwach
    umbrochenerText(ctx, c.bedingung.text, mx + 46, y + 130, PLATTE_B - 200, 24)
    ctx.restore()
    return
  }

  ctx.font = `400 16px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  umbrochenerText(ctx, c.beschreibung, mx + 46, y + 84, PLATTE_B - 210, 22)

  ctx.textAlign = 'left'
  const lx = x + 172
  ctx.font = `700 13px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.heilung
  ctx.fillText(TEXTE.vorteil.toUpperCase(), lx, y + 132)
  ctx.font = `400 15px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.text
  umbrochenerLinks(ctx, c.vorteil, lx, y + 154, PLATTE_B - 214, 20)

  ctx.font = `700 13px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.gefahr
  ctx.fillText(TEXTE.nachteil.toUpperCase(), lx, y + 196)
  ctx.font = `400 15px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.text
  umbrochenerLinks(ctx, c.nachteil, lx, y + 218, PLATTE_B - 214, 20)

  ctx.textAlign = 'right'
  ctx.font = `600 14px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textHervor
  ctx.fillText(`×${kommaText(c.punkteFaktor, 2)}`, x + PLATTE_B - 42, y + 52)
  ctx.font = `400 11px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.punkteFaktor, x + PLATTE_B - 42, y + 68)

  ctx.restore()
}

/**
 * Das Wappen eines Charakters.
 *
 * Vorher stand auf der Auswahl nur Text - man waehlte eine Beschreibung, keine
 * Figur. Hier steht jetzt derselbe Koerper, den man gleich steuert: cremiger
 * Kreis, dunkle Kontur, Ring in der Charakterfarbe. Dazu ein Zeichen, das die
 * Mechanik andeutet, statt sie nur zu behaupten.
 *
 * Gezeichnet und nicht gemalt: Das Spiel hat keine Bilddateien, und das soll
 * so bleiben - eine Figur aus Pfaden skaliert auf jeden Bildschirm und wiegt
 * nichts.
 */
function zeichneWappen(
  ctx: CanvasRenderingContext2D,
  c: Charakter,
  offen: boolean,
  x: number,
  y: number,
): void {
  const r = 34
  const farbe = offen ? c.farbe : FARBEN.textSchwach

  // Hof in der Charakterfarbe - er traegt das Wappen und trennt es vom Grund.
  ctx.beginPath()
  ctx.arc(x, y, r * 1.85, 0, Math.PI * 2)
  ctx.fillStyle = mitAlpha(farbe, offen ? 0.16 : 0.07)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, r * 1.5, 0, Math.PI * 2)
  ctx.strokeStyle = mitAlpha(farbe, offen ? 0.85 : 0.35)
  ctx.lineWidth = 3
  ctx.stroke()

  zeichneWappenZeichen(ctx, c.id, x, y, r, farbe, offen)

  // Der Koerper zuletzt, damit er auf allem liegt - genau wie im Spiel.
  ctx.beginPath()
  ctx.arc(x, y + 4, r * 0.92, 0, Math.PI * 2)
  ctx.fillStyle = FARBEN.schatten
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.9, 0, Math.PI * 2)
  ctx.fillStyle = offen ? FARBEN.spieler : FARBEN.kartenGrund
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2)
  ctx.fillStyle = offen ? farbe : FARBEN.textSchwach
  ctx.fill()
}

/** Je Charakter ein Zeichen, das seine Mechanik andeutet. */
function zeichneWappenZeichen(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  r: number,
  farbe: string,
  offen: boolean,
): void {
  ctx.save()
  ctx.strokeStyle = mitAlpha(farbe, offen ? 0.9 : 0.4)
  ctx.fillStyle = mitAlpha(farbe, offen ? 0.9 : 0.4)
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  const weit = r * 1.5

  switch (id) {
    case 'schleiferin':
      // Ein Bogenhieb - die Klinge, mit der sie startet.
      ctx.beginPath()
      ctx.arc(x, y, weit * 0.78, -0.9, 0.9)
      ctx.stroke()
      break
    case 'sammler':
      // Kristalle, die hereinfliegen.
      for (let i = 0; i < 3; i++) {
        const w = -0.7 + i * 0.7
        const d = weit * (0.72 + i * 0.1)
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(w) * d, y + Math.sin(w) * d - 5)
        ctx.lineTo(x + Math.cos(w) * d + 5, y + Math.sin(w) * d)
        ctx.lineTo(x + Math.cos(w) * d, y + Math.sin(w) * d + 5)
        ctx.lineTo(x + Math.cos(w) * d - 5, y + Math.sin(w) * d)
        ctx.closePath()
        ctx.fill()
      }
      break
    case 'riss':
      // Der Geisterriss: drei Sprünge, die vom Koerper wegzeigen.
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const w = -2.2 + i * 1.5
        ctx.moveTo(x + Math.cos(w) * r * 1.0, y + Math.sin(w) * r * 1.0)
        ctx.lineTo(x + Math.cos(w + 0.2) * weit, y + Math.sin(w + 0.2) * weit)
      }
      ctx.stroke()
      break
    case 'koloss':
      // Dornen ringsum.
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const w = (i / 8) * Math.PI * 2
        ctx.moveTo(x + Math.cos(w) * weit * 0.98, y + Math.sin(w) * weit * 0.98)
        ctx.lineTo(x + Math.cos(w) * weit * 1.3, y + Math.sin(w) * weit * 1.3)
      }
      ctx.stroke()
      break
    case 'prismatikerin': {
      // Ein Strahl, der sich bricht.
      ctx.beginPath()
      ctx.moveTo(x - weit * 1.25, y + weit * 0.5)
      ctx.lineTo(x, y)
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(x, y)
        ctx.lineTo(x + weit * 1.25, y - weit * 0.45 + i * weit * 0.45)
      }
      ctx.stroke()
      break
    }
    case 'kernscherbe': {
      // Drei Risse, die auf *sie* zeigen statt von ihr weg - der Unterschied
      // zum Riss-Charakter daneben, in einem Bild. Dazu der Ring, den ihre
      // eigene Zersplitterung schlaegt.
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const w = (i / 3) * Math.PI * 2 - Math.PI / 3
        ctx.moveTo(x + Math.cos(w) * weit * 1.35, y + Math.sin(w) * weit * 1.35)
        ctx.lineTo(x + Math.cos(w + 0.28) * r * 0.5, y + Math.sin(w + 0.28) * r * 0.5)
      }
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, weit * 1.32, 0, Math.PI * 2)
      ctx.setLineDash([4, 8])
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.setLineDash([])
      break
    }
    default:
      // Splitter: der Grundzustand, ein schlichter Ring.
      ctx.beginPath()
      ctx.arc(x, y, weit * 1.2, 0, Math.PI * 2)
      ctx.setLineDash([6, 10])
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.setLineDash([])
      break
  }
  ctx.restore()
}

/** Punkte-Kaestchen unten am Titelbild: welcher Charakter, wie weit man kam. */
function zeichnePunkte(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  mx: number,
  y: number,
): void {
  /*
   * Die Charakterreihe als Kacheln statt als Zeichenkette.
   *
   * Vorher standen dort Rauten aus der Schriftart - je nach System sahen sie
   * verschieden aus, und ein gesperrter Charakter war ein Punkt, den man kaum
   * sah. Gezeichnete Kacheln tragen ihre Farbe und zeigen auf einen Blick, wie
   * viele es ueberhaupt gibt.
   */
  const kachel = 22
  const luecke = 10
  const gesamt = CHARAKTERE.length * kachel + (CHARAKTERE.length - 1) * luecke
  let kx = mx - gesamt / 2

  for (let i = 0; i < CHARAKTERE.length; i++) {
    const c = CHARAKTERE[i]
    const offen = s.offen.includes(c.id)
    const hier = i === s.charakterWahl

    ctx.fillStyle = FARBEN.kontur
    ctx.fillRect(kx, y - kachel / 2 + 3, kachel, kachel)
    ctx.fillStyle = offen ? c.farbe : FARBEN.kartenGrundTief
    ctx.fillRect(kx, y - kachel / 2, kachel, kachel)
    ctx.lineWidth = hier ? 3 : 2
    ctx.strokeStyle = hier ? FARBEN.spieler : FARBEN.kontur
    ctx.strokeRect(kx + 1, y - kachel / 2 + 1, kachel - 2, kachel - 2)
    kx += kachel + luecke
  }

  if (s.bestwert <= 0) return
  ctx.textAlign = 'center'
  ctx.font = `600 15px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(`${TEXTE.bestwert}: ${zahlText(s.bestwert)}`, mx, y + 34)
}

// ---------------------------------------------------------------------------
// Levelup
// ---------------------------------------------------------------------------

const KARTE_B = 292
const KARTE_H = 220
const KARTE_LUECKE = 26

export function zeichneLevelup(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  schleier(ctx, breite, hoehe, 0.68)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const kopf = s.bossKarte ? 'BOSSBEUTE' : TEXTE.levelup
  const kopfFarbe = s.bossKarte ? SELTENHEIT_FARBE.legendaer : FARBEN.spielerRing
  ctx.font = `700 34px ${SCHRIFT.anzeige}`
  const kopfB = ctx.measureText(kopf).width + 76
  massivePlatte(ctx, breite / 2 - kopfB / 2, hoehe / 2 - 206, kopfB, 58, {
    grund: FARBEN.kartenGrund,
    kontur: FARBEN.kontur,
    akzent: kopfFarbe,
    aktiv: true,
    ecke: 16,
  })
  ctx.fillStyle = kopfFarbe
  ctx.fillText(kopf, breite / 2, hoehe / 2 - 174)

  const anzahl = s.angebote.length
  const gesamt = anzahl * KARTE_B + (anzahl - 1) * KARTE_LUECKE
  const startX = (breite - gesamt) / 2
  const y = hoehe / 2 - KARTE_H / 2 + 12

  for (let i = 0; i < anzahl; i++) {
    zeichneKarte(ctx, s.angebote[i], startX + i * (KARTE_B + KARTE_LUECKE), y, i, i === s.auswahl)
  }

  ctx.font = `400 16px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.levelupHinweis, breite / 2, hoehe / 2 + 166)

  ctx.textBaseline = 'alphabetic'
}

function zeichneKarte(
  ctx: CanvasRenderingContext2D,
  a: Aufwertung,
  x: number,
  y: number,
  index: number,
  gewaehlt: boolean,
): void {
  const besonders = a.vollendung === true || a.art === 'fusion'
  const rand = besonders ? SELTENHEIT_FARBE.fusion : SELTENHEIT_FARBE[a.seltenheit]
  const saat = a.id.length * 53 + index * 17 + a.name.charCodeAt(0)

  // Gewaehlte Karte hebt sich und richtet sich auf: Auf einem Deck-Bildschirm
  // aus einem Meter Entfernung ist Farbe allein zu wenig.
  const hebung = gewaehlt ? 12 : 0
  const oben = y - hebung
  const mx = x + KARTE_B / 2

  ctx.save()

  if (besonders || a.seltenheit === 'legendaer') {
    // Ein Schein ringsum statt Linien darin - die seltene Karte darf leuchten,
    // aber nicht auf Kosten ihrer Lesbarkeit.
    const puls = 0.3 + 0.3 * Math.sin(performance.now() / 260 + index)
    ctx.fillStyle = mitAlpha(rand, puls * 0.35)
    ctx.fillRect(x - 7, oben - 7, KARTE_B + 14, KARTE_H + 14)
  }

  massivePlatte(ctx, x, oben, KARTE_B, KARTE_H, {
    grund: gewaehlt ? FARBEN.kartenGrund : FARBEN.kartenGrundTief,
    kontur: FARBEN.kontur,
    akzent: rand,
    aktiv: gewaehlt,
  })
  // Sprünge nur im Kopfstreifen - der Text darunter bleibt unberuehrt.
  randSpruenge(ctx, x, oben, KARTE_B, 30, saat, mitAlpha(rand, gewaehlt ? 0.5 : 0.25))

  ctx.font = `700 15px ${SCHRIFT.mono}`
  ctx.fillStyle = gewaehlt ? rand : FARBEN.textSchwach
  ctx.textAlign = 'left'
  ctx.fillText(String(index + 1), x + 20, oben + 30)

  ctx.textAlign = 'center'
  ctx.font = `700 12px ${SCHRIFT.text}`
  ctx.fillStyle = rand
  ctx.fillText(kopfZeile(a), mx, oben + 30)

  ctx.font = `700 25px ${SCHRIFT.anzeige}`
  ctx.fillStyle = a.art === 'passiv' ? FARBEN.text : a.farbe
  ctx.fillText(a.name, mx, oben + 72)

  ctx.font = `400 16px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  umbrochenerText(ctx, a.beschreibung, mx, oben + 114, KARTE_B - 46, 22)

  zeichneFuss(ctx, a, mx, oben + KARTE_H - 30, rand)
  ctx.restore()
}

function kopfZeile(a: Aufwertung): string {
  if (a.art === 'fusion') return 'VERSCHMELZUNG'
  if (a.vollendung === true) return TEXTE.kartenVollendung
  if (a.art === 'waffe') return TEXTE.kartenNeu
  return SELTENHEIT_NAME[a.seltenheit].toUpperCase()
}

function zeichneFuss(
  ctx: CanvasRenderingContext2D,
  a: Aufwertung,
  mx: number,
  y: number,
  farbe: string,
): void {
  if (a.art === 'waffe' || a.art === 'fusion') return
  const max = a.maxStufe
  if (max === undefined || !Number.isFinite(max)) return

  const vorher = a.stufeVon ?? 0
  const abstand = 14
  const startX = mx - ((max - 1) * abstand) / 2

  for (let i = 0; i < max; i++) {
    // Rauten statt Kreise - dieselbe Sprache wie die Kristalle im Feld.
    const px = startX + i * abstand
    const r = 4.5
    ctx.beginPath()
    ctx.moveTo(px, y - r)
    ctx.lineTo(px + r, y)
    ctx.lineTo(px, y + r)
    ctx.lineTo(px - r, y)
    ctx.closePath()
    if (i < vorher) ctx.fillStyle = farbe
    else if (i === vorher) ctx.fillStyle = mitAlpha(farbe, 0.5)
    else ctx.fillStyle = mitAlpha(FARBEN.textSchwach, 0.3)
    ctx.fill()
  }
}

// ---------------------------------------------------------------------------
// Todesbildschirm
// ---------------------------------------------------------------------------

export function zeichneTod(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  // Dichter als beim Levelup: Dort soll der Lauf weiterlaufen und sichtbar
  // bleiben, hier soll die Auswertung lesbar sein. Mit 0.84 stand die Schrift
  // mitten im Getuemmel und war es nicht.
  schleier(ctx, breite, hoehe, 0.94)

  // Der Bildschirm springt - ausgehend von der Bildmitte, wo der Spieler
  // stand. Waechst über gut eine Sekunde heran, damit man das Zerbrechen
  // sieht statt es vorzufinden.
  const seitTod = Math.min(1, s.totSeit / 1.1)
  /*
   * Ein Sieg sieht nicht aus wie ein Tod.
   *
   * Derselbe Bildschirm, ein anderes Motiv: Der Sprung im Glas laeuft
   * *einwaerts* auf die Mitte zu statt von ihr weg, in Gold statt in Rot. Es
   * ist die einzige Verzweigung, die der ganze Sieg braucht - eine zweite
   * Bildschirmroutine waere derselbe Code mit anderen Farben, und die faellt
   * beim naechsten Umbau auseinander.
   */
  const gewonnen = s.gewonnen
  const akzent = gewonnen ? FARBEN.spielerRing : FARBEN.gefahr
  ctx.strokeStyle = mitAlpha(akzent, gewonnen ? 0.45 : 0.3)
  ctx.lineWidth = gewonnen ? 3 : 2
  ctx.beginPath()
  // Beim Sieg geht der Sprung von der Punktetafel aus statt von der Bildmitte:
  // Sein Ursprung liegt damit *hinter* der Platte und nicht im Spalt zwischen
  // den beiden Auswertungsplatten, wo er als loser Stern im Nichts stand.
  sprungOverlay(
    ctx,
    breite,
    hoehe,
    gewonnen ? 1 - seitTod * 0.75 : seitTod,
    s.saat,
    breite / 2,
    gewonnen ? 132 : hoehe / 2,
  )
  ctx.stroke()

  // Der Kranz sitzt um die *Punktetafel*, nicht um die Bildmitte: Dort liegen
  // die beiden Auswertungsplatten, und ein Kranz dahinter waere nur ein
  // Sternchen im Spalt zwischen ihnen. Um die Zahl herum, auf die ohnehin
  // jeder zuerst schaut, wird daraus eine Krone.
  if (gewonnen) zeichneKranz(ctx, breite / 2, 132, seitTod)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  /*
   * Die Punktetafel: eine massive Platte, kein frei schwebender Text.
   *
   * Sie traegt das Wichtigste des ganzen Bildschirms - die Zahl, um die es
   * bei einer Bestenliste geht - und muss deshalb auch die staerkste Form
   * haben. Der Sprung im Glas laeuft dahinter durch, nicht darueber.
   */
  const tafelB = 520
  const tafelX = breite / 2 - tafelB / 2
  massivePlatte(ctx, tafelX, 44, tafelB, 176, {
    grund: FARBEN.kartenGrund,
    kontur: FARBEN.kontur,
    akzent: akzent,
    aktiv: true,
    ecke: 26,
  })
  randSpruenge(ctx, tafelX, 44, tafelB, 26, s.saat, mitAlpha(akzent, 0.5))

  ctx.font = `700 40px ${SCHRIFT.anzeige}`
  ctx.fillStyle = akzent
  ctx.fillText(gewonnen ? TEXTE.gewonnen : TEXTE.tot, breite / 2, 84)

  ctx.font = `600 12px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.punkte, breite / 2, 118)
  ctx.font = `700 56px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.spielerRing
  ctx.fillText(zahlText(s.punkte), breite / 2, 156)

  ctx.font = `400 13px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  // Die Zerruettung steht in derselben Zeile wie der Charakterfaktor: Beides
  // sind Multiplikatoren auf dieselbe Zahl darueber, und wer wissen will,
  // *warum* sie so hoch ist, soll es dort finden.
  const zerr = s.zerruettung > 0 ? `  ·  Z${s.zerruettung} ×${kommaText(1 + s.zerruettung * 0.5, 1)}` : ''
  ctx.fillText(
    `${s.charakter.name} ×${kommaText(s.charakter.punkteFaktor, 2)}${zerr}  ·  ${TEXTE.bestwert} ${zahlText(s.bestwert)}`,
    breite / 2,
    196,
  )

  // Zwei Platten nebeneinander: links was passiert ist, rechts woran sie
  // gestorben sind.
  const spalteB = 300
  const spalteH = 250
  const luecke = 28
  const linksX = breite / 2 - spalteB - luecke / 2
  const rechtsX = breite / 2 + luecke / 2
  const spalteY = 252

  massivePlatte(ctx, linksX, spalteY, spalteB, spalteH, {
    grund: FARBEN.kartenGrundTief,
    kontur: FARBEN.kontur,
    akzent: FARBEN.textSchwach,
    ecke: 20,
  })
  massivePlatte(ctx, rechtsX, spalteY, spalteB + 130, spalteH, {
    grund: FARBEN.kartenGrundTief,
    kontur: FARBEN.kontur,
    akzent: FARBEN.treffer,
    ecke: 20,
  })

  zeichneErgebnisZeilen(ctx, s, linksX + 34, spalteY + 52)
  zeichneSchadensBalken(ctx, s, rechtsX + 30, spalteY + 56)
  zeichneFreischaltung(ctx, s, breite / 2, hoehe - 104)

  const puls = 0.55 + 0.45 * Math.sin(performance.now() / 380)
  ctx.textAlign = 'center'
  ctx.font = `600 19px ${SCHRIFT.text}`
  ctx.fillStyle = mitAlpha(FARBEN.text, puls)
  ctx.fillText(TEXTE.totHinweis, breite / 2, hoehe - 40)

  ctx.textBaseline = 'alphabetic'
}

/**
 * Der Kranz um die Bildmitte - nur beim Sieg.
 *
 * Zwoelf Scherben, die nach aussen zeigen: dieselbe Formsprache wie der
 * Sprung im Glas, nur andersherum gelesen. Ein Sieg im Scherbenfeld ist kein
 * heiler Bildschirm, sondern ein Bruch, den man selbst gesetzt hat.
 */
function zeichneKranz(ctx: CanvasRenderingContext2D, mx: number, my: number, t: number): void {
  const zacken = 14
  const innen = 268 + t * 24
  const aussen = innen + 44
  ctx.beginPath()
  for (let i = 0; i < zacken; i++) {
    const w = (i / zacken) * Math.PI * 2 - Math.PI / 2
    ctx.moveTo(mx + Math.cos(w) * innen, my + Math.sin(w) * innen)
    ctx.lineTo(mx + Math.cos(w) * aussen, my + Math.sin(w) * aussen)
  }
  ctx.lineWidth = 6
  ctx.strokeStyle = mitAlpha(FARBEN.kontur, 0.75 * t)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.strokeStyle = mitAlpha(FARBEN.spielerRing, 0.85 * t)
  ctx.stroke()
}

function zeichneErgebnisZeilen(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  x: number,
  y: number,
): void {
  const zeilen: Array<[string, string]> = [
    [TEXTE.ergebnisZeit, zeitText(s.statistik.zeit)],
    [TEXTE.ergebnisKills, zahlText(s.statistik.kills)],
    [TEXTE.ergebnisZersplittert, zahlText(s.statistik.zersplittert)],
    ['Bosse', String(s.statistik.bosse)],
    [TEXTE.ergebnisStufe, String(s.statistik.level)],
  ]

  for (let i = 0; i < zeilen.length; i++) {
    const zy = y + i * 34
    ctx.font = `400 17px ${SCHRIFT.text}`
    ctx.textAlign = 'left'
    ctx.fillStyle = FARBEN.textSchwach
    ctx.fillText(zeilen[i][0], x, zy)
    ctx.font = `700 20px ${SCHRIFT.mono}`
    ctx.textAlign = 'right'
    ctx.fillStyle = FARBEN.text
    ctx.fillText(zeilen[i][1], x + 190, zy)
  }
}

/**
 * Woran die Gegner gestorben sind.
 *
 * Der befriedigendste Teil einer Auswertung: Man sieht, welche Waffe den Lauf
 * getragen hat - und wie viel die Zersplitterung wirklich beitraegt. Ohne
 * diesen Balken bliebe die Kernregel eine Behauptung.
 */
function zeichneSchadensBalken(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  x: number,
  y: number,
): void {
  const st = s.statistik
  const eintraege: Array<{ name: string; farbe: string; wert: number }> = []
  for (let i = 0; i < st.schadenProPlatz.length; i++) {
    if (st.schadenProPlatz[i] <= 0) continue
    const b = beschriftung(s, i)
    eintraege.push({ name: b.name, farbe: b.farbe, wert: st.schadenProPlatz[i] })
  }
  eintraege.sort((a, b) => b.wert - a.wert)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `400 14px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.schadensAnteil, x, y - 24)

  if (eintraege.length === 0) return
  const groesster = eintraege[0].wert
  // Name links, Balken rechts daneben: Vorher stand der Name *im* Balken, und
  // ein kurzer Balken verschluckte ihn dann komplett.
  const namensBreite = 132
  const bw = 190

  for (let i = 0; i < Math.min(6, eintraege.length); i++) {
    const e = eintraege[i]
    const by = y + i * 30
    const anteil = e.wert / groesster

    ctx.font = `600 14px ${SCHRIFT.text}`
    ctx.textAlign = 'right'
    ctx.fillStyle = FARBEN.text
    ctx.fillText(e.name, x + namensBreite - 12, by)

    const bx = x + namensBreite
    schraegBalken(ctx, bx, by - 9, bw, 18, 9)
    ctx.fillStyle = FARBEN.kontur
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = e.farbe
    ctx.fillRect(bx, by - 9, bw * anteil, 18)
    ctx.fillStyle = mitAlpha(FARBEN.kontur, 0.13)
    ctx.fillRect(bx, by - 9, bw * anteil, 4)
    ctx.restore()
    schraegBalken(ctx, bx, by - 9, bw, 18, 9)
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = FARBEN.kontur
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.font = `700 14px ${SCHRIFT.mono}`
    ctx.fillStyle = FARBEN.text
    ctx.fillText(zahlText(e.wert), bx + bw + 12, by)
  }
}

/**
 * Name und Farbe eines Guertelplatzes.
 *
 * Zuerst der aktuelle Guertel, dann das Gedaechtnis in der Statistik: Eine
 * Waffe, die durch eine Verschmelzung verschwunden ist, soll ihren Balken
 * behalten. Die drei reservierten Plaetze haben feste Namen - besonders die
 * Scherben, denn genau an ihnen liest man ab, wie viel die Kernregel
 * beitraegt.
 *
 * Vor dieser Funktion stand auf den Balken "Platz 6" statt "Scherben" - eine
 * Auswertung, die einem nicht sagt, welches Ding getroffen hat, beantwortet
 * die Frage nicht, fuer die sie da ist.
 */
function beschriftung(s: Spielstand, i: number): { name: string; farbe: string } {
  const w = s.spieler.waffen.find((x) => x.platz === i)
  if (w !== undefined) return { name: w.def.name, farbe: w.def.farbe }
  if (i === SPLITTER_PLATZ) return { name: 'Scherben', farbe: FARBEN.treffer }
  if (i === GEIST_PLATZ) return { name: 'Geisterriss', farbe: SELTENHEIT_FARBE.legendaer }
  if (i === DORNEN_PLATZ) return { name: 'Dornen', farbe: FARBEN.gefahr }
  const gemerkt = s.statistik.platzName[i]
  if (gemerkt !== undefined && gemerkt !== '') {
    return { name: gemerkt, farbe: s.statistik.platzFarbe[i] }
  }
  return { name: `Platz ${i + 1}`, farbe: FARBEN.textSchwach }
}

function zeichneFreischaltung(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  mx: number,
  y: number,
): void {
  if (s.neuFreigeschaltet.length === 0) return
  const namen = s.neuFreigeschaltet
    .map((id) => CHARAKTERE.find((c) => c.id === id)?.name ?? id)
    .join(' · ')

  const puls = 0.6 + 0.4 * Math.sin(performance.now() / 200)
  ctx.textAlign = 'center'
  ctx.font = `700 15px ${SCHRIFT.text}`
  ctx.fillStyle = mitAlpha(SELTENHEIT_FARBE.legendaer, puls)
  ctx.fillText(TEXTE.freigeschaltet, mx, y)
  ctx.font = `700 22px ${SCHRIFT.anzeige}`
  ctx.fillStyle = SELTENHEIT_FARBE.legendaer
  ctx.fillText(namen, mx, y + 26)
}

// ---------------------------------------------------------------------------
// Atempause zwischen zwei Etappen
// ---------------------------------------------------------------------------

/**
 * Drei Türen, auf jeder steht Preis und Lohn.
 *
 * Der ganze Reiz haengt daran, dass **beides sichtbar ist, bevor man waehlt**.
 * Eine Tuer, deren Preis man erst hinterher merkt, ist keine Entscheidung,
 * sondern eine Falle - und der Lauf war vorher genau deshalb rhythmuslos: Es
 * gab ueberhaupt keinen Moment, in dem man etwas abwaegen konnte.
 */
export function zeichneAtempause(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  schleier(ctx, breite, hoehe, 0.86)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 15px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(`${TEXTE.etappe} ${s.etappe}`, breite / 2, 62)

  ctx.font = `700 40px ${SCHRIFT.anzeige}`
  ctx.fillStyle = FARBEN.textHervor
  ctx.fillText(TEXTE.atempauseTitel, breite / 2, 100)

  // Was die Etappe gekostet hat - dieselben Balken wie am Ende des Laufs.
  zeichneSchadensBalken(ctx, s, breite / 2 - 200, 150)

  const kb = 300
  const kh = 210
  const abstand = 30
  const gesamt = s.tuerAngebot.length * kb + (s.tuerAngebot.length - 1) * abstand
  const startX = (breite - gesamt) / 2
  const y = hoehe - kh - 120

  for (let i = 0; i < s.tuerAngebot.length; i++) {
    zeichneTuer(ctx, s, i, startX + i * (kb + abstand), y, kb, kh)
  }

  ctx.textAlign = 'center'
  ctx.font = `600 15px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.atempauseHinweis, breite / 2, hoehe - 52)
  ctx.textBaseline = 'alphabetic'
}

function zeichneTuer(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  i: number,
  x: number,
  y: number,
  b: number,
  h: number,
): void {
  const tuer = tuerMit(s.tuerAngebot[i])
  const gewaehlt = i === s.tuerWahl
  const saat = 300 + i * 17

  ctx.save()
  // Gewaehlte Tuer hebt sich, statt sich zu drehen: Eine schiefe Karte mit
  // vier Textzeilen liest sich schlechter, nicht interessanter.
  const hebung = gewaehlt ? 10 : 0
  ctx.translate(x, y - hebung)

  massivePlatte(ctx, 0, 0, b, h, {
    grund: gewaehlt ? FARBEN.kartenGrund : FARBEN.kartenGrundTief,
    kontur: FARBEN.kontur,
    akzent: tuer.farbe,
    aktiv: gewaehlt,
    ecke: 22,
  })
  randSpruenge(ctx, 0, 0, b, 28, saat, mitAlpha(tuer.farbe, gewaehlt ? 0.5 : 0.24))

  ctx.textAlign = 'left'
  ctx.font = `700 12px ${SCHRIFT.mono}`
  ctx.fillStyle = mitAlpha(FARBEN.textSchwach, 0.8)
  ctx.fillText(String(i + 1), 18, 26)

  ctx.textAlign = 'center'
  ctx.font = `700 23px ${SCHRIFT.anzeige}`
  ctx.fillStyle = tuer.farbe
  ctx.fillText(tuer.name, b / 2, 44)

  ctx.textAlign = 'left'
  ctx.font = `600 12px ${SCHRIFT.text}`
  ctx.fillStyle = mitAlpha(FARBEN.gefahr, 0.9)
  ctx.fillText(TEXTE.tuerPreis.toUpperCase(), 22, 84)
  ctx.font = `400 14px ${SCHRIFT.text}`
  ctx.fillStyle = tuer.preis === '' ? FARBEN.textSchwach : FARBEN.text
  umbrochenerLinks(ctx, tuer.preis === '' ? TEXTE.tuerOhnePreis : tuer.preis, 22, 104, b - 44, 18)

  ctx.font = `600 12px ${SCHRIFT.text}`
  ctx.fillStyle = mitAlpha(FARBEN.heilung, 0.9)
  ctx.fillText(TEXTE.tuerLohn.toUpperCase(), 22, 148)
  ctx.font = `400 14px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.text
  umbrochenerLinks(ctx, tuer.lohn, 22, 168, b - 44, 18)

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Pausenmenue
// ---------------------------------------------------------------------------

/**
 * Angehalten.
 *
 * Der Schleier ist duenner als beim Tod: Der Lauf ist nicht vorbei, er wartet.
 * Man soll sehen, in welcher Lage man steht, waehrend man ueberlegt - und
 * genau das ist oft der Grund, warum jemand anhaelt.
 */
export function zeichnePause(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  schleier(ctx, breite, hoehe, 0.72)

  const b = 460
  const h = 300
  const x = (breite - b) / 2
  const y = (hoehe - h) / 2

  ctx.save()
  ctx.translate(x, y)

  massivePlatte(ctx, 0, 0, b, h, {
    grund: FARBEN.kartenGrund,
    kontur: FARBEN.kontur,
    akzent: FARBEN.spielerRing,
    aktiv: true,
  })
  randSpruenge(ctx, 0, 0, b, 26, 7, mitAlpha(FARBEN.spielerRing, 0.4))

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 26px ${SCHRIFT.anzeige}`
  ctx.fillStyle = FARBEN.textHervor
  ctx.fillText(TEXTE.pauseTitel, b / 2, 46)

  for (let i = 0; i < PAUSE_EINTRAEGE.length; i++) {
    const gewaehlt = i === s.pauseWahl
    const zy = 108 + i * 44

    if (gewaehlt) {
      // Volle Flaeche mit Kante links - deutlicher als ein Farbwechsel und
      // ohne eine Linie, die durch die Schrift laeuft.
      ctx.fillStyle = mitAlpha(FARBEN.spielerRing, 0.16)
      ctx.fillRect(28, zy - 17, b - 56, 34)
      ctx.fillStyle = FARBEN.spielerRing
      ctx.fillRect(28, zy - 17, 4, 34)
    }

    ctx.font = `${gewaehlt ? 700 : 400} 18px ${SCHRIFT.text}`
    ctx.fillStyle = gewaehlt ? FARBEN.textHervor : FARBEN.textSchwach
    ctx.fillText(eintragText(PAUSE_EINTRAEGE[i], s), b / 2, zy)
  }

  // Der Hinweis steht dauerhaft da, nicht nur wenn "Aufgeben" gewaehlt ist:
  // Man soll es lesen, bevor man dort landet, nicht danach.
  ctx.font = `400 12px ${SCHRIFT.text}`
  ctx.fillStyle = mitAlpha(FARBEN.gefahr, 0.8)
  ctx.fillText(TEXTE.pauseWarnung, b / 2, h - 52)

  ctx.font = `400 13px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.pauseHinweis, b / 2, h - 28)

  ctx.restore()
  ctx.textBaseline = 'alphabetic'
}

function eintragText(eintrag: PauseEintrag, s: Spielstand): string {
  switch (eintrag) {
    case 'weiter':
      return TEXTE.pauseWeiter
    case 'ton':
      return `${TEXTE.pauseTon}: ${s.tonAus ? TEXTE.pauseAus : TEXTE.pauseAn}`
    case 'aufgeben':
      return TEXTE.pauseAufgeben
    case 'auswahl':
      return TEXTE.pauseAuswahl
  }
}

// ---------------------------------------------------------------------------
// Kleinkram
// ---------------------------------------------------------------------------

function schleier(
  ctx: CanvasRenderingContext2D,
  breite: number,
  hoehe: number,
  staerke: number,
): void {
  /*
   * Ein Blatt, das ueber das Feld gelegt wird.
   *
   * Zweimal hat diese Zeile schon die Farbe gewechselt, und beide Male aus
   * demselben Grund: Der Schleier muss *gegen* das Feld arbeiten. Auf dunklem
   * Feld war er hell, auf hellem Feld dunkel - und jetzt, wo der Grund Papier
   * ist und alles darauf Tinte, ist er wieder Papier. Er nimmt dem Getuemmel
   * die Tinte weg, statt Dunkelheit darueber zu giessen.
   *
   * Sichtbar durchscheinen soll das Feld weiterhin: Ein voll deckender
   * Schleier schneidet den Lauf gefuehlt ab, ein halbdurchsichtiger haelt die
   * Spannung.
   */
  ctx.fillStyle = mitAlpha(FARBEN.grund, staerke)
  ctx.fillRect(0, 0, breite, hoehe)
}

function umbrochenerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  mx: number,
  y: number,
  maxBreite: number,
  zeilenHoehe: number,
): void {
  for (const [i, zeile] of umbrich(ctx, text, maxBreite).entries()) {
    ctx.fillText(zeile, mx, y + i * zeilenHoehe)
  }
}

function umbrochenerLinks(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxBreite: number,
  zeilenHoehe: number,
): void {
  for (const [i, zeile] of umbrich(ctx, text, maxBreite).entries()) {
    ctx.fillText(zeile, x, y + i * zeilenHoehe)
  }
}

function umbrich(ctx: CanvasRenderingContext2D, text: string, maxBreite: number): string[] {
  const woerter = text.split(' ')
  const zeilen: string[] = []
  let zeile = ''

  for (const wort of woerter) {
    const versuch = zeile === '' ? wort : `${zeile} ${wort}`
    if (ctx.measureText(versuch).width > maxBreite && zeile !== '') {
      zeilen.push(zeile)
      zeile = wort
    } else {
      zeile = versuch
    }
  }
  if (zeile !== '') zeilen.push(zeile)
  return zeilen
}
