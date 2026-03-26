"""OpenRouter LLM-Client fuer Portfolio-Parsing mit Structured Outputs."""

import json

import httpx
from app.config import OPENROUTER_API_KEY

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "gpt-oss-120b"

POSITION_SCHEMA = {
    "type": "object",
    "properties": {
        "positionen": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "isin": {"type": ["string", "null"]},
                    "wkn": {"type": ["string", "null"]},
                    "name": {"type": "string"},
                    "stueckzahl": {"type": "number"},
                    "kurs": {"type": "number"},
                    "waehrung": {"type": "string"},
                    "land": {"type": ["string", "null"]},
                    "branche": {"type": ["string", "null"]},
                    "assetklasse": {"type": ["string", "null"]},
                    "typ": {
                        "type": "string",
                        "enum": [
                            "Aktie", "ETF", "Fonds",
                            "Anleihe", "Zertifikat", "Sonstige",
                        ],
                    },
                },
                "required": ["name", "stueckzahl", "kurs", "waehrung", "typ"],
            },
        }
    },
    "required": ["positionen"],
}

SYSTEM_PROMPT = """\
Du bist ein Experte fuer Finanzportfolios. Du erhaeltst den Rohtext eines
hochgeladenen Portfolio-Dokuments (Excel, CSV oder PDF). Extrahiere alle
Wertpapierpositionen als strukturiertes JSON.

Regeln:
- Erkenne ISIN (12 Zeichen, beginnt mit Laendercode) und WKN (6 Zeichen) wenn vorhanden
- Normalisiere deutsche Zahlenformate: 1.234,56 -> 1234.56
- Waehrung als ISO-Code (EUR, USD, CHF etc.)
- Wenn Land/Branche/Assetklasse nicht erkennbar, setze null
- typ muss einer von: Aktie, ETF, Fonds, Anleihe, Zertifikat, Sonstige sein
- Gib NUR die Positionen zurueck, keine Kommentare"""


async def parse_portfolio_text(raw_text: str) -> list[dict]:
    """Sendet Rohtext an OpenRouter LLM, gibt strukturierte Positionen zurueck."""
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY ist nicht gesetzt")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "provider": {"order": ["Cerebras"]},
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": raw_text},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "portfolio_positions",
                        "strict": True,
                        "schema": POSITION_SCHEMA,
                    },
                },
            },
        )
        response.raise_for_status()

    data = response.json()
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    return parsed["positionen"]
