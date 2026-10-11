"""Takvim etkileri: Nasdaq 100'ün uzun geçmişinde gün, ay ve özel dönemlere göre getiri farkı var mı?

Test edilen iddialar: haftanın günü, ay dönümü (ayın son günü + ilk 3 günü), yılın ayları, opsiyon vadesi haftası
(ayın 3. cuması), tatil öncesi gün. Her grup "diğer tüm günler" ile Welch t-testiyle karşılaştırılır.

Çok sayıda test yapıldığında bazıları şans eseri "anlamlı" çıkar (20 testte ortalama 1 tanesi %5 düzeyinde).
Bu yüzden p değerleri Benjamini–Hochberg yöntemiyle düzeltilir ve etkinin iki ayrı dönemde (ilk yarı / ikinci yarı)
aynı yönde olup olmadığına bakılır. İkisini de geçen etkiye "kararlı" denir.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]
MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def bh_adjust(p: np.ndarray) -> np.ndarray:
    """Benjamini–Hochberg: yanlış keşif oranını kontrol eden p düzeltmesi."""
    p = np.asarray(p, float)
    n = len(p)
    order = np.argsort(p)
    ranked = p[order] * n / np.arange(1, n + 1)
    adj = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.minimum(adj, 1)
    return out


def flags(idx: pd.DatetimeIndex) -> pd.DataFrame:
    """Her işlem günü için takvim özellikleri."""
    s = pd.Series(idx, index=idx)
    ym = idx.to_period("M")
    pos = s.groupby(ym).cumcount()                          # ayın kaçıncı işlem günü (0'dan)
    rev = s.groupby(ym).cumcount(ascending=False)           # ay sonuna kaç işlem günü kaldı
    # opsiyon vadesi haftası: o ayın 3. cumasının olduğu hafta (pzt–cuma)
    fri3 = pd.Series([pd.Timestamp(d.year, d.month, 1) + pd.offsets.WeekOfMonth(week=2, weekday=4) for d in idx], index=idx)
    opex = (idx.isocalendar().week.values == pd.DatetimeIndex(fri3).isocalendar().week.values) & (idx.year == pd.DatetimeIndex(fri3).year)
    nxt = s.shift(-1)
    bdays_gap = np.array([np.busday_count(a.date(), b.date()) if pd.notna(b) else 1 for a, b in zip(s, nxt)])
    return pd.DataFrame({
        "weekday": idx.weekday, "month": idx.month,
        "tom": (pos <= 2) | (rev == 0),
        "opex": opex,
        "pre_holiday": bdays_gap > 1,                        # bir sonraki işlem günü, iş günü sayısına göre 1'den uzaksa arada tatil var
    }, index=idx)


def _cmp(r: pd.Series, mask: pd.Series) -> dict:
    a, b = r[mask], r[~mask]
    t, p = stats.ttest_ind(a, b, equal_var=False)
    return {"n": int(len(a)), "mean": float(a.mean() * 100), "rest": float(b.mean() * 100), "diff": float((a.mean() - b.mean()) * 100),
            "hit": float((a > 0).mean() * 100), "t": float(t), "p": float(p)}


def analyze(close: pd.Series, start: str = "2000-01-01") -> dict:
    c = close[close.index >= start]
    r = c.pct_change().dropna()
    F = flags(r.index)
    mid = r.index[len(r) // 2]
    tests = []
    groups = [(f"gün:{DAYS[i]}", F["weekday"] == i) for i in range(5)] + [(f"ay:{MONTHS[m - 1]}", F["month"] == m) for m in range(1, 13)] + [
        ("Ay dönümü (son gün + ilk 3 gün)", F["tom"]), ("Opsiyon vadesi haftası", F["opex"]), ("Tatil öncesi gün", F["pre_holiday"])]
    for name, m in groups:
        row = {"name": name, **_cmp(r, m)}
        h1, h2 = r.index < mid, r.index >= mid
        row["diff_1"] = _cmp(r[h1], m[h1])["diff"]
        row["diff_2"] = _cmp(r[h2], m[h2])["diff"]
        tests.append(row)
    adj = bh_adjust([t["p"] for t in tests])
    for t, pa in zip(tests, adj):
        t["p_adj"] = float(pa)
        t["stable"] = bool(np.sign(t["diff_1"]) == np.sign(t["diff_2"]))
        t["verdict"] = "kararlı ve anlamlı" if pa < 0.05 and t["stable"] else "anlamlı ama kararsız" if pa < 0.05 else "yalnızca düzeltmesiz anlamlı" if t["p"] < 0.05 else "fark yok"
    kw = stats.kruskal(*[r[F["weekday"] == i] for i in range(5)])
    return {"start": r.index[0].strftime("%Y-%m-%d"), "end": r.index[-1].strftime("%Y-%m-%d"), "n_days": int(len(r)), "split": mid.strftime("%Y-%m-%d"),
            "mean_day": float(r.mean() * 100), "tests": tests, "weekday_kruskal_p": float(kw.pvalue),
            "naive_significant": int(sum(t["p"] < 0.05 for t in tests)), "adj_significant": int(sum(t["p_adj"] < 0.05 for t in tests))}
