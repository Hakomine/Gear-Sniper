import { FARBEN, mitAlpha, SCHRIFT } from '../render/palette'
import type { Spielstand } from '../game/state'
import { TEXTE, zahlText, zeitText } from './strings'

/**
 * Titel-, Levelup- und Todesbildschirm.
 *
 * Alle drei zeichnen in Bildschirmkoordinaten (also nach der Kamera) und
 * lesen den Spielstand nur - keiner von ihnen aendert etwas. Die Auswahl
 * selbst passiert in `state.ts`, damit sie ohne Browser testbar bleibt.
 */

export function zeichneTitel(ctx: CanvasRenderingContext2D, breite: number, hoehe: number): void {
  schleier(ctx, breite, hoehe, 0.72)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.font = `700 76px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.spieler
  ctx.fillText(TEXTE.titel, breite / 2, hoehe / 2 - 74)

  ctx.font = `400 21px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.untertitel, breite / 2, hoehe / 2 - 18)

  // Pulsierender Hinweis: Ein statischer Text wird auf einem Titelbild
  // uebersehen, ein atmender nicht.
  const puls = 0.55 + 0.45 * Math.sin(performance.now() / 380)
  ctx.font = `600 23px ${SCHRIFT.mono}`
  ctx.fillStyle = mitAlpha(FARBEN.text, puls)
  ctx.fillText(TEXTE.startHinweis, breite / 2, hoehe / 2 + 54)

  ctx.font = `400 16px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.steuerung, breite / 2, hoehe / 2 + 100)

  ctx.textBaseline = 'alphabetic'
}

const KARTE_B = 290
const KARTE_H = 208
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

  ctx.font = `700 40px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.spieler
  ctx.fillText(TEXTE.levelup, breite / 2, hoehe / 2 - 172)

  const anzahl = s.angebote.length
  const gesamt = anzahl * KARTE_B + (anzahl - 1) * KARTE_LUECKE
  const startX = (breite - gesamt) / 2
  const y = hoehe / 2 - KARTE_H / 2 + 12

  for (let i = 0; i < anzahl; i++) {
    const a = s.angebote[i]
    const x = startX + i * (KARTE_B + KARTE_LUECKE)
    const gewaehlt = i === s.auswahl
    const stufe = s.stufen.get(a.id) ?? 0

    // Die gewaehlte Karte hebt sich ab - nicht nur durch den Rand, sondern
    // auch durch die Hoehe. Auf einem Deck-Bildschirm aus einem Meter
    // Entfernung ist Farbe allein zu wenig.
    const hebung = gewaehlt ? 10 : 0

    ctx.beginPath()
    ctx.roundRect(x, y - hebung, KARTE_B, KARTE_H, 14)
    ctx.fillStyle = gewaehlt ? '#131d33' : FARBEN.kartenGrund
    ctx.fill()
    ctx.lineWidth = gewaehlt ? 3 : 1.5
    ctx.strokeStyle = gewaehlt ? FARBEN.kartenRandAktiv : FARBEN.kartenRand
    ctx.stroke()

    const mx = x + KARTE_B / 2

    // Zifferntaste als Abkuerzung - schneller als Blaettern, und auf der
    // Tastatur die Art, wie erfahrene Spieler waehlen.
    ctx.font = `700 15px ${SCHRIFT.mono}`
    ctx.fillStyle = gewaehlt ? FARBEN.kartenRandAktiv : FARBEN.textSchwach
    ctx.fillText(String(i + 1), mx, y - hebung + 26)

    ctx.font = `700 27px ${SCHRIFT.mono}`
    ctx.fillStyle = gewaehlt ? FARBEN.text : FARBEN.text
    ctx.fillText(a.name, mx, y - hebung + 74)

    ctx.font = `400 17px ${SCHRIFT.mono}`
    ctx.fillStyle = FARBEN.textSchwach
    umbrochenerText(ctx, a.beschreibung, mx, y - hebung + 116, KARTE_B - 40, 23)

    // Punkte zeigen, wie oft die Aufwertung schon genommen wurde. Ohne das
    // waehlt man im Eifer dreimal dasselbe, ohne es zu merken.
    if (Number.isFinite(a.maxStufe)) {
      zeichneStufenPunkte(ctx, mx, y - hebung + KARTE_H - 30, stufe, a.maxStufe)
    }
  }

  ctx.font = `400 16px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.levelupHinweis, breite / 2, hoehe / 2 + 158)

  ctx.textBaseline = 'alphabetic'
}

function zeichneStufenPunkte(
  ctx: CanvasRenderingContext2D,
  mx: number,
  y: number,
  stufe: number,
  maxStufe: number,
): void {
  const r = 4
  const abstand = 14
  const gesamt = (maxStufe - 1) * abstand
  const startX = mx - gesamt / 2

  for (let i = 0; i < maxStufe; i++) {
    ctx.beginPath()
    ctx.arc(startX + i * abstand, y, r, 0, Math.PI * 2)
    // Die kommende Stufe wird mitgezeigt, damit die Karte sagt, was sie
    // bewirkt - nicht nur, was schon da ist.
    if (i < stufe) ctx.fillStyle = FARBEN.textHervor
    else if (i === stufe) ctx.fillStyle = mitAlpha(FARBEN.textHervor, 0.45)
    else ctx.fillStyle = mitAlpha(FARBEN.textSchwach, 0.3)
    ctx.fill()
  }
}

export function zeichneTod(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  schleier(ctx, breite, hoehe, 0.8)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.font = `700 62px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.gefahr
  ctx.fillText(TEXTE.tot, breite / 2, hoehe / 2 - 132)

  const zeilen: Array<[string, string]> = [
    [TEXTE.ergebnisZeit, zeitText(s.statistik.zeit)],
    [TEXTE.ergebnisKills, zahlText(s.statistik.kills)],
    [TEXTE.ergebnisStufe, String(s.statistik.level)],
    [TEXTE.ergebnisSchaden, zahlText(s.statistik.schaden)],
  ]

  // Zweispaltig gesetzt: Bezeichnung rechtsbuendig, Wert linksbuendig. So
  // steht die Spalte auch dann gerade, wenn die Zahlen unterschiedlich lang
  // sind - der Grund, warum die Anzeige Monospace nutzt.
  const y0 = hoehe / 2 - 48
  for (let i = 0; i < zeilen.length; i++) {
    const y = y0 + i * 38
    ctx.font = `400 19px ${SCHRIFT.mono}`
    ctx.textAlign = 'right'
    ctx.fillStyle = FARBEN.textSchwach
    ctx.fillText(zeilen[i][0], breite / 2 - 18, y)
    ctx.font = `700 22px ${SCHRIFT.mono}`
    ctx.textAlign = 'left'
    ctx.fillStyle = FARBEN.text
    ctx.fillText(zeilen[i][1], breite / 2 + 18, y)
  }

  const puls = 0.55 + 0.45 * Math.sin(performance.now() / 380)
  ctx.textAlign = 'center'
  ctx.font = `600 21px ${SCHRIFT.mono}`
  ctx.fillStyle = mitAlpha(FARBEN.text, puls)
  ctx.fillText(TEXTE.totHinweis, breite / 2, hoehe / 2 + 138)

  ctx.textBaseline = 'alphabetic'
}

function schleier(
  ctx: CanvasRenderingContext2D,
  breite: number,
  hoehe: number,
  staerke: number,
): void {
  // Das Spielfeld bleibt sichtbar durchscheinen: Ein voll deckender Schleier
  // schneidet den Lauf gefuehlt ab, ein halbdurchsichtiger haelt die Spannung.
  ctx.fillStyle = mitAlpha(FARBEN.grund, staerke)
  ctx.fillRect(0, 0, breite, hoehe)
}

/** Einfacher Wortumbruch, mittig gesetzt. */
function umbrochenerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  mx: number,
  y: number,
  maxBreite: number,
  zeilenHoehe: number,
): void {
  const woerter = text.split(' ')
  let zeile = ''
  let zeileNr = 0

  for (const wort of woerter) {
    const versuch = zeile === '' ? wort : `${zeile} ${wort}`
    if (ctx.measureText(versuch).width > maxBreite && zeile !== '') {
      ctx.fillText(zeile, mx, y + zeileNr * zeilenHoehe)
      zeile = wort
      zeileNr++
    } else {
      zeile = versuch
    }
  }
  if (zeile !== '') ctx.fillText(zeile, mx, y + zeileNr * zeilenHoehe)
}
