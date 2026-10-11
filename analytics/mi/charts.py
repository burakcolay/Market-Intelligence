"""Rapor grafikleri (matplotlib). Sade, tek renk ailesi, Türkçe etiketler."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

INK, MUTED, LINE = "#16181D", "#5B6170", "#E3E3DE"
UP, DOWN, ACC = "#0B7A47", "#B42318", "#1F4FD1"
PALETTE = [ACC, "#D97706", UP, "#7C3AED", DOWN, "#0891B2"]

plt.rcParams.update({
    "font.size": 10, "axes.edgecolor": LINE, "axes.labelcolor": MUTED, "xtick.color": MUTED, "ytick.color": MUTED,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": LINE, "grid.linewidth": 0.6,
    "axes.titleweight": "bold", "axes.titlesize": 11.5, "axes.titlelocation": "left", "figure.dpi": 110,
})


def _save(fig, path: Path):
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def corr_heatmap(c: pd.DataFrame, labels: dict, path: Path, title: str):
    fig, ax = plt.subplots(figsize=(6.6, 5.4))
    ax.grid(False)
    im = ax.imshow(c.values, cmap="RdBu_r", vmin=-1, vmax=1)
    names = [labels.get(x, x) for x in c.columns]
    ax.set_xticks(range(len(c)), names, rotation=45, ha="right")
    ax.set_yticks(range(len(c)), names)
    for i in range(len(c)):
        for j in range(len(c)):
            v = c.values[i, j]
            ax.text(j, i, f"{v:.2f}".replace(".", ","), ha="center", va="center", fontsize=8, color="white" if abs(v) > 0.55 else INK)
    fig.colorbar(im, ax=ax, shrink=0.75)
    ax.set_title(title)
    _save(fig, path)


def sector_bars(df: pd.DataFrame, path: Path):
    d = df.sort_values("r_1m")
    fig, ax = plt.subplots(figsize=(7, 0.32 * len(d) + 1.2))
    ax.barh(d["sector"], d["r_1m"], color=[UP if v >= 0 else DOWN for v in d["r_1m"]])
    ax.axvline(0, color=MUTED, lw=0.8)
    ax.set_xlabel("Son 1 ay getiri (%, eşit ağırlıklı)")
    ax.set_title("Sektörlerin son bir ayı")
    _save(fig, path)


def lines(series: dict[str, pd.Series], path: Path, title: str, ylabel: str, zero: bool = True):
    fig, ax = plt.subplots(figsize=(7.4, 3.4))
    for i, (k, s) in enumerate(series.items()):
        ax.plot(s.index, s.values, lw=1.6, color=PALETTE[i % len(PALETTE)], label=k)
    if zero:
        ax.axhline(0, color=MUTED, lw=0.8)
    ax.set_ylabel(ylabel)
    ax.legend(frameon=False, fontsize=9)
    ax.set_title(title)
    _save(fig, path)


def event_paths(days: list[int], paths: dict[str, list[float]], path: Path):
    fig, ax = plt.subplots(figsize=(7.4, 3.6))
    colors = {"olumsuz": DOWN, "nötr": MUTED, "olumlu": UP}
    for k, v in paths.items():
        ax.plot(days, v, lw=1.8, color=colors.get(k, ACC), label=f"İlk tepkisi {k} olanlar")
    ax.axvline(0, color=INK, lw=0.8, ls="--")
    ax.axhline(0, color=MUTED, lw=0.8)
    ax.set_xlabel("Bilanço açıklamasından itibaren işlem günü")
    ax.set_ylabel("Kümülatif anormal getiri (%)")
    ax.legend(frameon=False, fontsize=9)
    ax.set_title("Bilanço sonrası fiyat yolu: ilk tepki sürüyor mu?")
    _save(fig, path)


def risk_scatter(df: pd.DataFrame, path: Path):
    fig, ax = plt.subplots(figsize=(7, 4.6))
    ax.scatter(df["beta"], df["vol_1y"], s=18, color=ACC, alpha=0.6)
    for _, r in df.nlargest(8, "vol_1y").iterrows():
        ax.annotate(r.name, (r["beta"], r["vol_1y"]), fontsize=8, color=INK, xytext=(3, 3), textcoords="offset points")
    ax.axvline(1, color=MUTED, lw=0.8, ls="--")
    ax.set_xlabel("Beta (Nasdaq 100'e duyarlılık, 1 yıl)")
    ax.set_ylabel("Yıllık oynaklık (%)")
    ax.set_title("Risk haritası: endekse duyarlılık ve oynaklık")
    _save(fig, path)


def regime_strip(timeline: list, colors: dict, path: Path):
    fig, ax = plt.subplots(figsize=(7.4, 1.9))
    ax.grid(False)
    d = pd.to_datetime([t[0] for t in timeline])
    for i in range(len(d) - 1):
        ax.axvspan(d[i], d[i + 1], color=colors.get(timeline[i][1], "#ccc"), lw=0)
    ax.set_yticks([])
    from matplotlib.patches import Patch
    ax.legend(handles=[Patch(color=c, label=k) for k, c in colors.items() if any(t[1] == k for t in timeline)],
              ncol=5, frameon=False, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.45))
    ax.set_title("Piyasa rejimleri (kümeleme)")
    _save(fig, path)


def calendar_bars(tests: list, path: Path):
    t = [x for x in tests if x["name"].startswith("gün:")] + [x for x in tests if not x["name"].startswith(("gün:", "ay:"))]
    names = [x["name"].replace("gün:", "") for x in t]
    fig, ax = plt.subplots(figsize=(7.4, 3.2))
    ax.bar(names, [x["diff"] for x in t], color=[UP if x["p_adj"] < 0.05 else LINE for x in t], edgecolor=MUTED)
    ax.axhline(0, color=MUTED, lw=0.8)
    ax.set_ylabel("Diğer günlere göre fark (%)")
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    ax.set_title("Takvim etkileri: gri = anlamlı değil, yeşil = düzeltmeden sonra anlamlı")
    _save(fig, path)
