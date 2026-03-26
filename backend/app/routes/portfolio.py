"""Portfolio CRUD-Endpunkte."""

from fastapi import APIRouter, Depends, HTTPException, Request
from app.auth import get_current_user
from app.database import get_supabase_for_user

router = APIRouter(tags=["Portfolio"])


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
    """Ein Portfolio mit allen Positionen."""
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
    return {**portfolio.data, "positionen": positions.data}


@router.delete("/portfolio/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str, request: Request, user=Depends(get_current_user)
):
    """Portfolio loeschen (RLS stellt sicher, dass nur eigene geloescht werden)."""
    sb = get_supabase_for_user(request.state.token)
    sb.table("portfolio").delete().eq("id", portfolio_id).execute()
    return {"status": "geloescht"}
