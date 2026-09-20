# Profile Merge – Moodle Local Plugin

Ein Moodle-Plugin zum Zusammenführen von Benutzerprofilen.

## Installation

1. Verzeichnis nach `moodle/local/profilemerge` kopieren
2. Moodle-Admin-Seite aufrufen → Plugin wird automatisch installiert

## Plugin-Typ

`local` – Allgemeines Verwaltungs-Plugin ohne feste Zuordnung zu einer Moodle-Komponente.

## Ordnerstruktur

```
moodle-profile-merge/
├── amd/src/              # JavaScript (AMD-Module)
├── classes/              # PHP-Klassen (PSR-4 Autoloading)
│   ├── form/             # Moodle-Formulare (moodleform)
│   └── privacy/          # DSGVO / Privacy API
├── db/                   # Datenbank-Schema & Berechtigungen
├── lang/                 # Sprachdateien
│   ├── de/               # Deutsch
│   └── en/               # Englisch
├── templates/            # Mustache-Templates
├── tests/                # PHPUnit-Tests
├── index.php             # Hauptseite
├── lib.php               # Globale Hooks (von Moodle geladen)
├── locallib.php          # Interne Hilfsfunktionen
├── settings.php          # Admin-Einstellungen
└── version.php           # Plugin-Metadaten & Version
```

## Entwicklung

- PHP-Klassen in `classes/` werden per PSR-4 automatisch geladen
- Sprachstrings immer über `get_string()` laden
- Datenbank-Änderungen über XMLDB (`db/install.xml`) + Upgrade-Schritte (`db/upgrade.php`)
