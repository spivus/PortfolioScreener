# Portfolio Analyzer

Interne Web-App fuer Finanzberater um Kundenportfolios hochzuladen, zu analysieren und mit einem Musterportfolio zu vergleichen.

## Voraussetzungen

- Python 3.11+
- Node.js 18+
- Supabase-Projekt (kostenloser Tier reicht)

## Setup

### 1. Environment-Variablen

```bash
cp .env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Trage deine Keys in beide `.env`-Dateien ein.

### 2. Backend starten

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Backend laeuft auf http://localhost:8000

### 3. Datenbank einrichten

Fuehre `backend/schema.sql` im Supabase SQL Editor aus.

### 4. Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Frontend laeuft auf http://localhost:3000

## Tech Stack

| Bereich     | Technologie                          |
| ----------- | ------------------------------------ |
| Frontend    | Next.js 14, TypeScript, Tailwind CSS |
| Backend     | FastAPI, Python 3.11                 |
| Datenbank   | Supabase (PostgreSQL + Auth)         |
| KI          | OpenRouter (gpt-oss-120b / Cerebras) |
| Marktdaten  | Finnhub + Yahoo Finance             |
