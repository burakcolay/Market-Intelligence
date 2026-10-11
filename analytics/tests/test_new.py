import numpy as np
import pandas as pd

from mi import breadth as br, calendar as cal, regime as rg


def test_above_ma_share():
    d = pd.bdate_range("2023-01-02", periods=260)
    up = pd.Series(np.linspace(100, 200, 260), index=d)        # sürekli yükselen: ortalamanın üstünde
    dn = pd.Series(np.linspace(200, 100, 260), index=d)        # sürekli düşen: altında
    close = pd.DataFrame({f"U{i}": up for i in range(30)} | {f"D{i}": dn for i in range(30)})
    p = br.above_ma(close, 200)
    assert abs(p.iloc[-1] - 50) < 1e-9 and p.iloc[:199].isna().all()


def test_contributions_sum_to_cap_weighted_return():
    d = pd.bdate_range("2024-01-01", periods=30)
    close = pd.DataFrame({"BIG": np.linspace(100, 110, 30), "SMALL": np.linspace(100, 80, 30)}, index=d)
    mcap = pd.Series({"BIG": 900.0, "SMALL": 100.0})
    c = br.contributions(close, mcap, 20)
    start = mcap / (1 + (close.iloc[-1] / close.iloc[-21] - 1))
    expected = ((start * (close.iloc[-1] / close.iloc[-21] - 1)).sum() / start.sum()) * 100
    assert abs(c["contrib"].sum() - expected) < 1e-9 and c.index[0] == "BIG"


def test_bh_adjust_monotone_and_bounded():
    p = np.array([0.01, 0.04, 0.03, 0.5])
    a = cal.bh_adjust(p)
    assert (a >= p).all() and (a <= 1).all()
    assert abs(a[0] - 0.04) < 1e-12                            # 0.01 * 4 / 1


def test_calendar_flags():
    idx = pd.bdate_range("2024-07-01", "2024-07-31").drop(pd.Timestamp("2024-07-04"))   # 4 Temmuz tatil
    f = cal.flags(idx)
    assert f.loc["2024-07-03", "pre_holiday"] and not f.loc["2024-07-02", "pre_holiday"]
    assert f.loc["2024-07-01", "tom"] and f.loc["2024-07-31", "tom"] and not f.loc["2024-07-15", "tom"]
    assert f.loc["2024-07-19", "opex"] and f.loc["2024-07-15", "opex"] and not f.loc["2024-07-26", "opex"]   # 3. cuma 19 Temmuz


def test_range_model_beats_naive_on_persistent_volatility():
    rng = np.random.default_rng(0)
    n = 900
    d = pd.bdate_range("2021-01-01", periods=n)
    sigma = np.exp(np.cumsum(rng.normal(0, 0.05, n)) * 0.3) * 0.01     # kalıcı (kümelenen) oynaklık
    close = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, sigma))), index=d)
    width = np.abs(rng.normal(0, sigma)) * close * 2 + close * sigma
    res = rg.range_model(close + width / 2, close - width / 2, close, None)
    assert res["model"]["mae"] < res["naive_yesterday"]["mae"]
    assert 60 < res["interval_hit"] < 95
