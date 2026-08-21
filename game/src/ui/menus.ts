import type { Spielstand } from '../game/state'
import type { Aufwertung } from '../game/upgrades'
import { SELTENHEIT_NAME } from '../game/weapons'
import { FARBEN, mitAlpha, SCHRIFT, SELTENHEIT_FARBE } from '../render/palette'
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
const KARTE_H = 216
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
  ctx.fillText(TEXTE.levelup, breite / 2, hoehe / 2 - 176)

  const anzahl = s.angebote.length
  const gesamt = anzahl * KARTE_B + (anzahl - 1) * KARTE_LUECKE
  const startX = (breite - gesamt) / 2
  const y = hoehe / 2 - KARTE_H / 2 + 12

  for (let i = 0; i < anzahl; i++) {
    zeichneKarte(ctx, s.angebote[i], startX + i * (KARTE_B + KARTE_LUECKE), y, i, i === s.auswahl)
  }

  ctx.font = `400 16px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.levelupHinweis, breite / 2, hoehe / 2 + 162)

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
  const vollendung = a.vollendung === true
  const rand = vollendung ? SELTENHEIT_FARBE.legendaer : SELTENHEIT_FARBE[a.seltenheit]

  // Die gewaehlte Karte hebt sich ab - nicht nur durch den Rand, sondern auch
  // durch die Hoehe. Auf einem Deck-Bildschirm aus einem Meter Entfernung ist
  // Farbe allein zu wenig.
  const hebung = gewaehlt ? 10 : 0
  const oben = y - hebung
  const mx = x + KARTE_B / 2

  // Legendaere und Vollendungen schimmern. Ein Fund, der sich nicht vom
  // Alltag abhebt, ist keiner.
  if (vollendung || a.seltenheit === 'legendaer') {
    const puls = 0.35 + 0.3 * Math.sin(performance.now() / 260 + index)
    ctx.beginPath()
    ctx.roundRect(x - 5, oben - 5, KARTE_B + 10, KARTE_H + 10, 18)
    ctx.fillStyle = mitAlpha(rand, puls * 0.35)
    ctx.fill()
  }

  ctx.beginPath()
  ctx.roundRect(x, oben, KARTE_B, KARTE_H, 14)
  ctx.fillStyle = gewaehlt ? '#131d33' : FARBEN.kartenGrund
  ctx.fill()
  ctx.lineWidth = gewaehlt ? 3 : 1.5
  ctx.strokeStyle = gewaehlt ? rand : mitAlpha(rand, 0.5)
  ctx.stroke()

  // Farbstreifen am Kopf: die Seltenheit auf einen Blick, auch wenn der Rand
  // im Getuemmel untergeht.
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, oben, KARTE_B, KARTE_H, 14)
  ctx.clip()
  ctx.fillStyle = rand
  ctx.fillRect(x, oben, KARTE_B, 5)
  ctx.restore()

  // Zifferntaste als Abkuerzung - auf der Tastatur die Art, wie erfahrene
  // Spieler waehlen.
  ctx.font = `700 15px ${SCHRIFT.mono}`
  ctx.fillStyle = gewaehlt ? rand : FARBEN.textSchwach
  ctx.textAlign = 'left'
  ctx.fillText(String(index + 1), x + 16, oben + 26)

  ctx.textAlign = 'center'
  ctx.font = `700 12px ${SCHRIFT.mono}`
  ctx.fillStyle = rand
  ctx.fillText(kopfZeile(a), mx, oben + 26)

  ctx.font = `700 26px ${SCHRIFT.mono}`
  ctx.fillStyle = a.art === 'passiv' ? FARBEN.text : a.farbe
  ctx.fillText(a.name, mx, oben + 68)

  ctx.font = `400 17px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  umbrochenerText(ctx, a.beschreibung, mx, oben + 110, KARTE_B - 40, 23)

  zeichneFuss(ctx, a, mx, oben + KARTE_H - 28, rand)
}

/** Was oben auf der Karte steht: NEU, VOLLENDUNG oder die Seltenheit. */
function kopfZeile(a: Aufwertung): string {
  if (a.vollendung === true) return TEXTE.kartenVollendung
  if (a.art === 'waffe') return TEXTE.kartenNeu
  return SELTENHEIT_NAME[a.seltenheit].toUpperCase()
}

/** Fuss der Karte: Stufenpunkte, sonst nichts. */
function zeichneFuss(
  ctx: CanvasRenderingContext2D,
  a: Aufwertung,
  mx: number,
  y: number,
  farbe: string,
): void {
  if (a.art === 'waffe') return
  const max = a.maxStufe
  if (max === undefined || !Number.isFinite(max)) return

  const vorher = a.stufeVon ?? 0
  const r = 4
  const abstand = 14
  const startX = mx - ((max - 1) * abstand) / 2

  for (let i = 0; i < max; i++) {
    ctx.beginPath()
    ctx.arc(startX + i * abstand, y, r, 0, Math.PI * 2)
    // Die kommende Stufe wird mitgezeigt, damit die Karte sagt, was sie
    // bewirkt - nicht nur, was schon da ist.
    if (i < vorher) ctx.fillStyle = farbe
    else if (i === vorher) ctx.fillStyle = mitAlpha(farbe, 0.5)
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
  ctx.fillText(TEXTE.tot, breite / 2, hoehe / 2 - 148)

  const zeilen: Array<[string, string]> = [
    [TEXTE.ergebnisZeit, zeitText(s.statistik.zeit)],
    [TEXTE.ergebnisKills, zahlText(s.statistik.kills)],
    [TEXTE.ergebnisZersplittert, zahlText(s.statistik.zersplittert)],
    [TEXTE.ergebnisStufe, String(s.statistik.level)],
    [TEXTE.ergebnisSchaden, zahlText(s.statistik.schaden)],
  ]

  // Zweispaltig gesetzt: Bezeichnung rechtsbuendig, Wert linksbuendig. So
  // steht die Spalte auch dann gerade, wenn die Zahlen unterschiedlich lang
  // sind - der Grund, warum die Anzeige Monospace nutzt.
  const y0 = hoehe / 2 - 66
  for (let i = 0; i < zeilen.length; i++) {
    const y = y0 + i * 36
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
  ctx.fillText(TEXTE.totHinweis, breite / 2, hoehe / 2 + 152)

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
