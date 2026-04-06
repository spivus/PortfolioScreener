"""Portfolio-Upload: Datei hochladen, Text extrahieren, LLM parsen, speichern."""

import logging
import os

from fastapi import APIRouter, UploadFile, Depends, HTTPException, Request, Form

logger = logging.getLogger(__name__)
from app.auth import get_current_user
from app.parsers import (
    extract_text_from_pdf,
    extract_text_from_excel,
    extract_text_from_csv,
)
from app.llm import parse_portfolio_text
from app.database import get_supabase_for_user
from app.finnhub import search_symbol, get_quote, get_company_profile, resolve_symbol_by_isin

router = APIRouter(tags=["Upload"])

ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def get_extension(filename: str | None) -> str:
    if not filename:
        return ""
    return os.path.splitext(filename)[1].lower()


@router.post("/upload")
async def upload_portfolio(
    request: Request,
    file: UploadFile,
    kunde_name: str = Form(...),
    user=Depends(get_current_user),
):
    """Datei hochladen, per LLM parsen und Portfolio in DB speichern."""
    ext = get_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail="Nicht unterstuetztes Dateiformat")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, detail="Datei zu gross (max. 10 MB)")

    # Text extrahieren
    if ext == ".pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    elif ext in (".xlsx", ".xls"):
        raw_text = extract_text_from_excel(file_bytes)
    else:
        raw_text = extract_text_from_csv(file_bytes)

    if not raw_text.strip():
        raise HTTPException(400, detail="Keine Inhalte in der Datei gefunden")

    logger.info("Extrahierter Text (%d Zeichen):\n%s", len(raw_text), raw_text[:5000])

    # LLM parsen
    positions = await parse_portfolio_text(raw_text)

    # Symbol-Aufloesung: ISIN ist zuverlaessigste Quelle, dann LLM-Symbol pruefen
    for pos in positions:
        isin = pos.get("isin")
        symbol = pos.get("symbol")

        # 1. ISIN-basierte Aufloesung (primaer, zuverlaessig)
        if isin:
            resolved = await resolve_symbol_by_isin(isin, pos.get("name"))
            if resolved:
                logger.info("ISIN %s -> Symbol %s (war: %s)", isin, resolved, symbol)
                pos["symbol"] = resolved
                continue

        # 2. LLM-Symbol validieren (Fallback)
        if symbol:
            if "." in symbol:
                continue
            if pos.get("waehrung") and pos["waehrung"] != "USD":
                profile = await get_company_profile(symbol)
                if profile and profile.get("ticker") and profile["ticker"] != symbol:
                    logger.info("Lokalen Ticker verwenden: %s -> %s", symbol, profile["ticker"])
                    pos["symbol"] = profile["ticker"]
                continue
            quote = await get_quote(symbol)
            if quote:
                continue
            logger.info("Symbol '%s' fuer '%s' ungueltig, suche Ersatz", symbol, pos["name"])

        # 3. Finnhub-Suche als letzter Fallback
        name = pos.get("name", "")
        searched = await search_symbol(name, expected_name=name)
        if not searched and symbol:
            searched = await search_symbol(symbol, expected_name=name)
        if searched:
            logger.info("Symbol fuer '%s': %s -> %s", pos["name"], symbol, searched)
            pos["symbol"] = searched

    # In Supabase speichern (mit User-JWT fuer RLS)
    sb = get_supabase_for_user(request.state.token)

    portfolio = sb.table("portfolio").insert({
        "berater_id": user.id,
        "kunde_name": kunde_name,
    }).execute()
    portfolio_id = portfolio.data[0]["id"]

    if positions:
        for pos in positions:
            pos["portfolio_id"] = portfolio_id
            # LLM gibt "kaufkurs" zurueck, DB-Spalte heisst "kurs"
            if "kaufkurs" in pos:
                pos["kurs"] = pos.pop("kaufkurs")
        sb.table("position").insert(positions).execute()

    return {
        "portfolio_id": portfolio_id,
        "kunde_name": kunde_name,
        "positionen_count": len(positions),
        "positionen": positions,
    }
