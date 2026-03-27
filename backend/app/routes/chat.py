"""KI-Chat Endpoints: Portfolio-Chat und allgemeiner Finanz-Chat."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user
from app.config import OPENROUTER_API_KEY
from app.database import get_supabase_for_user
from app.alpha_vantage import fetch_daily_prices

router = APIRouter(tags=["Chat"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "gpt-oss-120b"

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
Du bist ein KI-Finanzassistent fuer Finanzberater. Du beantwortest allgemeine Fragen \
zu Aktien, ETFs, Maerkten und Finanzthemen.

Wenn dir Marktdaten zu einem Titel mitgegeben werden, nutze diese in deiner Antwort.

WICHTIG - Antwortstil:
- Antworte KURZ und DIREKT. Maximal 3-5 Saetze.
- Wenn konkrete Zahlen vorhanden sind, nenne sie.
- Keine generischen Belehrungen ueber Risiken, es sei denn explizit gefragt.
- Antworte auf Deutsch.\
"""


async def _call_llm(messages: list[dict]) -> str:
    """Sendet Messages an OpenRouter und gibt die Antwort zurueck."""
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
                "messages": messages,
            },
        )
        response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


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

    answer = await _call_llm(messages)
    return {"answer": answer}


# ── Allgemeiner Finanz-Chat ──

class GeneralChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    symbol: str | None = None


@router.post("/chat/general")
async def general_chat(
    body: GeneralChatRequest, request: Request, user=Depends(get_current_user)
):
    """Allgemeiner Finanz-Chat, optional mit Marktdaten zu einem Symbol."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(500, detail="OPENROUTER_API_KEY nicht konfiguriert")

    # Marktdaten holen wenn Symbol angegeben
    market_context = ""
    if body.symbol:
        kurs, ytd = await fetch_daily_prices(body.symbol)
        if kurs is not None:
            market_context = (
                f"\nAktuelle Marktdaten fuer {body.symbol}:\n"
                f"- Kurs: {kurs:.2f}\n"
                f"- YTD Performance: {ytd:.2f}%\n" if ytd else
                f"\nAktuelle Marktdaten fuer {body.symbol}:\n"
                f"- Kurs: {kurs:.2f}\n"
            )

    messages = [
        {"role": "system", "content": GENERAL_SYSTEM_PROMPT},
    ]
    if market_context:
        messages.append({"role": "user", "content": f"Marktdaten-Kontext:{market_context}"})
        messages.append({"role": "assistant", "content": "Ok, ich habe die Marktdaten. Was moechtest du wissen?"})

    for msg in body.history:
        if msg.get("role") in ("user", "assistant"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.message})

    answer = await _call_llm(messages)
    return {"answer": answer}
