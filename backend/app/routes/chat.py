"""KI-Chat Endpoints: Portfolio-Chat und allgemeiner Finanz-Chat."""

import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user
from app.config import OPENROUTER_API_KEY
from app.database import get_supabase_for_user
from app.finnhub import get_quote, get_company_news, get_company_profile, screen_stocks

router = APIRouter(tags=["Chat"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
PORTFOLIO_MODEL = "gpt-oss-120b"
GENERAL_MODEL = "anthropic/claude-haiku-4.5"

PORTFOLIO_SYSTEM_PROMPT = """\
Du bist ein KI-Assistent fuer Finanzberater. Du hast Zugriff auf ein Kundenportfolio \
und ein Musterportfolio (siehe Kontext).

WICHTIG - Antwortstil:
- Antworte KURZ und DIREKT auf die gestellte Frage. Nicht mehr.
- Keine langen Einleitungen, keine unaufgeforderten Gesamtanalysen.
- Wenn nach einer bestimmten Position gefragt wird, antworte nur zu dieser Position.
- Wenn nach einer Empfehlung gefragt wird, gib eine konkrete Empfehlung.
- Nutze Zahlen und Namen aus dem Kontext, keine generischen Aussagen.
- Antworte auf Deutsch.
- Maximal 3-5 Saetze, es sei denn der Nutzer fragt explizit nach einer ausfuehrlichen Analyse.\
"""

GENERAL_SYSTEM_PROMPT = """\
Du bist ein KI-Finanzassistent fuer Finanzberater. Du hast Zugriff auf Echtzeit-Marktdaten.

WICHTIG - Faehigkeiten:
- Du kannst einzelne Aktien abfragen (Kurs, News, Firmenprofil).
- Du kannst SCREENEN: Wenn der Nutzer nach einer Gruppe von Aktien fragt \
(z.B. "europaeische Dauerlaeufer", "defensive Titel", "Tech-Aktien mit wenig Verlust"), \
nutze dein Wissen um 8-15 passende Ticker-Symbole zu identifizieren und rufe \
screen_stocks auf um die echten Kursdaten zu holen. Dann filtere/ranke basierend auf den Daten.
- WICHTIG: Die Datenquelle liefert nur US-Ticker. Fuer europaeische Aktien nutze die \
US-ADR-Ticker, z.B.: SAP (nicht SAP.DE), NVS (Novartis), UL (Unilever), SHEL (Shell), \
TTE (TotalEnergies), AZN (AstraZeneca), NVO (Novo Nordisk), DEO (Diageo), SNY (Sanofi), \
ASML, RELX, ING, PHG (Philips), SIE (Siemens), DTEGY (Deutsche Telekom), \
MBG (Mercedes), BMW (BMWYY), ALV (Allianz), DB (Deutsche Bank), EOAN (E.ON).

WICHTIG - Antwortstil:
- Antworte KURZ und DIREKT.
- Wenn konkrete Zahlen vorhanden sind, nenne sie.
- Keine generischen Belehrungen ueber Risiken, es sei denn explizit gefragt.
- Antworte auf Deutsch.\
"""


async def _call_llm(messages: list[dict], model: str = PORTFOLIO_MODEL, **kwargs) -> dict:
    """Sendet Messages an OpenRouter und gibt die rohe Choice zurueck."""
    payload = {"model": model, "messages": messages, **kwargs}
    if model == PORTFOLIO_MODEL:
        payload["provider"] = {"order": ["Cerebras"]}
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
    return response.json()["choices"][0]


def _build_portfolio_context(positions: list[dict], muster: list[dict]) -> str:
    """Baut den Portfolio-Kontext als Text fuer das LLM."""
    lines = ["KUNDENPORTFOLIO:"]
    for p in positions:
        kurs = p.get("aktueller_kurs") or p.get("kurs", 0)
        lines.append(
            f"- {p['name']}: {p.get('stueckzahl', 0)} Stueck, "
            f"Kurs {kurs}, Branche: {p.get('branche', 'unbekannt')}, "
            f"Typ: {p.get('typ', 'unbekannt')}"
        )

    lines.append("\nMUSTERPORTFOLIO:")
    for m in muster:
        lines.append(
            f"- {m['name']}: Zielgewicht {m.get('zielgewicht_prozent', 0)}%, "
            f"Branche: {m.get('branche', 'unbekannt')}, "
            f"Region: {m.get('region', 'unbekannt')}"
        )

    return "\n".join(lines)


# ── Portfolio-gebundener Chat ──

class ChatRequest(BaseModel):
    portfolio_id: str
    message: str
    history: list[dict] = []


@router.post("/chat")
async def chat(body: ChatRequest, request: Request, user=Depends(get_current_user)):
    """Beantwortet Fragen zum Portfolio via LLM."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(500, detail="OPENROUTER_API_KEY nicht konfiguriert")

    sb = get_supabase_for_user(request.state.token)

    portfolio = (
        sb.table("portfolio").select("*").eq("id", body.portfolio_id).single().execute()
    )
    if not portfolio.data:
        raise HTTPException(404, detail="Portfolio nicht gefunden")

    positions = (
        sb.table("position").select("*").eq("portfolio_id", body.portfolio_id).execute()
    )
    muster = sb.table("muster_position").select("*").execute()
    context = _build_portfolio_context(positions.data, muster.data)

    messages = [
        {"role": "system", "content": PORTFOLIO_SYSTEM_PROMPT},
        {"role": "user", "content": f"Hier ist der Kontext:\n\n{context}"},
        {"role": "assistant", "content": "Ok, ich habe die Daten. Was moechtest du wissen?"},
    ]
    for msg in body.history:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.message})

    choice = await _call_llm(messages)
    return {"answer": choice["message"]["content"]}


# ── Allgemeiner Finanz-Chat mit Tool Use ──

FINNHUB_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_quote",
            "description": "Aktuellen Aktienkurs, Tagesaenderung und Hoch/Tief abrufen.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Ticker-Symbol, z.B. AAPL, MSFT, SAP.DE",
                    }
                },
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stock_news",
            "description": "Aktuelle Nachrichten zu einer Aktie der letzten 7 Tage abrufen.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Ticker-Symbol, z.B. AAPL, MSFT, SAP.DE",
                    }
                },
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_company_info",
            "description": "Firmenprofil abrufen: Name, Branche, Land, Marktkapitalisierung.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Ticker-Symbol, z.B. AAPL, MSFT, SAP.DE",
                    }
                },
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "screen_stocks",
            "description": "Kursdaten fuer mehrere Aktien gleichzeitig abrufen. Nutze dies fuer Screening und Vergleiche.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbols": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Liste von Ticker-Symbolen, z.B. ['NESN.SW', 'ROG.SW', 'BAS.DE', 'MUV2.DE']",
                    }
                },
                "required": ["symbols"],
            },
        },
    },
]

TOOL_DISPATCH = {
    "get_stock_quote": lambda args: get_quote(args["symbol"]),
    "get_stock_news": lambda args: get_company_news(args["symbol"]),
    "get_company_info": lambda args: get_company_profile(args["symbol"]),
    "screen_stocks": lambda args: screen_stocks(args["symbols"]),
}

class GeneralChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat/general")
async def general_chat(
    body: GeneralChatRequest, request: Request, user=Depends(get_current_user)
):
    """Allgemeiner Finanz-Chat mit Claude Haiku + Finnhub Tool Use."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(500, detail="OPENROUTER_API_KEY nicht konfiguriert")

    messages = [
        {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
    ]
    for msg in body.history:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.message})

    # Tool-Use-Loop: Claude entscheidet selbst ob Marktdaten noetig sind
    for _ in range(3):
        choice = await _call_llm(
            messages, model=GENERAL_MODEL, tools=FINNHUB_TOOLS,
        )
        msg = choice["message"]

        if choice.get("finish_reason") != "tool_calls" and not msg.get("tool_calls"):
            return {"answer": msg["content"]}

        # Claude will Tools aufrufen
        messages.append(msg)
        for tc in msg["tool_calls"]:
            fn_name = tc["function"]["name"]
            fn_args = json.loads(tc["function"]["arguments"])
            handler = TOOL_DISPATCH.get(fn_name)
            result = await handler(fn_args) if handler else {"error": "Unknown tool"}
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(result, ensure_ascii=False),
            })

    # Fallback nach 3 Iterationen
    return {"answer": messages[-1].get("content", "Keine Antwort erhalten.")}
