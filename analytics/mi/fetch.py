"""Fiyat geçmişini çeker. Birincil kaynak Yahoo Finance (yfinance), yedek Stooq.

İkisi de resmi olmayan ücretsiz kaynaklardır; portföy/öğrenme amaçlı kullanım içindir.
"""
from __future__ import annotations

import io
import logging
import time

import pandas as pd
import requests

from .config import HISTORY_YEARS, LONG_DIR, PRICE_DIR, all_assets

log = logging.getLogger(__name__)
COLS = ["date", "open", "high", "low", "close", "volume"]


def _from_yahoo(symbols: list[str]) -> dict[str, pd.DataFrame]:
    import yfinance as yf

    raw = yf.download(symbols, period=f"{HISTORY_YEARS}y", interval="1d", auto_adjust=True,
                      group_by="ticker", threads=True, progress=False)
    out = {}
    for s in symbols:
        try:
            df = raw[s] if isinstance(raw.columns, pd.MultiIndex) else raw
        except KeyError:
            continue
        df = df.dropna(how="all")
        if df.empty:
            continue
        df = df.reset_index().rename(columns=str.lower)[COLS]
        out[s] = df
    return out


def _from_stooq(symbol: str) -> pd.DataFrame | None:
    """Stooq yedeği: ABD hisseleri 'aapl.us' biçiminde."""
    s = symbol.lower().replace("-", ".")
    s = s if s.startswith("^") else f"{s}.us"
    url = f"https://stooq.com/q/d/l/?s={s}&i=d"
    r = requests.get(url, timeout=20)
    if r.status_code != 200 or not r.text.startswith("Date"):
        return None
    df = pd.read_csv(io.StringIO(r.text)).rename(columns=str.lower)
    df = df[df["date"] >= (pd.Timestamp.today() - pd.DateOffset(years=HISTORY_YEARS)).strftime("%Y-%m-%d")]
    return df.reindex(columns=COLS)


def fetch_all() -> dict[str, int]:
    """Tüm varlıkları çeker ve sembol başına CSV yazar. Dönüş: sembol -> satır sayısı."""
    PRICE_DIR.mkdir(parents=True, exist_ok=True)
    assets = all_assets()
    by_yahoo = {a["yahoo"]: a["code"] for a in assets}
    got: dict[str, pd.DataFrame] = {}
    syms = list(by_yahoo)
    for i in range(0, len(syms), 40):                  # büyük toplu istekleri bölerek
        try:
            got.update(_from_yahoo(syms[i:i + 40]))
        except Exception as e:                           # ağ hatası: yedeğe düşülür
            log.warning("Yahoo toplu indirme hatası: %s", e)
        time.sleep(1)
    missing = [s for s in syms if s not in got]
    for s in missing:
        try:
            df = _from_stooq(s)
            if df is not None and len(df):
                got[s] = df
                log.info("Stooq yedeği kullanıldı: %s", s)
        except Exception as e:
            log.warning("Stooq hatası %s: %s", s, e)
    counts = {}
    for y, df in got.items():
        code = by_yahoo[y]
        df = df.copy()
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        df = df.round({"open": 4, "high": 4, "low": 4, "close": 4})
        df.to_csv(PRICE_DIR / f"{code}.csv", index=False)
        counts[code] = len(df)
    log.info("Fiyat: %d/%d varlık indirildi", len(counts), len(syms))
    return counts


def fetch_long(symbol: str = "^NDX", code: str = "NDX") -> int:
    """Takvim etkileri için endeksin tüm geçmişi (Nasdaq 100: 1985'ten bu yana)."""
    import yfinance as yf

    LONG_DIR.mkdir(parents=True, exist_ok=True)
    try:
        df = yf.download(symbol, period="max", interval="1d", auto_adjust=True, progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.reset_index().rename(columns=str.lower)[COLS]
    except Exception as e:
        log.warning("Uzun geçmiş Yahoo hatası: %s; Stooq deneniyor", e)
        r = requests.get("https://stooq.com/q/d/l/?s=^ndx&i=d", timeout=30)
        df = pd.read_csv(io.StringIO(r.text)).rename(columns=str.lower).reindex(columns=COLS)
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    df = df.dropna(subset=["close"]).round({"open": 2, "high": 2, "low": 2, "close": 2})
    if len(df) > 1000:
        df.to_csv(LONG_DIR / f"{code}.csv", index=False)
    log.info("Uzun geçmiş %s: %d gün", code, len(df))
    return len(df)
