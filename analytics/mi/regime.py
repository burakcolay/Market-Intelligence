"""Piyasa rejimi sınıflandırması ve ertesi gün hareket aralığı tahmini.

1) Rejimler (kümeleme): Her gün oynaklık, trend, 200 günlük ortalamaya uzaklık, VIX ve piyasa genişliğiyle tarif edilir;
   K-ortalamalar (k-means) bu günleri benzer gruplara ayırır. Gruplar betimleyicidir: "bugün geçmişte hangi tür günlere benziyor?"
2) Aralık tahmini: Ertesi günün en yüksek–en düşük farkı (yüzde) doğrusal bir modelle tahmin edilir (HAR yaklaşımı:
   dünün, son haftanın ve son ayın aralığı + VIX). Model zamana göre bölünerek sınanır: eski veriyle eğitilir,
   hiç görmediği son dönemde basit kurallarla karşılaştırılır.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

FEATURES = ["vol21", "ret63", "dist200", "vix", "breadth"]
FEATURE_TR = {"vol21": "1 aylık oynaklık %", "ret63": "3 aylık getiri %", "dist200": "200 g. ort. uzaklık %", "vix": "VIX", "breadth": "200 g. üstü hisse %"}


def features(bench_close: pd.Series, vix: pd.Series | None, breadth: pd.Series | None) -> pd.DataFrame:
    r = bench_close.pct_change()
    f = pd.DataFrame({
        "vol21": r.rolling(21).std() * np.sqrt(252) * 100,
        "ret63": (bench_close / bench_close.shift(63) - 1) * 100,
        "dist200": (bench_close / bench_close.rolling(200).mean() - 1) * 100,
    })
    f["vix"] = vix if vix is not None else np.nan
    f["breadth"] = breadth if breadth is not None else np.nan
    return f.dropna(axis=1, how="all").dropna()


def name_clusters(cent: pd.DataFrame) -> dict[int, str]:
    """Küme merkezlerine bakarak anlamlı ad verir (rastgele küme numarası yerine)."""
    names = {}
    stress = cent["vol21"].idxmax()
    names[stress] = "Stres"
    rest = cent.drop(index=stress).sort_values("ret63")
    labels = ["Düzeltme", "Kararsız", "Güçlü yükseliş"] if len(rest) == 3 else ["Düzeltme", "Yükseliş"]
    for k, lab in zip(rest.index, labels):
        names[k] = lab
    return names


def regimes(f: pd.DataFrame, bench_close: pd.Series, k: int = 4, horizon: int = 20, seed: int = 0) -> dict:
    X = StandardScaler().fit_transform(f.values)
    km = KMeans(n_clusters=k, n_init=20, random_state=seed).fit(X)
    lab = pd.Series(km.labels_, index=f.index)
    cent = f.groupby(lab).mean()
    names = name_clusters(cent)
    named = lab.map(names)
    fwd = (bench_close.shift(-horizon) / bench_close - 1).reindex(f.index) * 100
    rows = []
    for nm, g in f.groupby(named):
        fr = fwd[named == nm].dropna()
        runs = (named != named.shift()).cumsum()[named == nm].value_counts()
        rows.append({"regime": nm, "share": float(len(g) / len(f) * 100), "avg_days": float(runs.mean()),
                     **{c: float(g[c].mean()) for c in f.columns},
                     "fwd_mean": float(fr.mean()), "fwd_median": float(fr.median()), "fwd_hit": float((fr > 0).mean() * 100),
                     "fwd_worst": float(fr.quantile(0.05))})
    order = ["Güçlü yükseliş", "Kararsız", "Yükseliş", "Düzeltme", "Stres"]
    rows.sort(key=lambda x: order.index(x["regime"]) if x["regime"] in order else 9)
    trans = pd.crosstab(named.shift(), named, normalize="index") * 100
    cur = named.iloc[-1]
    streak = int((named.iloc[::-1] == cur).cumprod().sum())   # bugüne kadar kaç gündür aynı rejimde
    return {"current": cur, "streak": streak, "since": named.index[-streak].strftime("%Y-%m-%d"),
            "today": {c: float(f[c].iloc[-1]) for c in f.columns}, "features": list(f.columns),
            "table": rows, "stay_prob": float(trans.loc[cur, cur]) if cur in trans.index else None,
            "timeline": [[d.strftime("%Y-%m-%d"), v] for d, v in named.iloc[::5].items()], "horizon": horizon}


def range_model(high: pd.Series, low: pd.Series, close: pd.Series, vix: pd.Series | None, split: float = 0.7, refit: int = 21) -> dict:
    """Ertesi gün aralığı (en yüksek − en düşük, önceki kapanışa göre %) tahmini ve sınaması.

    Model logaritmik HAR: log(aralık_yarın) = a + b1·log(bugün) + b2·log(son 5 gün ort.) + b3·log(son 22 gün ort.) + b4·log(VIX).
    Logaritma kullanılır çünkü aralık hep pozitif ve sağa çarpıktır; büyük günler modeli aşırı çekmez.
    Sınama ileriye doğru yürüyen pencereyle yapılır: model her ay yalnızca o güne kadarki veriyle yeniden eğitilir
    ve sonraki ayı tahmin eder (geleceği görmeden). Karşılaştırma: "yarın dün gibi olur" ve "yarın son ayın ortalaması olur".
    """
    rng = (high - low) / close.shift(1) * 100
    d = pd.DataFrame({"y": np.log(rng.shift(-1)), "r1": np.log(rng), "r5": np.log(rng.rolling(5).mean()), "r22": np.log(rng.rolling(22).mean())})
    if vix is not None:
        d["vix"] = np.log(vix)
    cols = [c for c in d.columns if c != "y"]
    full = d.replace([np.inf, -np.inf], np.nan).dropna(subset=cols)
    hist = full.dropna(subset=["y"])

    def fit(df):
        A = np.column_stack([np.ones(len(df)), df[cols].values])
        beta, *_ = np.linalg.lstsq(A, df["y"].values, rcond=None)
        smear = float(np.mean(np.exp(df["y"].values - A @ beta)))      # log'dan geri dönüşte yanlılık düzeltmesi
        return beta, smear

    def pred(fitted, df):
        beta, smear = fitted
        return np.exp(np.column_stack([np.ones(len(df)), df[cols].values]) @ beta) * smear

    cut = int(len(hist) * split)
    parts = []
    for i in range(cut, len(hist), refit):
        f = fit(hist.iloc[:i])
        te = hist.iloc[i:i + refit]
        parts.append(pd.Series(pred(f, te), index=te.index))
    p = pd.concat(parts)
    y = np.exp(hist["y"].loc[p.index]).values
    p = p.values

    def score(yhat):
        e = y - yhat
        return {"mae": float(np.mean(np.abs(e))), "rmse": float(np.sqrt(np.mean(e ** 2))),
                "r2": float(1 - np.sum(e ** 2) / np.sum((y - y.mean()) ** 2))}

    ratio = y / p
    lo_q, hi_q = np.quantile(ratio, [0.1, 0.9])
    fall = fit(hist)
    nxt = float(pred(fall, full.iloc[[-1]])[0])
    level = float(close.iloc[-1])
    idx = hist.index[cut:cut + len(p)]
    base1, base22 = np.exp(hist["r1"].loc[idx].values), np.exp(hist["r22"].loc[idx].values)
    m, n1, n22 = score(p), score(base1), score(base22)
    return {
        "test_period": [idx[0].strftime("%Y-%m-%d"), idx[-1].strftime("%Y-%m-%d")], "n_train_start": int(cut), "n_test": int(len(p)),
        "model": m, "naive_yesterday": n1, "naive_month": n22,
        "improvement": float((1 - m["mae"] / min(n1["mae"], n22["mae"])) * 100),
        "coef": dict(zip(["sabit", *cols], [float(x) for x in fall[0]])),
        "next": {"pct": nxt, "lo": nxt * float(lo_q), "hi": nxt * float(hi_q), "points": nxt / 100 * level,
                 "points_lo": nxt * float(lo_q) / 100 * level, "points_hi": nxt * float(hi_q) / 100 * level, "level": level},
        "interval_hit": float(np.mean((y >= p * lo_q) & (y <= p * hi_q)) * 100), "avg_range_1y": float(rng.iloc[-252:].mean()),
        "recent": [[i.strftime("%Y-%m-%d"), float(a), float(b_)] for i, a, b_ in zip(idx[-60:], y[-60:], p[-60:])],
    }
