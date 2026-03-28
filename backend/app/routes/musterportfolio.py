"""Musterportfolio-Endpunkte."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, Form
from pydantic import BaseModel
from app.auth import get_current_user
from app.database import get_supabase_for_user
from app.parsers import extract_text_from_pdf, extract_text_from_excel, extract_text_from_csv
from app.llm import parse_portfolio_text
from app.finnhub import fetch_market_data, get_recommendation, get_forex_rates
import os

router = APIRouter(tags=["Musterportfolio"])

ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024


class MusterPositionInput(BaseModel):
    isin: str | None = None
    symbol: str | None = None
    name: str
    stueckzahl: float = 0
    kurs: float = 0
    zielgewicht_prozent: float = 0
    assetklasse: str | None = None
    branche: str | None = None
    region: str | None = None
    typ: str | None = None
    land: str | None = None


class MusterportfolioUpdate(BaseModel):
    name: str | None = None
    beschreibung: str | None = None
    positionen: list[MusterPositionInput]


@router.get("/musterportfolio")
async def get_musterportfolio(request: Request, user=Depends(get_current_user)):
    """Aktuelles Musterportfolio mit allen Positionen und berechneten Feldern."""
    sb = get_supabase_for_user(request.state.token)

    mp = sb.table("musterportfolio").select("*").limit(1).single().execute()
    if not mp.data:
        raise HTTPException(404, detail="Kein Musterportfolio vorhanden")

    positionen = (
        sb.table("muster_position")
        .select("*")
        .eq("musterportfolio_id", mp.data["id"])
        .execute()
    )

    # Gewichtung dynamisch berechnen (kurswert_eur bevorzugt fuer korrekte Waehrungsgewichtung)
    positions = positionen.data

    def _position_value_eur(p: dict) -> float:
        if p.get("kurswert_eur"):
            return p["kurswert_eur"]
        return p["stueckzahl"] * (p.get("aktueller_kurs") or p.get("kurs") or 0)

    total_value = sum(_position_value_eur(p) for p in positions)
    for pos in positions:
        value = _position_value_eur(pos)
        pos["gewichtung"] = round(value / total_value * 100, 2) if total_value > 0 else 0
        price = pos.get("aktueller_kurs") or pos.get("kurs") or 0
        if pos.get("sma_200") and price:
            pos["abstand_sma_200"] = round((price - pos["sma_200"]) / pos["sma_200"] * 100, 2)
        else:
            pos["abstand_sma_200"] = None

    return {**mp.data, "positionen": positions}


@router.put("/musterportfolio")
async def update_musterportfolio(
    body: MusterportfolioUpdate,
    request: Request,
    user=Depends(get_current_user),
):
    """Musterportfolio aktualisieren (Name/Beschreibung + Positionen ersetzen)."""
    sb = get_supabase_for_user(request.state.token)

    mp = sb.table("musterportfolio").select("id").limit(1).single().execute()
    if not mp.data:
        raise HTTPException(404, detail="Kein Musterportfolio vorhanden")

    mp_id = mp.data["id"]

    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.beschreibung is not None:
        updates["beschreibung"] = body.beschreibung
    if updates:
        sb.table("musterportfolio").update(updates).eq("id", mp_id).execute()

    rows = [
        {**pos.model_dump(), "musterportfolio_id": mp_id}
        for pos in body.positionen
    ]

    sb.table("muster_position").delete().eq("musterportfolio_id", mp_id).execute()
    if rows:
        sb.table("muster_position").insert(rows).execute()

    return await get_musterportfolio(request, user)


@router.post("/musterportfolio/upload")
async def upload_musterportfolio(
    request: Request,
    file: UploadFile,
    user=Depends(get_current_user),
):
    """Excel/CSV/PDF hochladen, per LLM parsen und Musterportfolio ersetzen."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail="Nicht unterstuetztes Dateiformat")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, detail="Datei zu gross (max. 10 MB)")

    if ext == ".pdf":
        raw_text = extract_text_from_pdf(file_bytes)
    elif ext in (".xlsx", ".xls"):
        raw_text = extract_text_from_excel(file_bytes)
    else:
        raw_text = extract_text_from_csv(file_bytes)

    if not raw_text.strip():
        raise HTTPException(400, detail="Keine Inhalte in der Datei gefunden")

    positions = await parse_portfolio_text(raw_text)

    sb = get_supabase_for_user(request.state.token)
    mp = sb.table("musterportfolio").select("id").limit(1).single().execute()
    if not mp.data:
        raise HTTPException(404, detail="Kein Musterportfolio vorhanden")

    mp_id = mp.data["id"]

    # Bestehende Positionen loeschen
    sb.table("muster_position").delete().eq("musterportfolio_id", mp_id).execute()

    # Neue Positionen einfuegen
    if positions:
        rows = []
        for pos in positions:
            rows.append({
                "musterportfolio_id": mp_id,
                "name": pos.get("name", ""),
                "isin": pos.get("isin"),
                "symbol": pos.get("symbol"),
                "stueckzahl": pos.get("stueckzahl", 0),
                "kurs": pos.get("kaufkurs", 0),
                "branche": pos.get("branche"),
                "region": pos.get("land"),
                "typ": pos.get("typ"),
                "land": pos.get("land"),
                "assetklasse": pos.get("assetklasse"),
                "waehrung": pos.get("waehrung", "EUR"),
                "kurswert_eur": pos.get("kurswert_eur"),
            })
        sb.table("muster_position").insert(rows).execute()

    return await get_musterportfolio(request, user)


@router.post("/musterportfolio/refresh-market-data")
async def refresh_muster_market_data(
    request: Request, user=Depends(get_current_user)
):
    """Marktdaten fuer alle Muster-Positionen aktualisieren."""
    sb = get_supabase_for_user(request.state.token)

    mp = sb.table("musterportfolio").select("id").limit(1).single().execute()
    if not mp.data:
        raise HTTPException(404, detail="Kein Musterportfolio vorhanden")

    positions = (
        sb.table("muster_position")
        .select("id, symbol, stueckzahl, waehrung")
        .eq("musterportfolio_id", mp.data["id"])
        .execute()
    )

    # Devisenkurse: 1 einziger API-Call fuer alle Waehrungen
    fx_rates = await get_forex_rates("EUR") or {}

    updated = 0
    for pos in positions.data:
        if not pos.get("symbol"):
            continue

        data = await fetch_market_data(pos["symbol"])
        rec = await get_recommendation(pos["symbol"])

        update_fields = {k: v for k, v in data.items() if v is not None}
        if rec:
            update_fields["analysten_buy"] = rec["buy"]
            update_fields["analysten_hold"] = rec["hold"]
            update_fields["analysten_sell"] = rec["sell"]

        # kurswert_eur neu berechnen: Stueckzahl * Akt. Kurs / Devisenkurs
        akt_kurs = update_fields.get("aktueller_kurs")
        whg = pos.get("waehrung", "EUR")
        fx_rate = fx_rates.get(whg)
        if akt_kurs and fx_rate:
            update_fields["kurswert_eur"] = round(pos["stueckzahl"] * akt_kurs / fx_rate, 2)

        if update_fields:
            update_fields["marktdaten_aktualisiert_am"] = "now()"
            sb.table("muster_position").update(update_fields).eq("id", pos["id"]).execute()
            updated += 1

    return {"aktualisiert": updated, "gesamt": len(positions.data)}
