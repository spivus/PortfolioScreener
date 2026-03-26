"""JWT-Validierung fuer geschuetzte Endpunkte."""

from fastapi import HTTPException, Request
from app.database import get_supabase


async def get_current_user(request: Request):
    """Extrahiert und validiert Supabase JWT aus dem Authorization Header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")

    token = auth_header.removeprefix("Bearer ")
    sb = get_supabase()
    user_response = sb.auth.get_user(token)

    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Ungueltiger Token")

    # Token im Request speichern fuer RLS-Zugriff
    request.state.token = token
    return user_response.user
