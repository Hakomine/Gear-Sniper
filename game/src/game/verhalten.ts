import { berechneSchaden } from './damage'
import { rissSetzen } from './risse'
import { funken } from './effects'
import type { Gegner, Spielstand } from './state'
import type { VerhaltenId, WaffenInstanz } from './weapons'
import { istVollendet } from './weapons'
import {
  gegnerImUmkreis,
  legeEffekt,
  legeZone,
  naechsterGegner,
  nimmGeschoss,
  verletzeGegner,
} from './welt'

/**
 * Die acht Feuerverhalten.
 *
 * Hier stoesst "Inhalte sind Daten" an seine ehrliche Grenze: Ein Bogenhieb
 * *ist* anderer Code als eine Kugel. Statt das in eine Tabelle zu pressen,
 * gibt es eine Registratur - und eine neue Waffe, die ein vorhandenes
 * Verhalten wiederverwendet, bleibt trotzdem ein reiner Tabelleneintrag in
 * `weapons.ts`.
 *
 * Zwei Haken, weil es zwei Arten von Waffen gibt: Die meisten loesen auf
 * Abklingzeit aus (`feuern`), Trabanten sind dagegen einfach da und wirken in
 * jedem Tick (`dauernd`).
 */
export type Verhalten = {
  /** Auf Abklingzeit. Gibt zurueck, ob tatsaechlich ausgeloest wurde. */
  feuern?: (s: Spielstand, w: WaffenInstanz) => boolean
  /** Jeden Tick, unabhaengig von der Abklingzeit. */
  dauernd?: (s: Spielstand, w: WaffenInstanz, dt: number) => void
}

/** Eigenes Array - siehe die Warnung zu verschachtelten Abfragen in `welt.ts`. */
const treffer: Gegner[] = []

/**
 * Zweites Array fuer Verhalten, die *waehrend* des Durchlaufs eine neue
 * Abfrage starten.
 *
 * Der Zerlegestrahl sammelt seine Treffer und laesst jeden einzeln
 * detonieren - und `detoniere` fragt selbst den Umkreis ab. Mit nur einem
 * Array uebermalt der erste Knall die Liste, ueber die gerade gelaufen wird,
 * und der Rest des Strahls verpufft. Derselbe Fall wie in `state.ts`, nur eine
 * Ebene tiefer.
 */
const treffer2: Gegner[] = []

function schadenWurf(s: Spielstand, w: WaffenInstanz): { wert: number; krit: boolean } {
  const sp = s.spieler
  return berechneSchaden(w.werte.schaden, sp.schadenMult, sp.kritChance, sp.kritFaktor, s.rng)
}

/** Abstand eines Punktes zur Strecke A-B - fuer den Prismastrahl. */
function abstandZurStrecke(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const laenge2 = dx * dx + dy * dy || 1
  // Auf [0,1] geklemmt: Ein Gegner *hinter* dem Spieler soll nicht getroffen
  // werden, nur weil er auf der verlaengerten Geraden liegt.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / laenge2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// ---------------------------------------------------------------------------

/** Gerade Schuesse auf den naechsten Gegner - die Startwaffe. */
function gerade(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const grund = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const anzahl = Math.max(1, w.werte.anzahl)

  for (let i = 0; i < anzahl; i++) {
    // Faecher um die Zielrichtung zentrieren, damit auch gerade Anzahlen
    // symmetrisch liegen.
    const versatz = anzahl === 1 ? 0 : (i - (anzahl - 1) / 2) * w.werte.streuung
    const winkel = grund + versatz
    const wurf = schadenWurf(s, w)

    const p = nimmGeschoss(s)
    p.x = sp.x
    p.y = sp.y
    p.vx = Math.cos(winkel) * w.werte.tempo
    p.vy = Math.sin(winkel) * w.werte.tempo
    p.schaden = wurf.wert
    p.krit = wurf.krit
    p.radius = w.werte.radius
    p.durchschlag = w.werte.durchschlag
    p.leben = w.werte.lebensdauer
    p.rueckstoss = w.werte.rueckstoss
    p.platz = w.platz
    p.farbe = w.def.farbe
  }
  return true
}

/**
 * Bogenhieb um den Spieler.
 *
 * Kein Geschoss, sondern eine sofortige Abfrage: alles im Radius, dessen
 * Richtung im Oeffnungswinkel liegt. Vollendet steht `extra` auf Pi, damit
 * wird aus dem Hieb ein Rundumschlag - ohne Sonderfall im Code.
 */
function schwung(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite + 40)
  if (ziel === null) return false

  const mitte = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const halb = w.werte.extra
  gegnerImUmkreis(s, sp.x, sp.y, w.werte.reichweite, treffer)

  for (let i = 0; i < treffer.length; i++) {
    const g = treffer[i]
    const dx = g.x - sp.x
    const dy = g.y - sp.y
    if (halb < Math.PI) {
      // Winkeldifferenz auf [-Pi, Pi] normieren, sonst schlaegt der Hieb bei
      // einem Ziel knapp jenseits von 180 Grad ins Leere.
      let ab = Math.atan2(dy, dx) - mitte
      while (ab > Math.PI) ab -= Math.PI * 2
      while (ab < -Math.PI) ab += Math.PI * 2
      if (Math.abs(ab) > halb) continue
    }
    const laenge = Math.hypot(dx, dy) || 1
    const wurf = schadenWurf(s, w)
    verletzeGegner(
      s,
      g,
      wurf.wert,
      w.platz,
      wurf.krit,
      (dx / laenge) * w.werte.rueckstoss,
      (dy / laenge) * w.werte.rueckstoss,
    )
  }

  const e = legeEffekt(s, 'bogen', sp.x, sp.y, w.werte.reichweite, w.werte.lebensdauer, w.def.farbe, 5)
  if (e !== null) {
    e.winkel = mitte
    e.spanne = halb
  }
  s.trauma = Math.min(1, s.trauma + 0.02)
  return true
}

/** Zielsuchende Pfeile. Die Lenkung selbst passiert in `state.ts`. */
function suchend(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const grund = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const anzahl = Math.max(1, w.werte.anzahl)

  for (let i = 0; i < anzahl; i++) {
    const versatz = anzahl === 1 ? 0 : (i - (anzahl - 1) / 2) * w.werte.streuung
    const winkel = grund + versatz
    const wurf = schadenWurf(s, w)

    const p = nimmGeschoss(s)
    p.x = sp.x
    p.y = sp.y
    p.vx = Math.cos(winkel) * w.werte.tempo
    p.vy = Math.sin(winkel) * w.werte.tempo
    p.schaden = wurf.wert
    p.krit = wurf.krit
    p.radius = w.werte.radius
    p.durchschlag = w.werte.durchschlag
    p.leben = w.werte.lebensdauer
    p.rueckstoss = w.werte.rueckstoss
    p.platz = w.platz
    p.farbe = w.def.farbe
    p.zielsuche = w.werte.extra
    p.zielId = ziel.id
    // Vollendet springt der Pfeil nach einem Treffer zum naechsten Gegner
    // weiter, statt zu vergehen.
    p.prallt = istVollendet(w.def, w.stufe)
  }
  return true
}

/** Blitz, der von Gegner zu Gegner springt. */
function kette(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  let aktuell = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (aktuell === null) return false

  const vollendet = istVollendet(w.def, w.stufe)
  const spruenge = Math.max(1, Math.floor(w.werte.extra) * (vollendet ? 2 : 1))
  // Sprungweite kuerzer als die Erstreichweite: Sonst zieht ein Blitz quer
  // ueber das ganze Feld und die Waffe hat keine Form mehr.
  const sprungWeite = w.werte.reichweite * 0.55

  let vonX = sp.x
  let vonY = sp.y
  const bereitsGetroffen: number[] = []

  for (let i = 0; i < spruenge && aktuell !== null; i++) {
    const wurf = schadenWurf(s, w)
    const dx = aktuell.x - vonX
    const dy = aktuell.y - vonY
    const laenge = Math.hypot(dx, dy) || 1

    verletzeGegner(
      s,
      aktuell,
      wurf.wert,
      w.platz,
      wurf.krit,
      (dx / laenge) * w.werte.rueckstoss,
      (dy / laenge) * w.werte.rueckstoss,
    )

    const e = legeEffekt(s, 'strich', vonX, vonY, 0, w.werte.lebensdauer, w.def.farbe, 2.5)
    if (e !== null) {
      e.x2 = aktuell.x
      e.y2 = aktuell.y
    }

    // Vollendet schlaegt jeder Sprung zusaetzlich eine kleine Flaeche.
    if (vollendet) {
      gegnerImUmkreis(s, aktuell.x, aktuell.y, 52, treffer)
      for (let k = 0; k < treffer.length; k++) {
        if (treffer[k] === aktuell) continue
        verletzeGegner(s, treffer[k], wurf.wert * 0.5, w.platz, false, 0, 0)
      }
    }

    bereitsGetroffen.push(aktuell.id)
    vonX = aktuell.x
    vonY = aktuell.y
    aktuell = naechstenSprung(s, vonX, vonY, sprungWeite, bereitsGetroffen)
  }
  return true
}

/** Naechster Gegner, der auf dieser Blitzbahn noch nicht dran war. */
function naechstenSprung(
  s: Spielstand,
  x: number,
  y: number,
  weite: number,
  ausser: readonly number[],
): Gegner | null {
  gegnerImUmkreis(s, x, y, weite, treffer)
  let bester: Gegner | null = null
  let bestD2 = Infinity

  for (let i = 0; i < treffer.length; i++) {
    const g = treffer[i]
    if (ausser.includes(g.id)) continue
    const d2 = (g.x - x) * (g.x - x) + (g.y - y) * (g.y - y)
    if (d2 < bestD2) {
      bestD2 = d2
      bester = g
    }
  }
  return bester
}

/** Traege Granate. Der Knall selbst steckt in `detoniere`. */
function sprengsatz(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const winkel = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const wurf = schadenWurf(s, w)

  const p = nimmGeschoss(s)
  p.x = sp.x
  p.y = sp.y
  p.vx = Math.cos(winkel) * w.werte.tempo
  p.vy = Math.sin(winkel) * w.werte.tempo
  p.schaden = wurf.wert
  p.krit = wurf.krit
  p.radius = w.werte.radius
  p.durchschlag = 0
  p.leben = w.werte.lebensdauer
  p.rueckstoss = w.werte.rueckstoss
  p.platz = w.platz
  p.farbe = w.def.farbe
  p.explosionsRadius = w.werte.extra
  p.nachwurf = istVollendet(w.def, w.stufe) ? 3 : 0
  return true
}

/**
 * Ein Knall.
 *
 * Wird auch von `state.ts` gerufen, wenn eine Granate ihre Lebensdauer
 * erreicht - deshalb hier exportiert und nicht im Verhalten versteckt.
 */
export function detoniere(
  s: Spielstand,
  x: number,
  y: number,
  radius: number,
  schaden: number,
  platz: number,
  farbe: string,
  nachwurf = 0,
): void {
  gegnerImUmkreis(s, x, y, radius, treffer)
  for (let i = 0; i < treffer.length; i++) {
    const g = treffer[i]
    const dx = g.x - x
    const dy = g.y - y
    const laenge = Math.hypot(dx, dy) || 1
    // Am Rand des Knalls kommt weniger an - sonst ist die Bazooka nur ein
    // sehr grosses Geschoss ohne eigenes Gefuehl.
    const abfall = 1 - Math.min(1, laenge / radius) * 0.45
    verletzeGegner(
      s,
      g,
      schaden * abfall,
      platz,
      false,
      (dx / laenge) * 220,
      (dy / laenge) * 220,
    )
  }

  legeEffekt(s, 'ring', x, y, radius, 0.32, farbe, 4)
  funken(s, x, y, farbe, 10)
  s.trauma = Math.min(1, s.trauma + 0.14)

  for (let i = 0; i < nachwurf; i++) {
    const winkel = (i / nachwurf) * Math.PI * 2 + s.rng.range(0, 1)
    const p = nimmGeschoss(s)
    p.x = x
    p.y = y
    p.vx = Math.cos(winkel) * 190
    p.vy = Math.sin(winkel) * 190
    p.schaden = schaden * 0.5
    p.krit = false
    p.radius = 5
    p.durchschlag = 0
    p.leben = 0.55
    p.rueckstoss = 140
    p.platz = platz
    p.farbe = farbe
    p.explosionsRadius = radius * 0.55
    p.nachwurf = 0
  }
}

/**
 * Trabanten - kreisen dauerhaft, statt zu feuern.
 *
 * `dauernd` dreht sie jeden Tick weiter (sonst ruckeln sie im Takt der
 * Abklingzeit), `feuern` ist der Schadenstakt: Ohne ihn wuerde ein Ring einen
 * stehenden Gegner in Sekundenbruchteilen zerlegen.
 */
function trabantenDrehen(_s: Spielstand, w: WaffenInstanz, dt: number): void {
  w.winkel += w.werte.tempo * dt
}

/** Wo ein Trabant gerade steht. Auch die Darstellung rechnet damit. */
export function trabantPunkt(
  w: WaffenInstanz,
  index: number,
  spielerX: number,
  spielerY: number,
): { x: number; y: number } {
  const gesamt = trabantenAnzahl(w)
  const proRing = Math.max(1, w.werte.anzahl)
  // Vollendet laeuft ein zweiter Ring gegenlaeufig - erkennbar daran, dass
  // sein Winkel rueckwaerts geht und die Bahn etwas enger liegt.
  const zweiterRing = index >= proRing
  const iImRing = zweiterRing ? index - proRing : index
  const anzahlImRing = zweiterRing ? gesamt - proRing : proRing
  const richtung = zweiterRing ? -1 : 1
  const bahn = w.werte.extra * (zweiterRing ? 0.62 : 1)
  const winkel = w.winkel * richtung + (iImRing / anzahlImRing) * Math.PI * 2

  return { x: spielerX + Math.cos(winkel) * bahn, y: spielerY + Math.sin(winkel) * bahn }
}

export function trabantenAnzahl(w: WaffenInstanz): number {
  const proRing = Math.max(1, w.werte.anzahl)
  return istVollendet(w.def, w.stufe) ? proRing * 2 : proRing
}

function trabantenSchaden(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const gesamt = trabantenAnzahl(w)

  for (let i = 0; i < gesamt; i++) {
    const punkt = trabantPunkt(w, i, sp.x, sp.y)
    gegnerImUmkreis(s, punkt.x, punkt.y, w.werte.radius + 14, treffer)
    for (let k = 0; k < treffer.length; k++) {
      const g = treffer[k]
      const dx = g.x - punkt.x
      const dy = g.y - punkt.y
      const laenge = Math.hypot(dx, dy) || 1
      const wurf = schadenWurf(s, w)
      verletzeGegner(
        s,
        g,
        wurf.wert,
        w.platz,
        wurf.krit,
        (dx / laenge) * w.werte.rueckstoss,
        (dy / laenge) * w.werte.rueckstoss,
      )
    }
  }
  // Immer "ausgeloest": Der Takt soll gleichmaessig weiterlaufen, auch wenn
  // gerade niemand in der Bahn stand.
  return true
}

/**
 * Wen ein Strahl von `sp` in Richtung `winkel` trifft.
 *
 * Eine grosse Abfrage um die Mitte der Strecke statt vieler kleiner - der
 * Strahl feuert selten genug, dass sich das lohnt.
 */
function strahlBahn(
  s: Spielstand,
  w: WaffenInstanz,
  winkel: number,
  aus: Gegner[],
): { bx: number; by: number } {
  const sp = s.spieler
  const bx = sp.x + Math.cos(winkel) * w.werte.reichweite
  const by = sp.y + Math.sin(winkel) * w.werte.reichweite
  const mx = (sp.x + bx) / 2
  const my = (sp.y + by) / 2

  gegnerImUmkreis(s, mx, my, w.werte.reichweite / 2 + w.werte.extra + 24, treffer)
  aus.length = 0
  for (let k = 0; k < treffer.length; k++) {
    const g = treffer[k]
    if (abstandZurStrecke(g.x, g.y, sp.x, sp.y, bx, by) > w.werte.extra + g.radius) continue
    aus.push(g)
  }
  return { bx, by }
}

function strahlEffekt(s: Spielstand, w: WaffenInstanz, bx: number, by: number): void {
  const e = legeEffekt(s, 'strich', s.spieler.x, s.spieler.y, 0, w.werte.lebensdauer, w.def.farbe, w.werte.extra)
  if (e !== null) {
    e.x2 = bx
    e.y2 = by
  }
}

/** Sofort-Laser quer durch das Bild. */
function strahl(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const grund = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  // Vollendet als Kreuz in vier Richtungen.
  const strahlen = istVollendet(w.def, w.stufe) ? 4 : 1

  for (let i = 0; i < strahlen; i++) {
    const winkel = grund + (i / strahlen) * Math.PI * 2
    const bahn = strahlBahn(s, w, winkel, treffer2)

    for (let k = 0; k < treffer2.length; k++) {
      const wurf = schadenWurf(s, w)
      verletzeGegner(
        s,
        treffer2[k],
        wurf.wert,
        w.platz,
        wurf.krit,
        Math.cos(winkel) * w.werte.rueckstoss,
        Math.sin(winkel) * w.werte.rueckstoss,
      )
    }
    strahlEffekt(s, w, bahn.bx, bahn.by)
  }

  s.trauma = Math.min(1, s.trauma + 0.2)
  return true
}

/** Das schwarze Loch. Sog und Detonation stecken im Zonen-Tick von `state.ts`. */
function singularitaet(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const vollendet = istVollendet(w.def, w.stufe)
  const z = legeZone(
    s,
    'sog',
    ziel.x,
    ziel.y,
    w.werte.extra * (vollendet ? 2 : 1),
    w.werte.lebensdauer,
    w.werte.schaden * s.spieler.schadenMult,
    w.platz,
    w.def.farbe,
  )
  z.sogKraft = 420
  z.truemmer = vollendet

  legeEffekt(s, 'ring', ziel.x, ziel.y, z.radius, 0.4, w.def.farbe, 3)
  return true
}


// ---------------------------------------------------------------------------
// Fusionen
// ---------------------------------------------------------------------------
// Sechs Verhalten, die nur entstehen, wenn zwei ausgereizte Waffen
// verschmelzen. Sie sind absichtlich nicht "dasselbe, aber staerker", sondern
// nehmen von beiden Eltern die Eigenart mit - sonst waere eine Fusion nur eine
// Zahlenerhoehung mit neuem Namen.

/** Schwarzes Loch, das alles Gefangene unter Strom setzt. */
function gewitterkern(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const vollendet = istVollendet(w.def, w.stufe)
  const z = legeZone(
    s,
    'sog',
    ziel.x,
    ziel.y,
    w.werte.extra * (vollendet ? 1.6 : 1),
    w.werte.lebensdauer,
    w.werte.schaden * sp.schadenMult,
    w.platz,
    w.def.farbe,
  )
  z.sogKraft = 520
  z.gewitter = true
  z.truemmer = vollendet

  legeEffekt(s, 'ring', ziel.x, ziel.y, z.radius, 0.4, w.def.farbe, 3)
  return true
}

/** Kreisende Klingen, die bei jeder vollen Umdrehung rundum schlagen. */
function scherbenkranzDrehen(s: Spielstand, w: WaffenInstanz, dt: number): void {
  const vorher = w.winkel
  w.winkel += w.werte.tempo * dt

  // Volle Umdrehung erkannt: Der Hieb kommt genau dann, wenn der Kranz
  // durchgelaufen ist - dadurch hat er einen hoerbaren Takt statt zufaellig
  // loszugehen.
  const umlauf = Math.PI * 2
  if (Math.floor(vorher / umlauf) === Math.floor(w.winkel / umlauf)) return

  const sp = s.spieler
  gegnerImUmkreis(s, sp.x, sp.y, w.werte.extra * 1.35, treffer2)
  for (let i = 0; i < treffer2.length; i++) {
    const g = treffer2[i]
    const dx = g.x - sp.x
    const dy = g.y - sp.y
    const laenge = Math.hypot(dx, dy) || 1
    const wurf = schadenWurf(s, w)
    verletzeGegner(
      s,
      g,
      wurf.wert * 1.4,
      w.platz,
      wurf.krit,
      (dx / laenge) * w.werte.rueckstoss,
      (dy / laenge) * w.werte.rueckstoss,
    )
  }

  const e = legeEffekt(s, 'bogen', sp.x, sp.y, w.werte.extra * 1.35, 0.22, w.def.farbe, 5)
  if (e !== null) {
    e.winkel = 0
    e.spanne = Math.PI
  }
}

/** Strahl, der an jedem getroffenen Gegner detoniert. */
function zerlegestrahl(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const winkel = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const bahn = strahlBahn(s, w, winkel, treffer2)

  // Die Positionen zuerst festhalten: `detoniere` fragt selbst den Umkreis ab
  // und wuerde die Trefferliste sonst unter den Fuessen wegziehen.
  const punkte: number[] = []
  for (let k = 0; k < treffer2.length; k++) {
    punkte.push(treffer2[k].x, treffer2[k].y)
  }

  const wurf = schadenWurf(s, w)
  for (let k = 0; k < punkte.length; k += 2) {
    detoniere(s, punkte[k], punkte[k + 1], w.werte.extra * 3.2, wurf.wert, w.platz, w.def.farbe)
  }

  strahlEffekt(s, w, bahn.bx, bahn.by)
  s.trauma = Math.min(1, s.trauma + 0.25)
  return true
}

/** Zielsuchende Nadeln, die sich bei jedem Kill teilen. */
function schwarmnadeln(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const grund = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const anzahl = Math.max(1, w.werte.anzahl)

  for (let i = 0; i < anzahl; i++) {
    const versatz = anzahl === 1 ? 0 : (i - (anzahl - 1) / 2) * w.werte.streuung
    const winkel = grund + versatz
    const wurf = schadenWurf(s, w)

    const p = nimmGeschoss(s)
    p.x = sp.x
    p.y = sp.y
    p.vx = Math.cos(winkel) * w.werte.tempo
    p.vy = Math.sin(winkel) * w.werte.tempo
    p.schaden = wurf.wert
    p.krit = wurf.krit
    p.radius = w.werte.radius
    p.durchschlag = w.werte.durchschlag
    p.leben = w.werte.lebensdauer
    p.rueckstoss = w.werte.rueckstoss
    p.platz = w.platz
    p.farbe = w.def.farbe
    p.zielsuche = w.werte.extra
    p.zielId = ziel.id
    // Zwei Teilungen bei jedem Kill, vollendet drei. Die Kette endet von
    // selbst, weil jede Nadel nur einen Teil der Lebensdauer erbt.
    p.spaltet = istVollendet(w.def, w.stufe) ? 3 : 2
  }
  return true
}

/** Granate, die erst zusammenreisst und dann detoniert. */
function kollaps(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const winkel = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const wurf = schadenWurf(s, w)

  const p = nimmGeschoss(s)
  p.x = sp.x
  p.y = sp.y
  p.vx = Math.cos(winkel) * w.werte.tempo
  p.vy = Math.sin(winkel) * w.werte.tempo
  p.schaden = wurf.wert
  p.krit = wurf.krit
  p.radius = w.werte.radius
  p.durchschlag = 0
  p.leben = w.werte.lebensdauer
  p.rueckstoss = w.werte.rueckstoss
  p.platz = w.platz
  p.farbe = w.def.farbe
  p.explosionsRadius = w.werte.extra
  p.kollaps = true
  return true
}

/** Strahl, der sich an jedem Gegner bricht und weiterspringt. */
function bogenlicht(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const winkel = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const bahn = strahlBahn(s, w, winkel, treffer2)

  // Erst alle Strahltreffer abarbeiten, dann die Spruenge: `naechstenSprung`
  // benutzt `treffer` und wuerde eine laufende Liste ueberschreiben.
  const getroffen: Gegner[] = []
  for (let k = 0; k < treffer2.length; k++) getroffen.push(treffer2[k])

  const vollendet = istVollendet(w.def, w.stufe)
  const spruenge = vollendet ? 3 : 2

  for (let k = 0; k < getroffen.length; k++) {
    const g = getroffen[k]
    const wurf = schadenWurf(s, w)
    verletzeGegner(
      s,
      g,
      wurf.wert,
      w.platz,
      wurf.krit,
      Math.cos(winkel) * w.werte.rueckstoss,
      Math.sin(winkel) * w.werte.rueckstoss,
    )

    // Von jedem Strahltreffer springt das Licht weiter.
    let vonX = g.x
    let vonY = g.y
    const bereits = [g.id]
    for (let j = 0; j < spruenge; j++) {
      const naechster = naechstenSprung(s, vonX, vonY, 190, bereits)
      if (naechster === null) break
      const sprungWurf = schadenWurf(s, w)
      verletzeGegner(s, naechster, sprungWurf.wert * 0.6, w.platz, sprungWurf.krit, 0, 0)
      const e = legeEffekt(s, 'strich', vonX, vonY, 0, 0.14, w.def.farbe, 2)
      if (e !== null) {
        e.x2 = naechster.x
        e.y2 = naechster.y
      }
      bereits.push(naechster.id)
      vonX = naechster.x
      vonY = naechster.y
    }
  }

  strahlEffekt(s, w, bahn.bx, bahn.by)
  s.trauma = Math.min(1, s.trauma + 0.22)
  return true
}


// ---------------------------------------------------------------------------
// Runde fuenf: zwoelf Waffen, die jeweils etwas tun, das keine andere tut
// ---------------------------------------------------------------------------

/** Eigene Liste - diese Verhalten fragen mitten in einer Schleife nach. */
const neueZiele: Gegner[] = []

/**
 * Schleifband: zieht eine Spur hinter dir her.
 *
 * Die erste Waffe, die belohnt, *wohin* man laeuft statt nur wie schnell. Wer
 * eine Schneise durch den Pulk zieht, macht mehr Schaden als wer aussen
 * herumrennt.
 */
function schleifband(s: Spielstand, w: WaffenInstanz, dt: number): void {
  w.merkZeit -= dt
  if (w.merkZeit > 0) return
  w.merkZeit = 0.12

  const sp = s.spieler
  legeZone(
    s,
    'knall',
    sp.x,
    sp.y,
    w.werte.radius,
    w.werte.lebensdauer,
    w.werte.schaden * sp.schadenMult,
    w.platz,
    w.def.farbe,
  )
}

/**
 * Stimmgabel: trifft, was rennt.
 *
 * Der Schaden waechst mit dem Tempo des Ziels. Damit ist sie gegen die
 * schnellen Splitter und den preschenden Stuermer stark und gegen den zaehen
 * Brocken schwach - eine Waffe, die sich am Gegner ausrichtet statt an einer
 * Zahl.
 */
function stimmgabel(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  gegnerImUmkreis(s, sp.x, sp.y, w.werte.reichweite, treffer)
  if (treffer.length === 0) return false

  for (let i = 0; i < treffer.length; i++) {
    const g = treffer[i]
    // Bezugstempo 78 ist der Splitter - er ist der Massstab, an dem sich
    // "schnell" in diesem Spiel misst.
    const faktor = 0.35 + Math.min(2.2, g.tempo / 78)
    const wurf = schadenWurf(s, w)
    verletzeGegner(s, g, wurf.wert * faktor, w.platz, wurf.krit, 0, 0)
  }
  legeEffekt(s, 'ring', sp.x, sp.y, w.werte.reichweite, 0.3, w.def.farbe, 3)
  return true
}

/**
 * Fadenkreuz: bohrt dauerhaft am zaehesten Gegner im Bild.
 *
 * Die Antwort auf ein Problem, das der Bau sonst nicht loesen kann: Eine
 * Flaechenwaffe raeumt tausend Splitter weg und kratzt am Boss nicht. Das
 * Fadenkreuz sucht sich genau das Gegenteil.
 */
function fadenkreuz(s: Spielstand, w: WaffenInstanz, dt: number): void {
  const sp = s.spieler
  gegnerImUmkreis(s, sp.x, sp.y, w.werte.reichweite, treffer)

  let ziel: Gegner | null = null
  let beste = -1
  for (let i = 0; i < treffer.length; i++) {
    if (treffer[i].hp > beste) {
      beste = treffer[i].hp
      ziel = treffer[i]
    }
  }
  if (ziel === null) {
    w.merkZeit = 0
    return
  }

  // Aufladung: Bleibt dasselbe Ziel, wird der Strahl staerker. Wechselt es,
  // faengt sie von vorn an - das belohnt, den dicken Brocken auszuhalten.
  w.merkZeit = ziel.id === w.merkId ? Math.min(3, w.merkZeit + dt) : 0
  w.merkId = ziel.id

  verletzeGegner(s, ziel, w.werte.schaden * sp.schadenMult * (1 + w.merkZeit) * dt, w.platz, false, 0, 0)
  const e = legeEffekt(s, 'strich', sp.x, sp.y, 0, 0.06, w.def.farbe, 2 + w.merkZeit)
  if (e !== null) {
    e.x2 = ziel.x
    e.y2 = ziel.y
  }
}

/**
 * Spiegelscherbe: wirft Feindgeschosse zurueck.
 *
 * Dreht den Speier gegen sich selbst - und ist die erste Waffe, die *nichts*
 * tut, wenn niemand auf einen schiesst. Genau deshalb ist sie interessant: Sie
 * ist eine Antwort, keine Grundausstattung.
 */
function spiegel(s: Spielstand, w: WaffenInstanz, dt: number): void {
  w.merkZeit -= dt
  const sp = s.spieler
  const liste = s.feindSchuesse.aktiv

  for (let i = liste.length - 1; i >= 0; i--) {
    const f = liste[i]
    const dx = f.x - sp.x
    const dy = f.y - sp.y
    if (dx * dx + dy * dy > w.werte.radius * w.werte.radius) continue

    const p = nimmGeschoss(s)
    p.x = f.x
    p.y = f.y
    // Zurueck, woher es kam, und schneller: Ein Spiegel gibt zurueck, was er
    // bekommt, nicht weniger.
    p.vx = -f.vx * 1.5
    p.vy = -f.vy * 1.5
    p.schaden = (f.schaden + w.werte.schaden) * sp.schadenMult
    p.krit = false
    p.radius = f.radius
    p.durchschlag = w.werte.durchschlag
    p.leben = w.werte.lebensdauer
    p.rueckstoss = w.werte.rueckstoss
    p.platz = w.platz
    p.farbe = w.def.farbe
    s.feindSchuesse.freigeben(i)
    funken(s, f.x, f.y, w.def.farbe, 5)
  }
}

/**
 * Frostkeil: friert ein - und Gefrorenes zerspringt mit zwei Rissen.
 *
 * Der direkteste Eingriff in die Kernregel, den eine Waffe machen kann. Sie
 * senkt die Schwelle, statt Schaden zu erhoehen: Ein Bau mit Frostkeil braucht
 * eine Waffe weniger, um dieselbe Wirkung zu erzielen.
 */
function frost(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  gegnerImUmkreis(s, ziel.x, ziel.y, w.werte.radius, treffer)
  for (let i = 0; i < treffer.length; i++) {
    const g = treffer[i]
    g.frost = w.werte.extra
    const wurf = schadenWurf(s, w)
    verletzeGegner(s, g, wurf.wert, w.platz, wurf.krit, 0, 0)
  }
  legeEffekt(s, 'ring', ziel.x, ziel.y, w.werte.radius, 0.4, w.def.farbe, 3)
  return true
}

/**
 * Ankerhaken: zieht einen weit entfernten Gegner heran.
 *
 * Sucht bewusst den *entferntesten* statt des naechsten - damit ist sie die
 * Antwort auf den Speier, der auf Abstand bleibt, und auf den Schwaermer, der
 * kreist. Was herangezogen wird, steht danach mitten im eigenen Bau.
 */
function anker(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  gegnerImUmkreis(s, sp.x, sp.y, w.werte.reichweite, treffer)

  let ziel: Gegner | null = null
  let weiteste = -1
  for (let i = 0; i < treffer.length; i++) {
    const g = treffer[i]
    const d = Math.hypot(g.x - sp.x, g.y - sp.y)
    if (d > weiteste) {
      weiteste = d
      ziel = g
    }
  }
  if (ziel === null || weiteste < 120) return false

  const dx = sp.x - ziel.x
  const dy = sp.y - ziel.y
  const laenge = Math.hypot(dx, dy) || 1
  const wurf = schadenWurf(s, w)
  verletzeGegner(
    s,
    ziel,
    wurf.wert,
    w.platz,
    wurf.krit,
    (dx / laenge) * w.werte.rueckstoss,
    (dy / laenge) * w.werte.rueckstoss,
  )

  const e = legeEffekt(s, 'strich', sp.x, sp.y, 0, 0.18, w.def.farbe, 3)
  if (e !== null) {
    e.x2 = ziel.x
    e.y2 = ziel.y
  }
  return true
}

/**
 * Bohrkopf: bleibt stecken und reisst immer wieder neu auf.
 *
 * Die einzige Waffe, die ihren Riss *erneuert*, statt ihn einmal zu setzen.
 * An einem Boss, der mehrfach zerspringen kann, ist genau das viel wert.
 */
function bohrkopf(s: Spielstand, w: WaffenInstanz, dt: number): void {
  const sp = s.spieler
  const liste = s.gegner.aktiv

  let ziel: Gegner | null = null
  for (let i = 0; i < liste.length; i++) {
    if (liste[i].id === w.merkId && !liste[i].tot) {
      ziel = liste[i]
      break
    }
  }
  if (ziel === null) {
    ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
    if (ziel === null) return
    w.merkId = ziel.id
    w.merkZeit = 0
  }

  w.merkZeit -= dt
  verletzeGegner(s, ziel, w.werte.schaden * sp.schadenMult * dt, w.platz, false, 0, 0)
  if (w.merkZeit > 0) return

  // Der eigentliche Trick: Riss loeschen und sofort neu setzen. Damit laeuft
  // das Zeitfenster der Kernregel an diesem Gegner nie ab.
  w.merkZeit = w.werte.extra
  rissSetzen(ziel, w.platz, sp.rissDauer)
  funken(s, ziel.x, ziel.y, w.def.farbe, 4)
}

/**
 * Glockenturm: ein Schlag, der alles im Bild anhebt.
 *
 * Setzt einen Riss bei *jedem* sichtbaren Gegner. Allein toetet sie nichts -
 * in einem Bau mit zwei weiteren Waffen laesst sie das halbe Bild zerspringen.
 * Die reinste Fassung der Kernregel, die es als Waffe geben kann.
 */
function glocke(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  gegnerImUmkreis(s, sp.x, sp.y, s.sichtRadius, treffer)
  if (treffer.length === 0) return false

  for (let i = 0; i < treffer.length; i++) {
    const wurf = schadenWurf(s, w)
    verletzeGegner(s, treffer[i], wurf.wert, w.platz, wurf.krit, 0, 0)
  }
  legeEffekt(s, 'ring', sp.x, sp.y, s.sichtRadius, 0.5, w.def.farbe, 4)
  s.trauma = Math.min(1, s.trauma + 0.12)
  return true
}

/**
 * Saatgut: eine Knospe, die erst spaeter aufgeht.
 *
 * Sie fliegt langsam, trifft niemanden - und platzt am Ende ihrer Lebensdauer
 * in einen Ring aus Scherben. Wer sie in die Laufrichtung des Pulks setzt,
 * bekommt viel; wer sie hinterherwirft, nichts.
 */
function saatgut(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const ziel = naechsterGegner(s, sp.x, sp.y, w.werte.reichweite)
  if (ziel === null) return false

  const winkel = Math.atan2(ziel.y - sp.y, ziel.x - sp.x)
  const wurf = schadenWurf(s, w)
  const p = nimmGeschoss(s)
  p.x = sp.x
  p.y = sp.y
  p.vx = Math.cos(winkel) * w.werte.tempo
  p.vy = Math.sin(winkel) * w.werte.tempo
  p.schaden = wurf.wert
  p.krit = wurf.krit
  p.radius = w.werte.radius
  // Kein Durchschlag und kein Treffer unterwegs: Die Knospe *ist* die
  // Wartezeit. Ihre ganze Wirkung steckt im Knall am Ende.
  p.durchschlag = 0
  p.leben = w.werte.lebensdauer
  p.explosionsRadius = w.werte.extra
  p.nachwurf = Math.max(0, Math.floor(w.werte.anzahl) - 1)
  p.platz = w.platz
  p.farbe = w.def.farbe
  return true
}

/**
 * Schwarzband: ein Schnitt zwischen zwei Gegnern.
 *
 * Sucht den naechsten und den entferntesten und schneidet alles auf der
 * Strecke dazwischen. Je weiter der Pulk auseinandersteht, desto laenger die
 * Linie - eine Waffe, die aus der *Anordnung* des Feldes Schaden macht.
 */
function schwarzband(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  gegnerImUmkreis(s, sp.x, sp.y, w.werte.reichweite, treffer)
  if (treffer.length < 2) return false

  let nah = treffer[0]
  let fern = treffer[0]
  let dNah = 1e9
  let dFern = -1
  for (let i = 0; i < treffer.length; i++) {
    const d = Math.hypot(treffer[i].x - sp.x, treffer[i].y - sp.y)
    if (d < dNah) { dNah = d; nah = treffer[i] }
    if (d > dFern) { dFern = d; fern = treffer[i] }
  }
  if (nah === fern) return false

  const ax = nah.x
  const ay = nah.y
  const bx = fern.x - ax
  const by = fern.y - ay
  const laenge2 = bx * bx + by * by || 1

  // Alle in einem Schlauch um die Strecke - die Mitte der beiden Punkte als
  // Abfragezentrum, damit eine Umkreisabfrage reicht.
  gegnerImUmkreis(s, ax + bx / 2, ay + by / 2, Math.sqrt(laenge2) / 2 + w.werte.radius, neueZiele)
  for (let i = 0; i < neueZiele.length; i++) {
    const g = neueZiele[i]
    const t = Math.max(0, Math.min(1, ((g.x - ax) * bx + (g.y - ay) * by) / laenge2))
    const abstand = Math.hypot(g.x - (ax + bx * t), g.y - (ay + by * t))
    if (abstand > w.werte.radius) continue
    const wurf = schadenWurf(s, w)
    verletzeGegner(s, g, wurf.wert, w.platz, wurf.krit, 0, 0)
  }

  const e = legeEffekt(s, 'strich', ax, ay, 0, 0.22, w.def.farbe, w.werte.radius * 0.5)
  if (e !== null) {
    e.x2 = fern.x
    e.y2 = fern.y
  }
  return true
}

/**
 * Kaleidoskop: spiegelt eine andere Waffe mit.
 *
 * Sie hat kein eigenes Geschoss - sie loest eine zufaellige andere Waffe des
 * Guertels ein zweites Mal aus. Damit ist sie die einzige Waffe, deren Wert
 * ausschliesslich davon abhaengt, was sonst noch getragen wird.
 *
 * Der Riss kommt dabei von der *gespiegelten* Waffe, nicht vom Kaleidoskop:
 * Sonst waere sie ein zusaetzlicher Riss fuer lau und haette die Kernregel
 * ausgehebelt.
 */
function kaleidoskop(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  const andere: WaffenInstanz[] = []
  for (let i = 0; i < sp.waffen.length; i++) {
    const x = sp.waffen[i]
    if (x !== w && x.def.verhalten !== 'kaleidoskop') andere.push(x)
  }
  if (andere.length === 0) return false

  const gewaehlt = s.rng.pick(andere)
  const v = VERHALTEN[gewaehlt.def.verhalten]
  if (v.feuern === undefined) return false

  // Schwaecher spiegeln: Der Schadensfaktor wird kurz gesenkt und danach
  // sauber zurueckgesetzt - so gilt er wirklich nur fuer diesen einen Schuss.
  const vorher = sp.schadenMult
  sp.schadenMult = vorher * w.werte.extra
  const ausgeloest = v.feuern(s, gewaehlt)
  sp.schadenMult = vorher
  return ausgeloest
}

/**
 * Sanduhr: alles im Umkreis laeuft rueckwaerts.
 *
 * Gegner werden zurueckgeschoben, Feindgeschosse kehren um. Sie macht kaum
 * Schaden - sie kauft Zeit und Raum, und in einem Spiel, das nur aus
 * Ausweichen besteht, ist das die knappste Waehrung ueberhaupt.
 */
function sanduhr(s: Spielstand, w: WaffenInstanz): boolean {
  const sp = s.spieler
  gegnerImUmkreis(s, sp.x, sp.y, w.werte.radius, treffer)

  for (let i = 0; i < treffer.length; i++) {
    const g = treffer[i]
    const dx = g.x - sp.x
    const dy = g.y - sp.y
    const laenge = Math.hypot(dx, dy) || 1
    const wurf = schadenWurf(s, w)
    verletzeGegner(
      s,
      g,
      wurf.wert,
      w.platz,
      wurf.krit,
      (dx / laenge) * w.werte.rueckstoss,
      (dy / laenge) * w.werte.rueckstoss,
    )
  }

  const liste = s.feindSchuesse.aktiv
  for (let i = 0; i < liste.length; i++) {
    const f = liste[i]
    const dx = f.x - sp.x
    const dy = f.y - sp.y
    if (dx * dx + dy * dy > w.werte.radius * w.werte.radius) continue
    f.vx = -f.vx
    f.vy = -f.vy
  }

  legeEffekt(s, 'ring', sp.x, sp.y, w.werte.radius, 0.45, w.def.farbe, 3)
  return treffer.length > 0
}

export const VERHALTEN: Record<VerhaltenId, Verhalten> = {
  gerade: { feuern: gerade },
  schwung: { feuern: schwung },
  suchend: { feuern: suchend },
  kette: { feuern: kette },
  sprengsatz: { feuern: sprengsatz },
  trabant: { feuern: trabantenSchaden, dauernd: trabantenDrehen },
  strahl: { feuern: strahl },
  singularitaet: { feuern: singularitaet },

  gewitterkern: { feuern: gewitterkern },
  scherbenkranz: { feuern: trabantenSchaden, dauernd: scherbenkranzDrehen },
  zerlegestrahl: { feuern: zerlegestrahl },
  schwarmnadeln: { feuern: schwarmnadeln },
  kollaps: { feuern: kollaps },
  bogenlicht: { feuern: bogenlicht },

  schleifband: { dauernd: schleifband },
  stimmgabel: { feuern: stimmgabel },
  fadenkreuz: { dauernd: fadenkreuz },
  spiegel: { dauernd: spiegel },
  frost: { feuern: frost },
  anker: { feuern: anker },
  bohrkopf: { dauernd: bohrkopf },
  glocke: { feuern: glocke },
  saatgut: { feuern: saatgut },
  schwarzband: { feuern: schwarzband },
  kaleidoskop: { feuern: kaleidoskop },
  sanduhr: { feuern: sanduhr },
}
