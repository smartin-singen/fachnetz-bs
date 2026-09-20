#!/usr/bin/env node

/**
 * LFB-Online: Transform & Generator für zielinfos.json
 * 
 * Liest die gecrawlten Veranstaltungsdaten (veranstaltungen.json),
 * führt semantische Vereinfachungen durch, aggregiert mehrteilige
 * Reihen (T1, T2, ...) sowie regionale Parallelangebote und erzeugt
 * eine strukturierte zielinfos.json (unter Erhalt redaktioneller Texte/Tags).
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

const options = {
  input: {
    type: 'string',
    short: 'i',
    default: 'veranstaltungen.json'
  },
  existing: {
    type: 'string',
    short: 'e',
    default: 'weitere-angebote.json'
  },
  output: {
    type: 'string',
    short: 'o',
    default: 'sj2627.json'
  },
  schuljahr: {
    type: 'string',
    short: 's',
    default: '26/27'
  },
  help: {
    type: 'boolean',
    short: 'h',
    default: false
  }
};

/**
 * Normalisiert den Titel zur Gruppierung von Reihen und Parallelangeboten
 */
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .replace(/^ABRUF\s*[:\-]?\s*/i, '')
    .replace(/^SchiLF\s*[:\-]?\s*/i, '')
    .replace(/^Schnalf\s*[:\-]?\s*/i, '')
    .replace(/^SchnaLF\s*[:\-]?\s*/i, '')
    .replace(/^Online\s*[:\-]?\s*/i, '')
    .replace(/\s*\((?:T|Teil)\s*\d+\)$/i, '')
    .replace(/\s*\(?\s*(?:,\s*Reihe)?\s*(?:Abrufangebot|Abruf)\)?$/i, '')
    .replace(/\s*\(?\s*Zusatztermin\s*\)?$/i, '')
    .replace(/\s*\(?\s*(?:SchiLF|Schalf|Schnalf|SchnaLF)\s*\)?$/i, '')
    .replace(/\s*Teil\s*\d+$/i, '')
    .replace(/\s*Teil\d+$/i, '')
    .replace(/\s*Tag\s*\d+$/i, '')
    .replace(/\s*T\d+(?:\/\d+)?$/i, '')
    .replace(/\s*\(T\d+(?:\/\d+)?\)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bereinigt Jahreszahlen zur thematischen Zuordnung von Vorjahreskursen
 */
function stripYear(title) {
  return normalizeTitle(title).replace(/\b202[4-9]\b/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Mappt den langen ZSL-Behördennamen auf die kurze Anbieter-Bezeichnung
 */
function mapAnbieter(veranstalterName) {
  if (!veranstalterName) return '';
  const n = veranstalterName.toLowerCase();
  if (n.includes('stuttgart') && n.includes('schwäbisch')) return 'Stuttgart/Schwäbisch Gmünd';
  if (n.includes('regionalstelle stuttgart') || n.includes('schwäbisch gmünd')) return 'Stuttgart/Schwäbisch Gmünd';
  if (n.includes('tübingen')) return 'Tübingen';
  if (n.includes('freiburg')) return 'Freiburg';
  if (n.includes('mannheim') || n.includes('karlsruhe')) return 'Karlsruhe/Mannheim';
  if (n.includes('esslingen')) return 'Esslingen';
  return '';
}

/**
 * Mappt den Ort auf eine prägnante Kurzbezeichnung (Stadt oder 'online', bei SchiLF/Abruf '')
 */
function mapOrt(ortObj, titel, rawTerminInform) {
  const t = (titel || '').toLowerCase();
  const name = (ortObj?.name || '').toLowerCase();
  const infoKennzeichen = (rawTerminInform?.kennzeichen || '').toUpperCase();

  // 1. Echte Online-Erkennung
  if (infoKennzeichen === 'ONLINEVERANSTALTUNG' || name.includes('online') || t.startsWith('online:') || t.includes('(online)')) {
    return 'online';
  }

  // 2. Konkrete Stadt vorhanden
  if (ortObj?.stadt) {
    return ortObj.stadt;
  }

  // 3. Wenn Name vorhanden und keine Dummy-Platzhalter
  if (ortObj?.name && !ortObj.name.includes('Veranstaltung') && !ortObj.name.includes('N.N.')) {
    return ortObj.name;
  }

  // 4. SchiLF / SchnaLF / Abrufangebote an Schulen haben keinen festen Ort im LFB
  return '';
}

/**
 * Prüft, ob ein Angebot ein Abrufangebot / Dauerangebot ist
 */
function checkIsAbruf(ev) {
  if (!ev) return false;
  const typ = (ev.veranstaltungstyp || '').toLowerCase();
  const titel = (ev.titel || '').toLowerCase();
  return typ.startsWith('abruf') || titel.startsWith('abruf') || !ev.beginn;
}

/**
 * Berechnet die semantische Dauer (ganztags, nachmittags, n. Absprache, Reihe)
 */
function mapDauer(beginn, ende, typ, titel, isSeries = false) {
  const t = (titel || '').toLowerCase();
  const typLower = (typ || '').toLowerCase();
  if (typLower.startsWith('abruf') || t.startsWith('abruf') || !beginn || (beginn && beginn.includes('2026-12-31'))) {
    return 'n. Absprache';
  }
  if (isSeries) {
    return 'Reihe';
  }
  if (!beginn || !ende) return 'n. Absprache';

  const start = new Date(beginn);
  const end = new Date(ende);
  const diffHours = (end - start) / (1000 * 60 * 60);
  const startHour = start.getHours();

  if (diffHours >= 5) return 'ganztags';
  if (startHour >= 12) return 'nachmittags';
  return 'ganztags';
}

/**
 * Heuristische Schlagwort-Generierung für neue Fortbildungen
 */
function generateTags(titel, inhalt, ziel) {
  const text = `${titel || ''} ${inhalt || ''} ${ziel || ''}`.toLowerCase();
  const tags = new Set();

  if (text.includes('ki') || text.includes('künstliche intelligenz')) tags.add('KI');
  if (text.includes('abitur') || text.includes('prüfung')) tags.add('Prüfung');
  if (text.includes('berufliches gymnasium') || text.includes(' bg ') || text.includes('bg/bo')) tags.add('BG');
  if (text.includes('berufskolleg') || text.includes(' bk ')) tags.add('BK');
  if (text.includes('2bfs') || text.includes(' bfs ')) tags.add('BFS');
  if (text.includes('barcamp')) tags.add('Barcamp');
  if (text.includes('lesson study')) tags.add('Lesson Study');
  if (text.includes('dgue')) tags.add('DGUE');
  if (text.includes('netzwerk') || text.includes('fachschaftsvorsitz')) tags.add('Netzwerk');
  if (text.includes('arbeitsheft') || text.includes('mathe-arbeitsheft')) tags.add('Mathe-Arbeitsheft');
  if (text.includes('begleitung') || text.includes('beratung')) tags.add('Begleitung');

  return Array.from(tags);
}

/**
 * Erzeugt eine bereinigte Kurzbeschreibung aus den Rohdaten
 */
function createDefaultKurzbeschreibung(event) {
  let rawText = (event.ziel || event.inhalt || '').trim();
  if (!rawText) return { text: '', bild: '' };

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Wenn Aufzählungspunkte nach "Die Teilnehmenden" folgen, sauber mit Semikolon verbinden:
  if (lines.length > 1 && /^die teilnehmenden\s*:?$/i.test(lines[0])) {
    const bullets = lines.slice(1).map(l => l.replace(/^[-\t*•]\s*/, '').trim());
    const text = 'Die Teilnehmenden ' + bullets.join('; ') + '.';
    return {
      text: text.slice(0, 450) + (text.length > 450 ? '...' : ''),
      bild: ''
    };
  }

  const clean = rawText
    .replace(/^die teilnehmenden\s*:\s*/i, 'Die Teilnehmenden ')
    .replace(/^[-\t*•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text: clean.slice(0, 450) + (clean.length > 450 ? '...' : ''),
    bild: ''
  };
}

/**
 * Haupttransformations-Funktion
 */
function transform({ crawledEvents, existingData, schuljahr = '26/27' }) {
  // 0. Filtern nach Schuljahr
  let filteredEvents = crawledEvents;
  if (schuljahr === '26/27' || schuljahr === '2026/2027') {
    filteredEvents = crawledEvents.filter(ev => {
      if (!ev.beginn) return true; // Abruf / Dauerangebot
      const d = ev.beginn.slice(0, 10);
      if (d.startsWith('2026-12-31')) return true;
      if (d >= '2026-08-01' && d <= '2027-07-31') return true;
      return false;
    });
  } else if (schuljahr === '25/26' || schuljahr === '2025/2026') {
    filteredEvents = crawledEvents.filter(ev => {
      if (!ev.beginn) return true;
      const d = ev.beginn.slice(0, 10);
      if (d.startsWith('2026-12-31')) return true;
      if (d >= '2025-08-01' && d <= '2026-07-31') return true;
      return false;
    });
  }

  // Bestehende manuelle Einträge indizieren
  const existingByTnr = new Map();
  const existingByTitle = new Map();
  const advisoryItems = {
    abrufangebote: [],
    individuell: []
  };

  if (existingData) {
    for (const [category, items] of Object.entries(existingData)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const normTitle = normalizeTitle(item.titel);
        existingByTitle.set(normTitle, { category, item });

        // Optionaler Alias (z. B. bei abweichenden/abgekürzten Titeln in LFB)
        if (item.alias) {
          existingByTitle.set(normalizeTitle(item.alias), { category, item });
        }

        // Reine Beratungs- und Sonderangebote merken
        if (item.ohneLfb === true || category === 'individuell') {
          advisoryItems[category] = advisoryItems[category] || [];
          advisoryItems[category].push(item);
        }

        // Optional TNR(s) für präzisen Abgleich
        if (item.tnr) {
          existingByTnr.set(item.tnr, { category, item });
        }
        if (Array.isArray(item.tnrs)) {
          for (const t of item.tnrs) {
            existingByTnr.set(t, { category, item });
          }
        }
        // Rückwärtskompatibilität für alte zielinfos mit termine-Objekten
        if (Array.isArray(item.termine)) {
          if (item.termine.length === 0 && (category === 'abrufangebote' || category === 'individuell')) {
            advisoryItems[category] = advisoryItems[category] || [];
            if (!advisoryItems[category].includes(item)) {
              advisoryItems[category].push(item);
            }
          }
          for (const t of item.termine) {
            if (t.tnr) {
              existingByTnr.set(t.tnr, { category, item, termin: t });
            }
          }
        }
      }
    }
  }

  // 1. Erkennung von Reihen und modularen Angeboten
  const modulreihenGroups = new Map();
  const seriesGroups = new Map();
  const standaloneEvents = [];

  for (const ev of filteredEvents) {
    // A. Modulreihen mit einzeln buchbaren Terminen (Marker: LFB-Stichwort 'impulsreihe' oder 'modulreihe')
    const stichworte = (ev.raw?.stichworte || []).map(s => s.trim().toLowerCase());
    const isModulreihe = stichworte.includes('impulsreihe') || stichworte.includes('modulreihe');
    const vId = ev.raw?.veranstaltung?.id;

    if (isModulreihe && vId) {
      if (!modulreihenGroups.has(vId)) {
        const vTitle = ev.raw?.veranstaltung?.titel 
          ? normalizeTitle(ev.raw.veranstaltung.titel)
          : normalizeTitle(ev.titel);
        modulreihenGroups.set(vId, {
          title: vTitle,
          events: []
        });
      }
      modulreihenGroups.get(vId).events.push(ev);
      continue;
    }

    // B. Klassische zusammenhängende Reihen (T1, T2, T3 bzw. Teil 1, Teil 2, T1/2, Tag 1)
    const tMatch = ev.titel.match(/^(?:Online:\s*)?(.+?)\s*(?:\((?:T|Teil)\s*(\d+)\)|(?:Teil|Tag)\s*(\d+)|T(\d+)(?:\/\d+)?|\(T(\d+)\)|Teil(\d+))$/i);
    if (tMatch) {
      const baseTitle = normalizeTitle(tMatch[1]);
      const partNum = parseInt(tMatch[2] || tMatch[3] || tMatch[4] || tMatch[5] || tMatch[6], 10);
      const seriesKey = ev.raw?.veranstaltung?.id 
        ? `v_${ev.raw.veranstaltung.id}`
        : `${baseTitle}_${ev.ort?.stadt || 'online'}`;

      if (!seriesGroups.has(seriesKey)) {
        seriesGroups.set(seriesKey, { baseTitle, parts: [] });
      }
      seriesGroups.get(seriesKey).parts.push({ partNum, ev });
    } else {
      standaloneEvents.push(ev);
    }
  }

  // Verarbeitete Veranstaltungen
  const groupedCourses = new Map();

  function getOrCreateCourse(baseTitle, sampleEvent, isAbruf) {
    // Bevorzuge Title-Match, falls der Kurstitel bereits in existingData existiert
    let titleMatch = existingByTitle.get(baseTitle);
    if (!titleMatch) {
      const baseNoYear = stripYear(baseTitle);
      for (const [eTitle, entry] of existingByTitle.entries()) {
        if (stripYear(eTitle) === baseNoYear) {
          titleMatch = entry;
          break;
        }
      }
    }
    const tnrMatch = sampleEvent?.terminnummer ? existingByTnr.get(sampleEvent.terminnummer) : null;
    const existing = titleMatch || tnrMatch;

    const key = existing?.item?.titel ? normalizeTitle(existing.item.titel) : baseTitle;

    if (!groupedCourses.has(key)) {
      let titel = existing?.item?.titel || baseTitle;
      // Bei Jahreskursen wie Fachtag Netzwerk den aktuellen LFB-Titel nutzen
      if (sampleEvent.titel?.toLowerCase().includes('fachtag')) {
        titel = normalizeTitle(sampleEvent.titel);
      }

      const kurzbeschreibung = existing?.item?.kurzbeschreibung || createDefaultKurzbeschreibung(sampleEvent);
      const tags = existing?.item?.tags || generateTags(sampleEvent.titel, sampleEvent.inhalt, sampleEvent.ziel);

      let targetCategory = 'zentraleFortbildungen';
      if (isAbruf) {
        targetCategory = 'abrufangebote';
      } else if (existing?.category) {
        targetCategory = existing.category;
      } else if (sampleEvent.titel?.toLowerCase().includes('fachtag') || sampleEvent.titel?.toLowerCase().includes('kolloquium')) {
        targetCategory = 'zentraleFortbildungen';
      } else if (sampleEvent.veranstalter?.includes('Regionalstelle') && !sampleEvent.titel?.includes('Abitur')) {
        targetCategory = 'regionaleFortbildungen';
      }

      groupedCourses.set(key, {
        category: targetCategory,
        course: {
          titel,
          kurzbeschreibung,
          tags,
          termine: []
        }
      });
    }
    return groupedCourses.get(key);
  }

  // A. Modulreihen einsortieren (z. B. Impulsreihe mit einzeln buchbaren Modulen)
  for (const group of modulreihenGroups.values()) {
    group.events.sort((a, b) => (a.beginn || '').localeCompare(b.beginn || ''));
    const primary = group.events[0];
    const isAbruf = checkIsAbruf(primary);

    const courseObj = getOrCreateCourse(group.title, primary, isAbruf);

    for (const ev of group.events) {
      let thema = '';
      const dashIdx = ev.titel.indexOf(' - ');
      if (dashIdx !== -1) {
        thema = ev.titel.slice(dashIdx + 3).trim();
      }

      courseObj.course.termine.push({
        anbieter: mapAnbieter(ev.veranstalter),
        tnr: ev.terminnummer,
        erster_termin: ev.beginn ? ev.beginn.slice(0, 10) : '',
        dauer: mapDauer(ev.beginn, ev.ende, ev.veranstaltungstyp, ev.titel, false),
        ort: mapOrt(ev.ort, ev.titel, ev.raw?.terminInform),
        thema: thema,
        reihe_je_termin: []
      });
    }
  }

  // B. Klassische Reihen-Gruppen einsortieren
  for (const { baseTitle, parts } of seriesGroups.values()) {
    // Sortiere nach Teilnummer T1, T2, ...
    parts.sort((a, b) => a.partNum - b.partNum);
    const primary = parts[0].ev;
    const isAbruf = checkIsAbruf(primary);

    const courseObj = getOrCreateCourse(baseTitle, primary, isAbruf);

    // Folgetermine für reihe_je_termin zusammenstellen
    const reiheJeTermin = [];
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].ev;
      reiheJeTermin.push({
        termin: p.beginn ? p.beginn.slice(0, 10) : '',
        dauer: mapDauer(p.beginn, p.ende, p.veranstaltungstyp, p.titel, false),
        ort: mapOrt(p.ort, p.titel, p.raw?.terminInform)
      });
    }

    courseObj.course.termine.push({
      anbieter: mapAnbieter(primary.veranstalter),
      tnr: primary.terminnummer,
      erster_termin: primary.beginn ? primary.beginn.slice(0, 10) : '',
      dauer: mapDauer(primary.beginn, primary.ende, primary.veranstaltungstyp, primary.titel, reiheJeTermin.length > 0),
      ort: mapOrt(primary.ort, primary.titel, primary.raw?.terminInform),
      reihe_je_termin: reiheJeTermin
    });
  }

  // C. Einzelveranstaltungen & Parallelangebote einsortieren
  for (const ev of standaloneEvents) {
    const isAbruf = checkIsAbruf(ev);
    const baseTitle = normalizeTitle(ev.titel);

    const courseObj = getOrCreateCourse(baseTitle, ev, isAbruf);

    courseObj.course.termine.push({
      anbieter: mapAnbieter(ev.veranstalter),
      tnr: ev.terminnummer,
      erster_termin: ev.beginn ? ev.beginn.slice(0, 10) : '',
      dauer: mapDauer(ev.beginn, ev.ende, ev.veranstaltungstyp, ev.titel, false),
      ort: mapOrt(ev.ort, ev.titel, ev.raw?.terminInform),
      reihe_je_termin: []
    });
  }

  // Termine in jedem Kurs chronologisch sortieren
  for (const { course } of groupedCourses.values()) {
    if (Array.isArray(course.termine)) {
      course.termine.sort((a, b) => (a.erster_termin || '').localeCompare(b.erster_termin || ''));
    }
  }

  // 3. Ergebnis-Objekt nach Kategorien aufbauen
  const result = {
    zentraleFortbildungen: [],
    regionaleFortbildungen: [],
    abrufangebote: [],
    individuell: []
  };

  for (const { category, course } of groupedCourses.values()) {
    if (result[category]) {
      result[category].push(course);
    } else {
      result.zentraleFortbildungen.push(course);
    }
  }

  // Reine Beratungsangebote ohne TNR aus existingData wieder anhängen (z.B. Begleitung von Fachschaften, Individuelle Begleitung)
  for (const [cat, items] of Object.entries(advisoryItems)) {
    for (const item of items) {
      if (!result[cat].some(c => c.titel === item.titel)) {
        result[cat].push({
          titel: item.titel,
          kurzbeschreibung: item.kurzbeschreibung || { text: '', bild: '', link: '' },
          tags: item.tags || [],
          termine: []
        });
      }
    }
  }

  // Sortierung der Kurse nach Titel
  for (const cat of Object.keys(result)) {
    result[cat].sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
  }

  return result;
}

// Hauptfunktion
function main() {
  const { values } = parseArgs({ options, allowPositionals: true });

  if (values.help) {
    console.log(`
LFB-Online Zielinfos-Generator & Transformer
============================================

Verwendung:
  node transform-zielinfos.js [Optionen]

Optionen:
  -i, --input <file>     Gecrawlte Eingabedatei (Standard: "veranstaltungen.json")
  -e, --existing <file>  Redaktionelle Vorlage / weitere Angebote (Standard: "weitere-angebote.json")
  -o, --output <file>    Zieldatei (Standard: "sj2627.json")
  -h, --help             Diese Hilfe anzeigen
`);
    process.exit(0);
  }

  const inputFile = path.resolve(process.cwd(), values.input);
  let existingFile = path.resolve(process.cwd(), values.existing);
  if (!fs.existsSync(existingFile) && values.existing === 'weitere-angebote.json') {
    const fallback = path.resolve(process.cwd(), 'zielinfos.json');
    if (fs.existsSync(fallback)) {
      existingFile = fallback;
    }
  }

  const outputFile = path.resolve(process.cwd(), values.output);

  if (!fs.existsSync(inputFile)) {
    console.error(`[Fehler] Eingabedatei nicht gefunden: ${inputFile}`);
    console.error('Bitte führen Sie zuerst den Crawler aus: npm run crawl');
    process.exit(1);
  }

  console.log('Lese gecrawlte Daten aus:', inputFile);
  const crawledEvents = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

  let existingData = null;
  if (fs.existsSync(existingFile)) {
    console.log('Lese bestehende Vorlage aus:', existingFile);
    try {
      existingData = JSON.parse(fs.readFileSync(existingFile, 'utf-8'));
    } catch (e) {
      console.warn('[Warnung] Konnte bestehende Datei nicht parsen, generiere neu:', e.message);
    }
  }

  const schuljahr = values.schuljahr || '26/27';
  console.log(`Transformiere Termine für Schuljahr ${schuljahr} (aus insgesamt ${crawledEvents.length} Terminen)...`);
  const transformed = transform({ crawledEvents, existingData, schuljahr });

  const stats = Object.entries(transformed)
    .map(([cat, list]) => `${cat}: ${list.length} Kurse`)
    .join(', ');
  console.log('Ergebnis-Statistik:', stats);

  const json = JSON.stringify(transformed, null, 2);
  fs.writeFileSync(outputFile, json, 'utf-8');
  console.log(`Gespeichert in: ${outputFile} (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB)`);
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    transform,
    normalizeTitle,
    mapAnbieter,
    mapOrt,
    mapDauer,
    generateTags
  };
}
