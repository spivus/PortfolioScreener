"""Registrierung und Login via Supabase Auth."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_supabase

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(body: RegisterRequest):
    """Neuen Berater registrieren."""
    sb = get_supabase()
    try:
        result = sb.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {"name": body.name}},
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not result.user:
        raise HTTPException(status_code=400, detail="Registrierung fehlgeschlagen")

    return {"user_id": result.user.id, "email": result.user.email}


@router.post("/login")
async def login(body: LoginRequest):
    """Berater einloggen."""
    sb = get_supabase()
    try:
        result = sb.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail="Ungueltige Anmeldedaten")

    return {
        "access_token": result.session.access_token,
        "user": {
            "id": result.user.id,
            "email": result.user.email,
            "name": result.user.user_metadata.get("name", ""),
        },
    }
