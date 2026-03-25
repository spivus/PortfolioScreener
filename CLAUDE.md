# Portfolio Analyzer – Projektdokumentation

## Was ist das?
Eine interne Web-App für Finanzberater um Kundenportfolios hochzuladen,
zu analysieren und mit einem Musterportfolio zu vergleichen.

## Zielgruppe
Interne Finanzberater (kein öffentlicher Zugang)

## Sprache
- UI, Fehlermeldungen, KI-Antworten: **Deutsch**
- Code, Variablen, Funktionsnamen: **Englisch** (Standard-Konvention)

## Authentifizierung
- Supabase Auth (Email/Passwort)
- Jeder Berater hat einen eigenen Account
- Ein Berater kann mehrere Kunden-Portfolios verwalten

## Core Features (Reihenfolge = Priorität)
1. **Portfolio-Upload** (Excel, CSV, PDF – beliebiges Format)
   - PDF: Nur Text-PDFs (kein OCR für gescannte Dokumente)
   - Claude API extrahiert Positionen automatisch aus dem Dokument
2. **Strukturanalyse** (Währungen, Länder, Branchen, Assetklassen)
3. **Musterportfolio-Vergleich**
   - Fehlende Positionen identifizieren
   - Gewichtungsabweichungen zeigen (Über-/Untergewichtung nach Branche, Region, Assetklasse)
   - Es gibt genau **ein globales Musterportfolio** – sichtbar und editierbar für alle Berater (accountübergreifend)
   - Das Musterportfolio kann nicht gelöscht werden, nur inhaltlich bearbeitet
   - Das Musterportfolio ist gleichzeitig die Startseite/Eingangsansicht der App
4. **Marktdaten-Indikatoren** (200-Tage-Linie etc.) via Alpha Vantage
5. **KI-Chat über Portfolio** (Claude API)
6. **Geeignetheitstexte-Generator** (Claude API)

## Unterstützte Assetklassen
- Aktien, ETFs, Investmentfonds
- Anleihen, Zertifikate, strukturierte Produkte
- Grundsatz: Alles was in einem Depot vorkommen kann soll parsbar sein

## Tech Stack
- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend:** FastAPI, Python 3.11
- **Datenbank:** Supabase (PostgreSQL + Auth)
- **Marktdaten:** Alpha Vantage API
- **KI:** Claude API (Anthropic, Modell: claude-sonnet-4-20250514)
- **PDF-Parsing:** pdfplumber oder PyPDF2 (Text-Extraktion vor Claude-Aufruf)
- **Hosting:** Vercel (Frontend), Railway (Backend)

## Projektstruktur
```
/frontend        → Next.js App
/backend         → FastAPI App
CLAUDE.md        → Diese Datei (immer aktuell halten)
```

## Datenmodell

### Berater (users via Supabase Auth)
- id, email, name

### Portfolio
- id, berater_id (FK → Auth User), kunde_name, erstellt_am, aktualisiert_am

### Position
- id, portfolio_id (FK), isin, wkn, name, stueckzahl, kurs, waehrung,
  land, branche, assetklasse, typ (Aktie/ETF/Fonds/Anleihe/Zertifikat)

### Musterportfolio
- id, name, beschreibung, erstellt_am

### MusterPosition
- id, musterportfolio_id (FK), isin, name, zielgewicht_prozent,
  assetklasse, branche, region

## API Struktur (Backend)

### Auth
- POST /auth/register    → Berater registrieren
- POST /auth/login       → Login (Supabase Auth)

### Portfolio
- POST /upload           → Datei hochladen + Claude parsed sie
- GET  /portfolios       → Alle Portfolios des eingeloggten Beraters
- GET  /portfolio/{id}   → Portfolio mit allen Positionen
- DELETE /portfolio/{id} → Portfolio löschen

### Analyse
- GET  /portfolio/{id}/analyse      → Strukturanalyse (Verteilung nach Assetklasse, Region etc.)
- GET  /portfolio/{id}/vergleich    → Musterportfolio-Vergleich (fehlend + Gewichtung)
- GET  /portfolio/{id}/marktdaten   → Marktindikatoren für alle Positionen

### Musterportfolio
- GET  /musterportfolio             → Aktuelles Musterportfolio abrufen (= Startseite)
- PUT  /musterportfolio             → Musterportfolio bearbeiten (jeder Berater darf ändern)

### KI
- POST /chat             → KI-Chat Anfrage (mit Portfolio-Kontext)
- POST /geeignetheit     → Geeignetheitstexte generieren

## Wichtige Konventionen
- Alle Geldbeträge intern in EUR speichern
- Zahlen immer als float, nie als string
- Deutsche Zahlenformate (1.234,56) vor Speicherung normalisieren
- Fehler immer mit klarer deutscher Meldung an Frontend zurückgeben
- API-Responses: JSON mit deutschen Feldnamen wo sinnvoll (z.B. `kunde_name`, `stueckzahl`)
- Alle API-Endpunkte (außer Auth) erfordern gültigen Supabase JWT
