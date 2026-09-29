#!/usr/bin/env node

/**
 * Erzeugt eine eigenständige, interaktive HTML-Vorschau (preview.html)
 * aus einer aggregierten JSON-Datei (z. B. fortbildungen.json oder zielinfos.json) und darstellung.js.
 * 
 * Vorteil: Funktioniert direkt per Doppelklick im Browser ohne CORS-Probleme!
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const { generateHTMLFromJSON } = require('./darstellung.js');

const options = {
    input: {
        type: 'string',
        short: 'i'
    },
    output: {
        type: 'string',
        short: 'o',
        default: 'preview.html'
    },
    title: {
        type: 'string',
        short: 't',
        default: 'LFB Fortbildungsangebote – Vorschau Schuljahr 26/27'
    },
    help: {
        type: 'boolean',
        short: 'h',
        default: false
    }
};

function printHelp() {
    console.log(`
LFB-Online HTML-Vorschau-Generator (build-preview.js)
=====================================================

Verwendung:
  node build-preview.js [Eingabedatei.json] [Optionen]

Optionen:
  -i, --input <file>   Eingabedatei (z. B. fortbildungen.json oder zielinfos.json)
  -o, --output <file>  HTML-Ausgabedatei (Standard: "preview.html")
  -t, --title <string> Titelzeile in der HTML-Vorschau
  -h, --help           Diese Hilfe anzeigen

Beispiele:
  node build-preview.js fortbildungen.json
  node build-preview.js -i fortbildungen.json -o preview.html
  node build-preview.js --input zielinfos.json
`);
}

const { values, positionals } = parseArgs({ options, allowPositionals: true });

if (values.help) {
    printHelp();
    process.exit(0);
}

// Eingabedatei ermitteln: 1. Flag -i/--input, 2. Erstes Positional-Argument, 3. Fallbacks
let inputFile = values.input || positionals[0];
if (!inputFile) {
    if (fs.existsSync(path.join(__dirname, 'fortbildungen.json'))) {
        inputFile = 'fortbildungen.json';
    } else if (fs.existsSync(path.join(__dirname, 'weitere-angebote.json'))) {
        inputFile = 'weitere-angebote.json';
    } else if (fs.existsSync(path.join(__dirname, 'zielinfos.json'))) {
        inputFile = 'zielinfos.json';
    } else {
        inputFile = 'fortbildungen.json';
    }
}

const jsonPath = path.isAbsolute(inputFile) ? inputFile : path.join(__dirname, inputFile);
const outputPath = path.isAbsolute(values.output) ? values.output : path.join(__dirname, values.output);

if (!fs.existsSync(jsonPath)) {
    console.error(`Fehler: Eingabedatei "${jsonPath}" existiert nicht!`);
    console.error(`Bitte gib eine gültige JSON-Datei an (z. B. "node build-preview.js fortbildungen.json").`);
    process.exit(1);
}

console.log(`Lese Fortbildungsdaten aus: ${jsonPath}`);
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const darstellungJsCode = fs.readFileSync(path.join(__dirname, 'darstellung.js'), 'utf8');

const htmlContent = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${values.title}</title>
    <!-- Bootstrap 5 CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
    <style>
        body {
            background-color: #f4f6f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #333;
        }

        .preview-header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 2rem 0;
            margin-bottom: 2rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .lfb-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }

        /* Filter-Leiste (Sticky) */
        .filter-card {
            position: -webkit-sticky;
            position: sticky;
            top: 15px;
            z-index: 1020;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border: 1px solid #e2e8f0;
            margin-bottom: 2rem;
        }

        /* Tabellen-Design */
        table.lfb {
            border-collapse: collapse;
            background: white;
            border-radius: 6px;
            overflow: hidden;
        }
        .lfb th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
        }
        .lfb td {
            border-bottom: 1px solid #f1f5f9;
        }
        .lfb tr:hover {
            background-color: #f8fafc;
        }

        /* Karten */
        .lfb-thema {
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            border: 1px solid #e9ecef !important;
        }
        .lfb-thema:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06) !important;
        }

        /* Loader Animation */
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #2a5298;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            animation: spin 0.8s linear infinite;
            display: none;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .category-heading {
            font-weight: 700;
            color: #1e293b;
            border-bottom: 3px solid #2a5298;
            padding-bottom: 0.5rem;
            margin-top: 2.5rem;
            margin-bottom: 1.5rem;
        }
    </style>
</head>
<body>

    <header class="preview-header">
        <div class="lfb-container">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <h1 class="h3 mb-1 font-weight-bold">Mathematik an beruflichen Schulen</h1>
                    <p class="mb-0 text-white-50">Fortbildungsangebote für das Schuljahr 2026/2027 (Vorschau & Testumgebung)</p>
                </div>
                <div class="badge bg-light text-dark p-2 fs-6">
                    Datenquelle: ${path.basename(jsonPath)}
                </div>
            </div>
        </div>
    </header>

    <main class="lfb-container mb-5" id="fortbildungsuebersicht">
        <!-- Interaktive Filterleiste -->
        <div class="filter-card p-3 p-md-4">
            <div class="row g-3 align-items-end">
                <div class="col-12 col-md-3">
                    <label for="anbieter-filter" class="form-label fw-bold small text-muted">Region</label>
                    <select id="anbieter-filter" class="form-select form-select-sm" onchange="applyFilters()">
                        <option value="">Alle Regionen</option>
                    </select>
                </div>
                <div class="col-12 col-md-3">
                    <label for="ort-filter" class="form-label fw-bold small text-muted">Ort / Format</label>
                    <select id="ort-filter" class="form-select form-select-sm" onchange="applyFilters()">
                        <option value="">Alle Orte</option>
                    </select>
                </div>
                <div class="col-12 col-md-3">
                    <label for="tag-filter" class="form-label fw-bold small text-muted">Themen-Tag</label>
                    <select id="tag-filter" class="form-select form-select-sm" onchange="applyFilters()">
                        <option value="">Alle Tags</option>
                    </select>
                </div>
                <div class="col-12 col-md-3">
                    <label for="such-filter" class="form-label fw-bold small text-muted">Volltextsuche</label>
                    <input type="search" id="such-filter" class="form-control form-control-sm" placeholder="Stichwort, Ort, LFB-Nr..." oninput="applyFilters()">
                </div>
            </div>

            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3 pt-3 border-top">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="show-completed" onchange="applyFilters()">
                    <label class="form-check-label small" for="show-completed">
                        Abgelaufene Termine anzeigen
                    </label>
                </div>
                <div class="d-flex gap-2 align-items-center">
                    <div id="loader" class="loader"></div>
                    <button class="btn btn-sm btn-outline-secondary" onclick="resetFilters()">Filter zurücksetzen</button>
                    <button class="btn btn-sm btn-outline-primary" onclick="generateLink()">Link merken</button>
                </div>
            </div>
        </div>

        <!-- Container für Fortbildungsinhalte -->
        <div id="fortbildungen-container">
            <!-- Dynamisch befüllt -->
        </div>
    </main>

    <!-- Embedded darstellung.js Logik -->
    <script>
${darstellungJsCode}
    </script>

    <!-- Embedded Data & Initialisierung -->
    <script>
        const embeddedData = ${JSON.stringify(data)};
        fortbildungData = embeddedData;

        window.addEventListener('DOMContentLoaded', () => {
            populateFilters(fortbildungData);
            applyFilters();
        });
    </script>
</body>
</html>`;

fs.writeFileSync(outputPath, htmlContent, 'utf8');
console.log(`Erfolgreich generiert: ${outputPath} (${(Buffer.byteLength(htmlContent) / 1024).toFixed(1)} KB)`);
