"""Ekonomik sürpriz endeksi (Citi Economic Surprise Index'in basit bir benzeri).

Kaynak: sitenin günlük dosyaları (data/daily/*.json). Her açıklanan veri için
gerçekleşen ile beklenti karşılaştırılır ve tek bir puan çıkar:
  +1  beklentiden güçlü (büyüme verisi) / beklentiden sıcak (enflasyon verisi)
  −1  beklentiden zayıf / beklentiden soğuk
   0  beklentiye yakın (fark beklentinin %1'inden küçük)
İşsizlik ve başvurularda yön terstir (düşük gelmesi güçlü demek).

Endeks = son 30 gündeki puanların ortalaması (−1 ile +1 arası), ülke ve
kategori (büyüme / enflasyon) bazında. Puan büyüklüğü değil yönü sayar;
böylece "kaç veri beklentiyi aştı, kaçı altında kaldı" diye okunur.

Tarih: sürpriz kartlarında açıklama günü yazılı (meta: "ABD · Eylül · 2 Eki").
Tablolarda (countries.rows) yazılı değil; satır ilk göründüğü günün tarihini alır.
İlk dosyadaki tablo satırlarının açıklama tarihi bilinmediği için onlar alınmaz
(yanlış güne yığılmasınlar diye).
"""
from __future__ import annotations

import json
import re
from datetime import date, timedelta
from pathlib import Path

from .config import ROOT, SITE_OUT

DAILY = ROOT / "data" / "daily"
WINDOW = 30
MONTHS = {"Oca": 1, "Şub": 2, "Mar": 3, "Nis": 4, "May": 5, "Haz": 6, "Tem": 7, "Ağu": 8, "Eyl": 9, "Eki": 10, "Kas": 11, "Ara": 12}
COUNTRY_ALIAS = {"Almanya": "Euro Bölgesi", "Fransa": "Euro Bölgesi", "İtalya": "Euro Bölgesi"}
INFL = ("TÜFE", "ÜFE", "PCE", "HICP", "enflasyon", "fiyat", "kazanç", "ücret")
INVERSE = ("işsizlik", "başvuru")
SKIP = ("faiz", "dengesi", "denge")  # politika faizi kararları ve dış denge yön taşımaz


def parse_num(s) -> float | None:
    """'−%10,6' → -10.6 · '197K' → 197 · '3.194,6' → 3194.6 · aralık ya da '—' → None."""
    if s is None:
        return None
    t = str(s).strip().replace("−", "-").replace("–", "-")
    if not t or t in ("—", "-") or re.search(r"\d\s*-\s*\d", t):
        return None
    m = re.search(r"-?\+?[\d.]+(?:,\d+)?", t.replace("%", "").replace(" ", ""))
    if not m:
        return None
    x = m.group(0).replace("+", "")
    neg = x.startswith("-") or t.lstrip().startswith("-")
    x = x.lstrip("-").replace(".", "").replace(",", ".")
    try:
        v = float(x)
    except ValueError:
        return None
    return -v if neg else v


def _low(s: str) -> str:
    return s.replace("İ", "i").replace("I", "ı").lower()


def category(name: str) -> str | None:
    if any(_low(k) in _low(name) for k in SKIP):
        return None
    return "inflation" if any(_low(k) in _low(name) for k in INFL) else "activity"


def score(name: str, actual, cons) -> int | None:
    a, c = parse_num(actual), parse_num(cons)
    if a is None or c is None:
        return None
    d = a - c
    if abs(d) < max(abs(c) * 0.01, 0.05):
        return 0
    s = 1 if d > 0 else -1
    return -s if any(k in _low(name) for k in INVERSE) else s


def _meta_date(meta: str, year: int) -> date | None:
    m = re.search(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")\s*$", meta or "")
    return date(year, MONTHS[m.group(2)], int(m.group(1))) if m else None


def collect(daily_dir: Path = DAILY) -> list[dict]:
    files = sorted(p for p in daily_dir.glob("????-??-??.json"))
    events: dict[tuple, dict] = {}
    for i, p in enumerate(files):
        fd = date.fromisoformat(p.stem)
        M = json.loads(p.read_text()).get("makro") or {}
        for s in M.get("surprises", []):
            country = COUNTRY_ALIAS.get((s.get("meta") or "").split("·")[0].strip(), (s.get("meta") or "").split("·")[0].strip())
            cat, sc = category(s["name"]), score(s["name"], s.get("actual"), s.get("cons"))
            d = _meta_date(s.get("meta", ""), fd.year)
            if cat is None or sc is None or d is None:
                continue
            if d > fd:  # yıl dönümü (Ara verisi Oca dosyasında)
                d = date(d.year - 1, d.month, d.day)
            key = (country, parse_num(s.get("actual")), parse_num(s.get("cons")))
            events.setdefault(key, {"date": d.isoformat(), "country": country, "name": s["name"], "actual": s.get("actual"),
                                    "cons": s.get("cons"), "cat": cat, "score": sc})
        if i == 0:
            continue
        for country, C in (M.get("countries") or {}).items():
            country = COUNTRY_ALIAS.get(country, country)
            for r in C.get("rows", []):
                if "name" not in r:
                    continue
                cat, sc = category(r["name"]), score(r["name"], r.get("actual"), r.get("cons"))
                if cat is None or sc is None:
                    continue
                key = (country, parse_num(r.get("actual")), parse_num(r.get("cons")))
                events.setdefault(key, {"date": fd.isoformat(), "country": country, "name": r["name"], "actual": r.get("actual"),
                                        "cons": r.get("cons"), "cat": cat, "score": sc})
    # ilk dosyada görülen tablo satırlarını sonraki günler "yeni" sanmasın
    if files:
        M0 = json.loads(files[0].read_text()).get("makro") or {}
        seen0 = {(COUNTRY_ALIAS.get(c, c), parse_num(r.get("actual")), parse_num(r.get("cons")))
                 for c, C in (M0.get("countries") or {}).items() for r in C.get("rows", []) if "name" in r}
        surpr = {(COUNTRY_ALIAS.get((s.get("meta") or "").split("·")[0].strip(), (s.get("meta") or "").split("·")[0].strip()),
                  parse_num(s.get("actual")), parse_num(s.get("cons"))) for p in files for s in (json.loads(p.read_text()).get("makro") or {}).get("surprises", [])}
        events = {k: v for k, v in events.items() if k in surpr or k not in seen0}
    return sorted(events.values(), key=lambda e: (e["date"], e["country"], e["name"]))


def index(events: list[dict], end: date, window: int = WINDOW) -> dict:
    if not events:
        return {"dates": [], "series": {}}
    start = date.fromisoformat(events[0]["date"])
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    countries = ["Tümü"] + sorted({e["country"] for e in events}, key=lambda c: ["ABD", "Euro Bölgesi", "Türkiye"].index(c) if c in ("ABD", "Euro Bölgesi", "Türkiye") else 9)
    series: dict = {}
    for c in countries:
        series[c] = {}
        for cat in ("activity", "inflation"):
            pts = []
            for d in days:
                lo = d - timedelta(days=window)
                xs = [e["score"] for e in events if (c == "Tümü" or e["country"] == c) and e["cat"] == cat and lo < date.fromisoformat(e["date"]) <= d]
                pts.append({"v": round(sum(xs) / len(xs), 2) if xs else None, "n": len(xs)})
            series[c][cat] = pts
    return {"dates": [d.isoformat() for d in days], "series": series}


def build(daily_dir: Path = DAILY, out_dir: Path = SITE_OUT) -> dict:
    events = collect(daily_dir)
    files = sorted(daily_dir.glob("????-??-??.json"))
    end = date.fromisoformat(files[-1].stem) if files else date.today()
    out = {"updated": end.isoformat(), "window_days": WINDOW, **index(events, end), "events": events[-40:]}
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "surprise.json").write_text(json.dumps(out, ensure_ascii=False))
    return out


if __name__ == "__main__":
    o = build()
    print(len(o["events"]), "veri;", {c: {k: v[-1] for k, v in s.items()} for c, s in o["series"].items()})
