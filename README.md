# Checklisten-Board

Konfigurierbares Checklisten-Board für Teams: Admin-Backend zur Pflege der Checklisten, mobile Nutzersicht zum Abhaken mit Kommentaren (auch per Sprache), Reports mit KI-Zusammenfassung, digitaler Unterschrift und automatisch ermitteltem Ort.

## Schnellstart

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY eintragen
npm run build && npm start   # oder: npm run dev
```

Dann http://localhost:3000 öffnen. Beim ersten Start werden angelegt:

| Konto | E-Mail | Passwort |
|---|---|---|
| Administrator | admin@example.com (`ADMIN_EMAIL`) | admin (`ADMIN_PASSWORD`) |
| Demo-Nutzer | max@example.com | demo |

Dazu eine Beispiel-Checkliste „Baustellenabnahme“ (abschaltbar mit `SEED_DEMO=false`). Passwörter bitte nach dem ersten Login ändern.

## Wichtig für den Betrieb

- **HTTPS ist Pflicht** auf dem Smartphone: Standort und Mikrofon funktionieren in Browsern nur über HTTPS (oder localhost).
- **Spracheingabe** nutzt die Spracherkennung des Browsers (Safari auf iOS/macOS, Chrome, Edge). Firefox unterstützt sie nicht; dort bleibt die Diktierfunktion der Tastatur.
- **KI** (Claude API, Modell über `ANTHROPIC_MODEL`, Standard `claude-opus-5-5`): Ohne `ANTHROPIC_API_KEY` läuft die App weiter, zeigt dann keine KI-Erklärungen, übernimmt Sprachnotizen unverändert und erstellt eine einfache automatische Zusammenfassung.
- **Ortsauflösung** (Koordinaten → Adresse) über OpenStreetMap Nominatim, serverseitig. Für viel Last einen eigenen Dienst über `GEOCODER_URL` eintragen.
- **Daten** liegen in SQLite unter `data/checklisten.db` (`DATABASE_PATH`). Für Backups reicht diese Datei.

## Funktionen

**Verwaltung (/admin)**
- Checklisten pro Anwendungsfall anlegen, in Abschnitte/Arbeitsphasen gliedern, sortieren, aktiv/inaktiv schalten
- Eigene Beschreibung je Abschnitt und Punkt; sonst KI-Erklärung (vorab erzeugbar oder beim ersten Antippen)
- Nutzer verwalten, Standard-Checkliste vorwählen, Schalter „Nur diese Checkliste erlauben“
- Alle Reports mit Filter nach Zeitraum, Nutzer, Checkliste, Status und Freitext; Detailansicht druck-/PDF-fähig

**Nutzersicht (/app)**
- Erster Abschnitt aufgeklappt, weitere eingeklappt; beim Fortsetzen öffnet sich der Abschnitt, an dem es weitergeht
- „i“-Symbol an Abschnitten und Punkten
- Abhaken mit optionalem Kommentar per Tastatur oder Sprache; Sprache wird per KI zu sauberem Text aufbereitet und vor Übernahme geprüft
- Jede Eingabe wird sofort gespeichert, Unterbrechen und Fortsetzen jederzeit möglich
- Report: Start, Ende, Dauer, KI-Zusammenfassung (korrigierbar), Ort (automatisch, nur bestätigbar), Unterschrift mit Datum und Ort
- „Herkunft der Angaben“: welche Werte automatisch ermittelt und welche manuell eingegeben oder geändert wurden

Unterschriebene Reports speichern eine eingefrorene Kopie der Checkliste, spätere Änderungen an der Checkliste verändern sie nicht.

## Technik

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · SQLite (better-sqlite3) · Anthropic SDK
