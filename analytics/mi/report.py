"""Analizleri hesaplar; sitenin JSON'unu ve haftalık Markdown raporunu üretir."""
from __future__ import annotations

import json
import math
from datetime import date

import numpy as np
import pandas as pd

from . import breadth as br, calendar as cal, charts, db, events, regime as rg, stats as st
from .config import BENCHMARK, LONG_DIR, MACRO, REPORT_DIR, SITE_OUT, universe

CROSS = ["NDX", "SPX", "US10Y", "DXY", "GOLD", "OIL", "BTC", "TLT", "VIX"]
PAIRS = [("BTC", "NDX", "Bitcoin ↔ Nasdaq 100"), ("GOLD", "DXY", "Altın ↔ Dolar"), ("US10Y", "NDX", "10Y faiz ↔ Nasdaq 100"), ("TLT", "NDX", "Uzun tahvil ↔ Nasdaq 100")]
LABELS = {code: name for _, (code, name, _) in MACRO.items()} | {"NDX": "Nasdaq 100", "SPX": "S&P 500", "US10Y": "10Y faiz", "DXY": "Dolar", "VIX": "VIX", "TLT": "Uzun tahvil", "OIL": "Petrol"}


def _clean(o):
    """JSON için NaN/inf -> None, numpy -> python."""
    if isinstance(o, dict):
        return {str(k): _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        return None if not math.isfinite(o) else round(float(o), 4)
    if isinstance(o, np.integer):
        return int(o)
    return o


def tr(v: float, d: int = 1) -> str:
    return f"{v:.{d}f}".replace(".", ",").replace("-", "−")


def compute() -> dict:
    con = db.connect()
    p = pd.read_sql("SELECT code, date, close, volume FROM prices", con)
    close, vol = st.wide(p), st.wide(p, "volume")
    r = st.returns(close)
    assets = pd.read_sql("SELECT * FROM assets", con).set_index("code")
    last = close.index[-1].strftime("%Y-%m-%d")

    cross = [c for c in CROSS if c in r.columns]
    c63, c252 = st.corr_matrix(r, cross, 63), st.corr_matrix(r, cross, 252)
    pairs = []
    for a, b, label in PAIRS:
        if a in r.columns and b in r.columns:
            rc = st.rolling_corr(r, a, b, 63).dropna()
            pairs.append({"a": a, "b": b, "label": label, "now": rc.iloc[-1], "year_ago": rc.iloc[-253] if len(rc) > 253 else None,
                          "min": rc.min(), "max": rc.max(),
                          "series": [[d.strftime("%Y-%m-%d"), v] for d, v in rc.iloc[::5].items()]})

    volt = st.volatility(r)
    b = st.beta(r)
    risk = volt.join(b.rename("beta")).join(assets[["name", "sector", "cls"]])
    dd = st.drawdown(close)
    dd_series = {c: [[d.strftime("%Y-%m-%d"), v] for d, v in dd[c].dropna().iloc[::5].items()] for c in ["NDX", "BTC", "GOLD"] if c in dd}

    E = pd.read_sql("SELECT code, date FROM filings WHERE items LIKE '%2.02%'", con)
    T = pd.read_sql("SELECT * FROM insider_trades", con)
    out = {
        "updated": last,
        "regime": st.regime(r, close),
        "period_returns": db.query("period_returns", con).to_dict("records"),
        "sectors": db.query("sector_returns", con).to_dict("records"),
        "trend": db.query("trend_status", con)["trend"].value_counts().to_dict(),
        "drawdowns": db.query("drawdowns", con).to_dict("records"),
        "corr": {"codes": cross, "labels": [LABELS.get(c, c) for c in cross], "m63": c63.values.tolist(), "m252": c252.values.tolist()},
        "pairs": pairs,
        "risk": risk.reset_index(names="code").to_dict("records"),
        "dd_series": dd_series,
        "anomalies": st.anomalies(r, vol).merge(assets[["name"]], left_on="code", right_index=True, how="left").to_dict("records"),
        "insider_sectors": db.query("insider_by_sector", con).to_dict("records"),
        "fund_consensus": db.query("fund_consensus", con).head(15).to_dict("records"),
        "earnings_study": events.earnings_study(r, E),
        "insider_study": events.insider_study(r, T),
    }
    # Genişlik, rejim, aralık tahmini, takvim etkileri
    ph = pd.read_sql("SELECT code, date, high, low FROM prices WHERE code IN ('NDX')", con)
    con.close()
    stocks = assets.index[assets["cls"] == "hisse"].tolist()
    mcap = pd.Series({u["code"]: m for u in universe() if (m := _mcap(u["code"])) is not None})
    out["breadth"] = br.analyze(close, stocks, mcap)
    p200 = br.above_ma(close[[c for c in stocks if c in close.columns]], 200)
    f = rg.features(close["NDX"], close["VIX"] if "VIX" in close else None, p200)
    out["regime_ml"] = rg.regimes(f, close["NDX"])
    hl = ph.pivot(index="date", columns="code", values=["high", "low"])
    hl.index = pd.to_datetime(hl.index)
    out["range_model"] = rg.range_model(hl["high"]["NDX"], hl["low"]["NDX"], close["NDX"], close["VIX"] if "VIX" in close else None)
    lp = LONG_DIR / "NDX.csv"
    if lp.exists():
        L = pd.read_csv(lp, parse_dates=["date"]).set_index("date")["close"]
        out["calendar"] = cal.analyze(L)
    out["narrative"] = narrative(out)
    return _clean(out)


_UNI = None


def _mcap(code: str):
    """universe.json'daki piyasa değeri (SEC/CNBC betiği yazar)."""
    global _UNI
    if _UNI is None:
        from .config import US_DIR
        _UNI = {r["t"]: r.get("mcap") for r in json.loads((US_DIR / "universe.json").read_text())["rows"]}
    return _UNI.get(code)


def narrative(R: dict) -> list[str]:
    """Kural tabanlı Türkçe yorum: rakamı tekrar etmez, ne anlama geldiğini söyler."""
    s = []
    g = R["regime"]
    s.append(f"Nasdaq 100 {g['trend']} trendinde (200 günlük ortalamanın {'üstünde' if g['dist_ma200'] > 0 else 'altında'}) "
             f"ve oynaklık uzun dönem normaline göre {g['vol_level']}. "
             + ("Bu, sakin bir yükseliş ortamı: geri çekilmeler genellikle sınırlı kalır." if g["trend"] == "yükseliş" and g["vol_level"] != "yüksek"
                else "Yüksek oynaklıkla gelen yükseliş kırılgandır; haber akışına duyarlılık artar." if g["trend"] == "yükseliş"
                else "Düşüş trendinde oynaklığın yüksek olması, satışın panik tarafına geçtiğini gösterebilir." if g["vol_level"] == "yüksek"
                else "Sakin bir düşüş: satış baskısı düzenli ama paniğe dönmüş değil."))
    if R["sectors"]:
        top, bot = R["sectors"][0], R["sectors"][-1]
        s.append(f"Son bir ayda en güçlü sektör {top['sector']}, en zayıfı {bot['sector']}. "
                 f"Para {'savunmacı' if top['sector'] in ('Sağlık', 'Gıda ve içecek', 'Enerji ve kamu hizmeti') else 'büyüme ve döngüsel'} tarafa kayıyor.")
    for pr in R["pairs"]:
        if pr["year_ago"] is None:
            continue
        d = pr["now"] - pr["year_ago"]
        if abs(d) > 0.25:
            s.append(f"{pr['label']} ilişkisi bir yıl öncesine göre belirgin {'güçlendi' if d > 0 else 'zayıfladı'}. "
                     + ("İki varlık artık daha çok birlikte hareket ediyor; birini diğerine karşı çeşitlendirme aracı olarak kullanmak eskisi kadar işe yaramaz." if d > 0
                        else "İki varlık birbirinden ayrışıyor; biri diğerinin hareketini eskisi kadar açıklamıyor."))
    es = R["earnings_study"]
    if es.get("n", 0) >= 20 and es.get("react_ratio"):
        sp = es["drift_spread"]
        k = es["react_ratio"]
        oyn = (f"yaklaşık {tr(k)} kat fazla oynuyor" if k > 1.15 else "daha az oynuyor" if k < 0.9 else "sıradan günlere benzer oynuyor")
        s.append(f"Bilanço açıklamalarından sonraki iki günde hisseler, sıradan iki günlük dönemlere göre {oyn} ({es['n']} bilanço). "
                 + (f"İlk tepkisi olumlu olanlar sonraki iki ayda da olumsuzlardan daha iyi gitti ve fark istatistiksel olarak anlamlı (p={tr(sp['p'], 3)}): piyasa bilançoyu tek seferde fiyatlamıyor."
                    if sp["p"] < 0.05 and sp["diff"] > 0 else
                    f"İlk tepkinin yönü sonraki iki ayı açıklamıyor (p={tr(sp['p'], 2)}): büyük şirketlerde bilanço haberi hızla fiyatlanıyor, sürüklenme görülmüyor."))
    ins = R["insider_study"].get("alim", {})
    al = ins.get("car40", {})
    if al.get("n", 0) >= 3 and al.get("mean") is not None:
        per = ins.get("period") or ["", ""]
        s.append(f"Yöneticilerin piyasadan alım yaptığı {al['n']} olayda ({ins.get('companies')} şirket) hisse sonraki iki ayda piyasaya göre ortalama {tr(al['mean'])} puan "
                 f"{'fazla' if al['mean'] > 0 else 'az'} getiri sağladı" + (f" ve fark istatistiksel olarak anlamlı. Ancak olaylar {per[0][:7]} – {per[1][:7]} arasındaki kısa bir döneme yığılmış; aynı piyasa ortamını paylaştıkları için bağımsız sayılmazlar, sonuç daha uzun bir dönemde doğrulanmadan sinyal sayılmamalı."
                    if al["p"] < 0.05 else "; ancak örnek küçük ve fark istatistiksel olarak anlamlı değil, tek başına sinyal sayılmamalı."))
    B = R.get("breadth")
    if B:
        n_, c3 = B["now"], B["concentration"].get("3a", {})
        s.append(f"Nasdaq 100 hisselerinin yaklaşık yüzde {n_['p200']:.0f} kadarı 200 günlük ortalamasının üstünde"
                 + (" ve bu oran son bir ayda düştü" if n_["p200"] < n_["p200_1m"] - 5 else " ve bu oran son bir ayda arttı" if n_["p200"] > n_["p200_1m"] + 5 else "")
                 + ". " + ("Yükseliş geniş tabana yayılmış." if n_["p200"] >= 65 else "Yükselişi hisselerin azınlığı taşıyor; dar tabanlı yükselişler, öncü birkaç hisse sendelediğinde daha kırılgandır." if n_["p200"] < 50 else "Katılım orta düzeyde."))
        if c3.get("top10_share") is not None and c3["index_ret"] > 1:
            s.append(f"Son üç ayda endeks getirisinin yaklaşık yüzde {c3['top10_share']:.0f} kadarı en büyük 10 şirketten geldi; eşit ağırlıklı sepet endeksten "
                     + ("geride kaldı: yükseliş devlerin omzunda." if c3["equal_weight_ret"] < c3["index_ret"] - 2 else "önde: küçük hisseler de katılıyor." if c3["equal_weight_ret"] > c3["index_ret"] + 2 else "benzer gitti."))
    G = R.get("regime_ml")
    if G:
        row = next((x for x in G["table"] if x["regime"] == G["current"]), None)
        s.append(f"Kümeleme modeline göre piyasa {G['streak']} işlem günüdür '{G['current']}' rejiminde."
                 + (f" Geçmişte bu rejimdeki günlerin ardından gelen {G['horizon']} işlem gününde Nasdaq 100 ortalama yüzde {tr(row['fwd_mean'])} değişti ve dönemlerin yüzde {row['fwd_hit']:.0f} kadarında yükseldi. Bu bir tahmin değil, benzer dönemlerin geçmiş davranışı." if row else ""))
    M = R.get("range_model")
    if M:
        better = M["improvement"] > 0
        s.append(f"Bir sonraki işlem günü için beklenen Nasdaq 100 aralığı (en yüksek ile en düşük arası) yaklaşık %{tr(M['next']['pct'], 2)}, yani {M['next']['points']:.0f} puan civarı; geçmiş isabete göre 10 günün 8'inde {M['next']['points_lo']:.0f} ile {M['next']['points_hi']:.0f} puan arasında kalır. "
                 + (f"Model, görmediği son dönemde basit kurallardan (dünün aralığı, son ayın ortalaması) yaklaşık yüzde {M['improvement']:.0f} daha isabetli." if better else "Model sınama döneminde basit kuralları geçemedi; bu tahmin kaba bir rehberdir."))
    C = R.get("calendar")
    if C:
        good = [t["name"] for t in C["tests"] if t["verdict"] == "kararlı ve anlamlı"]
        s.append(f"Takvim etkileri {C['start'][:4]} yılından bu yana {len(C['tests'])} ayrı iddiayla test edildi: düzeltmesiz bakılınca {C['naive_significant']} tanesi anlamlı görünüyor, çoklu test düzeltmesinden sonra {C['adj_significant']} tanesi kalıyor. "
                 + (f"Hem anlamlı hem iki dönemde tutarlı olanlar: {', '.join(good)}." if good else "Düzeltmeden sonra kalan etkiler iki dönemde tutarlı değil." if C['adj_significant'] else "Yaygın takvim efsanelerinin hiçbiri bu veride doğrulanmıyor; çoğu, şans eseri anlamlı görünen sonuçlardan ibaret."))
    if R["anomalies"]:
        names = ", ".join(sorted({a["code"] for a in R["anomalies"]})[:6])
        s.append(f"Son iki haftada getirisi ya da hacmi kendi normalinin çok dışına çıkan varlıklar: {names}. Bu günlerin arkasında genellikle bilanço, haber ya da endeks değişikliği olur.")
    return s


def write_site(R: dict):
    SITE_OUT.mkdir(parents=True, exist_ok=True)
    (SITE_OUT / "summary.json").write_text(json.dumps(R, ensure_ascii=False, separators=(",", ":")))


def write_weekly(R: dict, quality: dict) -> str:
    y, w, _ = date.fromisoformat(R["updated"]).isocalendar()
    wk = f"{y}-W{w:02d}"
    d = REPORT_DIR / wk
    d.mkdir(parents=True, exist_ok=True)
    c = R["corr"]
    charts.corr_heatmap(pd.DataFrame(c["m63"], index=c["codes"], columns=c["codes"]), LABELS, d / "korelasyon.png", "Varlıklar arası ilişki, son 3 ay")
    charts.sector_bars(pd.DataFrame(R["sectors"]), d / "sektorler.png")
    charts.lines({p["label"]: pd.Series({pd.Timestamp(x): v for x, v in p["series"]}) for p in R["pairs"][:3]}, d / "iliskiler.png",
                 "İlişkiler zamanla nasıl değişiyor (63 günlük korelasyon)", "Korelasyon")
    charts.lines({LABELS.get(k, k): pd.Series({pd.Timestamp(x): v for x, v in s}) for k, s in R["dd_series"].items()}, d / "dusus.png",
                 "Zirveden uzaklık", "%", zero=False)
    risk = pd.DataFrame(R["risk"]).set_index("code")
    charts.risk_scatter(risk[risk["cls"] == "hisse"].dropna(subset=["beta", "vol_1y"]), d / "risk.png")
    es = R["earnings_study"]
    if es.get("avg_path"):
        charts.event_paths(es["path_days"], es["avg_path"], d / "bilanco.png")

    B, G, M, C = R.get("breadth"), R.get("regime_ml"), R.get("range_model"), R.get("calendar")
    if B:
        cols = B["series_cols"]
        ser = lambda k: pd.Series({pd.Timestamp(r[0]): r[cols.index(k)] for r in B["series"]})
        charts.lines({"200 g. ortalama üstü %": ser("p200"), "50 g. ortalama üstü %": ser("p50")}, d / "genislik.png", "Piyasa genişliği: hisselerin yüzde kaçı ortalamasının üstünde", "%", zero=False)
    RCOL = {"Güçlü yükseliş": charts.UP, "Kararsız": charts.MUTED, "Yükseliş": charts.UP, "Düzeltme": "#D97706", "Stres": charts.DOWN}
    if G:
        charts.regime_strip(G["timeline"], RCOL, d / "rejim.png")
    if M:
        charts.lines({"Gerçekleşen": pd.Series({pd.Timestamp(a): b for a, b, _ in M["recent"]}), "Model": pd.Series({pd.Timestamp(a): c for a, _, c in M["recent"]})},
                     d / "aralik.png", "Nasdaq 100 günlük aralık: gerçekleşen ve tahmin (%)", "%", zero=False)
    if C:
        charts.calendar_bars(C["tests"], d / "takvim.png")

    def tbl(rows, cols, heads):
        h = "| " + " | ".join(heads) + " |\n|" + "|".join("---" for _ in heads) + "|\n"
        return h + "".join("| " + " | ".join(str(f(r)) for f in cols) + " |\n" for r in rows)

    sec = tbl(R["sectors"], [lambda r: r["sector"], lambda r: tr(r["r_1w"]), lambda r: tr(r["r_1m"]), lambda r: tr(r["r_3m"]), lambda r: r["leader"], lambda r: r["laggard"]],
              ["Sektör", "1 hafta %", "1 ay %", "3 ay %", "Öncü", "Geride kalan"])
    pr = sorted([x for x in R["period_returns"] if x["cls"] == "hisse" and x["r_1w"] is not None], key=lambda x: x["r_1w"])
    movers = tbl(pr[-5:][::-1] + pr[:5], [lambda r: r["code"], lambda r: r["name"], lambda r: tr(r["r_1w"]), lambda r: tr(r["r_1m"])], ["Kod", "Şirket", "1 hafta %", "1 ay %"])
    an = tbl(R["anomalies"][:12], [lambda r: r["date"], lambda r: r["code"], lambda r: tr(r["ret"]), lambda r: tr(r["z_ret"]) if r["z_ret"] is not None else "—",
                                   lambda r: tr(r["z_vol"]) if r["z_vol"] is not None else "—"], ["Tarih", "Kod", "Getiri", "Getiri z", "Hacim z"]) if R["anomalies"] else "_Olağandışı gün yok._\n"
    ok = sum(1 for q in quality.values() if q.get("rows", 0) > 200)
    fixed = sum(q.get("spikes_fixed", 0) for q in quality.values())
    bucket = es.get("drift_by_bucket", {})
    md = f"""# Haftalık piyasa raporu · {wk}

_Otomatik üretildi: {R['updated']} kapanış verisiyle. Kaynak kod: [`analytics/`](../../analytics). Yatırım tavsiyesi değildir._

## Özet
{chr(10).join('- ' + x for x in R['narrative'])}

## Sektörler
![Sektörler](sektorler.png)

{sec}
## Haftanın en çok yükselen ve düşen hisseleri
{movers}
## Varlıklar arası ilişki
![Korelasyon](korelasyon.png)

![İlişkilerin zaman içindeki değişimi](iliskiler.png)

## Risk
![Risk haritası](risk.png)

![Zirveden uzaklık](dusus.png)

## Olağandışı günler (son 10 işlem günü)
Getirisi ya da hacmi, önceki 63 günün ortalamasından en az 3 standart sapma uzak olanlar.

{an}
## Piyasa genişliği ve yoğunlaşma
{'![Genişlik](genislik.png)' if B else ''}

{(lambda c: tbl(c.get('leaders', []), [lambda r: r['code'], lambda r: tr(r['contrib'], 2), lambda r: tr(r['ret'], 1), lambda r: tr(r['weight'], 1)], ['Kod', 'Endekse katkı (puan)', 'Getiri %', 'Ağırlık %']))(B['concentration'].get('3a', {})) if B else ''}
## Piyasa rejimi (kümeleme)
{f'''![Rejimler](rejim.png)

Bugün: **{G['current']}** ({G['streak']} işlem günüdür). Rejimler oynaklık, trend, 200 günlük ortalamaya uzaklık, VIX ve genişlikten k-ortalamalar ile çıkarıldı; tablo betimleyicidir.

''' + tbl(G['table'], [lambda r: r['regime'], lambda r: tr(r['share'], 0), lambda r: tr(r['vol21'], 0), lambda r: tr(r['ret63'], 1), lambda r: tr(r['fwd_mean'], 1), lambda r: tr(r['fwd_hit'], 0)],
          ['Rejim', 'Gün payı %', 'Oynaklık %', '3 ay getiri %', f"Sonraki {G['horizon']} gün ort. %", 'Yükselme oranı %']) if G else ''}
## Ertesi gün aralık tahmini
{f'''![Aralık](aralik.png)

Beklenen aralık: **{M['next']['points']:.0f} puan** (%{tr(M['next']['pct'], 2)}); 10 günün 8'inde {M['next']['points_lo']:.0f}–{M['next']['points_hi']:.0f} puan.

| Yöntem | Ort. mutlak hata | R² |
|---|---|---|
| Model (logaritmik HAR + VIX) | {tr(M['model']['mae'], 3)} | {tr(M['model']['r2'], 2)} |
| Yarın dün gibi | {tr(M['naive_yesterday']['mae'], 3)} | {tr(M['naive_yesterday']['r2'], 2)} |
| Yarın son ayın ortalaması | {tr(M['naive_month']['mae'], 3)} | {tr(M['naive_month']['r2'], 2)} |

Sınama: {M['test_period'][0]} – {M['test_period'][1]}, ileriye doğru yürüyen pencere (aylık yeniden eğitim).
''' if M else ''}
## Takvim etkileri
{f'''![Takvim](takvim.png)

{C['start'][:4]}–{C['end'][:4]}, {C['n_days']} gün, {len(C['tests'])} iddia. Düzeltmesiz anlamlı: {C['naive_significant']}, Benjamini–Hochberg sonrası: {C['adj_significant']}.
''' if C else ''}
## Araştırma: Bilanço sonrası fiyat davranışı
{f'''![Bilanço sonrası](bilanco.png)

{es['n']} bilanço açıklaması ({es['companies']} şirket, {es['period'][0]} – {es['period'][1]}). Anormal getiri piyasa modeliyle hesaplandı (her olay için önceki 220 günde hissenin Nasdaq 100'e duyarlılığı).

| İlk tepki grubu | Olay | Sonraki 2 ay ort. anormal getiri % | t | p |
|---|---|---|---|---|
''' + ''.join(f"| {k} | {v['n']} | {tr(v['mean'], 2)} | {tr(v['t'], 2)} | {tr(v['p'], 3)} |{chr(10)}" for k, v in bucket.items()) + f'''
Olumlu ve olumsuz grup farkı: {tr(es['drift_spread']['diff'], 2)} puan (Welch t-testi p={tr(es['drift_spread']['p'], 3)}). Tepki ile sonraki getiri arasındaki sıra korelasyonu: {tr(es['spearman']['rho'], 3)} (p={tr(es['spearman']['p'], 3)}).
''' if es.get('avg_path') else '_Yeterli veri yok._'}
## Veri kalitesi
- {ok} varlıkta 200 günden uzun temiz fiyat geçmişi var.
- Temizleme sırasında {fixed} tek günlük hatalı fiyat düzeltildi.
"""
    (d / "README.md").write_text(md)
    idx = sorted([p.name for p in REPORT_DIR.iterdir() if p.is_dir()], reverse=True)
    (REPORT_DIR / "README.md").write_text("# Haftalık raporlar\n\nHer cumartesi GitHub Actions tarafından otomatik üretilir.\n\n" + "".join(f"- [{x}]({x}/README.md)\n" for x in idx))
    return wk
