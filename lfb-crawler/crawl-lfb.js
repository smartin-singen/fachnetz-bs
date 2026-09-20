#!/usr/bin/env node

/**
 * LFB-Online Crawler
 * 
 * Durchsucht das Fortbildungsportal LFB-Online (Baden-Württemberg) nach einem
 * Suchbegriff (Standard: 'LFTMath319!'), ruft alle Veranstaltungstermine mit
 * ihren Detailseiten ab und exportiert die Ergebnisse als JSON.
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

const BASE_URL = 'https://lfbo.kultus-bw.de/lfb';

// CLI Optionen konfigurieren
const options = {
  query: {
    type: 'string',
    short: 'q',
    multiple: true,
    default: ['LFTMath319!']
  },
  output: {
    type: 'string',
    short: 'o',
    default: 'veranstaltungen.json'
  },
  limit: {
    type: 'string',
    short: 'l'
  },
  browser: {
    type: 'boolean',
    default: false
  },
  concurrency: {
    type: 'string',
    short: 'c',
    default: '5'
  },
  stdout: {
    type: 'boolean',
    default: false
  },
  help: {
    type: 'boolean',
    short: 'h',
    default: false
  }
};

/**
 * Hilfsfunktion zum Bereinigen von HTML-Fragmenten oder Sonderzeichen
 */
function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Normalisiert ein Roh-Event und dessen Kontakte in ein klares JSON-Objekt
 */
function normalizeEvent(event, contacts = []) {
  const terminnummer = event.terminnummer || event.id?.toString();
  const detailUrl = `${BASE_URL}/termine/${terminnummer}`;

  const veranstalterName = event.anbieter?.name || null;
  const ortObj = event.veranstaltungsOrt || {};
  const adresseObj = ortObj.adresse || {};

  const ort = {
    name: ortObj.bezeichnung || null,
    art: ortObj.veranstaltungsortArt?.name || null,
    raum: event.veranstaltungsRaum?.name || ortObj.raum?.name || null,
    strasse: adresseObj.strasse || null,
    plz: adresseObj.postleitzahl || null,
    stadt: adresseObj.ort || null,
    land: adresseObj.land || null
  };

  const leitender = event.leitender
    ? [event.leitender.vorname, event.leitender.name].filter(Boolean).join(' ')
    : null;

  const kontaktListe = (contacts || []).map(c => ({
    name: c.name || null,
    rolle: c.contactType || null,
    kontaktierbar: Boolean(c.contactable)
  }));

  const schularten = Array.isArray(event.schulart)
    ? event.schulart.map(s => s.name || s.kennzeichen).filter(Boolean)
    : [];

  const faecher = Array.isArray(event.fachbezug)
    ? event.fachbezug.map(f => f.name).filter(Boolean)
    : [];

  const inhaltsschwerpunkte = Array.isArray(event.inhaltsschwerpunkte)
    ? event.inhaltsschwerpunkte.map(i => i.name).filter(Boolean)
    : [];

  const referenzrahmen = Array.isArray(event.referenzrahmen)
    ? event.referenzrahmen.map(r => r.name || r.kennzeichen).filter(Boolean)
    : [];

  const zieldienststellen = Array.isArray(event.zieldienststellen)
    ? event.zieldienststellen.map(z => z.name || z.bezeichnung).filter(Boolean)
    : [];

  return {
    terminnummer,
    titel: cleanText(event.titel),
    url: detailUrl,
    status: event.status?.name || null,
    veranstaltungstyp: event.veranstaltungstyp?.name || null,
    beginn: event.beginn || null,
    ende: event.ende || null,
    buchbarLehrkraft: Boolean(event.buchbarLehrkraft),
    buchbarSchulleitung: Boolean(event.buchbarSchulleitung),
    blendedLearning: Boolean(event.blendedLearning),
    veranstalter: veranstalterName,
    ort,
    ziel: cleanText(event.veranstaltungsZiel),
    inhalt: cleanText(event.inhalt),
    hinweis: cleanText(event.teilnahmeHinweis),
    tagungsprogramm: cleanText(event.tagungsprogramm),
    zielgruppe: cleanText(event.zielgruppe?.name || event.zielgruppeBeschreibung),
    zielgruppeBeschreibung: cleanText(event.zielgruppeBeschreibung),
    zieldienststellen,
    schularten,
    faecher,
    inhaltsschwerpunkte,
    referenzrahmen,
    arbeitsfeld: event.arbeitsfeld?.name || null,
    fachreferat: event.fachreferat?.name || null,
    leitender,
    kontakte: kontaktListe,
    uebergeordneteVeranstaltung: event.veranstaltung ? {
      nummer: event.veranstaltung.veranstaltungsnummer || null,
      titel: cleanText(event.veranstaltung.titel),
      status: event.veranstaltung.status?.name || null
    } : null,
    // Vollständige Rohdaten für maximale Detailtiefe
    raw: event
  };
}

/**
 * Führt asynchrone Tasks mit konfigurierbarer Parallelität aus
 */
async function asyncPool(limit, items, iteratorFn) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

/**
 * Performanter Abruf direkt über das LFB REST-API (unter Beachtung von Cookies & XSRF)
 */
async function crawlViaApi({ queries, limit, concurrency, log }) {
  log(`[API-Modus] Initialisiere Session bei ${BASE_URL}/suche ...`);
  const initRes = await fetch(`${BASE_URL}/suche`);
  if (!initRes.ok) {
    throw new Error(`Fehler beim Laden der Startseite: HTTP ${initRes.status}`);
  }

  const setCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [initRes.headers.get('set-cookie')];
  const cookies = [];
  let xsrfToken = '';

  for (const c of setCookies) {
    if (!c) continue;
    const cookiePart = c.split(';')[0];
    cookies.push(cookiePart);
    if (cookiePart.startsWith('XSRF-TOKEN=')) {
      xsrfToken = cookiePart.replace('XSRF-TOKEN=', '');
    }
  }

  const cookieHeader = cookies.join('; ');
  log(`[API-Modus] Session etabliert (Cookies: ${cookies.length}, XSRF vorhanden: ${Boolean(xsrfToken)})`);

  const eventsByTnr = new Map();
  const pageSize = 100;

  for (const query of queries) {
    log(`[API-Modus] Suche nach Suchbegriff "${query}" ...`);
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const queryUrl = `${BASE_URL}/apiv1/query?sort=beginn,asc&size=${pageSize}&page=${page}`;
      const queryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
          'X-XSRF-TOKEN': xsrfToken
        },
        body: JSON.stringify({
          suchtext: query,
          zieltyp: {
            cls: 'de.bw.km.lfb.domain.suche.ErgebnistypEN',
            kennzeichen: 'TERMIN'
          }
        })
      });

      if (!queryRes.ok) {
        throw new Error(`Suchabfrage fehlgeschlagen für "${query}": HTTP ${queryRes.status} ${await queryRes.text()}`);
      }

      const queryData = await queryRes.json();
      const batch = queryData.terminErgebnisliste || [];
      const gesamtzahl = queryData.gesamtzahl || 0;

      for (const item of batch) {
        if (!eventsByTnr.has(item.terminnummer)) {
          eventsByTnr.set(item.terminnummer, item);
        }
      }

      log(`[API-Modus] "${query}" Seite ${page + 1}: ${batch.length} Termine empfangen (Gesamtzahl im System: ${gesamtzahl}, Einzigartige Treffer: ${eventsByTnr.size})`);

      if (limit && eventsByTnr.size >= limit) {
        break;
      }

      if (batch.length === 0 || (page + 1) * pageSize >= gesamtzahl) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (limit && eventsByTnr.size >= limit) {
      break;
    }
  }

  let allEvents = Array.from(eventsByTnr.values());
  if (limit && allEvents.length > limit) {
    allEvents = allEvents.slice(0, limit);
  }

  log(`[API-Modus] Insgesamt ${allEvents.length} Termine gefunden. Starte Abruf der Detailseiten (Parallelität: ${concurrency}) ...`);

  let completed = 0;
  const detailedResults = await asyncPool(concurrency, allEvents, async (item) => {
    const terminnummer = item.terminnummer;
    let detail = item;
    let contacts = [];

    try {
      const detailRes = await fetch(`${BASE_URL}/apiv1/events/${terminnummer}`, {
        headers: { 'Cookie': cookieHeader }
      });
      if (detailRes.ok) {
        detail = await detailRes.json();
      }
    } catch (err) {
      log(`[Warnung] Detailabruf für ${terminnummer} fehlgeschlagen: ${err.message}`);
    }

    const eventId = detail.id || item.id;
    if (eventId) {
      try {
        const contactRes = await fetch(`${BASE_URL}/apiv1/kontakt/fetchContacts/${eventId}`, {
          headers: { 'Cookie': cookieHeader }
        });
        if (contactRes.ok) {
          contacts = await contactRes.json();
        }
      } catch (err) {
        // Kontakte sind optional
      }
    }

    completed++;
    if (completed % 10 === 0 || completed === allEvents.length) {
      log(`[API-Modus] Fortschritt: ${completed}/${allEvents.length} Detailseiten geladen`);
    }

    return normalizeEvent(detail, contacts);
  });

  return detailedResults;
}

/**
 * UI-gestützter Abruf über Puppeteer (Chrome-Browser)
 */
async function crawlViaBrowser({ queries, limit, concurrency, log }) {
  log('[Browser-Modus] Starte Google Chrome via puppeteer-core...');
  const puppeteer = require('puppeteer-core');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const itemsByTnr = new Map();

    for (const query of queries) {
      log(`[Browser-Modus] Navigiere zu ${BASE_URL}/suche ...`);
      await page.goto(`${BASE_URL}/suche`, { waitUntil: 'networkidle2' });

      log(`[Browser-Modus] Tippe "${query}" in das Suchfeld ein...`);
      await page.waitForSelector('input[placeholder*="Suchbegriff"]', { timeout: 15000 });

      await page.evaluate((val) => {
        const input = document.querySelector('input[placeholder*="Suchbegriff"]') || document.querySelector('input.form-control');
        if (input) {
          input.focus();
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, query);

      log('[Browser-Modus] Klicke den Such-Button...');
      const queryPromise = page.waitForResponse(
        res => res.url().includes('/apiv1/query') && res.status() === 200,
        { timeout: 20000 }
      ).catch(() => null);

      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('SUCHEN'));
        if (btn) {
          btn.click();
        } else {
          const input = document.querySelector('input[placeholder*="Suchbegriff"]') || document.querySelector('input.form-control');
          if (input) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          }
        }
      });

      const queryResponse = await queryPromise;

      if (queryResponse) {
        const qJson = await queryResponse.json();
        const batch = qJson.terminErgebnisliste || [];
        for (const item of batch) {
          if (!itemsByTnr.has(item.terminnummer)) {
            itemsByTnr.set(item.terminnummer, item);
          }
        }
        log(`[Browser-Modus] "${query}": ${batch.length} Termine empfangen (Gesamt einzigartig: ${itemsByTnr.size})`);
      } else {
        log('[Browser-Modus] Warte auf Suchergebnisse in der Seite...');
        await new Promise(r => setTimeout(r, 4000));
      }

      if (limit && itemsByTnr.size >= limit) {
        break;
      }
    }

    let items = Array.from(itemsByTnr.values());
    if (limit && items.length > limit) {
      items = items.slice(0, limit);
    }

    log(`[Browser-Modus] Lade Detailinformationen für ${items.length} Termine...`);

    // Detail-Seiten abrufen
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const terminnummer = item.terminnummer;
      const detailUrl = `${BASE_URL}/termine/${terminnummer}`;
      log(`[Browser-Modus] [${i + 1}/${items.length}] Rufe Detailseite auf: ${detailUrl}`);

      let detailJson = null;
      let contacts = [];

      const detailHandler = async (res) => {
        if (res.url().includes(`/apiv1/events/${terminnummer}`) && res.status() === 200) {
          try { detailJson = await res.json(); } catch (e) {}
        }
        if (res.url().includes('/apiv1/kontakt/fetchContacts/') && res.status() === 200) {
          try { contacts = await res.json(); } catch (e) {}
        }
      };

      page.on('response', detailHandler);
      try {
        await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000));
      } finally {
        page.off('response', detailHandler);
      }

      const eventData = detailJson || item;
      results.push(normalizeEvent(eventData, contacts));
    }

    return results;
  } finally {
    await browser.close();
  }
}

// Hauptfunktion
async function main() {
  const { values, positionals } = parseArgs({ options, allowPositionals: true });

  if (values.help) {
    console.log(`
LFB-Online Fortbildungs-Crawler
===============================

Verwendung:
  node crawl-lfb.js [Optionen] [Suchbegriffe...]
  npm run crawl

Optionen:
  -q, --query <string>        Suchbegriff (kann mehrfach angegeben oder kommagetrennt werden)
  -o, --output <file>         Zieldatei für JSON-Ausgabe (Standard: "veranstaltungen.json")
  -l, --limit <number>        Maximale Anzahl der zu verarbeitenden Termine (Standard: alle)
  -c, --concurrency <number>  Anzahl paralleler Detail-Requests im API-Modus (Standard: 5)
      --browser               Verwende Puppeteer Browser-Automatisierung statt nativem API-Modus
      --stdout                Reine JSON-Ausgabe auf stdout (z. B. für Pipes in jq)
  -h, --help                  Diese Hilfe anzeigen

Beispiele:
  node crawl-lfb.js
  node crawl-lfb.js -q "LFTMath319!" -q "Mathematik"
  node crawl-lfb.js --query "LFTMath319!, Mathematik" --output ergebnis.json
  node crawl-lfb.js LFTMath319! Mathematik
  node crawl-lfb.js --limit 5 --browser
  node crawl-lfb.js --limit 3 --stdout | jq .
`);
    process.exit(0);
  }

  const rawQueries = Array.isArray(values.query) ? values.query : [values.query || 'LFTMath319!'];
  const queries = [
    ...rawQueries.flatMap(q => q.split(',')),
    ...(positionals || [])
  ].map(s => s.trim()).filter(Boolean);
  const uniqueQueries = [...new Set(queries.length > 0 ? queries : ['LFTMath319!'])];

  const limit = values.limit ? parseInt(values.limit, 10) : null;
  const concurrency = values.concurrency ? parseInt(values.concurrency, 10) : 5;
  const outputFile = values.output;
  const useBrowser = Boolean(values.browser);
  const writeStdout = Boolean(values.stdout);

  const log = (msg) => {
    if (!writeStdout) {
      console.error(msg);
    }
  };

  log(`\n=== LFB-Online Crawler ===`);
  log(`Suchbegriffe: ${uniqueQueries.map(q => `"${q}"`).join(', ')}`);
  log(`Modus       : ${useBrowser ? 'Browser-Automatisierung (Puppeteer)' : 'Nativer REST-API Modus'}`);
  if (limit) log(`Limit       : ${limit} Termine`);
  if (outputFile) log(`Ausgabe     : ${outputFile}`);
  log(`==========================\n`);

  const startTime = Date.now();

  try {
    let results = [];
    if (useBrowser) {
      results = await crawlViaBrowser({ queries: uniqueQueries, limit, concurrency, log });
    } else {
      results = await crawlViaApi({ queries: uniqueQueries, limit, concurrency, log });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\nCrawl erfolgreich abgeschlossen in ${duration}s.`);
    log(`Gesammelte Veranstaltungen: ${results.length}`);

    const jsonString = JSON.stringify(results, null, 2);

    if (outputFile) {
      const resolvedPath = path.resolve(process.cwd(), outputFile);
      fs.writeFileSync(resolvedPath, jsonString, 'utf-8');
      log(`Ergebnisse gespeichert in: ${resolvedPath} (${(Buffer.byteLength(jsonString) / 1024).toFixed(1)} KB)`);
    }

    if (writeStdout) {
      process.stdout.write(jsonString + '\n');
    }

  } catch (err) {
    console.error(`\n[Fehler beim Crawlen]: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    crawlViaApi,
    crawlViaBrowser,
    normalizeEvent
  };
}
