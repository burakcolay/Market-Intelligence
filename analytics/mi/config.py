"""Ayarlar ve evren tanımı."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # repo kökü
AN = ROOT / "analytics"
PRICE_DIR = Path(os.environ.get("MI_PRICE_DIR", AN / "data" / "prices"))  # sembol başına CSV (git'te tutulur)
DB_PATH = Path(os.environ.get("MI_DB", AN / "data" / "market.db"))    # her çalıştırmada yeniden kurulur (git'te tutulmaz)
SQL_DIR = AN / "sql"
LONG_DIR = Path(os.environ.get("MI_LONG_DIR", AN / "data" / "long"))     # takvim etkileri için uzun geçmiş (NDX)
US_DIR = ROOT / "data" / "us"                         # SEC verisi (Node betiği üretir)
SITE_OUT = Path(os.environ.get("MI_SITE_OUT", ROOT / "data" / "analytics"))  # sitenin okuduğu JSON
REPORT_DIR = Path(os.environ.get("MI_REPORT_DIR", ROOT / "reports"))

HISTORY_YEARS = 5
TRADING_DAYS = 252

# Makro ve çapraz varlıklar: Yahoo sembolü -> (kısa kod, Türkçe ad, sınıf)
MACRO = {
    "^NDX": ("NDX", "Nasdaq 100", "endeks"),
    "^GSPC": ("SPX", "S&P 500", "endeks"),
    "^VIX": ("VIX", "VIX (korku endeksi)", "oynaklık"),
    "^TNX": ("US10Y", "ABD 10 yıllık faiz", "faiz"),
    "DX-Y.NYB": ("DXY", "Dolar endeksi", "döviz"),
    "GC=F": ("GOLD", "Altın", "emtia"),
    "CL=F": ("OIL", "Ham petrol (WTI)", "emtia"),
    "BTC-USD": ("BTC", "Bitcoin", "kripto"),
    "TLT": ("TLT", "ABD uzun vadeli tahvil fonu", "tahvil"),
}
BENCHMARK = "NDX"


def universe() -> list[dict]:
    """Nasdaq 100 şirketleri: SEC betiğinin ürettiği universe.json'dan."""
    path = US_DIR / "universe.json"
    rows = json.loads(path.read_text())["rows"]
    return [{"code": r["t"], "name": r["name"], "sector": r.get("sector") or "", "yahoo": r["t"].replace(".", "-")} for r in rows]


def all_assets() -> list[dict]:
    """Hisseler + makro varlıklar, tek liste."""
    out = [{**u, "cls": "hisse"} for u in universe()]
    for y, (code, name, cls) in MACRO.items():
        out.append({"code": code, "name": name, "sector": "", "yahoo": y, "cls": cls})
    return out
