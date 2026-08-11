// Gear Sniper – Verkaufspreise von eBay (optional)
//
// WOZU: markt.json kennt bisher nur den Kleinanzeigen-Markt. Verkauft wird aber
// eher auf eBay, und das ist ein anderer Markt mit anderen Preisen. Dieses
// Skript holt die eBay-Preisverteilung je Modell und schreibt sie zusaetzlich
// in markt.json, damit die Margenrechnung gegen den Markt rechnet, in den
// wirklich verkauft wird.
//
// WAS ES NICHT KANN – wichtig, damit die Zahlen richtig gelesen werden:
// Die Browse-API liefert LAUFENDE Angebote, keine verkauften. Das sind also
// wieder Wunschpreise, genau wie der Kleinanzeigen-Median. Echte Verkaufspreise
// gaebe es nur ueber die Marketplace-Insights-API, und die muss man bei eBay
// beantragen. Deshalb wird auch hier mit dem unteren Viertel gerechnet und
// nicht mit dem Median.
// (Die eBay-Website direkt auszulesen geht nicht: getestet am 09.08.2026,
// ebay.de antwortet automatisierten Abrufen mit HTTP 403 – wie Geizhals und
// Idealo auch.)
//
// EINRICHTEN (Stand 09.08.2026 auf developer.ebay.com nachgesehen):
//   1. https://developer.ebay.com/signin?tab=register – eigene, kostenlose
//      Registrierung mit eigenem Benutzernamen und Passwort. Das ist NICHT
//      das normale eBay-Konto; bei ebay.de angemeldet zu sein hilft nicht.
//      Freie Stufe: 5.000 Abrufe pro Tag, dieses Skript braucht 31 pro Lauf.
//   2. "My Account" -> "Application Keysets" -> Anwendungsname eintragen ->
//      unter PRODUCTION (nicht Sandbox!) "Create a keyset".
//   3. WICHTIG, sonst laeuft nichts: ein frisches Production-Keyset ist
//      stillgelegt, bis man sich zu den Benachrichtigungen ueber
//      Kontoloeschungen geaeussert hat. Steht dort "Your Keyset is currently
//      disabled", dem Link folgen und abonnieren ODER abbestellen – beides
//      schaltet frei.
//   4. App-ID (Client ID) und Cert-ID (Client Secret) nach ebay.txt, eine Zeile:
//         AppID:CertID
//      Die Datei ist per .gitignore geschuetzt und wird nie hochgeladen.
//
//   KEIN Partner-Network-Antrag noetig. Der betrifft die Limited-Release-
//   Methoden (Checkout, Order, Feed) – item_summary/search gehoert nicht dazu
//   und laeuft mit einem gewoehnlichen Production-Keyset.
//
// BENUTZEN:
//   node verkauf.mjs              alle Modelle aus jagd.json
//   node verkauf.mjs --dry-run    nur anzeigen, markt.json nicht anfassen

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { ladeJagdDbs, passtZumModell } from './collector.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const P = (n) => path.join(__dirname, n);
const DRY = process.argv.includes('--dry-run');

const MARKT = 'EBAY_DE';
// Nur Gebrauchtzustaende – ein Neupreis taugt nicht als Vergleich fuer eine
// gebrauchte Karte. 3000 = gebraucht, 2500/2750 = generalueberholt.
const ZUSTAENDE = '3000|2500|2750';

// Erste Zeile im Format AppID:CertID, Kommentarzeilen werden uebersprungen –
// so darf in ebay.txt auch die Anleitung stehen.
function zugangsdaten() {
  const roh = process.env.EBAY_KEYS || (fs.existsSync(P('ebay.txt')) ? fs.readFileSync(P('ebay.txt'), 'utf8') : '');
  const zeile = roh
    .split(/\r?\n/)
    .map((z) => z.trim())
    .find((z) => z && !z.startsWith('#') && z.includes(':'));
  const [id, secret] = (zeile || '').split(':');
  return id && secret ? { id: id.trim(), secret: secret.trim() } : null;
}

// eBay will Client-Credentials: einmal Token holen, dann damit suchen.
async function token({ id, secret }) {
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (res.ok) return (await res.json()).access_token;

  // Die haeufigste Ursache ist NICHT ein Tippfehler, sondern ein frisch
  // erstelltes Production-Keyset, das eBay stillgelegt laesst, bis man sich
  // fuer die Kontoloeschungs-Benachrichtigungen entschieden hat (an- oder
  // abmelden, beides geht). Ohne diesen Hinweis sucht man den Fehler in den
  // Schluesseln, und die sind richtig.
  const text = await res.text().catch(() => '');
  const hinweis =
    res.status === 401 || res.status === 400
      ? '\n  Pruefen, in dieser Reihenfolge:\n' +
        '  1. Ist das Keyset ueberhaupt freigeschaltet? Auf der Seite "Application Keys" steht sonst\n' +
        '     "Your Keyset is currently disabled" – dann dem Link folgen und die Benachrichtigungen\n' +
        '     zur Kontoloeschung abonnieren ODER abbestellen. Beides schaltet frei.\n' +
        '  2. Sind es die PRODUCTION-Schluessel und nicht die aus der Sandbox?\n' +
        '  3. Steht in ebay.txt wirklich AppID:CertID (Client ID : Client Secret)?'
      : '';
  throw new Error(`Token HTTP ${res.status}${hinweis}${text ? '\n  eBay sagt: ' + text.slice(0, 300) : ''}`);
}

// Liefert { title, price } je Treffer.
//
// Der Titel wird gebraucht, um Zubehoer auszusortieren – er wird ausgewertet
// und danach fallengelassen. Gespeichert werden am Ende nur die Kennzahlen,
// die Freistellung von der Marketplace Account Deletion bleibt also gueltig:
// sie verbietet das PERSISTIEREN von eBay-Daten, nicht das Anschauen.
export async function ebayTreffer(begriff, tok, limit = 100) {
  const u =
    'https://api.ebay.com/buy/browse/v1/item_summary/search' +
    `?q=${encodeURIComponent(begriff)}&limit=${limit}` +
    `&filter=${encodeURIComponent(`conditionIds:{${ZUSTAENDE}},buyingOptions:{FIXED_PRICE}`)}`;

  const res = await fetch(u, {
    headers: { authorization: 'Bearer ' + tok, 'X-EBAY-C-MARKETPLACE-ID': MARKT },
  });
  if (!res.ok) throw new Error('Suche HTTP ' + res.status);

  const j = await res.json();
  return (j.itemSummaries || [])
    .map((i) => ({ title: i.title || '', price: parseFloat(i.price?.value) }))
    .filter((x) => x.title && Number.isFinite(x.price) && x.price > 0);
}

const quantil = (s, q) => {
  if (!s.length) return null;
  const i = (s.length - 1) * q;
  const u = Math.floor(i);
  const o = Math.ceil(i);
  return r2(u === o ? s[u] : s[u] + (s[o] - s[u]) * (i - u));
};
const r2 = (n) => Math.round(n * 100) / 100;

async function main() {
  const zd = zugangsdaten();
  if (!zd) {
    console.log('In ebay.txt steht noch keine Zeile "AppID:CertID" – die Anleitung steht in der Datei.');
    console.log('');
    console.log('Solange rechnet der Sniper mit dem Kleinanzeigen-Markt weiter. Das funktioniert,');
    console.log('schaetzt den Erloes aber gegen den Marktplatz, auf dem du nicht verkaufst.');
    process.exit(1);
  }

  const dbs = ladeJagdDbs(__dirname);
  const markt = JSON.parse(fs.readFileSync(P('markt.json'), 'utf8'));
  const tok = await token(zd);
  const anzahl = dbs.reduce((n, d) => n + d.db.modelle.length, 0);
  console.log(`eBay-Verkaufspreise für ${anzahl} Modelle (${MARKT}, nur gebraucht)\n`);

  for (const { db, filter } of dbs) {
    console.log(`  --- ${db.emoji || ''} ${db.label || ''} ---`);
    for (const m of db.modelle) {
      try {
        // Alle Suchbegriffe des Modells, doppelte Treffer raus
        const roh = [];
        const gesehen = new Set();
        for (const q of m.queries) {
          for (const t of await ebayTreffer(q, tok)) {
            const schluessel = t.title + '|' + t.price;
            if (gesehen.has(schluessel)) continue;
            gesehen.add(schluessel);
            roh.push(t);
          }
          await new Promise((r) => setTimeout(r, 400));
        }

        // DIESELBEN Filter wie bei Kleinanzeigen. Ohne sie stand die RTX 4090
        // bei p25 68 € – das waren Kuehler, leere Kartons ("NUR OVP OHNE
        // GRAFIKKARTE") und am oberen Ende komplette Dell-Workstations.
        const echt = roh.filter((t) => passtZumModell(t, m, filter));
        const preise = echt.map((t) => t.price).sort((a, b) => a - b);
        const raus = roh.length - echt.length;

        if (preise.length < 5) {
          console.log(
            `  ${m.name.padEnd(18)} nur ${preise.length} brauchbar von ${roh.length} – zu wenig, übersprungen`
          );
          continue;
        }

        const eintrag = {
          p25: quantil(preise, 0.25),
          median: quantil(preise, 0.5),
          p75: quantil(preise, 0.75),
          anzeigen: preise.length,
        };
        const vorher = markt.modelle[m.name] || {};
        markt.modelle[m.name] = { ...vorher, ebay: eintrag };

        const ka = vorher.p25;
        const diff = ka
          ? ` · KA p25 ${ka} € (${eintrag.p25 > ka ? '+' : ''}${Math.round(((eintrag.p25 - ka) / ka) * 100)} %)`
          : '';
        console.log(
          `  ${m.name.padEnd(18)} p25 ${String(eintrag.p25).padStart(8)} € · Median ${String(eintrag.median).padStart(8)} € · ` +
            `${String(preise.length).padStart(3)} von ${String(roh.length).padStart(3)} (${raus} aussortiert)${diff}`
        );
      } catch (e) {
        console.log(`  ${m.name.padEnd(18)} Fehler: ${e.message}`);
      }
    }
  }

  if (!DRY) {
    markt.ebayAt = new Date().toISOString();
    fs.writeFileSync(P('markt.json'), JSON.stringify(markt), 'utf8');
    console.log('\nIn markt.json geschrieben.');
  } else {
    console.log('\ndry-run: markt.json nicht angefasst.');
  }
}

const direkt = process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href;
if (direkt) main().catch((e) => (console.error('Abbruch: ' + e.message), process.exit(1)));
