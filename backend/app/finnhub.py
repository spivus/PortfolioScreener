"""Finnhub API-Client fuer Echtzeit-Kurse, News und Marktdaten."""

import asyncio
import logging
import time
from datetime import datetime, timedelta

import httpx
import yfinance as yf
from app.config import FINNHUB_API_KEY

logger = logging.getLogger(__name__)

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


async def _yahoo_chart_meta(symbol: str) -> dict:
    """52W-Hoch/Tief aus Yahoo Finance Chart-Metadaten."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return {}
        data = resp.json()
    try:
        return data["chart"]["result"][0]["meta"]
    except (KeyError, IndexError):
        return {}


async def fetch_fundamentals(symbol: str, waehrung: str | None = None) -> dict:
    """52W-Hoch, Forward KGV, Beta via Finnhub + Yahoo Fallback."""
    result = {
        "high_52w": None, "low_52w": None,
        "forward_pe": None, "beta": None,
    }
    # Finnhub (funktioniert nur fuer US-Aktien)
    data = await _get("/stock/metric", {"symbol": symbol, "metric": "all"})
    if data and data.get("metric"):
        m = data["metric"]
        result["high_52w"] = m.get("52WeekHigh")
        result["low_52w"] = m.get("52WeekLow")
        result["forward_pe"] = round(m["forwardPE"], 2) if m.get("forwardPE") else None
        result["beta"] = round(m["beta"], 2) if m.get("beta") else None

    # Yahoo Fallback fuer 52W wenn Finnhub nichts liefert
    if result["high_52w"] is None:
        yahoo_sym = symbol
        if "." not in symbol and waehrung:
            suffixes = YAHOO_SUFFIX_MAP.get(waehrung, [""])
            for suffix in suffixes:
                meta = await _yahoo_chart_meta(f"{symbol}{suffix}")
                if meta.get("fiftyTwoWeekHigh"):
                    result["high_52w"] = meta["fiftyTwoWeekHigh"]
                    result["low_52w"] = meta.get("fiftyTwoWeekLow")
                    break
        else:
            meta = await _yahoo_chart_meta(yahoo_sym)
            if meta.get("fiftyTwoWeekHigh"):
                result["high_52w"] = meta["fiftyTwoWeekHigh"]
                result["low_52w"] = meta.get("fiftyTwoWeekLow")

    return result


def fetch_analyst_target(symbol: str) -> dict:
    """Analysten-Kursziel, Forward KGV und Beta via yfinance (synchron)."""
    result = {"target_price": None, "target_potential": None,
              "forward_pe": None, "beta": None}
    try:
        info = yf.Ticker(symbol).info
        target = info.get("targetMeanPrice")
        current = info.get("currentPrice")
        if target and current and current > 0:
            result["target_price"] = round(target, 2)
            result["target_potential"] = round((target - current) / current * 100, 2)
        fpe = info.get("forwardPE")
        if fpe and fpe > 0:
            result["forward_pe"] = round(fpe, 2)
        b = info.get("beta")
        if b:
            result["beta"] = round(b, 2)
    except Exception:
        pass
    return result


async def fetch_analyst_target_async(symbol: str) -> dict:
    """Async-Wrapper fuer yfinance (blockierender Call)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, fetch_analyst_target, symbol)


async def _yahoo_search(query: str) -> list[dict]:
    """Yahoo Finance Search - gibt Liste von Quotes zurueck."""
    url = "https://query2.finance.yahoo.com/v1/finance/search"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            url,
            params={"q": query, "quotesCount": 10, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
        )
        if resp.status_code != 200:
            return []
        return resp.json().get("quotes", [])


def _pick_best_symbol(quotes: list[dict]) -> str | None:
    """Waehlt das beste Symbol aus Yahoo-Suchergebnissen (.DE bevorzugt)."""
    if not quotes:
        return None
    # .DE-Symbol bevorzugen (Xetra, relevant fuer deutsche Berater)
    for q in quotes:
        sym = q.get("symbol", "")
        if sym.endswith(".DE"):
            return sym
    return quotes[0].get("symbol")


async def resolve_symbol_by_isin(isin: str, name: str | None = None) -> str | None:
    """ISIN → Ticker via Yahoo Finance Search, mit Name-Fallback."""
    quotes = await _yahoo_search(isin)
    symbol = _pick_best_symbol(quotes)
    if symbol:
        return symbol
    # Fallback: Name-basierte Suche
    if name:
        quotes = await _yahoo_search(name)
        return _pick_best_symbol(quotes)
    return None


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
        "ticker": data.get("ticker"),
    }


async def search_symbol(name: str, expected_name: str | None = None) -> str | None:
    """Sucht das korrekte Ticker-Symbol fuer einen Firmennamen via Finnhub.

    Wenn expected_name angegeben, wird geprueft ob das Ergebnis zum Firmennamen passt.
    """
    data = await _get("/search", {"q": name})
    if not data or not data.get("result"):
        return None

    def _matches(description: str) -> bool:
        if not expected_name:
            return True
        # Pruefen ob die ersten Woerter des Firmennamens in der Beschreibung vorkommen
        keywords = expected_name.lower().split()[:2]
        desc_lower = description.lower()
        return any(kw in desc_lower for kw in keywords)

    # Erstes Ergebnis mit Typ "Common Stock" das zum Namen passt
    for r in data["result"]:
        if r.get("type") == "Common Stock" and _matches(r.get("description", "")):
            return r["symbol"]
    # Fallback: erstes Ergebnis das passt
    for r in data["result"]:
        if _matches(r.get("description", "")):
            return r["symbol"]
    return None


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


async def fetch_historical_metrics(symbol: str) -> dict:
    """SMA-200, Perf 5T und YTD aus Yahoo Finance historischen Kursen (1 Call).

    Returns dict mit sma_200, perf_5d, perf_ytd (jeweils float | None).
    """
    now = int(datetime.now().timestamp())
    one_year_ago = int((datetime.now() - timedelta(days=400)).timestamp())

    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?period1={one_year_ago}&period2={now}&interval=1d"
    )
    result = {"aktueller_kurs_yahoo": None, "sma_200": None, "perf_5d": None, "perf_ytd": None}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return result
        data = resp.json()

    try:
        timestamps = data["chart"]["result"][0]["timestamp"]
        closes = data["chart"]["result"][0]["indicators"]["quote"][0]["close"]
    except (KeyError, IndexError):
        return result

    # Paare (date, close) filtern
    pairs = [
        (datetime.fromtimestamp(t).strftime("%Y-%m-%d"), c)
        for t, c in zip(timestamps, closes) if c is not None
    ]
    if not pairs:
        return result

    current_price = pairs[-1][1]
    result["aktueller_kurs_yahoo"] = round(current_price, 2)

    # SMA-200
    close_values = [c for _, c in pairs]
    if len(close_values) >= 200:
        result["sma_200"] = round(sum(close_values[-200:]) / 200, 2)

    # Perf 5 Handelstage
    if len(pairs) > 5:
        price_5d = pairs[-6][1]
        result["perf_5d"] = round((current_price - price_5d) / price_5d * 100, 2)

    # Perf YTD (letzter Handelstag des Vorjahres)
    current_year = datetime.now().year
    prev_year_pairs = [(d, c) for d, c in pairs if d.startswith(str(current_year - 1))]
    if prev_year_pairs:
        year_start_price = prev_year_pairs[-1][1]
        result["perf_ytd"] = round((current_price - year_start_price) / year_start_price * 100, 2)

    return result


YAHOO_SUFFIX_MAP = {
    "EUR": [".DE", ".F", ""],
    "GBP": [".L", ""],
    "CHF": [".SW", ""],
    "DKK": [".CO", ""],
    "SEK": [".ST", ""],
    "NOK": [".OL", ""],
    "JPY": [".T", ""],
    "AUD": [".AX", ""],
    "HKD": [".HK", ""],
    "CAD": [".TO", ""],
}


async def _resolve_yahoo_symbol(symbol: str, waehrung: str | None) -> dict:
    """Versucht Yahoo-Suffixe basierend auf Waehrung, bis Daten gefunden werden."""
    # Wenn Symbol schon einen Suffix hat, direkt verwenden
    if "." in symbol:
        return await fetch_historical_metrics(symbol)

    suffixes = YAHOO_SUFFIX_MAP.get(waehrung or "USD", [""])
    for suffix in suffixes:
        hist = await fetch_historical_metrics(f"{symbol}{suffix}")
        if hist.get("aktueller_kurs_yahoo") is not None:
            return hist
    return {"aktueller_kurs_yahoo": None, "sma_200": None, "perf_5d": None, "perf_ytd": None}


async def fetch_market_data(symbol: str, waehrung: str | None = None) -> dict:
    """Aggregiert Marktdaten: Finnhub + Yahoo (mit Exchange-Suffix-Fallback).

    Returns dict mit aktueller_kurs, sma_200, perf_5d, perf_ytd.
    """
    if not symbol:
        return {"aktueller_kurs": None, "sma_200": None, "perf_5d": None, "perf_ytd": None}

    quote = await get_quote(symbol)
    hist = await _resolve_yahoo_symbol(symbol, waehrung)

    finnhub_price = round(quote["kurs"], 2) if quote else None
    yahoo_price = hist.pop("aktueller_kurs_yahoo", None)

    return {
        "aktueller_kurs": finnhub_price or yahoo_price,
        **hist,
    }
