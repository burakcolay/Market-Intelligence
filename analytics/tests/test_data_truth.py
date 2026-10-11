"""Gerçeklik testi: SEC'ten çekilen finansallar şirketlerin resmi yıllık raporlarıyla aynı mı?

Değerler şirketlerin 10-K raporlarından elle alındı (milyar $). Veri hattı bir kalemi yanlış etiketlerse
(ör. toplam yerine bir segmenti alırsa) bu test kırılır.
"""
import json
from pathlib import Path

import pytest

CO = Path(__file__).resolve().parents[2] / "data" / "us" / "co"
KNOWN = [  # şirket, mali yıl sonu (YYYY-AA), gelir, net kâr
    ("AAPL", "2024-09", 391.04, 93.74), ("AAPL", "2025-09", 416.16, 112.01),
    ("MSFT", "2024-06", 245.12, 88.14), ("MSFT", "2025-06", 281.72, 101.83),
    ("NVDA", "2025-01", 130.50, 72.88), ("AMZN", "2024-12", 637.96, 59.25),
    ("META", "2024-12", 164.50, 62.36), ("GOOGL", "2024-12", 350.02, 100.12),
    ("TSLA", "2024-12", 97.69, 7.09), ("AVGO", "2024-11", 51.57, 5.90),
    ("NFLX", "2024-12", 39.00, 8.71), ("COST", "2024-09", 254.45, 7.37),
    ("INTC", "2024-12", 53.10, -18.76), ("AMD", "2024-12", 25.79, 1.64),
    ("PEP", "2024-12", 91.85, 9.58), ("ADBE", "2024-11", 21.51, 5.56),
]


@pytest.mark.skipif(not CO.exists(), reason="SEC verisi yok")
@pytest.mark.parametrize("code,ym,rev,net", KNOWN)
def test_annual_matches_official_10k(code, ym, rev, net):
    c = json.loads((CO / f"{code}.json").read_text())
    rows = [a for a in c["fin"]["annual"] if a["end"].startswith(ym)]
    assert rows, f"{code} {ym} yıllık veri yok"
    a = rows[0]
    assert a["revenue"] / 1e9 == pytest.approx(rev, rel=0.005)
    assert a["net"] / 1e9 == pytest.approx(net, rel=0.01, abs=0.05)
