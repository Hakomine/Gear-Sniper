import type { Spielstand } from '../game/state'
import { TEXTE, zahlText, zeitText } from '../ui/strings'
import { FARBEN, mitAlpha, SCHRIFT } from './palette'

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

  // --- Lebensbalken, unten mittig ------------------------------------------
  const bw = 360
  const bh = 16
  const bx = (breite - bw) / 2
  const by = hoehe - 46
  const lebenAnteil = Math.max(0, sp.hp / sp.maxHp)

  ctx.fillStyle = mitAlpha('#000000', 0.55)
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4)
  ctx.fillStyle = mitAlpha(FARBEN.gefahr, 0.22)
  ctx.fillRect(bx, by, bw, bh)
  // Faerbt sich mit sinkendem Leben von Mint nach Rot - man soll es sehen,
  // ohne die Zahl zu lesen.
  ctx.fillStyle = lebenAnteil > 0.34 ? FARBEN.heilung : FARBEN.gefahr
  ctx.fillRect(bx, by, bw * lebenAnteil, bh)

  ctx.font = `600 14px ${SCHRIFT.mono}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = FARBEN.grund
  ctx.fillText(`${Math.ceil(sp.hp)} / ${Math.ceil(sp.maxHp)}`, breite / 2, by + bh / 2 + 1)

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
