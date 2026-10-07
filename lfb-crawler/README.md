# LFB-Online Crawler & Fortbildungsportal

Node.js Crawler und Darstellungs-Engine für das Lehrerfortbildungsportal Baden-Württemberg (**LFB-Online**, `https://lfbo.kultus-bw.de`).

Der Crawler sucht automatisch nach Fortbildungen (z. B. nach dem Stichwort `LFTMath319!` für Begleitveranstaltungen zum Projekt **Mathe-Arbeitsheft** bzw. Mathematik an beruflichen Schulen), ermittelt alle zugehörigen Veranstaltungstermine, ruft die jeweiligen Detailseiten und Kontakte ab und exportiert die aggregierten Daten als strukturiertes JSON.

Mit **`darstellung.js`**, **`loader.html`** und **`build-preview.js`** werden die Fortbildungsangebote responsiv aufbereitet – inklusive dynamischer Filter (Region, Ort/Format, Themen-Tags, Volltextsuche) sowie teilbaren Direktlinks für Moodle.

---

## Voraussetzungen

- Node.js (ab Version 18+, empfohlen 22+)
- Google Chrome (nur erforderlich für den optionalen `--browser`-Modus)

---

## Installation

```bash
cd lfb-crawler
npm install
```

---

## Workflow-Übersicht

```text
1. Crawlen          crawl-lfb.js            -> veranstaltungen.json
2. Transformieren   transform-zielinfos.js  -> sj2627.json
3. Lokale Vorschau  build-preview.js        -> preview.html
4. Moodle-Export    darstellung.js + loader.html (über Moodle-Ressource)
```

---

## Verwendung

### 1. Daten crawlen (Nativer API-Modus)

Durchsucht LFB-Online und speichert alle Termine in `veranstaltungen.json`:

```bash
npm run crawl
# oder direkt:
node crawl-lfb.js
```

#### Mehrere Suchbegriffe gleichzeitig
Sie können mehrere Stichworte angeben (z. B. für verschiedene Fächer oder Begleitreihen). Der Crawler führt alle Suchen aus und dedupliziert die Termine automatisch anhand der Terminnummer:

```bash
# Mehrfachangabe mit -q:
node crawl-lfb.js -q "LFTMath319!" -q "Mathematik"

# Kommagetrennt:
node crawl-lfb.js --query "LFTMath319!, Neurobiologie, Problemlösen"

# Als direkte Argumente:
node crawl-lfb.js LFTMath319! Mathematik
```

#### Browser-Automatisierungsmodus (Puppeteer)
Öffnet Google Chrome im Headless-Modus, tippt den Suchbegriff ein und navigiert durch die Weboberfläche:

```bash
npm run crawl:browser
# oder:
node crawl-lfb.js --browser
```

#### Optionen & Flags für den Crawler

| Option | Kurz | Standard | Beschreibung |
|---|---|---|---|
| `--query <text>` | `-q` | `LFTMath319!` | Suchbegriff (mehrfach angebbar, kommagetrennt oder positionell) |
| `--output <datei>` | `-o` | `veranstaltungen.json` | Pfad zur JSON-Ausgabedatei |
| `--limit <zahl>` | `-l` | *(alle)* | Maximale Anzahl der abzurufenden Termine |
| `--concurrency <zahl>` | `-c` | `5` | Parallele Detail-Anfragen (nur API-Modus) |
| `--browser` | | `false` | Puppeteer-Browsersteuerung verwenden |
| `--stdout` | | `false` | Reines JSON auf stdout ausgeben (z. B. für Pipes in `jq`) |
| `--help` | `-h` | | Hilfe anzeigen |

---

### 2. Daten transformieren & anreichern

Führt semantische Bereinigungen durch, aggregiert modulare Reihen (Impulsreihen) und bündelt regionale Parallelangebote. Verbindet die gecrawlten LFB-Termine mit den redaktionellen Kurzbeschreibungen und didaktischen Tags aus `weitere-angebote.json`:

```bash
# Standard: erzeugt fortbildungen.json (LFTMath319!) und angebote.json (LFSMath319!):
npm run transform

# Gezielt einzelne Dateien erzeugen:
npm run transform:fortbildungen
npm run transform:angebote

# Oder mit individuellem Stichwort / Zieldatei:
node transform-zielinfos.js -q "LFTMath319!" -o fortbildungen.json
node transform-zielinfos.js -q "LFSMath319!" -o angebote.json
node transform-zielinfos.js --stichwort "LFTMath319!"

# Termine oder Kurse ausschließen (--exclude unterstützt Mehrfachangabe):
node transform-zielinfos.js -q "LFTMath319!" --exclude "V42P6Z"
node transform-zielinfos.js -q "LFTMath319!" -x "V42P6Z, LRZE79"
```

---

### 3. Eigenständige HTML-Vorschau generieren (`preview.html`)

Erzeugt eine vollständige, interaktive HTML-Datei (`preview.html`) inklusive eingebetteter Daten und Skriptlogik. Diese kann ohne Webserver per Doppelklick im Browser geöffnet werden:

```bash
# Vorschau für sj2627.json bauen:
npm run build:preview

# Vorschau bauen und direkt im Standardbrowser öffnen:
npm run preview

# Mit individuellen Optionen:
node build-preview.js -i sj2627.json -o preview.html -t "LFB Fortbildungsangebote 2026/2027"
```

---

## Moodle-Integration & URL-Steuerung

Die Fortbildungsangebote können direkt in Moodle (z. B. in ein Text- und Medienfeld / Label oder eine Textseite) eingebunden werden.

### Komponenten

1. **`loader.html`**: Das HTML-Gerüst mit Filterleiste, Container und Lade-Spinner. Wird im Moodle-Editor (HTML-Modus) eingefügt.
2. **`darstellung.js`**: Das Rendering- und Filterskript. Wird als Datei-Ressource (`mod_resource`) in Moodle abgelegt.
3. **`fortbildungen.json` / `sj2627.json`**: Die aggregierte Datendatei. Wird ebenfalls als Datei-Ressource in Moodle abgelegt.

### Unterstützte URL-Parameter

Die Anwendung wertet beim Aufruf automatisch URL-Parameter aus `window.location.search` aus und stellt den entsprechenden Filterzustand direkt her:

| Parameter | Beispiel | Beschreibung |
|---|---|---|
| `aasuche` | `?aasuche=Geometrie` | **Volltextsuche:** Belegt das Suchfeld vor und filtert die Angebote sofort |
| `aaanbieter` | `?aaanbieter=ZSL+Regionalstelle+Stuttgart` | Filtert nach Region / Anbieter |
| `aaort` | `?aaort=Online` | Filtert nach Veranstaltungsort / Format |
| `aatag` | `?aatag=KI` | Filtert nach didaktischem Themen-Tag |
| `aacompleted` | `?aacompleted=1` | Zeigt auch abgelaufene Termine an |
| `id` | `?id=1234` | Moodle-Kurs-/Modul-ID (wird bei Direktlinks beibehalten) |
| `section` | `?section=3` | Moodle-Abschnitts-ID (wird bei Direktlinks beibehalten) |

Kombinationen sind beliebig möglich, z. B.:
```text
https://moodle.example.de/course/view.php?id=123&section=2&aasuche=Analysis&aaort=Online#fortbildungsuebersicht
```

### Teilen & Direktlinks („Link merken“)

Über die Schaltfläche **„Link merken“** in der Filterleiste wird die aktuelle URL mitsamt allen aktiven Dropdown-Filtern, der Checkbox, dem Volltext-Suchbegriff (`aasuche`) sowie dem Sprunganker `#fortbildungsuebersicht` in die Zwischenablage kopiert. Dadurch springt der Browser beim Aufruf direkt an die Übersicht.

> [!IMPORTANT]
> **Hinweis zur Moodle-Aktualisierung:**
> Wenn [darstellung.js](file:///home/holger/jdevel/fachnetz-bs/lfb-crawler/darstellung.js) aktualisiert wird, muss die neue Datei in die entsprechende Moodle-Materialaktivität hochgeladen werden.
> Beachten Sie dabei, dass Moodle intern Revisionsnummern in URLs verwendet (z. B. `/content/30/darstellung.js`). Wenn sich die Revisionsnummer nach dem Austausch ändert, muss der `<script src="...">`-Pfad im HTML-Code von [loader.html](file:///home/holger/jdevel/fachnetz-bs/lfb-crawler/loader.html) entsprechend angepasst oder der Browser-Cache geleert werden (`Strg + F5`).

---

## Datenformat

Jeder Eintrag in der JSON-Datei enthält:

- `terminnummer`: Amtliche Terminnummer (z. B. `JZKXPL`)
- `titel`: Vollständiger Titel der Fortbildung
- `url`: Direkter Link zur Terminseite auf LFB-Online
- `status`: Status der Veröffentlichung (z. B. "Freigegeben (Publiziert)")
- `veranstaltungstyp`: Art (z. B. "Ausschreibung", "Abrufveranstaltung")
- `beginn` / `ende`: Beginn- und Endzeitpunkt (ISO 8601)
- `buchbarLehrkraft` / `buchbarSchulleitung`: Buchbarkeitsstatus
- `veranstalter`: Name der veranstaltenden Institution (z. B. ZSL Regionalstelle)
- `ort`: Strukturierte Ortsangaben (Bezeichnung, Adresse, Raum, Art)
- `ziel`: Konkrete Zielsetzung der Veranstaltung
- `inhalt`: Ausführliche Inhaltsbeschreibung
- `hinweis`: Teilnahme- und Freistellungshinweise
- `zielgruppe` & `zieldienststellen`: Berechtigte Lehrkräfte und Schulen
- `faecher` & `schularten`: Zugeordnete Unterrichtsfächer und Schularten
- `inhaltsschwerpunkte` & `referenzrahmen`: Thematische Schwerpunkte
- `leitender` & `kontakte`: Leitungen und Ansprechpartner
- `raw`: Das unveränderte Originalobjekt aus dem LFB-Backend für maximale Detailtiefe
