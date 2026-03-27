"""Musterportfolio-Endpunkte."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user
from app.database import get_supabase_for_user

router = APIRouter(tags=["Musterportfolio"])


class MusterPositionInput(BaseModel):
    isin: str | None = None
    name: str
    zielgewicht_prozent: float = 0
    assetklasse: str | None = None
    branche: str | None = None
    region: str | None = None


class MusterportfolioUpdate(BaseModel):
    name: str | None = None
    beschreibung: str | None = None
    positionen: list[MusterPositionInput]


@router.get("/musterportfolio")
async def get_musterportfolio(request: Request, user=Depends(get_current_user)):
    """Aktuelles Musterportfolio mit allen Positionen."""
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

    return {**mp.data, "positionen": positionen.data}


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

    # Name/Beschreibung aktualisieren wenn angegeben
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.beschreibung is not None:
        updates["beschreibung"] = body.beschreibung
    if updates:
        sb.table("musterportfolio").update(updates).eq("id", mp_id).execute()

    # Rows vorbereiten vor dem Loeschen (Validierung vor DB-Aenderung)
    rows = [
        {**pos.model_dump(), "musterportfolio_id": mp_id}
        for pos in body.positionen
    ]

    # Alte Positionen loeschen, neue einfuegen
    sb.table("muster_position").delete().eq("musterportfolio_id", mp_id).execute()
    if rows:
        sb.table("muster_position").insert(rows).execute()

    return await get_musterportfolio(request, user)
