# Market Intelligence

Burak'ın kişisel günlük piyasa paneli. Statik site (derleme adımı yok), Vercel'de yayında.
Sayfalar `data/` altındaki JSON dosyalarını okuyup kendini çizer. **Günlük rutin sadece JSON yazar; HTML/JS'ye dokunmaz.**

## Dosya düzeni

```
index.html, faizler.html, kuresel.html, hisseler.html, sirket.html, bilancolar.html, kripto.html, turkiye.html, makro.html, haftalik.html, sozluk.html
assets/app.js        ortak: veri yükleme, menü, biçimlendirme
assets/charts.js     SVG grafikler
assets/pages/*.js    her sayfanın çizimi
data/latest.json     { "date": "YYYY-MM-DD", "week": "YYYY-Www" }  -> sitenin gösterdiği gün ve hafta
data/daily/index.json      tüm günlerin listesi (eski günler arşivden seçilebilir)
data/daily/YYYY-MM-DD.json günlük veri + yorum (ŞEMA: aşağıda, örnek: data/daily/2026-10-06.json)
data/weekly/index.json     [{ id, label, title }]
data/weekly/YYYY-Www.json  haftalık özet (sadece cuma)
data/sozluk.json           kavramlar; her yeni "günün dersi" buraya da eklenir
data/companies.json        NQ devlerinin şirket/bilanço kartları (cumartesi + bilanço yakınken güncellenir)
scripts/validate.mjs       veri kontrolü
```

## Günlük rutinin yapacağı iş

1. Verileri araçlardan çek (Bigdata.com: piyasa/ekonomik takvim/haber; Borsa MCP: BIST, TCMB, TR tahvil). Borsa MCP'yi **sırayla** çağır, aynı anda çok çağrı 429 hatası verir; hata olursa birkaç saniye bekleyip bir kez tekrar dene.
2. Bir önceki günün dosyasını şablon olarak kopyala, `data/daily/<bugün>.json` olarak yaz. Rakamları araç çıktısından al, tahmin etme. Bulunamayan değer için `"—"` (metin) veya `null` (sayı) kullan.
3. `data/daily/index.json` listesine bugünü ekle, `data/latest.json`'daki `date`'i güncelle.
4. `s8.concept` yeni bir kavramsa `data/sozluk.json`'a ekle (aynı alanlar: name, cat, learned, def, analogy, chain[], quote, rule, related[]).
5. Cuma günleri: `data/weekly/<hafta>.json` yaz, `weekly/index.json`'a ekle, `latest.json`'daki `week`'i güncelle.
   **Cumartesi:** günlük dosya yazma. Sadece o haftanın dosyasına `deep` (derin konu + uzun vade) ekle, doğrula, commit et.
   **Pazar:** hiçbir şey yapma, hemen bitir.
6. `node scripts/validate.mjs` çalıştır. Hata varsa düzelt, tekrar çalıştır. Geçmeden commit yapma.
7. `main` dalına commit + push. Mesaj: `veri: YYYY-MM-DD`.

## Commit yazarı (Vercel için zorunlu)

Vercel Hobby planı, özel repoda sadece hesap sahibinin yazdığı commit'leri yayına alır. Claude ya da bot adına atılan commit'ler "blocked" olur ve site yenilenmez. Bu yüzden her commit Burak adına atılır:

```
git -c user.name="Burak Colay" -c user.email="170448628+burakcolay@users.noreply.github.com" commit -m "veri: YYYY-MM-DD"
```

Doğrudan `main`'e push et. Ayrı dala atıp merge commit ile birleştirme; merge commit'in yazarı bot olur ve yine bloklanır.

## Yazım kuralları

- Nasdaq her yerde **Nasdaq 100** (^NDX, Burak'ın takip ettiği NQ vadelisinin endeksi) olarak yazılır; Nasdaq Bileşik (^IXIC) kullanma. Şeritteki adı `Nasdaq 100`.
- Kripto coin tablosu sadece BTC, ETH, BNB, SOL. XRP, ADA, DOGE, LINK, AVAX, LTC ekleme (Burak çıkardı).
- Gösterge adlarını değiştirme (`S&P 500`, `Nasdaq 100`, `BIST 100`, `USD/TRY`, `Ons altın`, `Gram altın`, `Brent`, `BTC`, `TOTAL`, `BTC.D` vb.): site canlı fiyatı bu adlardan eşleştiriyor.
- Fiyatlar rutinin çalıştığı andaki anlık değerdir; `updated` alanına o saati yaz.
- Dil Türkçe, sayılar Türk biçimi (`12.395`, `%29,73`, `−0,39%`). Eksi için `−` (U+2212).
- `tone`: `up` (yeşil), `down` (kırmızı), `flat` (gri); tablolarda `good` / `bad` / `flat`. Ton, okuyucu için iyi mi kötü mü olduğuna göre seçilir (ör. enflasyon beklentiden düşükse `good`).
- Sayı alanları (`chg`, `d1`, `w1`, `m1`, `ytd`, `values`, `points[].v`, `curve[].now/m1`, `price`) gerçek sayıdır, metin değil; site biçimlendirir.
- Paragraf içinde sözlük terimine bağlantı: `[[nfp|Tarım dışı istihdamın]]` (id `sozluk.json`'da olmalı).
- Dolgu cümlesi yok. Önce ABD, sonra Avrupa/Asya, para/emtia, kısa Türkiye.
- `s7` (Benim okumam) gerçekçi olmalı: en olası senaryo, alternatif, izlenecek tek sinyal. Al/sat tavsiyesi verme.

## Yorum nasıl yazılır (en önemli kural)

Burak rakamları şeritte, kartlarda ve tablolarda zaten görüyor; bir iki kez görünce aklında kalıyor. Yazının işi rakamı tekrar etmek değil, **rakamın ne anlama geldiğini** anlatmak. Burak bu metni kendine sesli anlatarak öğreniyor.

**Rakam kuralı**
- Paragraf başına en fazla 1-2 rakam, o da sadece anlatının dayanağıysa: bir eşik (%5 faiz), bir rekor, beklentiden büyük bir sapma.
- "S&P %0,5, Nasdaq %0,6 arttı, Dow %0,4..." gibi sıralamalar yasak. Hareketi kelimeyle söyle: "teknoloji öncülüğünde yükseldi", "sert düştü", "yatay".
- Aynı rakamı iki bölümde tekrarlama.

**Her bölüm şu sırayla düşünülür**
1. **Ne oldu?** Tek cümle, rakamsız ya da tek rakamla.
2. **Neden oldu?** Asıl sebep ve arkasındaki mekanizma: kim alıyor, kim satıyor, neyi fiyatlıyorlar.
3. **Zincir:** Bu hareket başka neyi etkiliyor? (petrol → enflasyon beklentisi → faiz → teknoloji hisseleri → gelişen piyasalar ve TL)
4. **Dünle kıyas:** Dünkü okumamızı teyit etti mi, çürüttü mü? Hikâye değişiyor mu?
5. **Piyasa ne bekliyor, sen ne görüyorsun:** Fiyatlanan senaryo ile riskler arasındaki fark. Belirsizse açıkça "belirsiz" de.
6. **Bundan sonra neye bakmalı:** Bu hikâyeyi bozacak ya da güçlendirecek tek şey.

**Örnek**

Kötü (rakam sıralaması):
> Wall Street teknoloji öncülüğünde yükseldi: S&P 500 %0,5, Nasdaq %0,6 arttı; Nasdaq pazartesi rekor kapanışı yaptı. Hisseler 10 yıllık faizin 24 yılın zirvesinde olmasına rağmen yükseliyor, çünkü şirket kârları çeyreklik %25'in üzerinde büyüyor.

İyi (yorum):
> Wall Street'te yükselişi yine teknoloji taşıdı ve Nasdaq rekor tazeledi. Asıl dikkat çekici olan, bunun tahvil faizleri çeyrek asrın zirvesindeyken olması. Normalde bu kadar yüksek faiz hisseleri aşağı çeker, çünkü gelecekteki kârın bugünkü değerini düşürür. Şu an bu çekimi kârların güçlü büyümesi dengeliyor; yatırımcı "faiz yüksek ama kâr daha hızlı artıyor" diye düşünüyor. Bu denge kırılgan: kâr büyümesinin yavaşladığı ilk çeyrekte faizin baskısı birden hissedilir. Bu yüzden önümüzdeki bilanço sezonunda kârın kendisinden çok şirketlerin gelecek çeyrek beklentilerine bakmak gerekiyor.

Bu kural `summary`, `s1`-`s7` paragrafları, `turkiye.reading`, `kripto.reading` ve tüm `*_note` alanları için geçerli. Kart ve tablolar (`cards`, `kpis`, `tickers`, `macro`, tablolar) rakam taşımaya devam eder.

## Öğrenme parçaları

**Neden-sonuç zinciri (`chain`)** — `s2`, `s3`, `s4`, `s5` her gün 3-6 adımlık bir zincir taşır. Her adım kısa bir ifade (en fazla ~6 kelime), rakamsız. Zincir o bölümün asıl hikâyesini baştan sona gösterir: `["Petrol geriledi", "Enflasyon beklentisi azaldı", "10Y faiz zirveden döndü", "Teknoloji yükseldi"]`. Paragraf bu halkaları tek tek açıklar.

**NQ için makro rüzgâr (`nq`)** — Burak NQ (Nasdaq 100 vadelisi) işlem yapıyor; yüksek zaman diliminde yön (bias) kurup 1 dakikalıkta giriyor. Bu bölüm makronun Nasdaq 100'e etkisini anlatır, **al/sat sinyali vermez**, seviye/hedef/stop yazmaz.
- `bias`: `destek` (makro NQ lehine), `notr` (karışık), `engel` (makro NQ aleyhine). Ana belirleyiciler: 10Y faiz yönü, dolar, büyük teknoloji haberleri/bilançoları, risk iştahı, Fed beklentisi.
- `paragraphs`: 1-2 paragraf; neden bu yön, denge nerede kırılır.
- `tailwinds` / `headwinds`: 2-4'er madde `{title, note}`.
- `vol_times`: bugün (ve yakın günlerdeki büyük olaylar) TSİ saatleriyle `{time, title, note, impact}`. ABD açılışını (16:30) her zaman ekle.
- `watch`: bugün izlenecek tek şey, tek cümle.
- `earnings`: NQ'yu en çok oynatan şirketlerin sıradaki bilanço tarihleri `{ticker, name, date: "YYYY-MM-DD", time: "before"|"after"}` (açılış öncesi / kapanış sonrası). Liste: AAPL, MSFT, NVDA, AMZN, META, GOOGL, TSLA, AVGO. Bigdata.com `corporate_calendar` (earnings-call) ile çek; tarihi geçenleri bir sonraki çeyreğinkiyle güncelle. Entity ID'ler: AAPL D8442A, MSFT 228D42, NVDA E09E2B, AMZN 0157B1, META 12E454, GOOGL 4A6F00, TSLA DD3BB1, AVGO 09DE1F. Takvim saati ABD kapanışından (23:00 TSİ) sonraysa `after`.

**Olay ve sektör etkisi (`impact`)** — her piyasa için: bir şey olduğunda hangi sektörü nasıl etkiledi, para nereye kayabilir, neye bakmalı. Ana sayfada özetin altında hepsi görünür; `turkiye.html` ve `kripto.html` kendi piyasasının kartlarını da gösterir. Burak'ın sohbette sorduğu "bu haberle bu sektörde ne var / bankalar yükseldi, para şimdi nereye geçer" sorusunun cevabı sormadan panelde hazır olsun diye var.
- `market`: `ABD` | `Avrupa-Asya` | `Emtia ve döviz` | `Türkiye` | `Kripto`. Her piyasadan en fazla 2, toplam en fazla 6 olay.
- Tetikleyici (`trigger`, kısa etiket: "Haber · 9 Ekim kapanışı", "Veri · TÜİK", "Sektör hareketi"): bir haber, bir veri açıklaması ya da sektörde sıra dışı bir hareket olabilir.
- Seçim: ABD/Avrupa/emtia/kripto için Bigdata.com'da önceki seansın en büyük hisse/sektör hareketlerini ve arkasındaki haberi bul. Türkiye için Borsa MCP sektör endeksleri (XBANK, XHOLD, XUSIN, XUTEK, XUMAL, XGMYO, XULAS…) + günün verisi/KAP haberi. **Olay en az iki grubu belirgin (ya da zıt yönde) oynatmış olmalı.** Böyle bir şey yoksa o piyasa için olay **koyma**; dolgu yazma. Hareketin sebebi bulunamıyorsa "sebebi netleşmedi" de, uydurma.
- `chain`: 3-5 adımlık neden-sonuç, rakamsız.
- `groups` (2-4 grup): `{name, tickers[], move, tone: up|down|flat, priced, question, flow?, counter}`.
  - `move`: araçtan gelen gerçek hareket ("%8,5–13 düşüş", "−%1,45"). Uydurma. Henüz hareket etmemiş ama etkilenecek grup için boş bırakılabilir.
  - `priced`: piyasa bu hareketle neyi fiyatladı (mekanizma).
  - `question`: bu grup için asıl soru; cevabı belirsizse "belirsiz" de.
  - `flow` (isteğe bağlı): **para nereye kayabilir** — bu hareketin ardından paranın hangi sektöre/varlığa geçmesi beklenebilir ve neden (mekanizma ya da geçmişteki benzer dönem: "indirim döngülerinde para önce bankalara, sonra borçlu sektörlere kayar"). Olasılık dili kullan, kesinlik ve al/sat yok.
  - `counter`: **ters okuma zorunlu**; aynı olayın bu grup için tersine yorumlanabileceği yön. Tek taraflı hikâye yazma.
- `checks`: karar vermeden önce bakılacak 3-4 doğrulanabilir veri (sıradaki veri/karar, bilanço kalemi, sözleşme koşulu gibi).
- `title`, `summary` (1-2 cümle), `sources[{name, url}]` (Bigdata sonuç adresi; yoksa sadece name).
- Al/sat, hedef fiyat, "fırsat" dili yok. Yorum kuralı geçerli.

**Veriler ne söylüyor (`makro.analysis`)** — makro sekmesinin ana yorumu, `surprises_note`'un yerine geçer. Son 7 günün verilerini tek tek saymaz; birlikte ne anlattıklarını yorumlar.
```
"analysis": {
  "headline": "Tek cümlelik ana fikir",
  "chain": ["3-5 adımlık neden-sonuç"],
  "paragraphs": ["3-4 paragraf: 1) ekonominin genel resmi (büyüme, istihdam), 2) enflasyon ve merkez bankası açısından anlamı, 3) diğer bölgeler (Avrupa, Türkiye) ile karşılaştırma, 4) bundan sonra hangi veri bu tabloyu değiştirir"],
  "effects": [{ "asset": "Fed | ABD 10Y faiz | Dolar | NQ / ABD hisseleri | Altın | Türkiye", "dir": "up|down|flat", "why": "tek cümle" }]
}
```

**Şirket kartları (`data/companies.json`)** — NQ bölümündeki bilanço listesinde bir şirkete tıklayınca açılan kart. Günlük dosyada değil, ayrı dosyada durur; her gün yeniden yazılmaz (maliyet).
- **Cumartesi:** 8 şirketin hepsi için `bigdata_company_tearsheet` (sections: `latest_earnings`, `revenue_segmentation`, `analyst_ratings`) ile `last`, `segments`, `analysts` alanlarını güncelle. `about` ve `nq_note` sadece şirketin işi değiştiyse değişir.
- **Bilançoya 10 gün veya daha az kala:** o şirketin `next` alanını doldur: `eps_est`, `rev_est` (milyar $; `analyst_estimates`'te yoksa haber araması), `known` (bilançodan önce bilinen veriler, ör. teslimat rakamları; 2-4 madde), `watch` (bilançoda neye bakılacak; 3 madde), `sources`.
- **Bilançonun ertesi sabahı:** `last`'ı yeni sonuçla güncelle (`note`: ne oldu ve hisse/NQ nasıl tepki verdi), `next`'i bir sonraki çeyreğe taşı.
- Yapı: `{name, about, nq_note, segments{period, items[{name, share}]}, last{period, date, eps{act, est}, rev{act, est}, note}, next{period, date, time, eps_est, rev_est, known[], watch[]}, analysts{buy, hold, sell, target}, sources[{name, url}]}`. Gelirler milyar $. EPS farkı çok büyükse (tek seferlik kalemler) `note`'ta belirt.

**Faiz eğrisinin NQ anlamı (`faizler.nq_note`)** — eğrideki bugünkü hareketin NQ'ya etkisi, 1-2 cümle. Odak 10 yıllık faizin yönü: yükseliyorsa NQ'ya baskı, düşüyorsa destek; neden ve ne zaman değişebilir.

**İki görüş (`s7.views`)** — günün ana tartışma konusunda boğa ve ayı tarafının argümanları. Bigdata.com'da 1 arama yap (strateji/analist görüşleri, son 1 hafta, haber + araştırma). Her madde `{text, who, url}`: `who` kurum/kişi, `url` Bigdata sonucunun adresi. Uydurma kaynak yazma; bulamazsan o maddeyi koyma. `split`: iki taraf neden ayrışıyor ve kimin haklı olduğunu hangi veri gösterecek.

**Cumartesi derin konu (`weekly.deep`)** — haftanın en önemli olayını uzun anlat: neden oldu, arkasındaki mekanizma, tarihte benzeri, kimi nasıl etkiliyor, ileride ne olabilir. 5-8 paragraf, yorum kuralı geçerli. Yapı:
```
"deep": {
  "title": "...", "chain": ["...", "..."], "paragraphs": ["..."],
  "sources": [{ "name": "...", "url": "..." }],
  "long_term": {
    "cycle": "Geç döngü / yavaşlama / resesyon / toparlanma / genişleme",
    "paragraphs": ["Ekonomik döngünün neresindeyiz, neden"],
    "assets": [{ "name": "ABD hisseleri", "view": "olumlu|notr|olumsuz", "note": "neden" }]
  }
}
```
`assets`: ABD hisseleri, Türk hisseleri, ABD tahvilleri, TL mevduat, altın, dolar, Bitcoin. Bu bir yatırım tavsiyesi değil, "bu ortamda bu varlık sınıfını hangi rüzgârlar etkiliyor" analizidir.

## Günlük JSON şeması (özet)

| Alan | İçerik |
|---|---|
| `date`, `updated` | `"2026-10-06"`, `"09:00"` |
| `tickers[]` | `{name, value, chg, tone}` üst şerit, 10 gösterge |
| `summary` | `{headline, lede, paragraphs[], read_min}` Claude'un günlük özeti |
| `impact` | isteğe bağlı, piyasa başına en fazla 2, toplam 6: `[{market, trigger, title, summary, chain[], groups[{name, tickers[], move, tone: up|down|flat, priced, question, flow?, counter}], checks[], sources[{name, url}]}]` |
| `s1` | `{mood: risk_off|temkinli|risk_on, mood_note, changes[{tag, tone: same|good|bad|new, text}], themes[3]{title,text}}` |
| `s2` | `{chain[], paragraphs[], sectors[{name, chg}]}` ABD + S&P sektörleri |
| `s3`, `s4`, `s5` | `{chain[], cards[{label, value, sub, tone}], paragraphs[]}` Avrupa-Asya / para-faiz-emtia / Türkiye |
| `s6` | `{paragraph, today[{time "SS:DD", title, detail, impact: high|mid|low|session}], week[{when,title,expect}], earnings[{ticker,when}]}` |
| `s7` | `{likely, alternative, signal, views{topic, bull[{text,who,url}], bear[...], split}}` |
| `nq` | `{bias: destek|notr|engel, paragraphs[], tailwinds[{title,note}], headwinds[...], vol_times[{time,title,note,impact}], watch, earnings[{ticker,name,date,time}]}` |
| `s8` | `{concept, title, paragraphs[], rule}` günün dersi |
| `news[]` | `{date, region, title, why}` |
| `faizler` | `{kpis[], curve[{tenor, now, m1}], curve_note, nq_note, fed{rate, rate_note, next_meeting, pricing, paragraph}, speakers[{when, who}]}` |
| `kuresel` | `{groups[{name, unit: pct|bp, rows[{name, d1, w1, m1, ytd}]}], note}` · Risk termometresi canlıdır, rutin yazmaz. |
| `turkiye` | `{kpis[], reading{headline, paragraphs[]}, bist{title, change_label, tone, highlight?{from, label}, points[{d, v}]}, sectors[{name, chg}], sectors_note, cpi{last, labels[], values[], note}, rates{policy, bonds[{tenor, v}], cards[], note}, macro[{name, period, actual, cons, prev, note, tone}], upcoming[{when, name}], lesson{title, paragraphs[], rule}, source}` |
| `kripto` | `{kpis[{code,label,value,sub,tone}], fng{now, yesterday, week}, reading{}, dominance{total_label, btc, usdt, total2_label}, dom_cards[{code,text}], levels{range[lo,hi], zone[a,b], items[{name, price, label, kind: past|support|now|resistance|ref|target}], note}, etf[{label, v (milyar $), text}], etf_note, coins[{sym, name, price, d1, w1, m1, m3, ytd, y1}], coins_note, institutional[{v,title,note}], drivers[{tag, tone, title, note}], lesson{}}` |
| `makro` | `{surprises[{name, actual, cons, prev, verdict, tone, meta}], analysis{headline, chain[], paragraphs[], effects[]}, countries{"ABD"|"Euro Bölgesi"|"Türkiye"|"Japonya"|"Çin": {charts[{type: bar|line, title, sub, unit, target?, target_label?, labels[], values[], last, trend, tone, note, prev, next}], rows[{group} | {name, period, actual, cons, prev, surprise, tone, next}], note}}, upcoming[{when, country, name, impact, cons, prev}]}` |
| `sources` | kaynak notu |

Tam örnek her zaman en son günün dosyasıdır.

## Yerelde deneme

```
python3 -m http.server 8000   # sonra http://localhost:8000
node scripts/validate.mjs
```

## ABD hisseleri (`hisseler.html`, `sirket.html`)

Ham veri (fiyat, finansallar, SEC açıklamaları, yönetici işlemleri, 13F) **GitHub Actions** ile gelir: `.github/workflows/us-data.yml` → `scripts/us/build.mjs` → `data/us/{universe.json, funds.json, co/<TICKER>.json, _log.txt}`. Hafta içi gece fiyat + açıklamalar, cumartesi finansallar dahil tam güncelleme. Bu dosyalara rutin **dokunmaz**.

Rutinin tek işi Türkçe metin: `data/us/tr.json`
```
{ "updated": "YYYY-MM-DD",
  "about": { "AAPL": "Ne iş yapar: 2-3 cümle, gelirin nereden geldiği, rakamsız" },
  "notes": { "<8-K accession no>": "Bu açıklama ne diyor, hisse için neden önemli: 1-2 cümle" },
  "news":  { "NVDA": [{ "date": "YYYY-MM-DD", "title": "Türkçe başlık", "why": "neden önemli, tek cümle" }] } }
```
Her sabah (hafta içi, günlük dosyadan sonra):
1. `about`'ta olmayan şirketlerden en büyük piyasa değerli 10 tanesine özet yaz (`universe.json` sırası). Hepsi dolunca bu adımı atla.
2. `co/*.json` içinde son 2 günde gelen `form: "8-K"` açıklamalarından en önemli en fazla 10 tanesine (`items` 2.02 bilanço, 1.01 anlaşma, 2.01 satın alma, 5.02 yönetici değişikliği, 2.05 yeniden yapılanma, 1.05 siber olay öncelikli) `notes[acc]` yaz. İçerik için Bigdata.com'da şirket + konu araması yap; açıklamanın kendisini uydurma, bulamazsan yazma.
3. `news`: piyasa değeri en büyük 15 şirket için Bigdata.com'dan son 24 saatin önemli haberi varsa şirket başına en fazla 2 haber ekle; her şirkette en yeni 6 haber kalsın.
Yorum kuralları burada da geçerli: rakam sıralama yok, al/sat yok. `node scripts/validate.mjs` sonra aynı commit'e dahil et.

## Veri analizi katmanı (`analytics/`, `analiz.html`)

Python ile yazılmış analiz hattı: `analytics/mi` (fetch → clean → SQLite → stats/events → report), `analytics/sql/*.sql`, `analytics/notebooks/` (defterler `build.py` ile koddan üretilir), `analytics/tests/` (pytest). GitHub Actions (`.github/workflows/analytics.yml`) her gün `data/analytics/summary.json`'u, her cumartesi `reports/<YYYY-Www>/` haftalık raporunu ve çalıştırılmış defterleri üretir. Rutin bu dosyalara **dokunmaz**. Kod değişikliğinden önce `cd analytics && python -m pytest -q tests`.


Analizler: korelasyon/risk, olay çalışmaları (bilanço, yönetici işlemleri), piyasa genişliği ve yoğunlaşma (`mi/breadth.py`), rejim kümelemesi ve ertesi gün aralık tahmini (`mi/regime.py`), takvim etkileri (`mi/calendar.py`, uzun geçmiş `analytics/data/long/NDX.csv`, haftalık güncellenir).
