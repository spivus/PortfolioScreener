"""Portfolio CRUD-Endpunkte."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request
from app.auth import get_current_user
from app.database import get_supabase_for_user
from app.finnhub import fetch_market_data, get_recommendation

router = APIRouter(tags=["Portfolio"])


def _enrich_positions(positions: list[dict], muster_data: list[dict]) -> list[dict]:
    """Berechnet abgeleitete Felder fuer jede Position."""
    muster_isins = {m["isin"].upper() for m in muster_data if m.get("isin")}
    muster_names = {m["name"].strip().lower() for m in muster_data if m.get("name")}

    total_value = sum(
        p["stueckzahl"] * (p.get("aktueller_kurs") or p["kurs"])
        for p in positions
    )

    for pos in positions:
        current_price = pos.get("aktueller_kurs") or pos["kurs"]
        kaufkurs = pos["kurs"]
        position_value = pos["stueckzahl"] * current_price

        pos["kaufkurs"] = kaufkurs
        pos["abstand_sma_200"] = (
            round((current_price - pos["sma_200"]) / pos["sma_200"] * 100, 2)
            if pos.get("sma_200") else None
        )
        pos["im_musterportfolio"] = (
            (bool(pos.get("isin")) and pos["isin"].upper() in muster_isins)
            or (bool(pos.get("name")) and pos["name"].strip().lower() in muster_names)
        )
        pos["gewichtung"] = round(position_value / total_value * 100, 2) if total_value > 0 else 0
        pos["rendite"] = round((current_price - kaufkurs) / kaufkurs * 100, 2) if kaufkurs > 0 else 0

    return positions


@router.get("/portfolios")
async def list_portfolios(request: Request, user=Depends(get_current_user)):
    """Alle Portfolios des eingeloggten Beraters."""
    sb = get_supabase_for_user(request.state.token)
    result = sb.table("portfolio").select("*").order(
        "erstellt_am", desc=True
    ).execute()
    return result.data


@router.get("/portfolio/{portfolio_id}")
async def get_portfolio(
    portfolio_id: str, request: Request, user=Depends(get_current_user)
):
    """Ein Portfolio mit allen Positionen und berechneten Kennzahlen."""
    sb = get_supabase_for_user(request.state.token)
    portfolio = (
        sb.table("portfolio")
        .select("*")
        .eq("id", portfolio_id)
        .single()
        .execute()
    )
    if not portfolio.data:
        raise HTTPException(404, detail="Portfolio nicht gefunden")

    positions = (
        sb.table("position")
        .select("*")
        .eq("portfolio_id", portfolio_id)
        .execute()
    )

    muster = sb.table("muster_position").select("isin, name").execute()
    enriched = _enrich_positions(positions.data, muster.data)

    return {**portfolio.data, "positionen": enriched}


@router.post("/portfolio/{portfolio_id}/refresh-market-data")
async def refresh_market_data(
    portfolio_id: str, request: Request, user=Depends(get_current_user)
):
    """Holt aktuelle Marktdaten von Alpha Vantage und cached sie in der DB."""
    sb = get_supabase_for_user(request.state.token)

    positions = (
        sb.table("position")
        .select("id, symbol")
        .eq("portfolio_id", portfolio_id)
        .execute()
    )
    if not positions.data:
        raise HTTPException(404, detail="Keine Positionen gefunden")

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

        if update_fields:
            update_fields["marktdaten_aktualisiert_am"] = "now()"
            sb.table("position").update(update_fields).eq("id", pos["id"]).execute()
            updated += 1

    return {"aktualisiert": updated, "gesamt": len(positions.data)}


def _match_position(pos: dict, muster_isins: dict, muster_names: dict) -> str | None:
    """Findet die passende Muster-Position-ID via ISIN oder Name."""
    if pos.get("isin"):
        mp_id = muster_isins.get(pos["isin"].upper())
        if mp_id:
            return mp_id
    if pos.get("name"):
        mp_id = muster_names.get(pos["name"].strip().lower())
        if mp_id:
            return mp_id
    return None


@router.get("/portfolio/{portfolio_id}/vergleich")
async def get_vergleich(
    portfolio_id: str, request: Request, user=Depends(get_current_user)
):
    """Vergleicht Kundenportfolio mit dem Musterportfolio."""
    sb = get_supabase_for_user(request.state.token)

    portfolio = (
        sb.table("portfolio").select("id").eq("id", portfolio_id).single().execute()
    )
    if not portfolio.data:
        raise HTTPException(404, detail="Portfolio nicht gefunden")

    positions = (
        sb.table("position").select("*").eq("portfolio_id", portfolio_id).execute()
    )
    muster_positions = sb.table("muster_position").select("*").execute()

    # Gewichtung des Kundenportfolios berechnen
    total_value = sum(
        p["stueckzahl"] * (p.get("aktueller_kurs") or p["kurs"])
        for p in positions.data
    )

    # Lookup-Maps fuer Muster-Positionen
    muster_by_id = {m["id"]: m for m in muster_positions.data}
    muster_isins = {
        m["isin"].upper(): m["id"]
        for m in muster_positions.data if m.get("isin")
    }
    muster_names = {
        m["name"].strip().lower(): m["id"]
        for m in muster_positions.data if m.get("name")
    }

    # Kundenposition → Muster-Position matchen
    matched: dict[str, float] = {}  # muster_id → ist_gewicht
    for pos in positions.data:
        mp_id = _match_position(pos, muster_isins, muster_names)
        if mp_id:
            current_price = pos.get("aktueller_kurs") or pos["kurs"]
            ist_gewicht = (pos["stueckzahl"] * current_price / total_value * 100) if total_value > 0 else 0
            matched[mp_id] = matched.get(mp_id, 0) + ist_gewicht

    # Ergebnis: Fuer jede Muster-Position Soll vs. Ist
    vergleich = []
    for mp in muster_positions.data:
        ziel = mp["zielgewicht_prozent"]
        ist = round(matched.get(mp["id"], 0), 2)
        vergleich.append({
            "name": mp["name"],
            "isin": mp.get("isin"),
            "branche": mp.get("branche"),
            "region": mp.get("region"),
            "zielgewicht": ziel,
            "ist_gewicht": ist,
            "abweichung": round(ist - ziel, 2),
            "vorhanden": mp["id"] in matched,
        })

    return {"vergleich": vergleich}


def _build_breakdown(positions: list[dict], field: str, total_value: float) -> list[dict]:
    """Gruppiert Positionen nach einem Feld und berechnet Gewichtung."""
    buckets: dict[str, float] = {}
    for pos in positions:
        key = pos.get(field) or "Unbekannt"
        price = pos.get("aktueller_kurs") or pos["kurs"]
        value = pos["stueckzahl"] * price
        buckets[key] = buckets.get(key, 0) + value

    return [
        {"name": name, "gewichtung": round(value / total_value * 100, 2) if total_value > 0 else 0}
        for name, value in sorted(buckets.items(), key=lambda x: -x[1])
    ]


@router.get("/portfolio/{portfolio_id}/analyse")
async def get_analyse(
    portfolio_id: str, request: Request, user=Depends(get_current_user)
):
    """Strukturanalyse: Aufschluesselung nach Branche, Land, Typ, Waehrung."""
    sb = get_supabase_for_user(request.state.token)

    portfolio = (
        sb.table("portfolio").select("id").eq("id", portfolio_id).single().execute()
    )
    if not portfolio.data:
        raise HTTPException(404, detail="Portfolio nicht gefunden")

    positions = (
        sb.table("position").select("*").eq("portfolio_id", portfolio_id).execute()
    )

    total_value = sum(
        p["stueckzahl"] * (p.get("aktueller_kurs") or p["kurs"])
        for p in positions.data
    )

    return {
        "branche": _build_breakdown(positions.data, "branche", total_value),
        "land": _build_breakdown(positions.data, "land", total_value),
        "typ": _build_breakdown(positions.data, "typ", total_value),
        "waehrung": _build_breakdown(positions.data, "waehrung", total_value),
    }


@router.delete("/portfolio/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str, request: Request, user=Depends(get_current_user)
):
    """Portfolio loeschen (RLS stellt sicher, dass nur eigene geloescht werden)."""
    sb = get_supabase_for_user(request.state.token)
    sb.table("portfolio").delete().eq("id", portfolio_id).execute()
    return {"status": "geloescht"}
