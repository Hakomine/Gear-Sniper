import type { Spielstand } from '../game/state'
import { findeBoss } from '../game/bosse'
import { istVollendet } from '../game/weapons'
import { TEXTE, zahlText, zeitText } from '../ui/strings'
import { schraegBalken } from './glas'
import { FARBEN, mitAlpha, SCHRIFT, SELTENHEIT_FARBE } from './palette'

/**
 * Die Anzeige.
 *
 * Regel: Was staendig gebraucht wird, steht am Rand; was den Blick vom Feld
 * zieht, kommt weg. Deshalb keine Zahlenkolonnen - drei Balken, eine Uhr,
 * zwei Zahlen. Alles andere lenkt in einem Spiel ab, in dem man permanent
 * ausweicht.
 */

let randVerlauf: CanvasGradient | null = null
let randVerlaufSchluessel = ''
let saumOben: CanvasGradient | null = null
let saumUnten: CanvasGradient | null = null
let saumSchluessel = ''

/**
 * Dunkler Verlauf hinter Uhr und Zahlen.
 *
 * Ohne ihn steht die Anzeige in der spaeten Phase auf einem Teppich aus
 * orangen Gegnern und ist schlicht nicht mehr lesbar - ausgerechnet die Uhr,
 * an der in diesem Genre der ganze Ehrgeiz haengt. Ein Verlauf statt eines
 * Balkens, damit der Rand nicht als Kante ins Bild schneidet.
 */
function zeichneSaeume(ctx: CanvasRenderingContext2D, breite: number, hoehe: number): void {
  const schluessel = `${breite}x${hoehe}`
  if (saumOben === null || saumSchluessel !== schluessel) {
    const oben = ctx.createLinearGradient(0, 0, 0, 96)
    oben.addColorStop(0, mitAlpha(FARBEN.grund, 0.82))
    oben.addColorStop(1, mitAlpha(FARBEN.grund, 0))
    const unten = ctx.createLinearGradient(0, hoehe - 88, 0, hoehe)
    unten.addColorStop(0, mitAlpha(FARBEN.grund, 0))
    unten.addColorStop(1, mitAlpha(FARBEN.grund, 0.82))
    saumOben = oben
    saumUnten = unten
    saumSchluessel = schluessel
  }
  ctx.fillStyle = saumOben
  ctx.fillRect(0, 0, breite, 96)
  ctx.fillStyle = saumUnten as CanvasGradient
  ctx.fillRect(0, hoehe - 88, breite, 88)
}

export function zeichneHud(
  ctx: CanvasRenderingContext2D,
  s: Spielstand,
  breite: number,
  hoehe: number,
): void {
  const sp = s.spieler

  zeichneSaeume(ctx, breite, hoehe)

  // --- Erfahrungsbalken, ganz oben ueber die volle Breite -------------------
  // Ganz oben, weil er der eigentliche Fortschritt ist: Der Blick muss ihn
  // streifen koennen, ohne das Getuemmel aus den Augen zu verlieren.
  const xpAnteil = Math.max(0, Math.min(1, sp.xp / sp.xpNaechste))
  ctx.fillStyle = mitAlpha(FARBEN.kristall, 0.14)
  ctx.fillRect(0, 0, breite, 7)
  ctx.fillStyle = FARBEN.kristall
  ctx.fillRect(0, 0, breite * xpAnteil, 7)

  // --- Uhr, mittig oben ----------------------------------------------------
  ctx.font = `600 40px ${SCHRIFT.mono}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = FARBEN.text
  ctx.fillText(zeitText(s.zeit), breite / 2, 22)

  // --- Stufe links, Kills rechts -------------------------------------------
  ctx.font = `500 17px ${SCHRIFT.mono}`
  ctx.textAlign = 'left'
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.hudStufe, 26, 26)
  ctx.font = `700 26px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textHervor
  ctx.fillText(String(sp.level), 26, 46)

  ctx.font = `500 17px ${SCHRIFT.mono}`
  ctx.textAlign = 'right'
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(TEXTE.ergebnisKills.toUpperCase(), breite - 26, 26)
  ctx.font = `700 26px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.text
  ctx.fillText(zahlText(s.statistik.kills), breite - 26, 46)

  // Etappe neben der Uhr: Die Uhr sagt, wie lange - die Etappe, wie weit.
  ctx.textAlign = 'center'
  ctx.font = `600 13px ${SCHRIFT.mono}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(`${TEXTE.etappe} ${s.etappe}`, breite / 2, 62)

  // --- Lebensbalken, unten mittig ------------------------------------------
  const bw = 360
  const bh = 16
  const bx = (breite - bw) / 2
  const by = hoehe - 46
  const lebenAnteil = Math.max(0, sp.hp / sp.maxHp)

  const schraege = bh * 0.7

  schraegBalken(ctx, bx - 2, by - 2, bw + 4, bh + 4, schraege)
  ctx.fillStyle = mitAlpha('#000000', 0.55)
  ctx.fill()
  schraegBalken(ctx, bx, by, bw, bh, schraege)
  ctx.fillStyle = mitAlpha(FARBEN.gefahr, 0.22)
  ctx.fill()

  // Die Fuellung wird am Balken *abgeschnitten* statt selbst schraeg gerechnet.
  // Sonst muesste jede Fuellbreite ihre eigene Schraege bekommen, und bei
  // wenig Leben liefe sie in sich zusammen.
  ctx.save()
  ctx.clip()
  // Faerbt sich mit sinkendem Leben von Mint nach Rot - man soll es sehen,
  // ohne die Zahl zu lesen.
  ctx.fillStyle = lebenAnteil > 0.34 ? FARBEN.heilung : FARBEN.gefahr
  ctx.fillRect(bx, by, bw * lebenAnteil, bh)
  ctx.restore()

  ctx.font = `600 14px ${SCHRIFT.mono}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = FARBEN.grund
  ctx.fillText(`${Math.ceil(sp.hp)} / ${Math.ceil(sp.maxHp)}`, breite / 2, by + bh / 2 + 1)

  zeichneWaffenLeiste(ctx, s, hoehe)
  zeichneBossLeiste(ctx, s, breite)

  // --- Warnschleier bei wenig Leben ----------------------------------------
  if (lebenAnteil < 0.34) {
    zeichneRandWarnung(ctx, breite, hoehe, (0.34 - lebenAnteil) / 0.34)
  }

  ctx.textBaseline = 'alphabetic'
}

/**
 * Roter Schimmer an den Bildraendern.
 *
 * Der Verlauf wird zwischengespeichert: Ihn jedes Bild neu anzulegen waere
 * genau die Art von Muell, die der Pool an anderer Stelle vermeidet.
 */
function zeichneRandWarnung(
  ctx: CanvasRenderingContext2D,
  breite: number,
  hoehe: number,
  staerke: number,
): void {
  const schluessel = `${breite}x${hoehe}`
  if (randVerlauf === null || randVerlaufSchluessel !== schluessel) {
    const verlauf = ctx.createRadialGradient(
      breite / 2,
      hoehe / 2,
      Math.min(breite, hoehe) * 0.32,
      breite / 2,
      hoehe / 2,
      Math.max(breite, hoehe) * 0.62,
    )
    verlauf.addColorStop(0, 'rgba(255,77,94,0)')
    verlauf.addColorStop(1, 'rgba(255,77,94,1)')
    randVerlauf = verlauf
    randVerlaufSchluessel = schluessel
  }

  ctx.save()
  // Pulsiert leicht, damit die Warnung nicht zur Tapete wird.
  ctx.globalAlpha = Math.min(0.55, staerke * 0.5) * (0.75 + 0.25 * Math.sin(performance.now() / 190))
  ctx.fillStyle = randVerlauf
  ctx.fillRect(0, 0, breite, hoehe)
  ctx.restore()
}

/**
 * Die getragenen Waffen, unten links.
 *
 * Nach zehn Minuten weiss niemand mehr auswendig, was im Guertel steckt - und
 * genau das braucht man, um zu entscheiden, ob die naechste Karte passt. Ohne
 * diese Leiste waere das Riss-System nicht spielbar, sondern Glueckssache.
 */
function zeichneWaffenLeiste(ctx: CanvasRenderingContext2D, s: Spielstand, hoehe: number): void {
  const waffen = s.spieler.waffen
  const kasten = 38
  const luecke = 8
  const x0 = 26
  const y = hoehe - 62

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < waffen.length; i++) {
    const w = waffen[i]
    const x = x0 + i * (kasten + luecke)
    const voll = istVollendet(w.def, w.stufe)
    const rahmen = voll ? SELTENHEIT_FARBE.legendaer : w.def.farbe

    ctx.beginPath()
    ctx.roundRect(x, y, kasten, kasten, 8)
    ctx.fillStyle = mitAlpha(FARBEN.grund, 0.8)
    ctx.fill()
    ctx.lineWidth = voll ? 2.5 : 1.5
    ctx.strokeStyle = mitAlpha(rahmen, voll ? 1 : 0.7)
    ctx.stroke()

    // Raute in Waffenfarbe - dieselbe Farbe wie ihre Geschosse im Feld,
    // damit man Anzeige und Wirkung zusammenbringt.
    const mx = x + kasten / 2
    const my = y + kasten / 2 - 3
    const r = 8
    ctx.beginPath()
    ctx.moveTo(mx, my - r)
    ctx.lineTo(mx + r, my)
    ctx.lineTo(mx, my + r)
    ctx.lineTo(mx - r, my)
    ctx.closePath()
    ctx.fillStyle = w.def.farbe
    ctx.fill()

    ctx.font = `700 10px ${SCHRIFT.mono}`
    ctx.fillStyle = voll ? SELTENHEIT_FARBE.legendaer : FARBEN.textSchwach
    ctx.fillText(voll ? 'MAX' : `${w.stufe}`, mx, y + kasten - 8)
  }

  ctx.textBaseline = 'alphabetic'
}

/**
 * Bossleiste mit Phasenmarke.
 *
 * Der Strich bei der Phasenschwelle ist der eigentliche Punkt: Er sagt dem
 * Spieler vorher, wann der Kampf sich aendert - statt ihn davon ueberraschen
 * zu lassen. Ein Boss soll schwer sein, nicht heimtueckisch.
 */
function zeichneBossLeiste(ctx: CanvasRenderingContext2D, s: Spielstand, breite: number): void {
  const boss = findeBoss(s)
  if (boss === null || boss.bossZustand === null) return

  const z = boss.bossZustand
  const bw = 640
  const bh = 14
  const bx = (breite - bw) / 2
  const by = 78
  const anteil = Math.max(0, boss.hp / boss.maxHp)

  const schraege = bh * 0.9

  schraegBalken(ctx, bx - 3, by - 3, bw + 6, bh + 6, schraege)
  ctx.fillStyle = mitAlpha('#000000', 0.6)
  ctx.fill()
  schraegBalken(ctx, bx, by, bw, bh, schraege)
  ctx.fillStyle = mitAlpha(z.art.farbe, 0.2)
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.fillStyle = z.art.farbe
  ctx.fillRect(bx, by, bw * anteil, bh)
  ctx.restore()

  // Phasenmarke.
  const markeX = bx + bw * z.art.phaseSchwelle
  ctx.fillStyle = z.phase === 1 ? FARBEN.treffer : mitAlpha(FARBEN.treffer, 0.3)
  ctx.fillRect(markeX - 1, by - 4, 2, bh + 8)

  ctx.font = `700 15px ${SCHRIFT.mono}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = FARBEN.text
  ctx.fillText(z.phase === 1 ? z.art.name : `${z.art.name} — PHASE 2`, breite / 2, by - 8)
  ctx.textBaseline = 'alphabetic'
}
