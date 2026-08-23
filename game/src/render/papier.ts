/**
 * Papier und Tinte - das Material, aus dem dieses Spiel gedruckt ist.
 *
 * Drei Runden lang war die Rueckmeldung dieselbe: "sieht aus, als waer das mit
 * KI gemacht". Runde 6 hat versucht, sie mit mehr Politur zu beantworten -
 * Nachtfeld, Leuchten, Bloom - und es wurde *schlimmer*. Der Grund dafuer ist
 * belegbar und nicht Geschmack: Die dokumentierte Handschrift maschinell
 * erzeugter Gestaltung ist woertlich "neon-on-dark (cyan/violet) with glowing
 * card borders". Wer sie waehlt, waehlt die Voreinstellung.
 *
 * Und was von Hand gemacht *wirkt*, kommt aus "irregular lines, uneven edges,
 * visible materials" - Dinge, die sich mit prozeduralen, vektorbasierten
 * Mitteln nur schwer herstellen lassen. Genau das war das Problem: In diesem
 * Spiel kam jedes Sechseck aus `cos(i * PI / 3)`, jeder Strich war exakt drei
 * Punkte breit, jede Flaeche eine einfarbige Fuellung. Es sah maschinell aus,
 * weil es maschinell *war*.
 *
 * Diese Datei ist die Antwort darauf. Sie liefert vier Dinge, die ein Druck
 * hat und ein Vektorbild nicht:
 *
 * 1. **Korn** - Papier ist nie glatt.
 * 2. **Flecken** - Papier ist nie gleichmaessig.
 * 3. **Schraffur** - Schattierung entsteht aus Strichen, nicht aus Verlaeufen.
 * 4. **Kerben** - eine helle Stelle ist fehlende Tinte, kein helles Pixel.
 *
 * Alles davon ist weiterhin reine Mathematik. Der Unterschied zu vorher ist
 * nicht das Werkzeug, sondern dass die Mathematik jetzt *Unregelmaessigkeit*
 * erzeugt statt Perfektion.
 */

import { FARBEN, mitAlpha } from './palette'

/**
 * Stabiler Kleinzufall aus zwei Zahlen.
 *
 * Wichtig ist die Stabilitaet: Ein Gegner muss ueber alle Bilder hinweg
 * dieselbe ausgebrochene Kante haben. Waere sie je Bild neu, flackerte das
 * ganze Feld - und aus "handgeschnitten" wuerde "kaputt".
 *
 * Dieselbe Formel benutzt `glas.ts` seit Runde 5 fuer die Kartenformen. Sie
 * steht hier ein zweites Mal und nicht als Import, weil `glas.ts` die
 * Oberflaeche ist und diese Datei die Welt: Ein Import in diese Richtung
 * wuerde die beiden verkleben, und die Sternform der Importe im Projekt
 * bricht.
 */
export function streu(saat: number, i: number): number {
  const x = Math.sin(saat * 12.9898 + i * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Vorgerechnete Streuung fuer den heissen Pfad.
 *
 * `formPfad` laeuft bei vollem Feld ueber rund tausend Koerper mal zwei Pfade
 * mal bis zu zwoelf Eckpunkte - das sind ueber zwanzigtausend Abfragen je
 * Bild. `Math.sin` so oft aufzurufen ist messbar; eine Tabelle mit 256
 * Eintraegen ist es nicht. Die Zahlen liegen in `[-1, 1]`.
 */
const TABELLE_GROESSE = 256
const VERSATZ = new Float32Array(TABELLE_GROESSE)
for (let i = 0; i < TABELLE_GROESSE; i++) VERSATZ[i] = streu(i + 1, 7) * 2 - 1

/**
 * Wie weit ein Eckpunkt aus seiner Sollposition rutscht.
 *
 * `saat` ist normalerweise die `id` des Gegners, `i` der Index des Eckpunkts.
 * Dieselbe Kombination gibt immer denselben Wert - dieselbe Kreatur bricht
 * also immer gleich aus, aber keine zwei brechen gleich aus.
 */
export function kantenVersatz(saat: number, i: number): number {
  return VERSATZ[((saat * 7 + i * 31) & (TABELLE_GROESSE - 1))]
}

/**
 * Wie stark eine Kante ausbricht, gemessen am Radius.
 *
 * Bewusst klein: Bei sieben Prozent sieht man einem einzelnen Koerper die
 * Unregelmaessigkeit kaum an, aber tausend nebeneinander wirken sofort
 * geschnitten statt gestanzt. Mehr, und die Formensprache aus neun Silhouetten
 * faengt an zu verschwimmen - und die traegt die ganze Lesbarkeit.
 */
export const AUSBRUCH = 0.07

/* ------------------------------------------------------------------ Korn */

/**
 * Die Kornkachel - einmal gebaut, dann nur noch gekachelt.
 *
 * 128 x 128 Punkte reichen: Bei dieser Feinheit sieht niemand die
 * Wiederholung, und ein `fillRect` mit Muster kostet einen Aufruf je Bild
 * statt zwoelftausend Punkten.
 *
 * Die Koerner sind *dunkler* als das Papier, nie heller. Papier hat
 * Einschluesse, keine Leuchtpunkte - und ein helles Korn auf hellem Grund
 * saehe aus wie Bildrauschen, also wie ein Fehler.
 */
let kornMuster: CanvasPattern | null = null

export function papierMuster(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (kornMuster !== null) return kornMuster

  const kachel = document.createElement('canvas')
  kachel.width = 128
  kachel.height = 128
  const k = kachel.getContext('2d')
  if (k === null) return null

  k.fillStyle = FARBEN.grund
  k.fillRect(0, 0, 128, 128)

  // Zwei Dichten: viele sehr blasse Punkte fuer die Tiefe, wenige kraeftigere
  // fuer die Einschluesse, die man einzeln wahrnimmt.
  for (let i = 0; i < 900; i++) {
    const x = streu(i, 1) * 128
    const y = streu(i, 2) * 128
    const a = 0.03 + streu(i, 3) * 0.05
    k.fillStyle = mitAlpha(FARBEN.kontur, a)
    k.fillRect(x, y, 1, 1)
  }
  for (let i = 0; i < 70; i++) {
    const x = streu(i, 11) * 128
    const y = streu(i, 12) * 128
    const g = 0.6 + streu(i, 13) * 1.1
    k.fillStyle = mitAlpha(FARBEN.kontur, 0.1 + streu(i, 14) * 0.07)
    k.fillRect(x, y, g, g)
  }

  kornMuster = ctx.createPattern(kachel, 'repeat')
  return kornMuster
}

/**
 * Der Bogen, auf dem gespielt wird.
 *
 * Erst die Grundfarbe, dann das Korn darueber. Das Korn ist im Muster bereits
 * mit Papierfarbe hinterlegt, ein zweiter Auftrag waere also verschenkt - er
 * steht trotzdem hier, weil das Muster bei einem Kontextfehler `null` sein
 * darf und das Bild dann immer noch Papier zeigt statt Schwarz.
 */
export function bogen(ctx: CanvasRenderingContext2D, breite: number, hoehe: number): void {
  ctx.fillStyle = FARBEN.grund
  ctx.fillRect(0, 0, breite, hoehe)

  const muster = papierMuster(ctx)
  if (muster === null) return
  ctx.fillStyle = muster
  ctx.fillRect(0, 0, breite, hoehe)
}

/* --------------------------------------------------------------- Flecken */

/**
 * Grosse, sehr schwache Flecken im Papier - an Weltkoordinaten verankert.
 *
 * Sie sind der Ersatz fuer den Staub aus Runde 6 und haben denselben Zweck:
 * Wenn der Spieler steht, soll das Bild nicht stehen. Aber wo Staub *treibt*
 * und damit Bewegung erfindet, die es nicht gibt, liegt ein Fleck einfach da.
 * Man sieht ihn nur, wenn man sich bewegt - und genau dann sagt er "du bist
 * woanders" statt "hier fliegt was".
 *
 * Bewusst gross und bewusst wenige: Ein Fleck, den man als Fleck erkennt, ist
 * zu stark. Er soll nur verhindern, dass die Flaeche gleichmaessig ist.
 */
const FLECK_FELD = 900
const FLECKEN = 7

export function flecken(ctx: CanvasRenderingContext2D, kameraX: number, kameraY: number): void {
  ctx.save()
  for (let i = 0; i < FLECKEN; i++) {
    const rx = streu(i, 21)
    const ry = streu(i, 22)
    const r = 90 + streu(i, 23) * 170

    // In den sichtbaren Bereich falten, wie beim Staub zuvor - der Fleck
    // wiederholt sich, aber bei dieser Groesse und Blaesse sieht das niemand.
    const x = kameraX + ((((rx * FLECK_FELD - kameraX) % FLECK_FELD) + FLECK_FELD) % FLECK_FELD) - FLECK_FELD / 2
    const y = kameraY + ((((ry * FLECK_FELD - kameraY) % FLECK_FELD) + FLECK_FELD) % FLECK_FELD) - FLECK_FELD / 2

    ctx.beginPath()
    // Kein Kreis: Ein Fleck im Papier hat keine Mittelpunktsform. Acht Punkte
    // mit ungleichem Radius genuegen, damit das Auge ihn als Zufall liest.
    for (let e = 0; e < 8; e++) {
      const w = (e / 8) * Math.PI * 2
      const rr = r * (0.7 + streu(i, 30 + e) * 0.6)
      const px = x + Math.cos(w) * rr
      const py = y + Math.sin(w) * rr * 0.72
      if (e === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = mitAlpha(FARBEN.grundTief, 0.5)
    ctx.fill()
  }
  ctx.restore()
}

/* -------------------------------------------------------------- Schraffur */

/**
 * Schraffur - so schattiert ein Druck.
 *
 * Ein Verlauf ist im Hochdruck nicht herstellbar: Die Walze traegt Farbe auf
 * oder sie traegt keine auf. Wer dunkler will, schneidet enger. Deshalb
 * bekommen grosse Koerper hier parallele Striche statt eines Kerns - und weil
 * der Strichabstand die Helligkeit macht, ist `dichte` der einzige Regler.
 *
 * Nur fuer Grosses. Bei einem Splitter mit neun Punkten Radius waere eine
 * Schraffur ein grauer Fleck, und tausend graue Flecken sind wieder der
 * Teppich, den die Konturen seit Runde 5 verhindern.
 */
export function schraffurPfad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  winkel: number,
  abstand: number,
  saat: number,
): void {
  const c = Math.cos(winkel)
  const sn = Math.sin(winkel)

  for (let d = -radius; d <= radius; d += abstand) {
    // Sehne des Kreises an dieser Stelle - so endet jeder Strich am Rand der
    // Form statt an einem Rechteck darum.
    const halb = Math.sqrt(Math.max(0, radius * radius - d * d))
    if (halb < 1.5) continue
    // Beide Enden verkuerzt, und zwar ungleich: Ein Schnitt laeuft nie exakt
    // bis an die Kante, und zwei Schnitte sind nie exakt gleich lang.
    const e1 = halb * (0.74 + streu(saat + d, 41) * 0.22)
    const e2 = halb * (0.74 + streu(saat + d, 42) * 0.22)
    ctx.moveTo(x + c * -e1 - sn * d, y + sn * -e1 + c * d)
    ctx.lineTo(x + c * e2 - sn * d, y + sn * e2 + c * d)
  }
}

/**
 * Ab welchem Radius sich Schraffur lohnt.
 *
 * Darunter waeren zwei Striche in einem Koerper von neun Punkten kein
 * Schnitt, sondern Dreck - und tausend Dreckflecken sind wieder der Teppich,
 * den die Konturen seit Runde 5 verhindern. Kleines bleibt massive Tinte,
 * genau wie im echten Linolschnitt.
 */
export const SCHRAFFUR_AB = 13

/* ------------------------------------------------------- Schraffur-Muster */

/**
 * Schraffur als Muster - fuer Flaechen, die zu gross fuer Einzelstriche sind.
 *
 * Eine Zone kann zweihundert Punkte Radius haben. Sie mit Einzelstrichen zu
 * schraffieren waeren vierzig Linien je Zone, und bei achtzig Zonen im Feld
 * dreitausend Linien je Bild - genau die Sorte Rechnung, wegen der der
 * Zonendeckel ueberhaupt existiert.
 *
 * Ein gekacheltes Muster kostet stattdessen *einen* Fuellaufruf. Und weil das
 * Muster der Weltmatrix folgt, sitzt die Schraffur am Papier statt an der
 * Zone: Laeuft der Spieler, wandert die Zone ueber ein feststehendes Raster
 * aus Schnitten. Das ist genau das, was ein zweiter Druckgang tut.
 *
 * Vier Winkel, nicht beliebig viele: Sie sind der Ersatz fuer die
 * Waffenfarben, die diese Runde eingezogen hat. Zwei Zonen nebeneinander sind
 * an der Strichrichtung auseinanderzuhalten, ohne dass eine dritte Farbe ins
 * Bild kommt.
 */
const MUSTER_KACHEL = 16
const muster = new Map<string, CanvasPattern | null>()

export function schraffurMuster(
  ctx: CanvasRenderingContext2D,
  winkelIndex: number,
  farbe: string,
  alpha: number,
): CanvasPattern | null {
  const i = ((winkelIndex % 4) + 4) % 4
  const stufe = Math.round(alpha * 10) / 10
  const schluessel = `${i}|${farbe}|${stufe}`
  const fertig = muster.get(schluessel)
  if (fertig !== undefined) return fertig

  const kachel = document.createElement('canvas')
  kachel.width = MUSTER_KACHEL
  kachel.height = MUSTER_KACHEL
  const k = kachel.getContext('2d')
  if (k === null) {
    muster.set(schluessel, null)
    return null
  }

  // Die Kachel wird gedreht gezeichnet und muss deshalb ueber ihre eigenen
  // Raender hinausgehen, sonst klaffen an den Kachelgrenzen Luecken.
  k.translate(MUSTER_KACHEL / 2, MUSTER_KACHEL / 2)
  k.rotate((i * Math.PI) / 4)
  k.beginPath()
  for (let d = -MUSTER_KACHEL; d <= MUSTER_KACHEL; d += MUSTER_KACHEL / 2) {
    k.moveTo(-MUSTER_KACHEL, d)
    k.lineTo(MUSTER_KACHEL, d)
  }
  k.lineWidth = 1.6
  k.strokeStyle = mitAlpha(farbe, alpha)
  k.stroke()

  const fertigMuster = ctx.createPattern(kachel, 'repeat')
  muster.set(schluessel, fertigMuster)
  return fertigMuster
}

/* ----------------------------------------------------------------- Kerben */

/**
 * Eine Kerbe - der Riss als *fehlende* Tinte.
 *
 * Das ist der wichtigste Handgriff dieser Datei, weil er die Kernregel des
 * Spiels traegt. Bisher war ein Riss ein hellblauer Strich *auf* dem Gegner:
 * eine Linie, die man aufgemalt hat. Jetzt ist er eine Stelle, an der die
 * Walze nichts hinterlassen hat - und damit sieht ein gerissener Gegner
 * beschaedigt aus statt bemalt.
 *
 * Zwei Striche uebereinander: der breitere in Papierfarbe schneidet die Tinte
 * weg, der schmalere daneben gibt der Kerbe eine Tiefe. Der Knick in der Mitte
 * ist derselbe Trick wie bei den Bruchlinien seit Runde 5 - eine gerade Linie
 * liest sich als Strich, eine geknickte als Sprung.
 */
export function kerbe(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  saat: number,
  breite = 2.6,
): void {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const laenge = Math.sqrt(dx * dx + dy * dy) || 1
  // Der Knick sitzt quer zur Linie, seine Groesse haengt an der Laenge: Ein
  // kurzer Riss soll nicht so stark zappeln wie ein langer.
  const knick = (streu(saat, 51) - 0.5) * laenge * 0.22

  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(mx + (-dy / laenge) * knick, my + (dx / laenge) * knick)
  ctx.lineTo(x2, y2)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = breite
  ctx.strokeStyle = FARBEN.riss
  ctx.stroke()
}

/* ---------------------------------------------------------------- Strahlen */

/**
 * Strahlen - wie ein Holzschnitt Licht zeichnet.
 *
 * Im Druck gibt es kein Leuchten. Ein Ding, das strahlen soll, bekommt
 * ausstrahlende Schnitte - der Griff ist so alt wie die Technik selbst und
 * jedem sofort verstaendlich, ohne dass ein einziger Bildpunkt heller wird
 * als das Papier.
 *
 * Damit ersetzt diese Funktion die ganze Glut-Schicht aus Runde 6: Sie kostet
 * einen Pfad statt einer Nebenleinwand, eines Weichzeichners und einer
 * additiven Rueckgabe - gemessen rund dreieinhalb Millisekunden je Bild.
 */
export function strahlen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  innen: number,
  aussen: number,
  anzahl: number,
  farbe: string,
  drehung = 0,
  alpha = 0.9,
): void {
  ctx.beginPath()
  for (let i = 0; i < anzahl; i++) {
    const w = drehung + (i / anzahl) * Math.PI * 2
    // Ungleich lange Strahlen: Gleich lange sind ein Zahnrad, ungleich lange
    // sind Licht.
    const laenge = aussen * (0.62 + streu(i, 61) * 0.38)
    ctx.moveTo(x + Math.cos(w) * innen, y + Math.sin(w) * innen)
    ctx.lineTo(x + Math.cos(w) * laenge, y + Math.sin(w) * laenge)
  }
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.strokeStyle = mitAlpha(farbe, alpha)
  ctx.stroke()
}
