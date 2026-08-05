// Gear Sniper – Collector
// Sammelt Preise aus drei Quellen und schreibt sie in kompakte JSON-Dateien,
// die der Cloudflare Worker dann nur noch liest:
//
//   1. Elgato-Shop DE  – kompletter Katalog aus der Sitemap (UVP + aktueller Preis)
//   2. Watchlist       – beliebige Produkt-Links anderer Shops (watchlist.json)
//   3. Kleinanzeigen   – Gebraucht-Angebote, verglichen mit dem Neupreis
//
// Läuft in GitHub Actions (und lokal per run.bat). Bewusst NICHT im Worker:
// ein Elgato-Produkt-JSON ist ~500 KB, das sprengt jedes Cloudflare-Free-Limit.
//
// Start:  node collector.mjs --mode=fast
//         node collector.mjs --mode=full
//         node collector.mjs --mode=fast --dry-run

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

// --- Argumente ---------------------------------------------------------

const args = process.argv.slice(2);
const arg = (name, def = null) => {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : args.includes('--' + name) ? true : def;
};
const MODE = arg('mode', 'fast');
const DRY = !!arg('dry-run');
const SIMULATE = arg('simulate-deal', null);
const ONLY = arg('only', null); // elgato | watch | ka

// Ehrlicher User-Agent statt Browser-Tarnung. Getestet: Elgato und
// Kleinanzeigen antworten damit genauso wie einem echten Browser.
const UA =
  process.env.SNIPER_UA ||
  'GearSniper/1.0 (persoenlicher Preiswecker, geringe Frequenz; Node ' + process.version + ')';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const eur = (n) => (n == null ? '–' : n.toFixed(2).replace('.', ',') + ' €');

// --- HTTP mit Bremse, Timeout und Wiederholung -------------------------

let lastCall = 0;

async function get(target, { accept = 'text/html', tries = 3 } = {}) {
  const wait = CFG.throttleMs - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(target, {
        headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'de-DE,de;q=0.9' },
        signal: AbortSignal.timeout(20000),
        redirect: 'follow',
      });
      if (res.status === 429 || res.status === 503) {
        const back = (i + 1) * 15000;
        console.log(`    Rate-Limit (${res.status}), warte ${back / 1000}s ...`);
        await sleep(back);
        continue;
      }
      if (!res.ok) {
        const err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return await res.text();
    } catch (e) {
      lastErr = e;
      // 4xx sind endgültig – nochmal fragen bringt nichts
      if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) break;
      if (i < tries - 1) await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

// --- Quelle 1: Elgato-Shop DE ------------------------------------------

// Die buildId steckt in jeder Seite und ändert sich bei jedem Deploy von
// Elgato. Deshalb pro Lauf frisch holen – hartkodiert wäre sie morgen tot.
async function elgatoBuildId() {
  const html = await get(CFG.elgato.base + '/' + CFG.elgato.locale);
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('buildId nicht gefunden – hat Elgato die Seite umgebaut?');
  return m[1];
}

async function elgatoCatalog() {
  const xml = await get(CFG.elgato.sitemap, { accept: 'application/xml' });
  const slugs = [...xml.matchAll(/<loc>[^<]*\/p\/([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return [...new Set(slugs)];
}

async function elgatoProduct(buildId, slug) {
  const u = `${CFG.elgato.base}/_next/data/${buildId}/${CFG.elgato.locale}/p/${slug}.json`;
  const raw = await get(u, { accept: 'application/json' });
  const it = JSON.parse(raw)?.pageProps?.productData?.productDetail?.items?.[0];
  if (!it) return null;

  const mp = it.price_range?.minimum_price;
  const reg = mp?.regular_price?.value;
  const cur = mp?.final_price?.value;
  if (typeof cur !== 'number' || typeof reg !== 'number' || reg <= 0) return null;

  return {
    id: 'elgato:' + it.sku,
    src: 'elgato',
    sku: it.sku,
    name: it.name,
    shop: 'Elgato',
    url: `${CFG.elgato.base}/${CFG.elgato.locale}/p/${slug}`,
    img: it.image?.url || it.small_image?.url || it.media_gallery?.[0]?.url || null,
    cur: round2(cur),
    ref: round2(reg),
    pct: pct(reg, cur),
    stock: it.stock_status || null,
  };
}

async function collectElgato(mode, prevItems, state) {
  console.log('\n[1/3] Elgato-Shop');
  const buildId = await elgatoBuildId();
  console.log('  buildId: ' + buildId);

  const all = await elgatoCatalog();
  console.log('  Katalog: ' + all.length + ' Produkte');

  let slugs = all;
  if (mode === 'fast') {
    // Schnelllauf: alles was zuletzt reduziert war (das will man engmaschig
    // beobachten) plus ein rotierender Block, damit auch neue Sales innerhalb
    // weniger Stunden auffallen statt erst beim Nachtlauf.
    const hot = new Set(
      prevItems.filter((p) => p.src === 'elgato' && (p.pct > 0 || p.atLow)).map((p) => slugOf(p.url))
    );
    const cursor = state.cursor || 0;
    const block = [];
    for (let i = 0; i < Math.min(CFG.fastBlock, all.length); i++) {
      block.push(all[(cursor + i) % all.length]);
    }
    state.cursor = (cursor + CFG.fastBlock) % all.length;
    slugs = [...new Set([...hot, ...block])].filter(Boolean);
    console.log(`  Schnelllauf: ${slugs.length} Produkte (${hot.size} beobachtet + Block ab ${cursor})`);
  }

  const out = [];
  let fails = 0;
  for (let i = 0; i < slugs.length; i++) {
    try {
      const p = await elgatoProduct(buildId, slugs[i]);
      if (p) out.push(p);
      fails = 0;
    } catch (e) {
      fails++;
      if (fails >= 20) throw new Error('20 Fehler in Folge bei Elgato – Abbruch (' + e.message + ')');
      console.log(`    ! ${slugs[i]}: ${e.message}`);
    }
    if ((i + 1) % 50 === 0) console.log(`  ... ${i + 1}/${slugs.length}`);
  }
  console.log('  ' + out.length + ' Preise geholt');
  return out;
}

const slugOf = (u) => (u || '').split('/p/')[1] || null;

// --- Quelle 2: Watchlist (beliebige Shops) -----------------------------

// Preis aus einer fremden Produktseite ziehen. Reihenfolge nach Zuverlässigkeit:
// JSON-LD ist standardisiert, der Rest ist Fallback.
export function extractPrice(html, custom) {
  if (custom) {
    const m = html.match(new RegExp(custom));
    const v = num(m?.[1]);
    if (v) return { price: v, via: 'regex' };
  }

  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const found = findOffer(data);
    if (found) return { price: found, via: 'json-ld' };
  }

  const meta = html.match(/<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([^"']+)["']/i);
  if (num(meta?.[1])) return { price: num(meta[1]), via: 'meta' };

  const micro = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i);
  if (num(micro?.[1])) return { price: num(micro[1]), via: 'microdata' };

  return null;
}

// Rekursiv durch JSON-LD laufen – manche Shops verschachteln in @graph,
// itemListElement oder liefern ein Array von Offers.
function findOffer(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const v = findOffer(n, depth + 1);
      if (v) return v;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  const t = String(node['@type'] || '');
  if (/Offer/i.test(t)) {
    const v = num(node.price) ?? num(node.lowPrice);
    if (v) return v;
  }
  for (const key of ['offers', '@graph', 'itemListElement', 'mainEntity', 'hasVariant']) {
    if (node[key]) {
      const v = findOffer(node[key], depth + 1);
      if (v) return v;
    }
  }
  return null;
}

async function collectWatchlist() {
  console.log('\n[2/3] Watchlist');
  const file = path.join(__dirname, 'watchlist.json');
  if (!fs.existsSync(file)) {
    console.log('  keine watchlist.json – übersprungen');
    return [];
  }
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];

  for (const e of list) {
    const base = {
      id: 'watch:' + hash(e.url),
      src: 'watch',
      name: e.name || e.url,
      shop: e.shop || hostOf(e.url),
      url: e.url,
      img: e.img || null,
      ref: e.uvp ?? null,
      stock: null,
    };
    try {
      const html = await get(e.url);
      const hit = extractPrice(html, e.regex);
      if (!hit) {
        console.log(`  ? ${base.name}: kein Preis gefunden (Seite geladen)`);
        out.push({ ...base, cur: null, pct: 0, status: 'no-price' });
        continue;
      }
      // Ohne eingetragene UVP kommt die Referenz aus dem Preisverlauf
      // (höchster je gesehener Preis) – siehe updateHistory. Sie hier auf den
      // aktuellen Preis zu setzen hieße: Rabatt ist immer null.
      out.push({
        ...base,
        cur: round2(hit.price),
        ref: base.ref != null ? round2(base.ref) : null,
        pct: base.ref != null ? pct(base.ref, hit.price) : 0,
        refFromHistory: base.ref == null,
        status: 'ok',
      });
      console.log(`  ✓ ${base.name}: ${eur(hit.price)} (${hit.via})`);
    } catch (e2) {
      // Erwartbar: viele Shops sperren Server-IPs aus. Das ist kein Bug,
      // das gehört sichtbar in die App statt still zu verschwinden.
      console.log(`  × ${base.name}: nicht abrufbar (${e2.message})`);
      out.push({ ...base, cur: null, pct: 0, status: 'blocked', note: e2.message });
    }
  }
  return out;
}

// --- Quelle 3: Kleinanzeigen (gebraucht) -------------------------------

// Wanted-Ads und Tauschgesuche raus – wir wollen Angebote, keine Suchenden.
const WANTED = /^\s*(suche|kaufe|tausche|ankauf|gesucht|suchen)\b/i;

// Vermietung ist kein Kauf. Stand echt in den Treffern: "MIETE Elgato Cam Link
// 4K – 15 €" sah aus wie −85%, war aber ein Tagespreis.
const RENTAL = /\b(miete|mieten|vermiete|vermietung|leihen|leihe|verleih)\b/i;

// Zubehör zum Gerät ist nicht das Gerät. "Stream Deck Mini Halterung für Sim
// Racing" wurde sonst gegen den Preis eines Stream Deck Mini gerechnet.
// Bewusst NICHT drin: "Zubehör", "Standfuß", "Kabel" – die stehen auch in
// ganz normalen Geräte-Anzeigen ("… mit Zubehör und OVP").
const ACCESSORY = /\b(halterung|halter|mount|case|huelle|tasche|skin|aufkleber|faceplate|abdeckung|schutzfolie|tastenkappen)\b/;

export function parseKleinanzeigen(html) {
  const out = [];
  for (const block of html.split(/(?=<article[^>]*class="aditem)/).slice(1)) {
    const id = block.match(/data-adid="(\d+)"/)?.[1];
    const href = block.match(/data-href="([^"]+)"/)?.[1];
    const title = clean(block.match(/<a[^>]*class="ellipsis"[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    const priceTxt = clean(block.match(/price-shipping--price">([\s\S]*?)</)?.[1]);
    const img = block.match(/<img[^>]*src="([^"]+)"/)?.[1] || null;
    if (!id || !href || !title) continue;

    // "1.250 € VB" / "50 €" / "Zu verschenken"
    const price = num((priceTxt || '').replace(/\./g, '').replace(/\s*€.*$/, ''));
    out.push({ id, href, title, price, img, vb: /VB/i.test(priceTxt || '') });
  }
  return out;
}

async function collectKleinanzeigen(catalog) {
  console.log('\n[3/3] Kleinanzeigen (gebraucht)');
  if (!CFG.kleinanzeigen.enabled) {
    console.log('  deaktiviert');
    return [];
  }
  const ka = CFG.kleinanzeigen;
  const seen = new Set();
  const out = [];

  for (const q of ka.queries) {
    const slug = q.trim().toLowerCase().replace(/\s+/g, '-');
    for (let page = 1; page <= ka.pages; page++) {
      // Seite 6+ sperrt die robots.txt von Kleinanzeigen – da gehen wir nicht hin.
      if (page > 5) break;
      const u =
        page === 1
          ? `https://www.kleinanzeigen.de/s-preis:${ka.minPrice}:${ka.maxPrice}/${slug}/k0`
          : `https://www.kleinanzeigen.de/s-preis:${ka.minPrice}:${ka.maxPrice}/seite:${page}/${slug}/k0`;
      let ads;
      try {
        ads = parseKleinanzeigen(await get(u));
      } catch (e) {
        console.log(`  × "${q}" Seite ${page}: nicht abrufbar (${e.message})`);
        break;
      }
      if (!ads.length) break;

      for (const ad of ads) {
        if (seen.has(ad.id)) continue;
        seen.add(ad.id);
        if (!ad.price || WANTED.test(ad.title) || RENTAL.test(ad.title)) continue;

        const match = matchProduct(ad.title, catalog);
        if (!match) continue; // ohne Neupreis kein Vergleich – kein Rabatt berechenbar

        const p = pct(match.ref, ad.price);
        out.push({
          id: 'ka:' + ad.id,
          src: 'ka',
          name: ad.title,
          shop: 'Kleinanzeigen',
          url: 'https://www.kleinanzeigen.de' + ad.href,
          img: ad.img,
          cur: ad.price,
          ref: match.ref,
          pct: p,
          stock: 'USED',
          match: match.name,
          vb: ad.vb,
          // Auffällig weit unter Neupreis: eher Betrugsmasche oder defekt.
          // Nicht wegwerfen, aber markieren – die Entscheidung trifft Hakan.
          sus: p >= CFG.suspiciousPct,
        });
      }
      console.log(`  "${q}" Seite ${page}: ${ads.length} Anzeigen`);
    }
  }
  const hits = out.filter((o) => o.pct >= CFG.usedMinPct).length;
  console.log(`  ${out.length} zuordenbare Angebote, davon ${hits} über ${CFG.usedMinPct}% unter Neupreis`);
  return out;
}

// Gebraucht-Titel einem Katalog-Produkt zuordnen. Regel: ALLE Wörter des
// Produktnamens müssen im Anzeigentitel vorkommen, und der längste Treffer
// gewinnt – so schlägt "Stream Deck XL" das allgemeinere "Stream Deck".
export function matchProduct(title, catalog) {
  const t = ' ' + norm(title) + ' ';
  // Produktnamen wie "Wave" sind für sich genommen zu allgemein. Solche
  // Ein-Wort-Treffer zählen nur, wenn die Anzeige auch Elgato nennt.
  const brandNamed = / elgato /.test(t);
  let best = null;

  for (const p of catalog) {
    if (p.src !== 'elgato' || !p.ref) continue;
    // Bündel als Referenz sind irreführend: ein einzelnes Gerät gegen einen
    // Set-Preis gerechnet ergibt Traumrabatte, die es nie gab.
    if (/\b(bundle|kit)\b/i.test(p.name)) continue;

    const phrase = norm(p.name);
    if (phrase.length < 3) continue;
    if (!phrase.includes(' ') && (!brandNamed || phrase.length < 4)) continue;

    // Der Produktname muss am Stück im Anzeigentitel stehen. Nur die
    // einzelnen Wörter irgendwo zu finden reicht nicht – so wurde
    // "Stream Deck MK.2 … Studio Controller" gegen den 999-€-"Stream Deck
    // Studio" gerechnet und sah aus wie −91%.
    if (!t.includes(' ' + phrase + ' ')) continue;

    if (ACCESSORY.test(t) && !ACCESSORY.test(phrase)) continue;

    const score = phrase.length; // längster (= genauester) Treffer gewinnt
    if (!best || score > best.score) best = { name: p.name, ref: p.ref, score };
  }
  return best;
}

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    // Sonst wären "Stream Deck +" und "Stream Deck" nach dem Putzen identisch
    // und ein Plus-Modell würde gegen den Preis des kleinen Modells gerechnet.
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// --- Preisverlauf ------------------------------------------------------

// Ein Punkt pro Tag und Produkt. Daraus kommt das Allzeittief-Kennzeichen,
// das nicht auf Elgatos UVP vertraut – falls die still gesenkt wird.
function updateHistory(hist, items) {
  const d = today();
  for (const it of items) {
    if (it.cur == null || it.src === 'ka') continue; // Gebraucht-Anzeigen sind Einzelstücke
    // Nicht neu geprüfte Produkte behalten ihren alten Stand – sonst würde der
    // Verlauf Tagespunkte erfinden, die nie gemessen wurden.
    if (it.stale) continue;
    const h = (hist.items[it.id] ||= { min: it.cur, max: it.cur, minAt: d, points: [] });

    // Tiefstand VOR dem heutigen Punkt merken. Sonst wäre jeder Preis sein
    // eigenes Allzeittief und der allererste Lauf würde Discord fluten.
    const prevMin = h.min;
    const prevDays = h.points.length;
    h.max = Math.max(h.max ?? it.cur, it.cur);

    // Watchlist-Einträge ohne eingetragene UVP: Referenz ist der höchste je
    // gesehene Preis. Am Anfang also 0% – das wächst sich mit der Zeit aus.
    if (it.refFromHistory) {
      it.ref = h.max;
      it.pct = pct(h.max, it.cur);
    }

    // Den Tagespunkt schreibt nur der Nachtlauf. Sonst änderte sich
    // history.json 48-mal am Tag und würde bei jedem Commit neu im Repo
    // landen. min/max pflegen die Schnellläufe trotzdem mit – nur darauf
    // stützt sich das Allzeittief.
    const last = h.points[h.points.length - 1];
    if (MODE === 'full' || !h.points.length) {
      if (last && last[0] === d) last[1] = it.cur;
      else h.points.push([d, it.cur]);
      if (h.points.length > CFG.historyDays) h.points = h.points.slice(-CFG.historyDays);
    }
    if (it.cur <= h.min) {
      h.min = it.cur;
      h.minAt = d;
    }

    it.low = h.min;
    it.lowAt = h.minAt;
    // Ein Allzeittief ist erst eins, wenn der Sniper das Produkt lange genug
    // kennt – vorher weiß er schlicht zu wenig.
    it.atLow = prevDays >= CFG.minHistoryDays && it.cur <= prevMin;
  }
  hist.meta = { ...(hist.meta || {}), updated: new Date().toISOString() };
  return hist;
}

// --- Hilfsmittel -------------------------------------------------------

const round2 = (n) => Math.round(n * 100) / 100;
const pct = (ref, cur) => (!ref || ref <= 0 || cur == null ? 0 : Math.max(0, Math.round(((ref - cur) / ref) * 100)));
const clean = (s) =>
  (s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const num = (v) => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return 'Shop';
  }
};
const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const readJson = (name, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
  } catch {
    return fallback;
  }
};
const writeJson = (name, data) => {
  if (DRY) return;
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data), 'utf8');
};

// --- Hauptlauf ---------------------------------------------------------

async function main() {
  const t0 = Date.now();
  console.log(`Gear Sniper – Sammellauf (${MODE}${DRY ? ', dry-run' : ''})`);

  const prev = readJson('prices.json', { items: [] });
  const hist = readJson('history.json', { meta: {}, items: {} });
  hist.items ||= {};
  hist.meta ||= {};

  let items = [];

  if (!ONLY || ONLY === 'elgato') {
    items.push(...(await collectElgato(MODE, prev.items || [], hist.meta)));
  }
  if (!ONLY || ONLY === 'watch') {
    items.push(...(await collectWatchlist()));
  }

  // Im Schnelllauf fehlt der halbe Katalog – für den Gebraucht-Vergleich
  // deshalb die alten Preise als Referenz dazunehmen.
  const known = new Map(items.map((i) => [i.id, i]));
  const catalog = [...items, ...(prev.items || []).filter((p) => !known.has(p.id))];

  if (!ONLY || ONLY === 'ka') {
    items.push(...(await collectKleinanzeigen(catalog)));
  }

  // Im Schnelllauf nicht geprüfte Produkte behalten ihren letzten Stand,
  // sonst wäre die App nach jedem Lauf halb leer.
  const fresh = new Set(items.map((i) => i.id));
  for (const p of prev.items || []) {
    if (!fresh.has(p.id) && p.src !== 'ka') items.push({ ...p, stale: true });
  }

  updateHistory(hist, items);

  if (SIMULATE) {
    const t = items.find((i) => i.sku === SIMULATE || i.id === SIMULATE);
    if (t) {
      t.cur = round2(t.ref * 0.4);
      t.pct = 60;
      t.simulated = true;
      console.log(`\n  TESTFALL: ${t.name} künstlich auf ${eur(t.cur)} (−60%) gesetzt`);
    } else {
      console.log(`\n  TESTFALL: ${SIMULATE} nicht gefunden`);
    }
  }

  items.sort((a, b) => b.pct - a.pct || (a.cur ?? 1e9) - (b.cur ?? 1e9));

  const prices = { at: new Date().toISOString(), mode: MODE, count: items.length, items };

  // Zweite, winzige Datei nur für den Alarm-Cron: der Worker hat auf dem
  // Free-Plan 10 ms CPU – 500 Produkte zu parsen wäre Verschwendung.
  const deals = items.filter(
    (i) => i.pct >= CFG.dealFloorPct || i.atLow || i.status === 'blocked' || i.simulated
  );
  const dealFile = { at: prices.at, mode: MODE, count: deals.length, items: deals };

  writeJson('prices.json', prices);
  writeJson('deals.json', dealFile);
  writeJson('history.json', hist);

  const top = items.filter((i) => i.pct > 0).slice(0, 10);
  console.log('\n--- Beste Rabatte ---');
  if (!top.length) console.log('  gerade nichts reduziert');
  for (const t of top) {
    console.log(
      `  −${String(t.pct).padStart(2)}%  ${eur(t.cur).padStart(10)} statt ${eur(t.ref).padStart(10)}  ` +
        `${t.name.slice(0, 45).padEnd(45)} [${t.shop}]${t.sus ? ' ⚠ verdächtig günstig' : ''}`
    );
  }
  console.log(
    `\nFertig in ${Math.round((Date.now() - t0) / 1000)}s – ` +
      `${items.length} Einträge, ${deals.length} für den Alarm relevant` +
      (DRY ? ' (dry-run: nichts geschrieben)' : '')
  );
}

// Nur starten, wenn die Datei direkt aufgerufen wurde – wird sie nur
// importiert (Tests), passiert nichts.
const startedDirectly = process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href;

if (startedDirectly) {
  main().catch((e) => {
    console.error('\nAbbruch: ' + e.message);
    process.exit(1);
  });
}
