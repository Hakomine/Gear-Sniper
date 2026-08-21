import { Eingabe } from './core/input'
import { Schleife } from './core/loop'
import { CHARAKTERE } from './game/charaktere'
import type { Befehle } from './game/state'
import { erzeugeSpielstand, tick } from './game/state'
import { ruesteAus, WAFFEN, werteAuf } from './game/weapons'
import { SICHT_RADIUS, Zeichner } from './render/draw'

/**
 * Aufbau und Verdrahtung.
 *
 * Diese Datei ist die Naht zwischen Browser und Spiel. Sie uebersetzt Tasten
 * in Absichten und reicht sie an die Simulation weiter - die selbst nichts
 * von einem Fenster weiss. Alles, was hier steht, waere beim Verpacken fuer
 * Steam der einzige Teil, der ueberhaupt angefasst werden muesste.
 */

const canvas = document.getElementById('spiel') as HTMLCanvasElement
// `alpha: false` erspart dem Browser das Durchmischen mit dem Seitenhintergrund.
const ctx = canvas.getContext('2d', { alpha: false })
if (ctx === null) throw new Error('Canvas 2D nicht verfügbar')

const zeichner = new Zeichner(canvas, ctx)
const eingabe = new Eingabe()

const spiel = erzeugeSpielstand(Date.now() >>> 0)
spiel.sichtRadius = SICHT_RADIUS

/**
 * Was ueber einen Lauf hinaus bestehen bleibt - und was nicht.
 *
 * Gespeichert werden genau zwei Dinge: welche Charaktere offen sind und der
 * beste Punktestand. Keine Werte, keine Aufwertungen, nichts Zaehlbares. Das
 * ist Absicht und die tragende Regel des ganzen Spiels: Jeder Lauf beginnt bei
 * null, sonst misst eine Bestenliste nur noch, wer am laengsten gespielt hat.
 * Freigeschaltet wird der *Zugang* zu einem Spielstil, nie Rechenkraft.
 *
 * Der Speicherzugriff steht hier und nicht in der Spiellogik: `src/game/`
 * kennt keinen Browser, und genau das macht die Messungen und Tests ohne
 * Fenster ueberhaupt erst moeglich.
 */
const SPEICHER = 'scherbenfeld.fortschritt.v1'

type Fortschritt = { offen: string[]; bestwert: number }

function ladeFortschritt(): Fortschritt {
  // Ein kaputter, fremder oder gesperrter Eintrag darf das Spiel nicht am
  // Starten hindern - im privaten Fenster wirft schon der Zugriff selbst.
  try {
    const roh = localStorage.getItem(SPEICHER)
    if (roh === null) return { offen: [], bestwert: 0 }
    const daten = JSON.parse(roh) as Partial<Fortschritt>
    const bekannt = new Set<string>(CHARAKTERE.map((c) => c.id))
    return {
      offen: Array.isArray(daten.offen) ? daten.offen.filter((id) => bekannt.has(id)) : [],
      bestwert:
        typeof daten.bestwert === 'number' && Number.isFinite(daten.bestwert)
          ? Math.max(0, Math.floor(daten.bestwert))
          : 0,
    }
  } catch {
    return { offen: [], bestwert: 0 }
  }
}

function sichereFortschritt(): void {
  try {
    localStorage.setItem(
      SPEICHER,
      JSON.stringify({ offen: spiel.offen, bestwert: spiel.bestwert }),
    )
  } catch {
    // Volle Quote oder gesperrter Speicher: Der Lauf laeuft trotzdem weiter.
  }
}

const gespeichert = ladeFortschritt()
for (const id of gespeichert.offen) if (!spiel.offen.includes(id)) spiel.offen.push(id)
spiel.bestwert = Math.max(spiel.bestwert, gespeichert.bestwert)

// Geschrieben wird nur, wenn sich wirklich etwas geaendert hat. Beides aendert
// sich ausschliesslich im Moment des Todes, also hoechstens einmal pro Lauf -
// eine Pruefung auf zwei Zahlen pro Bild ist dafuer bezahlbar, ein
// `setItem` pro Bild waere es nicht.
let offenStand = spiel.offen.length
let bestStand = spiel.bestwert

// Einmal angelegt und pro Tick ueberschrieben - kein Muell in der Schleife.
const befehle: Befehle = {
  x: 0,
  y: 0,
  bestaetigen: false,
  links: false,
  rechts: false,
  wahl: -1,
}
const bewegung = { x: 0, y: 0 }

const schleife = new Schleife({
  tick(dt) {
    eingabe.pollen()
    eingabe.bewegung(bewegung)

    befehle.x = bewegung.x
    befehle.y = bewegung.y
    // Bewegung liest gehaltene Tasten, Menuefuehrung nur die Flanke: Sonst
    // rast die Auswahl bei gehaltenem A durch alle Karten.
    befehle.bestaetigen = eingabe.getippt('bestaetigen')
    befehle.links = eingabe.getippt('links')
    befehle.rechts = eingabe.getippt('rechts')
    befehle.wahl = eingabe.getippt('wahl1')
      ? 0
      : eingabe.getippt('wahl2')
        ? 1
        : eingabe.getippt('wahl3')
          ? 2
          : -1

    tick(spiel, befehle, dt)
    eingabe.tickEnde()

    if (spiel.offen.length !== offenStand || spiel.bestwert !== bestStand) {
      offenStand = spiel.offen.length
      bestStand = spiel.bestwert
      sichereFortschritt()
    }
  },

  render(alpha) {
    zeichner.zeichne(spiel, alpha)
  },
})

eingabe.verbinden()
zeichner.passeAn()
window.addEventListener('resize', () => zeichner.passeAn())
schleife.start()

// Griff fuer den Playwright-Test: Er startet den Lauf, liest den Zustand aus
// und kann Waffen ausruesten, statt sich auf Screenshots allein zu verlassen.
// Ohne den Zugriff auf `WAFFEN` liesse sich kein Bild von einem fertigen Bau
// machen - man muesste zehn Minuten spielen, um eine Vollendung zu sehen.
declare global {
  interface Window {
    __scherbenfeld?: {
      spiel: typeof spiel
      schleife: Schleife
      waffen: typeof WAFFEN
      ruesteAus: typeof ruesteAus
      werteAuf: typeof werteAuf
    }
  }
}
window.__scherbenfeld = { spiel, schleife, waffen: WAFFEN, ruesteAus, werteAuf }
