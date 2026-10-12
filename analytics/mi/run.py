"""Komut satırı: python -m mi.run [daily|weekly] [--no-fetch]"""
from __future__ import annotations

import json
import logging
import sys

from . import db, fetch, report, surprise
from .config import SITE_OUT

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("mi")


def main(argv: list[str]) -> int:
    mode = argv[0] if argv and not argv[0].startswith("-") else "daily"
    if "--no-fetch" not in argv:
        counts = fetch.fetch_all()
        from .config import LONG_DIR
        if mode == "weekly" or not (LONG_DIR / "NDX.csv").exists():
            fetch.fetch_long()
        if len(counts) < 50:
            log.error("Çok az varlık indirildi (%d); eski veriyle devam ediliyor.", len(counts))
    built = db.build()
    log.info("Veritabanı: %s", built["counts"])
    R = report.compute()
    report.write_site(R)
    SITE_OUT.mkdir(parents=True, exist_ok=True)
    (SITE_OUT / "quality.json").write_text(json.dumps({"counts": built["counts"], "assets": built["quality"]}, ensure_ascii=False))
    try:
        sp = surprise.build()
        log.info("Sürpriz endeksi: %d veri", len(sp["events"]))
    except Exception as e:  # sürpriz endeksi diğer çıktıları durdurmasın
        log.error("Sürpriz endeksi üretilemedi: %s", e)
    if mode == "weekly":
        wk = report.write_weekly(R, built["quality"])
        log.info("Haftalık rapor: %s", wk)
    for s in R["narrative"]:
        log.info("• %s", s)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
