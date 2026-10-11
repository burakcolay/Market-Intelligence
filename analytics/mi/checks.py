"""Otomatik veri kontrolleri: her çalıştırmada verinin kendi içinde ve kaynaklar arasında tutarlı olup olmadığını sınar.

Bir kontrolün başarısız olması analizi durdurmaz; sonuç sitede ve raporda görünür, böylece hangi rakama
güvenilmemesi gerektiği bilinir.
"""
from __future__ import annotations

import json
from datetime import date, timedelta

import numpy as np
import pandas as pd

from .config import US_DIR


# Elle doğrulanmış, gerçek olan aşırı hareketler (kaynakla birlikte); kontrol bunları sorun saymaz
VERIFIED_MOVES = {
    ("MRNA", "2026-08-19"): "kanser aşısı verisi, tek günde +%177 (gerçek)",
    ("PDD", "2022-03-16"): "Çin teknoloji hisselerinde toplu yükseliş (gerçek)",
}


def _co() -> dict:
    return {p.stem: json.loads(p.read_text()) for p in sorted((US_DIR / "co").glob("*.json"))}


def run(close: pd.DataFrame, ret: pd.DataFrame) -> dict:
    uni = {r["t"]: r for r in json.loads((US_DIR / "universe.json").read_text())["rows"]}
    co = _co()
    last_day = close.index[-1]
    checks = []

    def add(key, title, why, items, total):
        checks.append({"key": key, "title": title, "why": why, "total": int(total), "failed": items, "ok": not items})

    # 1. İki bağımsız fiyat kaynağı aynı kapanışı veriyor mu?
    bad = []
    n = 0
    for t, r in uni.items():
        if t in close.columns and r.get("price"):
            n += 1
            y = close[t].dropna().iloc[-1]
            d = (y / r["price"] - 1) * 100
            if abs(d) > 1.5:
                bad.append({"code": t, "detail": f"Yahoo {y:.2f}, CNBC {r['price']:.2f} ({d:+.1f}%)"})
    add("price_cross", "Fiyat kaynakları uyuşuyor", "Yahoo ve CNBC'nin son kapanışı %1,5'ten fazla farklıysa biri hatalı ya da günü kaymış.", bad, n)

    # 2. Fiyat güncel mi?
    stale = [{"code": c, "detail": f"son veri {close[c].last_valid_index():%Y-%m-%d}"} for c in close.columns
             if close[c].last_valid_index() is not None and (last_day - close[c].last_valid_index()).days > 6]
    add("price_stale", "Fiyatlar güncel", "Son işlem gününden 6 günden eski fiyat, kaynakta kesinti olduğunu gösterir.", stale, close.shape[1])

    # 3. Ayıklanmamış aşırı hareket (bölünme hatası olabilir)
    big = []
    for c in ret.columns:
        if c in ("US10Y", "VIX"):
            continue
        s = ret[c].dropna()
        for d_, v in s[s.abs() > 0.5].items():
            if (c, d_.strftime("%Y-%m-%d")) in VERIFIED_MOVES:
                continue
            big.append({"code": c, "detail": f"{d_:%Y-%m-%d} günlük %{v * 100:.0f}"})
    add("big_moves", "Günlük %50 üstü hareket yok", "Bu büyüklükte hareket çoğunlukla düzeltilmemiş hisse bölünmesidir; gerçekse de incelenmelidir.", big, ret.shape[1])

    today = date.fromisoformat(last_day.strftime("%Y-%m-%d"))
    fresh, ident_g, ident_b, mc, cur = [], [], [], [], []
    nf = ng = nb = nm = 0
    for t, c in co.items():
        f = c.get("fin") or {}
        a = f.get("annual") or []
        if a:
            nf += 1
            end = date.fromisoformat(a[-1]["end"])
            if today - end > timedelta(days=470):
                fresh.append({"code": t, "detail": f"son yıllık rapor {a[-1]['end']}"})
            x = a[-1]
            if all(x.get(k) is not None for k in ("revenue", "gross", "cogs")) and x["revenue"]:
                ng += 1
                e = abs(x["gross"] - (x["revenue"] - x["cogs"])) / abs(x["revenue"]) * 100
                if e > 2:
                    ident_g.append({"code": t, "detail": f"brüt kâr ≠ gelir − maliyet (%{e:.1f} fark)"})
            if all(x.get(k) is not None for k in ("assets", "liab", "equity")) and x["assets"]:
                nb += 1
                e = abs(x["assets"] - x["liab"] - x["equity"]) / x["assets"] * 100
                if e > 10:
                    ident_b.append({"code": t, "detail": f"varlık ≠ yükümlülük + özkaynak (%{e:.0f} fark)"})
        if f.get("currency_orig"):
            cur.append({"code": t, "detail": f"{f['currency_orig']} raporluyor, bugünkü kurla dolara çevrildi"})
        r = uni.get(t, {})
        if f.get("shares") and r.get("price") and r.get("mcap"):
            nm += 1
            k = r["price"] * f["shares"] / r["mcap"]
            if abs(k - 1) > 0.15:
                mc.append({"code": t, "detail": f"fiyat × hisse sayısı, piyasa değerinin {k:.2f} katı (bölünme ya da çoklu hisse sınıfı)"})
    add("fin_fresh", "Finansallar güncel", "Son yıllık raporu 15 aydan eski olan şirketin oranları güncel değildir.", fresh, nf)
    add("gross_identity", "Gelir tablosu kendi içinde tutarlı", "Brüt kâr = gelir − satış maliyeti olmalı; tutmuyorsa yanlış kalem eşleşmiş olabilir.", ident_g, ng)
    add("bs_identity", "Bilanço denkliği", "Varlıklar = yükümlülükler + özkaynak (azınlık payı yüzünden %10'a kadar fark normal).", ident_b, nb)
    add("mcap_shares", "Piyasa değeri ile hisse sayısı tutarlı", "Fark, bölünmeden sonra güncellenmemiş hisse sayısı ya da birden fazla hisse sınıfından gelir; piyasa değeri CNBC'den alındığı için oranlar etkilenmez.", mc, nm)
    add("currency", "Para birimi", "Dolar dışı raporlayan şirketler kurla çevrilir; geçmiş yıllar da bugünkü kurla çevrildiği için dolar bazlı büyüme yaklaşıktır.", cur, len(co))
    passed = sum(1 for c in checks if c["ok"])
    return {"date": last_day.strftime("%Y-%m-%d"), "passed": passed, "total": len(checks), "checks": checks}
