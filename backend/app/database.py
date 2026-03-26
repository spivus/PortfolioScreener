from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY


def get_supabase() -> Client:
    """Supabase-Client mit Anon-Key (fuer Auth-Operationen)."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "SUPABASE_URL und SUPABASE_ANON_KEY muessen in .env gesetzt sein"
        )
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def get_supabase_for_user(token: str) -> Client:
    """Supabase-Client mit User-JWT fuer RLS-geschuetzte Abfragen."""
    client = get_supabase()
    client.postgrest.auth(token)
    return client
