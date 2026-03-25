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
   - LLM extrahiert Positionen automatisch aus dem Dokument via OpenRouter/Cerebras
2. **Strukturanalyse** (Währungen, Länder, Branchen, Assetklassen)
3. **Musterportfolio-Vergleich**
   - Fehlende Positionen identifizieren
   - Gewichtungsabweichungen zeigen (Über-/Untergewichtung nach Branche, Region, Assetklasse)
   - Es gibt genau **ein globales Musterportfolio** – sichtbar und editierbar für alle Berater
   - Das Musterportfolio kann nicht gelöscht werden, nur inhaltlich bearbeitet
   - Das Musterportfolio ist gleichzeitig die Startseite/Eingangsansicht der App
4. **Marktdaten-Indikatoren** (200-Tage-Linie etc.) via Alpha Vantage
5. **KI-Chat über Portfolio** (OpenRouter/Cerebras)
6. **Geeignetheitstexte-Generator** (OpenRouter/Cerebras)

## Unterstützte Assetklassen
- Aktien, ETFs, Investmentfonds
- Anleihen, Zertifikate, strukturierte Produkte
- Grundsatz: Alles was in einem Depot vorkommen kann soll parsbar sein

## Tech Stack
- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend:** FastAPI, Python 3.11
- **Datenbank:** Supabase (PostgreSQL + Auth)
- **Marktdaten:** Alpha Vantage API
- **KI:** OpenRouter API (Modell: gpt-oss-120b via Cerebras als Inference Provider)
- **PDF-Parsing:** pdfplumber (Text-Extraktion vor LLM-Aufruf)
- **Hosting:** Vercel (Frontend), Railway (Backend)

## Projektstruktur


/frontend        → Next.js App
/backend         → FastAPI App (uv Projekt)
/scripts         → Start/Stop Scripts für lokale Entwicklung
CLAUDE.md        → Diese Datei (immer aktuell halten)

## AI Design

Wenn du Code schreibst der LLM-Calls macht, nutze deinen Cerebras skill um OpenRouter mit dem gpt-oss-120b
Modell und Cerebras als Inference Provider zu nutzen. Verwende Structured Outputs damit du
die Ergebnisse interpretieren und die Felder in der Applikation befüllen kannst.

LLM-Calls werden an folgenden Stellen gemacht:
- **Portfolio-Parser:** Rohinhalt der hochgeladenen Datei → strukturiertes JSON
- **KI-Chat:** Berater stellt Fragen zum Portfolio → LLM analysiert und antwortet
- **Geeignetheitstexte:** Portfolio-Daten → fertiger Eignungstext

Alle LLM-Calls laufen ausschließlich über das Backend (FastAPI), nie direkt vom Frontend.
API-Key: OPENROUTER_API_KEY aus .env

## Technical Design

Das gesamte Projekt soll in einem Docker Container laufen:
- Backend in /backend/ als uv Projekt mit FastAPI
- Frontend in /frontend/ als Next.js Projekt
- Frontend wird auf Vercel gehostet, Backend auf Railway
- Lokale Start/Stop Scripts in /scripts/:
  - scripts/start-mac.sh   → startet Backend + Frontend
  - scripts/stop-mac.sh    → stoppt beide Services

Umgebungsvariablen immer aus .env laden, nie hardcoden.

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
- POST /upload           → Datei hochladen + LLM parsed sie
- GET  /portfolios       → Alle Portfolios des eingeloggten Beraters
- GET  /portfolio/{id}   → Portfolio mit allen Positionen
- DELETE /portfolio/{id} → Portfolio löschen

### Analyse
- GET  /portfolio/{id}/analyse      → Strukturanalyse
- GET  /portfolio/{id}/vergleich    → Musterportfolio-Vergleich
- GET  /portfolio/{id}/marktdaten   → Marktindikatoren via Alpha Vantage

### Musterportfolio
- GET  /musterportfolio             → Aktuelles Musterportfolio (= Startseite)
- PUT  /musterportfolio             → Musterportfolio bearbeiten

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

## Environment Variables
OPENROUTER_API_KEY
ALPHA_VANTAGE_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL