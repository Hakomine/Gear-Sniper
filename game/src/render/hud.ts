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
    // In der Konturfarbe, nicht in der Grundfarbe: Seit das Spielfeld hell
    // ist, wuerde ein Saum in Grundfarbe die Raender *aufhellen* - und damit
    // genau das Gegenteil dessen tun, wofuer er da ist.
    const oben = ctx.createLinearGradient(0, 0, 0, 104)
    oben.addColorStop(0, mitAlpha(FARBEN.kontur, 0.85))
    oben.addColorStop(1, mitAlpha(FARBEN.kontur, 0))
    const unten = ctx.createLinearGradient(0, hoehe - 96, 0, hoehe)
    unten.addColorStop(0, mitAlpha(FARBEN.kontur, 0))
    unten.addColorStop(1, mitAlpha(FARBEN.kontur, 0.85))
    saumOben = oben
    saumUnten = unten
    saumSchluessel = schluessel
  }
  ctx.fillStyle = saumOben
  ctx.fillRect(0, 0, breite, 104)
  ctx.fillStyle = saumUnten as CanvasGradient
  ctx.fillRect(0, hoehe - 96, breite, 96)
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
  const xpHoehe = 10
  ctx.fillStyle = FARBEN.kontur
  ctx.fillRect(0, 0, breite, xpHoehe + 3)
  ctx.fillStyle = mitAlpha(FARBEN.kristall, 0.2)
  ctx.fillRect(0, 0, breite, xpHoehe)
  ctx.fillStyle = FARBEN.kristall
  ctx.fillRect(0, 0, breite * xpAnteil, xpHoehe)
  // Heller Kamm auf der Fuellung - dieselbe Lichtung wie an jedem Koerper.
  ctx.fillStyle = mitAlpha('#ffffff', 0.28)
  ctx.fillRect(0, 0, breite * xpAnteil, 3)

  // --- Uhr, mittig oben ----------------------------------------------------
  const uhr = zeitText(s.zeit)
  ctx.font = `700 40px ${SCHRIFT.mono}`
  const uhrB = ctx.measureText(uhr).width + 44
  hudPlatte(ctx, breite / 2 - uhrB / 2, 20, uhrB, 78, FARBEN.spielerRing)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = FARBEN.text
  ctx.fillText(uhr, breite / 2, 30)

  // Etappe unter der Uhr: Die Uhr sagt, wie lange - die Etappe, wie weit.
  // Die Zerruettung haengt hinten dran statt eine eigene Platte zu bekommen:
  // Sie beantwortet dieselbe Frage - wie weit ist dieser Lauf - nur eine
  // Ebene hoeher.
  ctx.font = `700 13px ${SCHRIFT.mono}`
  ctx.fillStyle = s.zerruettung > 0 ? '#c86bff' : FARBEN.spielerRing
  const fortschritt =
    s.zerruettung > 0 ? `${TEXTE.etappe} ${s.etappe} · Z${s.zerruettung}` : `${TEXTE.etappe} ${s.etappe}`
  ctx.fillText(fortschritt, breite / 2, 74)

  // --- Stufe links, Kills rechts -------------------------------------------
  zaehler(ctx, 22, 20, TEXTE.hudStufe, String(sp.level), FARBEN.spielerRing, false)
  zaehler(
    ctx,
    breite - 22,
    20,
    TEXTE.ergebnisKills.toUpperCase(),
    zahlText(s.statistik.kills),
    FARBEN.text,
    true,
  )

  // --- Lebensbalken, unten mittig ------------------------------------------
  const bw = 360
  const bh = 16
  const bx = (breite - bw) / 2
  const by = hoehe - 46
  const lebenAnteil = Math.max(0, sp.hp / sp.maxHp)

  // Massiv wie jede Platte: harter Schatten, dunkle Kontur, und die Fuellung
  // innen abgeschnitten. Der Balken liegt damit *auf* dem Feld statt darin.
  const schraege = bh * 0.6
  schraegBalken(ctx, bx, by + 5, bw, bh, schraege)
  ctx.fillStyle = FARBEN.kontur
  ctx.fill()

  schraegBalken(ctx, bx, by, bw, bh, schraege)
  ctx.fillStyle = FARBEN.kartenGrundTief
  ctx.fill()

  ctx.save()
  ctx.clip()
  // Faerbt sich mit sinkendem Leben von Mint nach Rot - man soll es sehen,
  // ohne die Zahl zu lesen.
  const lebenFarbe = lebenAnteil > 0.34 ? FARBEN.heilung : FARBEN.gefahr
  ctx.fillStyle = lebenFarbe
  ctx.fillRect(bx, by, bw * lebenAnteil, bh)
  ctx.fillStyle = mitAlpha('#ffffff', 0.25)
  ctx.fillRect(bx, by, bw * lebenAnteil, 4)
  ctx.restore()

  schraegBalken(ctx, bx, by, bw, bh, schraege)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()

  ctx.font = `700 14px ${SCHRIFT.mono}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = FARBEN.kontur
  ctx.fillText(`${Math.ceil(sp.hp)} / ${Math.ceil(sp.maxHp)}`, breite / 2, by + bh / 2 + 1)

  // Verhexung "Blindheit": Die Karte bleibt weg. Sie ist das einzige, was
  // eine Verhexung an der Oberflaeche aendert - und ausgerechnet die Anzeige
  // wegzunehmen, die vier Runden lang gefehlt hat, ist ein spuerbarer Preis.
  if (!s.blind) zeichneMinikarte(ctx, s, breite)
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
    // Zur Mitte hin schon leicht sichtbar: Auf dem helleren Spielfeld geht
    // ein reiner Randschimmer unter, und die Warnung soll man am Rand des
    // Blickfelds mitbekommen, nicht suchen muessen.
    verlauf.addColorStop(0, 'rgba(255,77,94,0)')
    verlauf.addColorStop(0.72, 'rgba(255,77,94,0.35)')
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
  const kasten = 44
  const luecke = 9
  const x0 = 22
  const y = hoehe - 70

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < waffen.length; i++) {
    const w = waffen[i]
    const x = x0 + i * (kasten + luecke)
    const voll = istVollendet(w.def, w.stufe)
    const akzent = voll ? SELTENHEIT_FARBE.legendaer : w.def.farbe

    // Kachel in derselben Sprache wie jede Platte - der Akzentbalken oben
    // traegt die Waffenfarbe, bei Vollendung das Gold der Legendaeren.
    hudPlatte(ctx, x, y, kasten, kasten, akzent)

    // Raute in Waffenfarbe, gefuellt und umrandet - dieselbe Regel wie bei
    // allem auf dem Feld, damit Anzeige und Wirkung zusammengehoeren.
    const mx = x + kasten / 2
    const my = y + kasten / 2 - 1
    const r = 9
    ctx.beginPath()
    ctx.moveTo(mx, my - r)
    ctx.lineTo(mx + r, my)
    ctx.lineTo(mx, my + r)
    ctx.lineTo(mx - r, my)
    ctx.closePath()
    ctx.fillStyle = w.def.farbe
    ctx.fill()
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = FARBEN.kontur
    ctx.stroke()

    ctx.font = `700 10px ${SCHRIFT.mono}`
    ctx.fillStyle = voll ? SELTENHEIT_FARBE.legendaer : FARBEN.textSchwach
    ctx.fillText(voll ? 'MAX' : `${w.stufe}`, mx, y + kasten - 7)
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
  /*
   * Tiefer, als es aussieht.
   *
   * Auf 78 stand die Leiste mitten in der Uhr und ihre Namensplatte darueber
   * schnitt sie an - im Screenshot mit Boss war von "3:20" nur die untere
   * Haelfte zu lesen, und die Etappenzeile lief durch den Balken. Jetzt
   * stapelt sich alles sauber: Uhr, Etappe, Bossname, Leiste, Kittuhr.
   */
  const by = 130
  const anteil = Math.max(0, boss.hp / boss.maxHp)

  const schraege = bh * 0.8

  schraegBalken(ctx, bx, by + 5, bw, bh, schraege)
  ctx.fillStyle = FARBEN.kontur
  ctx.fill()
  schraegBalken(ctx, bx, by, bw, bh, schraege)
  ctx.fillStyle = FARBEN.kartenGrundTief
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.fillStyle = z.art.farbe
  ctx.fillRect(bx, by, bw * anteil, bh)
  ctx.fillStyle = mitAlpha('#ffffff', 0.22)
  ctx.fillRect(bx, by, bw * anteil, 4)
  ctx.restore()

  schraegBalken(ctx, bx, by, bw, bh, schraege)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  ctx.strokeStyle = FARBEN.kontur
  ctx.stroke()

  /*
   * Schalen statt Phasenmarke - beim Kern.
   *
   * Drei Striche statt einem, und die schon gebrochenen sind blass. Damit sagt
   * die Leiste dasselbe wie beim gewoehnlichen Boss ("gleich aendert sich
   * etwas"), nur dreimal - und man sieht auf einen Blick, wie weit der
   * Endkampf ist, ohne den Balken lesen zu muessen.
   */
  const schalen = z.art.schalen ?? 0
  if (schalen > 0) {
    for (let i = 1; i <= schalen; i++) {
      const anteilMarke = i / (schalen + 1)
      const mx = bx + bw * anteilMarke
      const offen = z.schale >= i
      ctx.fillStyle = offen ? FARBEN.treffer : mitAlpha(FARBEN.treffer, 0.25)
      ctx.fillRect(mx - 1.5, by - 5, 3, bh + 10)
    }
  } else {
    // Phasenmarke.
    const markeX = bx + bw * z.art.phaseSchwelle
    ctx.fillStyle = z.phase === 1 ? FARBEN.treffer : mitAlpha(FARBEN.treffer, 0.3)
    ctx.fillRect(markeX - 1, by - 4, 2, bh + 8)
  }

  // Die Kittuhr: ein schmaler Streifen unter der Leiste, der leerlaeuft. Ohne
  // ihn ist die Selbstkittung eine Ueberraschung statt einer Ansage - und
  // genau die Regel gilt fuer jeden Bossangriff im Spiel.
  if (z.art.kittTakt !== undefined && z.art.kittTakt > 0) {
    const rest = Math.max(0, z.kittRest) / z.art.kittTakt
    ctx.fillStyle = FARBEN.kontur
    ctx.fillRect(bx, by + bh + 6, bw, 5)
    ctx.fillStyle = z.kittGemeldet ? FARBEN.gefahr : '#63d4ff'
    ctx.fillRect(bx, by + bh + 6, bw * rest, 5)
  }

  const name =
    schalen > 0
      ? `${z.art.name} — ${z.schale} ${z.schale === 1 ? 'SCHALE' : 'SCHALEN'}`
      : z.phase === 1
        ? z.art.name
        : `${z.art.name} — PHASE 2`
  ctx.font = `700 15px ${SCHRIFT.anzeige}`
  const nb = ctx.measureText(name).width + 32
  hudPlatte(ctx, breite / 2 - nb / 2, by - 34, nb, 26, z.art.farbe)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = FARBEN.text
  ctx.fillText(name, breite / 2, by - 19)
  ctx.textBaseline = 'alphabetic'
}


/**
 * Eine kleine HUD-Platte.
 *
 * Dieselbe Sprache wie die Karten in den Menues, nur kleiner: harter Schatten
 * in der Konturfarbe, gefuellter Koerper, dunkle Kante, Akzentbalken oben.
 * Vorher schwebte der HUD-Text frei ueber dem Getuemmel - auf einem hellen
 * Spielfeld ist das der schnellste Weg, eine Anzeige unlesbar zu machen.
 */
function hudPlatte(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  akzent: string,
): void {
  ctx.fillStyle = FARBEN.kontur
  ctx.fillRect(x, y + 4, b, h)
  ctx.fillStyle = mitAlpha(FARBEN.kartenGrundTief, 0.94)
  ctx.fillRect(x, y, b, h)
  ctx.lineWidth = 2.5
  ctx.strokeStyle = FARBEN.kontur
  ctx.strokeRect(x + 1.25, y + 1.25, b - 2.5, h - 2.5)
  ctx.fillStyle = akzent
  ctx.fillRect(x, y, b, 4)
}

/**
 * Ein Zaehler oben in der Ecke: Beschriftung klein, Wert gross.
 *
 * `rechts` legt fest, an welcher Kante er klebt - damit teilen sich Stufe und
 * Kills denselben Code statt zweier fast gleicher Bloecke.
 */
function zaehler(
  ctx: CanvasRenderingContext2D,
  kante: number,
  y: number,
  titel: string,
  wert: string,
  farbe: string,
  rechts: boolean,
): void {
  ctx.font = `700 26px ${SCHRIFT.mono}`
  const breite = Math.max(96, ctx.measureText(wert).width + 34, ctx.measureText(titel).width + 26)
  const x = rechts ? kante - breite : kante
  hudPlatte(ctx, x, y, breite, 62, farbe)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = `600 11px ${SCHRIFT.text}`
  ctx.fillStyle = FARBEN.textSchwach
  ctx.fillText(titel, x + breite / 2, y + 12)
  ctx.font = `700 26px ${SCHRIFT.mono}`
  ctx.fillStyle = farbe
  ctx.fillText(wert, x + breite / 2, y + 28)
}

/** Kantenlaenge der Minikarte und wie viel Welt sie zeigt. */
const KARTE_GROESSE = 148
const KARTE_REICHWEITE = 1500

/**
 * Die Minikarte.
 *
 * Sie zeigt **vier** Dinge, und das ist Absicht: dich, die Richtung des
 * Bosses, offene Schreine, und wo es dicht wird. Alles andere waere wieder
 * Rauschen - und Rauschen ist genau das Problem, das sie loesen soll.
 *
 * Das Getuemmel steht als *Wolke*, nicht als Punktemenge. 1400 Einzelpunkte
 * auf 148 Pixeln waeren Konfetti; eine Handvoll weicher Flecken sagt, wo es
 * eng wird, und genau das ist die Frage, die man an eine Karte hat.
 *
 * Was ausserhalb der Reichweite liegt, wird an den Rand geklemmt - ein Boss,
 * den man nicht sieht, ist die wichtigste Information von allen.
 */
function zeichneMinikarte(ctx: CanvasRenderingContext2D, s: Spielstand, breite: number): void {
  const rand = 22
  const x = breite - KARTE_GROESSE - rand
  const y = 84
  const mx = x + KARTE_GROESSE / 2
  const my = y + KARTE_GROESSE / 2
  const massstab = KARTE_GROESSE / 2 / KARTE_REICHWEITE
  const sp = s.spieler

  ctx.save()

  // Dieselbe Platte wie Uhr, Zaehler und Waffenkacheln.
  hudPlatte(ctx, x, y, KARTE_GROESSE, KARTE_GROESSE, FARBEN.spielerRing)

  ctx.beginPath()
  // Der Akzentbalken oben bleibt frei - die Wolke soll nicht darueber laufen.
  ctx.rect(x + 3, y + 5, KARTE_GROESSE - 6, KARTE_GROESSE - 8)
  ctx.clip()

  // Wo es dicht wird. Ein grosser weicher Fleck je Gegner summiert sich von
  // selbst zu einer Wolke - billiger und lesbarer als jede echte Dichtekarte.
  const gegner = s.gegner.aktiv
  //
  // Ein Pfad fuer alle, ein einziges `fill`. Bei 1400 Gegnern waeren 1400
  // Fuellaufrufe je Bild die teuerste Zeile im ganzen Zeichencode - dieselbe
  // Buendelung wie bei Gegnern und Geschossen.
  ctx.beginPath()
  for (let i = 0; i < gegner.length; i++) {
    const g = gegner[i]
    if (g.bossZustand !== null) continue
    const px = mx + (g.x - sp.x) * massstab
    const py = my + (g.y - sp.y) * massstab
    ctx.moveTo(px + 7, py)
    ctx.arc(px, py, 7, 0, Math.PI * 2)
  }
  ctx.fillStyle = mitAlpha(FARBEN.koerperLeicht, 0.3)
  ctx.fill()

  // Offene Schreine als Bernsteinraute - der einzige Grund, irgendwohin zu
  // *wollen*, also gehoeren sie auf jede Karte.
  const schreine = s.schreine.aktiv
  for (let i = 0; i < schreine.length; i++) {
    const sch = schreine[i]
    if (sch.benutzt) continue
    const p = aufKarte(sch.x - sp.x, sch.y - sp.y, massstab, mx, my)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = FARBEN.textHervor
    ctx.fillRect(-4, -4, 8, 8)
    ctx.strokeStyle = FARBEN.kontur
    ctx.lineWidth = 1.5
    ctx.strokeRect(-4, -4, 8, 8)
    ctx.restore()
  }

  // Der Boss als Keil, der in seine Richtung zeigt - auch weit ausserhalb.
  const boss = findeBoss(s)
  if (boss !== null) {
    const dx = boss.x - sp.x
    const dy = boss.y - sp.y
    const p = aufKarte(dx, dy, massstab, mx, my)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(Math.atan2(dy, dx))
    ctx.beginPath()
    ctx.moveTo(8, 0)
    ctx.lineTo(-6, 6)
    ctx.lineTo(-6, -6)
    ctx.closePath()
    ctx.fillStyle = FARBEN.gefahr
    ctx.fill()
    ctx.strokeStyle = FARBEN.kontur
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  // Du, mit Blickrichtung. Zuletzt, damit nichts dich verdeckt.
  ctx.beginPath()
  ctx.moveTo(mx, my)
  ctx.lineTo(mx + sp.blickX * 13, my + sp.blickY * 13)
  ctx.strokeStyle = FARBEN.spieler
  ctx.lineWidth = 2.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(mx, my, 4.5, 0, Math.PI * 2)
  ctx.fillStyle = FARBEN.spieler
  ctx.fill()
  ctx.strokeStyle = FARBEN.kontur
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

/**
 * Weltversatz auf Kartenkoordinaten - was zu weit weg ist, klemmt am Rand.
 *
 * Das Klemmen ist der Punkt: Ein Boss, der ausserhalb der Reichweite steht,
 * verschwaende sonst genau dann von der Karte, wenn man am dringendsten wissen
 * will, aus welcher Richtung er kommt.
 */
function aufKarte(
  dx: number,
  dy: number,
  massstab: number,
  mx: number,
  my: number,
): { x: number; y: number } {
  const grenze = KARTE_GROESSE / 2 - 9
  let px = dx * massstab
  let py = dy * massstab
  const laenge = Math.hypot(px, py)
  if (laenge > grenze) {
    px = (px / laenge) * grenze
    py = (py / laenge) * grenze
  }
  return { x: mx + px, y: my + py }
}
