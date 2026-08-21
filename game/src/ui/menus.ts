import type { Charakter } from '../game/charaktere'
import { CHARAKTERE } from '../game/charaktere'
import type { Spielstand } from '../game/state'
import type { Aufwertung } from '../game/upgrades'
import { SELTENHEIT_NAME } from '../game/weapons'
import { DORNEN_PLATZ, GEIST_PLATZ, SPLITTER_PLATZ } from '../game/welt'
import { bruchLinien, neigung, scherbenPfad, schraegBalken, sprungOverlay } from '../render/glas'
import { FARBEN, mitAlpha, SCHRIFT, SELTENHEIT_FARBE } from '../render/palette'
import { TEXTE, zahlText, zeitText } from './strings'

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
  zeichnePunkte(ctx, s, breite / 2, hoehe - 92)

  ctx.font = `400 16px ${SCHRIFT.mono}`
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
  const text = TEXTE.titel
  ctx.font = `700 78px ${SCHRIFT.mono}`

  for (const oben of [true, false]) {
    ctx.save()
    ctx.beginPath()
    // Der Sprung sitzt leicht ausserhalb der Mitte - genau mittig wirkt wie
    // ein Layoutfehler, leicht daneben wie Absicht.
    const schnitt = my + 6
    if (oben) ctx.rect(mx - 460, my - 70, 920, schnitt - (my - 70))
    else ctx.rect(mx - 460, schnitt, 920, 160)
    ctx.clip()
    ctx.fillStyle = FARBEN.spieler
    ctx.fillText(text, mx + (oben ? -4 : 5), my)
    ctx.restore()
  }

  // Die Bruchkante selbst.
  ctx.beginPath()
  ctx.moveTo(mx - 300, my + 12)
  ctx.lineTo(mx - 60, my + 4)
  ctx.lineTo(mx + 90, my + 11)
  ctx.lineTo(mx + 300, my + 2)
  ctx.strokeStyle = mitAlpha(FARBEN.treffer, 0.5)
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.font = `400 19px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.untertitel, mx, my + 58)
}

const PLATTE_B = 560
const PLATTE_H = 250

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
  ctx.translate(mx, y + PLATTE_H / 2)
  ctx.rotate(neigung(saat))
  ctx.translate(-mx, -(y + PLATTE_H / 2))

  scherbenPfad(ctx, x, y, PLATTE_B, PLATTE_H, saat)
  ctx.fillStyle = mitAlpha(FARBEN.kartenGrund, 0.95)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = mitAlpha(rand, offen ? 0.9 : 0.4)
  ctx.stroke()

  // Die Sprünge tragen die Farbe, nicht der Rahmen. Genau das unterscheidet
  // die Platte von einer Karte mit farbigem Rand.
  ctx.save()
  scherbenPfad(ctx, x, y, PLATTE_B, PLATTE_H, saat)
  ctx.clip()
  bruchLinien(ctx, x, y, PLATTE_B, PLATTE_H, saat, 3)
  ctx.strokeStyle = mitAlpha(rand, offen ? 0.3 : 0.15)
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.font = `700 34px ${SCHRIFT.mono}`
  ctx.fillStyle = offen ? c.farbe : FARBEN.textSchwach
  ctx.fillText(c.name, mx, y + 52)

  if (!offen && c.bedingung !== null) {
    ctx.font = `700 13px ${SCHRIFT.mono}`
    ctx.fillStyle = FARBEN.gefahr
    ctx.fillText(TEXTE.gesperrt, mx, y + 88)
    ctx.font = `400 17px ${SCHRIFT.mono}`
    ctx.fillStyle = FARBEN.textSchwach
    umbrochenerText(ctx, c.bedingung.text, mx, y + 126, PLATTE_B - 80, 24)
    ctx.restore()
    return
  }

  ctx.font = `400 16px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  umbrochenerText(ctx, c.beschreibung, mx, y + 84, PLATTE_B - 70, 22)

  ctx.textAlign = 'left'
  const lx = x + 42
  ctx.font = `700 13px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.heilung
  ctx.fillText(TEXTE.vorteil.toUpperCase(), lx, y + 138)
  ctx.font = `400 15px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.text
  umbrochenerLinks(ctx, c.vorteil, lx, y + 160, PLATTE_B - 84, 20)

  ctx.font = `700 13px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.gefahr
  ctx.fillText(TEXTE.nachteil.toUpperCase(), lx, y + 196)
  ctx.font = `400 15px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.text
  umbrochenerLinks(ctx, c.nachteil, lx, y + 218, PLATTE_B - 84, 20)

  ctx.textAlign = 'right'
  ctx.font = `600 14px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textHervor
  ctx.fillText(`×${c.punkteFaktor.toFixed(2)}`, x + PLATTE_B - 42, y + 52)
  ctx.font = `400 11px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.punkteFaktor, x + PLATTE_B - 42, y + 68)

  ctx.restore()
}

/** Punkte-Kaestchen unten am Titelbild: welcher Charakter, wie weit man kam. */
function zeichnePunkte(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  mx: number,
  y: number,
): void {
  ctx.textAlign = 'center'
  ctx.font = `400 14px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach

  const punkte: string[] = []
  for (let i = 0; i < CHARAKTERE.length; i++) {
    punkte.push(s.offen.includes(CHARAKTERE[i].id) ? (i === s.charakterWahl ? '◆' : '◇') : '·')
  }
  ctx.font = `400 20px ${SCHRIFT.mono}`
  ctx.fillText(punkte.join(' '), mx, y)

  if (s.bestwert <= 0) return
  ctx.font = `400 15px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(`${TEXTE.bestwert}: ${zahlText(s.bestwert)}`, mx, y + 28)
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

  ctx.font = `700 38px ${SCHRIFT.mono}`
  ctx.fillStyle = s.bossKarte ? SELTENHEIT_FARBE.legendaer : FARBEN.spieler
  ctx.fillText(s.bossKarte ? 'BOSSBEUTE' : TEXTE.levelup, breite / 2, hoehe / 2 - 178)

  const anzahl = s.angebote.length
  const gesamt = anzahl * KARTE_B + (anzahl - 1) * KARTE_LUECKE
  const startX = (breite - gesamt) / 2
  const y = hoehe / 2 - KARTE_H / 2 + 12

  for (let i = 0; i < anzahl; i++) {
    zeichneKarte(ctx, s.angebote[i], startX + i * (KARTE_B + KARTE_LUECKE), y, i, i === s.auswahl)
  }

  ctx.font = `400 16px ${SCHRIFT.mono}`
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
  ctx.translate(mx, oben + KARTE_H / 2)
  ctx.rotate(gewaehlt ? neigung(saat) * 0.3 : neigung(saat))
  ctx.translate(-mx, -(oben + KARTE_H / 2))

  if (besonders || a.seltenheit === 'legendaer') {
    const puls = 0.3 + 0.3 * Math.sin(performance.now() / 260 + index)
    scherbenPfad(ctx, x - 6, oben - 6, KARTE_B + 12, KARTE_H + 12, saat)
    ctx.fillStyle = mitAlpha(rand, puls * 0.3)
    ctx.fill()
  }

  scherbenPfad(ctx, x, oben, KARTE_B, KARTE_H, saat)
  ctx.fillStyle = gewaehlt ? '#141f36' : FARBEN.kartenGrund
  ctx.fill()
  ctx.lineWidth = gewaehlt ? 2.5 : 1.4
  ctx.strokeStyle = mitAlpha(rand, gewaehlt ? 1 : 0.55)
  ctx.stroke()

  // Seltenheitsfarbe laeuft in den Bruchlinien statt in einem Rahmen.
  ctx.save()
  scherbenPfad(ctx, x, oben, KARTE_B, KARTE_H, saat)
  ctx.clip()
  bruchLinien(ctx, x, oben, KARTE_B, KARTE_H, saat, gewaehlt ? 4 : 2)
  ctx.strokeStyle = mitAlpha(rand, gewaehlt ? 0.45 : 0.22)
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()

  ctx.font = `700 15px ${SCHRIFT.mono}`
  ctx.fillStyle = gewaehlt ? rand : FARBEN.textSchwach
  ctx.textAlign = 'left'
  ctx.fillText(String(index + 1), x + 20, oben + 30)

  ctx.textAlign = 'center'
  ctx.font = `700 12px ${SCHRIFT.mono}`
  ctx.fillStyle = rand
  ctx.fillText(kopfZeile(a), mx, oben + 30)

  ctx.font = `700 25px ${SCHRIFT.mono}`
  ctx.fillStyle = a.art === 'passiv' ? FARBEN.text : a.farbe
  ctx.fillText(a.name, mx, oben + 72)

  ctx.font = `400 16px ${SCHRIFT.mono}`
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
  ctx.strokeStyle = mitAlpha(FARBEN.treffer, 0.22)
  ctx.lineWidth = 1.4
  ctx.beginPath()
  sprungOverlay(ctx, breite, hoehe, seitTod, s.saat, breite / 2, hoehe / 2)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.font = `700 54px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.gefahr
  ctx.fillText(TEXTE.tot, breite / 2, 86)

  // Punkte gross: Das ist die Zahl, um die es bei einer Bestenliste geht.
  ctx.font = `400 14px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.punkte, breite / 2, 132)
  ctx.font = `700 58px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textHervor
  ctx.fillText(zahlText(s.punkte), breite / 2, 172)

  ctx.font = `400 14px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(
    `${s.charakter.name} ×${s.charakter.punkteFaktor.toFixed(2)}  ·  ${TEXTE.bestwert} ${zahlText(s.bestwert)}`,
    breite / 2,
    206,
  )

  zeichneErgebnisZeilen(ctx, s, breite / 2 - 250, 250)
  zeichneSchadensBalken(ctx, s, breite / 2 + 30, 250)
  zeichneFreischaltung(ctx, s, breite / 2, hoehe - 96)

  const puls = 0.55 + 0.45 * Math.sin(performance.now() / 380)
  ctx.textAlign = 'center'
  ctx.font = `600 19px ${SCHRIFT.mono}`
  ctx.fillStyle = mitAlpha(FARBEN.text, puls)
  ctx.fillText(TEXTE.totHinweis, breite / 2, hoehe - 40)

  ctx.textBaseline = 'alphabetic'
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
    ctx.font = `400 17px ${SCHRIFT.mono}`
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
  ctx.font = `400 14px ${SCHRIFT.mono}`
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

    ctx.font = `600 14px ${SCHRIFT.mono}`
    ctx.textAlign = 'right'
    ctx.fillStyle = FARBEN.text
    ctx.fillText(e.name, x + namensBreite - 12, by)

    const bx = x + namensBreite
    schraegBalken(ctx, bx, by - 9, bw, 18, 9)
    ctx.fillStyle = mitAlpha(e.farbe, 0.16)
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.fillStyle = e.farbe
    ctx.fillRect(bx, by - 9, bw * anteil, 18)
    ctx.restore()

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
  ctx.font = `700 15px ${SCHRIFT.mono}`
  ctx.fillStyle = mitAlpha(SELTENHEIT_FARBE.legendaer, puls)
  ctx.fillText(TEXTE.freigeschaltet, mx, y)
  ctx.font = `700 22px ${SCHRIFT.mono}`
  ctx.fillStyle = SELTENHEIT_FARBE.legendaer
  ctx.fillText(namen, mx, y + 26)
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
  // Das Spielfeld bleibt sichtbar durchscheinen: Ein voll deckender Schleier
  // schneidet den Lauf gefuehlt ab, ein halbdurchsichtiger haelt die Spannung.
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
