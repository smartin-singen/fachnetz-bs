# \<bubble-navigation>

Interaktive, responsive Bubble-Navigation als Web Component (Lit) für Fachnetz / Moodle.

Stellt hierarchisch gegliederte Themen- und Navigationsblöcke in einem zweispaltigen Masonry-Layout dar, inklusive dynamischer Filterung nach Schularten und responsivem Umbruch auf Mobilgeräten.

---

## Features

- **2-Spalten Masonry Grid:** Dynamische, lückenlose Anordnung von Gruppen unterschiedlicher Höhe mittels CSS Grid (`grid-auto-flow: dense`).
- **Vollständig responsiv:** Schaltet unterhalb von 500px automatisch (Container Query / Media Query) auf ein 1-spaltiges Layout um.
- **Schularten-Filter:** Integrierter Dropdown-Filter zur Umschaltung verlinkter Zielseiten je nach ausgewählter Schulart (inkl. Persistierung in `sessionStorage`).
- **Einfache Einbindung:** Datenübergabe direkt als JSON im Slot des Custom Elements.

---

## Installation

```bash
npm install bubble-navigation
```

---

## Verwendung

### 1. Verwendung mit Build-System (z. B. Vite, Rollup, Webpack)

```javascript
import { BubbleNavigation } from 'bubble-navigation';

if (!customElements.get('bubble-navigation')) {
  window.customElements.define('bubble-navigation', BubbleNavigation);
}
```

### 2. Direkte Einbindung per CDN (z. B. in Moodle)

Ohne Installationsaufwand direkt im Browser über jsDelivr:

```html
<script type="module">
  import { BubbleNavigation } from 'https://cdn.jsdelivr.net/npm/bubble-navigation@0.10.0/+esm';
  if (!customElements.get('bubble-navigation')) {
    window.customElements.define('bubble-navigation', BubbleNavigation);
  }
</script>

<style>
  :not(:defined) {
    visibility: hidden;
  }
</style>

<bubble-navigation style="max-width: 560px;">
{
  "types": {
    "bs": "Berufsschule",
    "bfs": "Berufsfachschule",
    "bk": "Berufskolleg",
    "bg": "Berufliches Gymnasium"
  },
  "groups": [
    [
      {
        "id": "austausch",
        "label": "Austausch",
        "color": "rgb(207, 153, 197)",
        "size": "large",
        "links": {
          "alle": "https://example.org/austausch"
        }
      },
      {
        "id": "sprechstunden",
        "label": "Sprechstunden",
        "color": "rgb(207, 153, 197)",
        "links": {
          "alle": "https://example.org/sprechstunden"
        }
      }
    ],
    [
      {
        "id": "unterricht",
        "label": "Unterricht",
        "color": "rgb(169, 204, 227)",
        "size": "large",
        "links": {
          "bg": "https://example.org/unterricht/bg",
          "bk": "https://example.org/unterricht/bk",
          "alle": "https://example.org/unterricht"
        }
      }
    ]
  ]
}
</bubble-navigation>
```

---

## JSON-Datenstruktur

| Feld | Typ | Beschreibung |
|---|---|---|
| `types` | `Record<string, string>` | Schlüssel-Wert-Paare der auswählbaren Schularten für das Dropdown-Menü. |
| `groups` | `Bubble[][]` | Zweidimensionales Array: Jedes Element ist eine Gruppe verbundener Bubbles (Spaltenblock). |

### Bubble-Objekt

| Eigenschaft | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `id` | `string` | Ja | Eindeutige Kennung des Knotens. |
| `label` | `string` | Ja | Beschriftungstext (HTML wie `<br>` ist erlaubt). |
| `color` | `string` | Ja | Hintergrundfarbe als CSS-Farbwert (z. B. Hex, `rgb(...)` oder `hsl(...)`). |
| `size` | `'small' \| 'large'` | Nein | Standard ist `large` für Wurzelknoten, `small` für kompakte Boxen. |
| `indent` | `'yes' \| 'no'` | Nein | Standard ist eingerückt (`yes`); `no` positioniert den Knoten linksbündig. |
| `links` | `Record<string, string>` | Nein | Map von Schulart-IDs auf Ziel-URLs. Der Schlüssel `"alle"` dient als Fallback. |

---

## Entwicklung

```bash
# Entwicklungsserver mit TypeScript-Watch und Web Dev Server starten
npm start

# Produktions-Bundle kompilieren
npm run build

# TypeScript Typ-Prüfung ohne Emit
npm run check

# Code-Formatierung (Prettier)
npm run format
npm run lint
```
