"""Piyasa genişliği ve yoğunlaşma.

Soru: Endeksin yükselişini hisselerin çoğu mu taşıyor, yoksa birkaç dev şirket mi?
- Genişlik: hisselerin kaçta kaçı kendi 200 ve 50 günlük ortalamasının üstünde, kaç hisse 52 haftalık zirvede/dipte.
- Yoğunlaşma: endeks getirisinin ne kadarı en büyük 10 şirketten geliyor; eşit ağırlıklı sepet ile endeksin farkı.
- Ayrışma testi: endeks zirvedeyken genişlik zayıfsa sonraki getiri farklı mı?

Not: Evren bugünkü Nasdaq 100. Geçmişte endeksten çıkan zayıf hisseler yok, bu yüzden geçmiş genişlik olduğundan
biraz yüksek görünür (hayatta kalma yanlılığı).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

MIN_STOCKS = 50


def above_ma(close: pd.DataFrame, n: int) -> pd.Series:
    """Her gün, ortalaması hesaplanabilen hisselerin yüzde kaçı n günlük ortalamasının üstünde."""
    ma = close.rolling(n, min_periods=n).mean()
    valid = ma.notna() & close.notna()
    cnt = valid.sum(axis=1)
    pct = ((close > ma) & valid).sum(axis=1) / cnt * 100
    return pct.where(cnt >= MIN_STOCKS)


def highs_lows(close: pd.DataFrame, n: int = 252) -> pd.DataFrame:
    hi = close >= close.rolling(n, min_periods=n).max()
    lo = close <= close.rolling(n, min_periods=n).min()
    return pd.DataFrame({"new_high": hi.sum(axis=1), "new_low": lo.sum(axis=1)})


def contributions(close: pd.DataFrame, mcap: pd.Series, days: int) -> pd.DataFrame:
    """Son `days` günde her hissenin endeks (piyasa değeri ağırlıklı) getirisine katkısı, yüzde puan.

    Dönem başı ağırlık, bugünkü piyasa değerinin dönem getirisiyle geriye çevrilmesiyle yaklaşık bulunur.
    """
    r = close.iloc[-1] / close.iloc[-1 - days] - 1
    m = mcap.reindex(r.index).dropna()
    r = r.reindex(m.index).dropna()
    start = m.loc[r.index] / (1 + r)
    w = start / start.sum()
    c = (w * r * 100).sort_values(ascending=False)
    return pd.DataFrame({"contrib": c, "ret": r.loc[c.index] * 100, "weight": w.loc[c.index] * 100})


def concentration(close: pd.DataFrame, mcap: pd.Series, bench: pd.Series) -> dict:
    out = {}
    for label, d in (("1a", 21), ("3a", 63), ("1y", 252)):
        if len(close) <= d:
            continue
        c = contributions(close, mcap, d)
        total = c["contrib"].sum()
        top = c.reindex(mcap.sort_values(ascending=False).index[:10]).dropna()
        ew = (close.iloc[-1] / close.iloc[-1 - d] - 1).mean() * 100
        out[label] = {
            "index_ret": float(total), "bench_ret": float((bench.iloc[-1] / bench.iloc[-1 - d] - 1) * 100),
            "equal_weight_ret": float(ew), "top10_contrib": float(top["contrib"].sum()),
            "top10_share": float(top["contrib"].sum() / total * 100) if abs(total) > 0.5 else None,
            "leaders": c.head(5).round(2).reset_index(names="code").to_dict("records"),
            "laggards": c.tail(5).iloc[::-1].round(2).reset_index(names="code").to_dict("records"),
            "up_share": float((c["ret"] > 0).mean() * 100),
        }
    return out


def divergence_test(bench: pd.Series, pct200: pd.Series, horizon: int = 40, step: int = 10) -> dict:
    """Endeks 52 haftalık zirvesine %2'den yakınken genişlik zayıf (<%50) ve güçlü (≥%65) günleri karşılaştırır.

    Ardışık günlerin ileri getirileri neredeyse aynı olduğundan (örtüşen pencereler) her `step` günde bir örnek alınır.
    """
    near_high = bench >= bench.rolling(252, min_periods=200).max() * 0.98
    fwd = (bench.shift(-horizon) / bench - 1) * 100
    df = pd.DataFrame({"near": near_high, "b": pct200, "f": fwd}).dropna().iloc[::step]
    df = df[df["near"]]
    weak, strong = df[df["b"] < 50]["f"], df[df["b"] >= 65]["f"]
    res = {"horizon": horizon, "weak": {"n": int(len(weak)), "mean": float(weak.mean()) if len(weak) else None},
           "strong": {"n": int(len(strong)), "mean": float(strong.mean()) if len(strong) else None}}
    if len(weak) >= 5 and len(strong) >= 5:
        t, p = stats.ttest_ind(weak, strong, equal_var=False)
        res.update({"t": float(t), "p": float(p)})
    return res


def analyze(close: pd.DataFrame, stocks: list[str], mcap: pd.Series, bench_code: str = "NDX") -> dict:
    s = close[[c for c in stocks if c in close.columns]]
    bench = close[bench_code]
    p200, p50 = above_ma(s, 200), above_ma(s, 50)
    hl = highs_lows(s)
    ew = (1 + s.pct_change(fill_method=None).mean(axis=1).fillna(0)).cumprod()   # eşit ağırlıklı sepet (her gün tüm hisselerin ortalama getirisi)
    weekly = pd.DataFrame({"p200": p200, "p50": p50, "ndx": bench / bench.iloc[0] * 100, "ew": ew / ew.iloc[0] * 100}).iloc[::5].dropna(subset=["p200"])
    return {
        "now": {"p200": float(p200.iloc[-1]), "p50": float(p50.iloc[-1]), "p200_1m": float(p200.iloc[-22]),
                "new_high": int(hl["new_high"].iloc[-1]), "new_low": int(hl["new_low"].iloc[-1]),
                "p200_pctile": float(p200.rank(pct=True).iloc[-1] * 100)},
        "series": [[d.strftime("%Y-%m-%d"), *[None if pd.isna(v) else round(float(v), 2) for v in row]] for d, row in weekly.iterrows()],
        "series_cols": ["date", "p200", "p50", "ndx", "ew"],
        "concentration": concentration(s, mcap, bench),
        "divergence": divergence_test(bench, p200),
        "ew_vs_index_5y": float((ew.iloc[-1] / ew.iloc[0] - bench.iloc[-1] / bench.iloc[0]) * 100),
    }
