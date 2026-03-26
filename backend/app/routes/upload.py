"""Portfolio-Upload: Datei hochladen, Text extrahieren, LLM parsen, speichern."""

import os

from fastapi import APIRouter, UploadFile, Depends, HTTPException, Request, Form
from app.auth import get_current_user
from app.parsers import (
    extract_text_from_pdf,
    extract_text_from_excel,
    extract_text_from_csv,
)
from app.llm import parse_portfolio_text
from app.database import get_supabase_for_user

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

    # LLM parsen
    positions = await parse_portfolio_text(raw_text)

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
        sb.table("position").insert(positions).execute()

    return {
        "portfolio_id": portfolio_id,
        "kunde_name": kunde_name,
        "positionen_count": len(positions),
        "positionen": positions,
    }
