"""OpenRouter LLM-Client fuer Portfolio-Parsing mit Structured Outputs."""

import json
import logging

import httpx
from app.config import OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

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
                    "isin": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "wkn": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "symbol": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "name": {"type": "string"},
                    "stueckzahl": {"type": "number"},
                    "kaufkurs": {"type": "number"},
                    "kurswert_eur": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                    "waehrung": {"type": "string"},
                    "land": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "region": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "branche": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "assetklasse": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "typ": {
                        "type": "string",
                        "enum": [
                            "Aktie", "ETF", "Fonds",
                            "Anleihe", "Zertifikat", "Sonstige",
                        ],
                    },
                },
                "required": ["name", "stueckzahl", "kaufkurs", "waehrung", "typ", "branche", "symbol", "land", "region"],
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
- symbol ist ein PFLICHTFELD fuer Aktien! Wenn kein Ticker im Dokument steht, leite ihn aus \
dem Firmennamen oder der ISIN ab. Beispiele: Albemarle Corp. -> ALB, Alphabet Class A -> GOOGL, \
Amazon.com -> AMZN, Allianz -> ALV.DE, Microsoft -> MSFT, Nvidia -> NVDA, Meta Platforms -> META, \
Broadcom -> AVGO, Berkshire Hathaway B -> BRK-B, JPMorgan Chase -> JPM, Visa -> V, \
Costco -> COST, ING Groep -> ING, RWE -> RWE.DE, Deutsche Telekom -> DTE.DE, \
Mercadolibre -> MELI, Arista Networks -> ANET, Cameco -> CCJ, ITOCHU -> ITOCY, \
Sterling Infrastructure -> STRL, Comfort Systems USA -> FIX, Carpenter Technology -> CRS, \
CACI International -> CACI, Cintas -> CTAS, Vertiv -> VRT, Vistra -> VST, AppLovin -> APP. \
Deutsche/europaeische Aktien brauchen den Suffix .DE (z.B. SAP.DE, ALV.DE, BAS.DE, DHL.DE). \
Fuer ETFs und Fonds setze null wenn der Ticker nicht offensichtlich ist
- Normalisiere deutsche Zahlenformate: 1.234,56 -> 1234.56
- kaufkurs ist der KAUFPREIS / Einstandskurs in der Heimatwaehrung. Suche nach Spalten wie \
'Kaufkurs', 'Einstandskurs', 'Avg. Cost'. NICHT den aktuellen Marktpreis verwenden!
- Waehrung als ISO-Code (EUR, USD, CHF etc.) - die Heimatwaehrung des Wertpapiers
- kurswert_eur ist der aktuelle Gesamtwert der Position in EUR. Suche nach Spalten wie 'Kurswert', \
'Marktwert', 'Wert EUR', 'Gesamtwert'. Dieser Wert ist IMMER in EUR (waehrungsbereinigt). \
Bei Fremdwaehrungs-Positionen (z.B. USD) ist der Kurswert bereits umgerechnet. \
Wenn keine solche Spalte vorhanden ist, setze null
- Branche ist ein Pflichtfeld! Wenn das Dokument eine Spalte wie 'Sektor', 'Branche' oder \
'Industrie' hat, uebernimm den Wert direkt. Ansonsten leite die Branche aus dem \
Unternehmensnamen ab (z.B. Apple -> Technologie, Allianz -> Versicherung, BASF -> Chemie). \
Nur null wenn absolut nicht ableitbar
- land ist das Sitzland des Unternehmens als ISO-2-Code (DE, US, CH, FR, JP etc.). \
Leite es aus dem Firmennamen oder der ISIN ab (z.B. ISIN beginnt mit DE -> DE, US -> US). \
Nur null wenn absolut nicht ableitbar
- region ist die uebergeordnete geografische Region: Nordamerika, Europa, Asien-Pazifik, \
Schwellenlaender, Global (fuer weltweit diversifizierte ETFs/Fonds). \
Leite sie aus dem Land ab (z.B. DE/FR/CH -> Europa, US/CA -> Nordamerika, JP/AU -> Asien-Pazifik)
- Wenn Assetklasse nicht erkennbar, setze null
- typ muss einer von: Aktie, ETF, Fonds, Anleihe, Zertifikat, Sonstige sein
- Ignoriere Summenzeilen (z.B. "Gesamt", "Total", "Summe")
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
    logger.info("LLM raw response: %s", content[:3000])
    parsed = json.loads(content)
    logger.info("LLM parsed %d positionen", len(parsed["positionen"]))
    return parsed["positionen"]
