# Plan: Portfolio Upload + LLM Parsing (Feature 1)

## Context
Das Projekt hat Frontend- und Backend-Scaffolding, aber keine funktionierenden Features. Das Backend nutzt noch `requirements.txt` + Anthropic SDK statt `uv` + OpenRouter. Supabase ist noch nicht aufgesetzt. Ziel: Erstes Feature end-to-end zum Laufen bringen – Datei hochladen, LLM parst Positionen, Ergebnis in DB speichern und anzeigen.

---

## Step 0: Infrastruktur bereinigen

### 0.1 Backend auf uv migrieren
- `requirements.txt` löschen
- `pyproject.toml` erstellen mit Dependencies (fastapi, uvicorn, supabase, python-dotenv, python-multipart, pdfplumber, openpyxl, httpx)
- `anthropic` SDK entfernen – OpenRouter wird direkt via httpx angesprochen
- `cd backend && uv sync`

### 0.2 Config anpassen
- `/backend/app/config.py`: `ANTHROPIC_API_KEY` → `OPENROUTER_API_KEY`
- `/backend/.env.example` + `/.env.example`: gleiche Änderung

### 0.3 Start/Stop Scripts
- `/scripts/start-mac.sh`: startet Backend (`uv run uvicorn`) + Frontend (`npm run dev`)
- `/scripts/stop-mac.sh`: stoppt beide

### 0.4 Validierung
- `uv run uvicorn app.main:app --reload` → `/health` antwortet

---

## Step 1: Supabase Setup

- `supabase init` im Projektroot
- Migration erstellen aus bestehendem `/backend/schema.sql`
- `supabase start` + `supabase db reset`
- Lokale Credentials in `.env` eintragen

---

## Step 2: Auth (minimal)

### Backend
- **Neu:** `/backend/app/auth.py` – `get_current_user` Dependency (liest JWT aus Header, validiert via `supabase.auth.get_user(token)`)
- **Neu:** `/backend/app/routes/auth.py` – `POST /auth/register` + `POST /auth/login`
- **Ändern:** `/backend/app/database.py` – `get_supabase_for_user(token)` hinzufügen (setzt JWT auf postgrest Client für RLS)
- **Ändern:** `/backend/app/main.py` – Auth-Router registrieren

### Frontend
- **Neu:** `/frontend/src/lib/api.ts` – API-Client mit `login()`, `register()`, `authFetch()` (Token in localStorage)
- **Neu:** `/frontend/src/components/AuthProvider.tsx` – React Context für Auth-State
- **Neu:** `/frontend/src/app/login/page.tsx` – Login-Formular
- **Ändern:** `/frontend/src/app/layout.tsx` – `<AuthProvider>` um children wrappen
- **Ändern:** `/frontend/src/components/Navbar.tsx` – Anmelden/Abmelden je nach Auth-State

---

## Step 3: File Parser

- **Neu:** `/backend/app/parsers.py`
  - `extract_text_from_pdf(bytes) → str` – pdfplumber
  - `extract_text_from_excel(bytes) → str` – openpyxl, Tab-separiert
  - `extract_text_from_csv(bytes) → str` – utf-8-sig Decode

---

## Step 4: LLM Integration

- **Neu:** `/backend/app/llm.py`
  - OpenRouter API via httpx (async), Model: `gpt-oss-120b`, Provider: Cerebras
  - Structured Outputs via `response_format.json_schema`
  - Schema: Array von Positionen (isin, wkn, name, stueckzahl, kurs, waehrung, land, branche, assetklasse, typ)
  - System-Prompt auf Deutsch: Regeln für ISIN/WKN-Erkennung, deutsche Zahlenformat-Normalisierung
  - Fallback: Falls Cerebras kein `json_schema` unterstützt → `json_object` + Pydantic-Validierung

---

## Step 5: Upload Endpoint

- **Neu:** `/backend/app/routes/upload.py`
  - `POST /upload` – nimmt `UploadFile` + `kunde_name`, erfordert Auth
  - Dateiformat prüfen (.xlsx, .csv, .pdf), max 10 MB
  - Text extrahieren (Step 3), LLM parsen (Step 4)
  - Portfolio + Positionen in Supabase speichern (mit User-JWT für RLS)
  - Response: portfolio_id, kunde_name, positionen_count, positionen
- **Ändern:** `/backend/app/main.py` – Upload-Router registrieren

---

## Step 6: Frontend Upload Flow

- **Ändern:** `/frontend/src/components/UploadZone.tsx`
  - File → Kundenname-Input → Upload → Loading-State → Ergebnis/Fehler
  - Nutzt `authFetch` aus api.ts
- **Neu:** `/frontend/src/app/portfolio/[id]/page.tsx` – Zeigt Portfolio mit Positions-Tabelle

---

## Step 7: Portfolio List & CRUD

- **Neu:** `/backend/app/routes/portfolio.py` – `GET /portfolios`, `GET /portfolio/{id}`, `DELETE /portfolio/{id}`
- **Neu:** `/frontend/src/app/portfolio/page.tsx` – Portfolio-Liste (Karten mit kunde_name, Datum, Anzahl Positionen)
- **Ändern:** `/backend/app/main.py` – Portfolio-Router registrieren

---

## Dateiübersicht

### Neue Dateien (13)
| Datei | Zweck |
|-------|-------|
| `/backend/pyproject.toml` | uv Projektconfig |
| `/scripts/start-mac.sh` | Lokaler Start |
| `/scripts/stop-mac.sh` | Lokaler Stop |
| `/backend/app/auth.py` | JWT-Validierung |
| `/backend/app/routes/auth.py` | Register + Login |
| `/backend/app/parsers.py` | PDF/Excel/CSV Textextraktion |
| `/backend/app/llm.py` | OpenRouter Client |
| `/backend/app/routes/upload.py` | Upload-Endpoint |
| `/backend/app/routes/portfolio.py` | Portfolio CRUD |
| `/frontend/src/lib/api.ts` | API-Client |
| `/frontend/src/components/AuthProvider.tsx` | Auth Context |
| `/frontend/src/app/login/page.tsx` | Login-Seite |
| `/frontend/src/app/portfolio/[id]/page.tsx` | Portfolio-Detail |
| `/frontend/src/app/portfolio/page.tsx` | Portfolio-Liste |

### Geänderte Dateien (6)
| Datei | Änderung |
|-------|----------|
| `/backend/app/config.py` | ANTHROPIC → OPENROUTER |
| `/backend/app/database.py` | + `get_supabase_for_user(token)` |
| `/backend/app/main.py` | Router registrieren |
| `/frontend/src/app/layout.tsx` | AuthProvider wrappen |
| `/frontend/src/components/Navbar.tsx` | Login/Logout UI |
| `/frontend/src/components/UploadZone.tsx` | Backend-Anbindung |

### Gelöscht (1)
| `/backend/requirements.txt` | Ersetzt durch pyproject.toml |

---

## Reihenfolge & Abhängigkeiten
Step 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 (strikt sequentiell, jeder Step baut auf dem vorherigen auf)

## Validierung (End-to-End Test)
1. Backend + Frontend starten via `scripts/start-mac.sh`
2. Registrieren + Einloggen über die Login-Seite
3. CSV/Excel/PDF hochladen über UploadZone
4. Positionen werden korrekt extrahiert und in der Detail-Ansicht angezeigt
5. Portfolio erscheint in der Liste unter `/portfolio`
