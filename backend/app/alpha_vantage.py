"""Alpha Vantage API-Client fuer Marktdaten."""

import asyncio
from datetime import datetime

import httpx
from app.config import ALPHA_VANTAGE_API_KEY

BASE_URL = "https://www.alphavantage.co/query"


async def _get(params: dict) -> dict | None:
    """Fuehrt einen Alpha Vantage API-Call aus."""
    params["apikey"] = ALPHA_VANTAGE_API_KEY
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(BASE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
    if "Error Message" in data or "Note" in data or "Information" in data:
        return None
    return data


async def fetch_daily_prices(symbol: str) -> tuple[float | None, float | None]:
    """Holt aktuellen Kurs und YTD-Performance aus TIME_SERIES_DAILY.

    Returns (aktueller_kurs, ytd_performance_percent) oder (None, None).
    """
    data = await _get({
        "function": "TIME_SERIES_DAILY",
        "symbol": symbol,
        "outputsize": "compact",
    })
    if not data or "Time Series (Daily)" not in data:
        return None, None

    ts = data["Time Series (Daily)"]
    dates = sorted(ts.keys(), reverse=True)
    if not dates:
        return None, None

    current_price = float(ts[dates[0]]["4. close"])

    # YTD: Letzter Handelstag des Vorjahres finden
    current_year = datetime.now().year
    prev_year_dates = [d for d in dates if d.startswith(str(current_year - 1))]
    if prev_year_dates:
        year_start_price = float(ts[prev_year_dates[0]]["4. close"])
        ytd = (current_price - year_start_price) / year_start_price * 100
    else:
        # Fallback: aeltester verfuegbarer Kurs im aktuellen Jahr
        current_year_dates = [d for d in dates if d.startswith(str(current_year))]
        if len(current_year_dates) >= 2:
            oldest_price = float(ts[current_year_dates[-1]]["4. close"])
            ytd = (current_price - oldest_price) / oldest_price * 100
        else:
            ytd = None

    return current_price, round(ytd, 2) if ytd is not None else None


async def fetch_sma_200(symbol: str) -> float | None:
    """Holt den aktuellen 200-Tage-SMA."""
    data = await _get({
        "function": "SMA",
        "symbol": symbol,
        "interval": "daily",
        "time_period": "200",
        "series_type": "close",
    })
    if not data or "Technical Analysis: SMA" not in data:
        return None

    sma_data = data["Technical Analysis: SMA"]
    latest_date = sorted(sma_data.keys(), reverse=True)[0]
    return float(sma_data[latest_date]["SMA"])


async def fetch_market_data(symbol: str) -> dict:
    """Aggregiert Marktdaten fuer ein Symbol.

    Returns dict mit aktueller_kurs, sma_200, ytd_performance (jeweils float | None).
    """
    if not ALPHA_VANTAGE_API_KEY or not symbol:
        return {"aktueller_kurs": None, "sma_200": None, "ytd_performance": None}

    aktueller_kurs, ytd = await fetch_daily_prices(symbol)
    await asyncio.sleep(12)
    sma = await fetch_sma_200(symbol)

    return {
        "aktueller_kurs": round(aktueller_kurs, 2) if aktueller_kurs else None,
        "sma_200": round(sma, 2) if sma else None,
        "ytd_performance": ytd,
    }
