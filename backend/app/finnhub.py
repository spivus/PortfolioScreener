"""Finnhub API-Client fuer Echtzeit-Kurse, News und Marktdaten."""

import asyncio
import time
from datetime import datetime, timedelta

import httpx
from app.config import FINNHUB_API_KEY

BASE_URL = "https://finnhub.io/api/v1"

# Rate Limiter: max 55 Calls/Minute (Puffer zu 60)
_semaphore = asyncio.Semaphore(1)
_last_call_time = 0.0
_MIN_INTERVAL = 1.1  # Sekunden zwischen Calls


async def _get(path: str, params: dict = {}) -> dict | None:
    """Finnhub API-Call mit Rate Limiting."""
    global _last_call_time
    async with _semaphore:
        now = time.monotonic()
        wait = _MIN_INTERVAL - (now - _last_call_time)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_call_time = time.monotonic()

        params["token"] = FINNHUB_API_KEY
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{BASE_URL}{path}", params=params)
            if resp.status_code == 429:
                await asyncio.sleep(5)
                resp = await client.get(f"{BASE_URL}{path}", params=params)
            if resp.status_code != 200:
                return None
            return resp.json()


async def get_quote(symbol: str) -> dict | None:
    """Aktueller Kurs, Tagesaenderung, Hoch/Tief."""
    data = await _get("/quote", {"symbol": symbol})
    if not data or data.get("c", 0) == 0:
        return None
    return {
        "symbol": symbol,
        "kurs": data["c"],
        "aenderung": data["d"],
        "aenderung_prozent": data["dp"],
        "tageshoch": data["h"],
        "tagestief": data["l"],
        "eroeffnung": data["o"],
    }


async def get_company_news(symbol: str, limit: int = 5) -> list[dict]:
    """Aktuelle News zu einem Symbol."""
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    data = await _get("/company-news", {
        "symbol": symbol,
        "from": week_ago,
        "to": today,
    })
    if not data or not isinstance(data, list):
        return []

    return [
        {
            "headline": item["headline"],
            "summary": item.get("summary", ""),
            "source": item.get("source", ""),
            "url": item.get("url", ""),
            "datetime": item.get("datetime", 0),
        }
        for item in data[:limit]
    ]


async def screen_stocks(symbols: list[str]) -> list[dict]:
    """Kursdaten fuer mehrere Symbole abrufen (sequentiell mit Rate Limiting)."""
    results = []
    for s in symbols:
        r = await get_quote(s)
        if r:
            results.append(r)
    return results


async def get_recommendation(symbol: str) -> dict | None:
    """Aktuelle Analystenempfehlung (Buy/Hold/Sell)."""
    data = await _get("/stock/recommendation", {"symbol": symbol})
    if not data or not isinstance(data, list) or len(data) == 0:
        return None
    latest = data[0]
    return {
        "buy": latest.get("buy", 0) + latest.get("strongBuy", 0),
        "hold": latest.get("hold", 0),
        "sell": latest.get("sell", 0) + latest.get("strongSell", 0),
    }


async def get_company_profile(symbol: str) -> dict | None:
    """Firmenprofil: Name, Branche, Land, Marktkapitalisierung."""
    data = await _get("/stock/profile2", {"symbol": symbol})
    if not data or not data.get("name"):
        return None
    return {
        "name": data.get("name"),
        "branche": data.get("finnhubIndustry"),
        "land": data.get("country"),
        "marktkapitalisierung": data.get("marketCapitalization"),
        "waehrung": data.get("currency"),
        "boerse": data.get("exchange"),
    }


async def get_forex_rates(base: str = "EUR") -> dict[str, float]:
    """Alle Wechselkurse via Frankfurter API (ECB-Referenzkurse, kostenlos).

    Returns z.B. {"USD": 1.15, "CHF": 0.92, "GBP": 0.87, ...}
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.frankfurter.dev/v1/latest",
            params={"base": base},
        )
        if resp.status_code != 200:
            return {}
        data = resp.json()
        return data.get("rates", {})


async def get_sma_200(symbol: str) -> float | None:
    """200-Tage-SMA berechnet aus Yahoo Finance historischen Kursen."""
    now = int(datetime.now().timestamp())
    one_year_ago = int((datetime.now() - timedelta(days=300)).timestamp())

    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?period1={one_year_ago}&period2={now}&interval=1d"
    )
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return None
        data = resp.json()

    try:
        closes = data["chart"]["result"][0]["indicators"]["quote"][0]["close"]
        closes = [c for c in closes if c is not None]
    except (KeyError, IndexError):
        return None

    if len(closes) < 200:
        return None
    return round(sum(closes[-200:]) / 200, 2)


async def fetch_market_data(symbol: str) -> dict:
    """Aggregiert Marktdaten: aktueller Kurs (Finnhub) + SMA-200 (Yahoo).

    Returns dict mit aktueller_kurs, sma_200 (jeweils float | None).
    """
    if not FINNHUB_API_KEY or not symbol:
        return {"aktueller_kurs": None, "sma_200": None}

    quote = await get_quote(symbol)
    sma = await get_sma_200(symbol)  # Yahoo braucht kein Rate Limiting

    return {
        "aktueller_kurs": round(quote["kurs"], 2) if quote else None,
        "sma_200": sma,
    }
