import json
from datetime import date

from mi import surprise as S


def test_parse_num():
    assert S.parse_num("−%10,6") == -10.6
    assert S.parse_num("197K") == 197
    assert S.parse_num("3.194,6") == 3194.6
    assert S.parse_num("+0,04 mlr $") == 0.04
    assert S.parse_num("%3,75–4,00") is None
    assert S.parse_num("—") is None


def test_score_direction():
    assert S.score("Tarım dışı istihdam", "29K", "90K") == -1          # zayıf
    assert S.score("Haftalık işsizlik başvuruları", "190K", "200K") == 1  # düşük başvuru = güçlü
    assert S.score("İşsizlik oranı", "%2,5", "%2,4") == -1               # büyük İ harfi
    assert S.score("ISM hizmet PMI", "54,9", "55,0") == 0               # beklentiye yakın
    assert S.category("Çekirdek TÜFE (yıllık)") == "inflation"
    assert S.category("Fed politika faizi") is None


def _day(p, d, surprises, rows):
    (p / f"{d}.json").write_text(json.dumps({"makro": {"surprises": surprises, "countries": {"ABD": {"rows": rows}}}}, ensure_ascii=False))


def test_collect_dedupes_and_dates(tmp_path):
    card = {"name": "Tarım dışı istihdam", "actual": "29K", "cons": "90K", "meta": "ABD · Eylül · 2 Eki"}
    old_row = {"name": "Perakende satışlar", "actual": "%1,2", "cons": "%0,5"}
    _day(tmp_path, "2026-10-06", [card], [old_row, {"name": "Tarım dışı istihdam", "actual": "29K", "cons": "90K"}])
    _day(tmp_path, "2026-10-07", [card], [old_row, {"name": "TÜFE (yıllık)", "actual": "%3,9", "cons": "%3,7"}])
    ev = S.collect(tmp_path)
    names = [(e["name"], e["date"]) for e in ev]
    assert ("Tarım dışı istihdam", "2026-10-02") in names          # kart tarihi kullanılır, tablo satırıyla tekrar etmez
    assert ("TÜFE (yıllık)", "2026-10-07") in names                # sonraki günde yeni satır
    assert all(n != "Perakende satışlar" for n, _ in names)         # ilk dosyanın tarihsiz satırı alınmaz
    idx = S.index(ev, date(2026, 10, 7))
    assert idx["series"]["ABD"]["activity"][-1] == {"v": -1.0, "n": 1}
    assert idx["series"]["ABD"]["inflation"][-1] == {"v": 1.0, "n": 1}
