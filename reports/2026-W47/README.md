# Haftalık piyasa raporu · 2026-W47

_Otomatik üretildi: 2026-11-20 kapanış verisiyle. Kaynak kod: [`analytics/`](../../analytics). Yatırım tavsiyesi değildir._

## Özet
- Nasdaq 100 düşüş trendinde (200 günlük ortalamanın altında) ve oynaklık uzun dönem normaline göre yüksek. Düşüş trendinde oynaklığın yüksek olması, satışın panik tarafına geçtiğini gösterebilir.
- Son bir ayda en güçlü sektör Sağlık, en zayıfı Yarı iletken. Para savunmacı tarafa kayıyor.
- Bilanço açıklamalarından sonraki iki günde hisseler, sıradan iki günlük dönemlere göre yaklaşık 2,9 kat fazla oynuyor (962 bilanço). İlk tepkinin yönü sonraki iki ayı açıklamıyor (p=0,89): büyük şirketlerde bilanço haberi hızla fiyatlanıyor, sürüklenme görülmüyor.
- Yöneticilerin piyasadan alım yaptığı 22 olayda (22 şirket) hisse sonraki iki ayda piyasaya göre ortalama 12,5 puan fazla getiri sağladı ve fark istatistiksel olarak anlamlı. Ancak olaylar 2026-05 – 2026-09 arasındaki kısa bir döneme yığılmış; aynı piyasa ortamını paylaştıkları için bağımsız sayılmazlar, sonuç daha uzun bir dönemde doğrulanmadan sinyal sayılmamalı.
- Nasdaq 100 hisselerinin yaklaşık yüzde 42 kadarı 200 günlük ortalamasının üstünde ve bu oran son bir ayda düştü. Yükselişi hisselerin azınlığı taşıyor; dar tabanlı yükselişler, öncü birkaç hisse sendelediğinde daha kırılgandır.
- Kümeleme modeline göre piyasa 2 işlem günüdür 'Stres' rejiminde. Geçmişte bu rejimdeki günlerin ardından gelen 20 işlem gününde Nasdaq 100 ortalama yüzde 4,4 değişti ve dönemlerin yüzde 74 kadarında yükseldi. Bu bir tahmin değil, benzer dönemlerin geçmiş davranışı.
- Bir sonraki işlem günü için beklenen Nasdaq 100 aralığı (en yüksek ile en düşük arası) yaklaşık %3,47, yani 869 puan civarı; geçmiş isabete göre 10 günün 8'inde 444 ile 1251 puan arasında kalır. Model, görmediği son dönemde basit kurallardan (dünün aralığı, son ayın ortalaması) yaklaşık yüzde 4 daha isabetli.
- Takvim etkileri 2000 yılından bu yana 20 ayrı iddiayla test edildi: düzeltmesiz bakılınca 1 tanesi anlamlı görünüyor, çoklu test düzeltmesinden sonra 0 tanesi kalıyor. Yaygın takvim efsanelerinin hiçbiri bu veride doğrulanmıyor; çoğu, şans eseri anlamlı görünen sonuçlardan ibaret.
- Son iki haftada getirisi ya da hacmi kendi normalinin çok dışına çıkan varlıklar: ADI, AMAT, AVGO, CEG, CHTR, CRWV. Bu günlerin arkasında genellikle bilanço, haber ya da endeks değişikliği olur.

## Sektörler
![Sektörler](sektorler.png)

| Sektör | 1 hafta % | 1 ay % | 3 ay % | Öncü | Geride kalan |
|---|---|---|---|---|---|
| Sağlık | −4,3 | 3,5 | 6,1 | IDXX | ISRG |
| Gıda ve içecek | −2,6 | −0,3 | 0,9 | CCEP | MNST |
| Perakende | −3,8 | −1,9 | −2,4 | COST | MELI |
| Havacılık ve uzay | −4,4 | −2,3 | −0,7 | HON | HON |
| İletişim | −7,2 | −2,5 | −13,2 | CHTR | GOOGL |
| Seyahat ve eğlence | −7,2 | −3,5 | −9,8 | MAR | BKNG |
| Enerji ve kamu hizmeti | −5,5 | −3,6 | −3,2 | EXC | FANG |
| Otomotiv | −7,8 | −7,1 | −11,0 | PCAR | TSLA |
| Sanayi | −5,2 | −7,5 | −12,5 | ROP | AXON |
| Ulaştırma | −4,7 | −8,2 | −10,4 | CSX | ODFL |
| Teknoloji | −9,2 | −13,6 | −7,4 | APP | MSTR |
| Tüketici hizmetleri | −8,5 | −13,9 | −18,9 | PYPL | DASH |
| Yarı iletken | −16,2 | −19,4 | −23,2 | NXPI | NVDA |

## Haftanın en çok yükselen ve düşen hisseleri
| Kod | Şirket | 1 hafta % | 1 ay % |
|---|---|---|---|
| PANW | Palo Alto Networks | 6,5 | −3,3 |
| PDD | PDD | 6,0 | 5,7 |
| CRWD | CrowdStrike Holdings | 1,2 | −3,6 |
| ZS | Zscaler | 1,2 | −18,1 |
| KHC | Kraft Heinz | 1,1 | 1,2 |
| MSTR | Strategy | −30,3 | −46,6 |
| MU | Micron Technology | −23,6 | −30,6 |
| NVDA | NVIDIA | −22,9 | −40,8 |
| INTU | Intuit | −20,9 | −23,8 |
| AMD | Advanced Micro Devices | −20,5 | −16,4 |

## Varlıklar arası ilişki
![Korelasyon](korelasyon.png)

![İlişkilerin zaman içindeki değişimi](iliskiler.png)

## Risk
![Risk haritası](risk.png)

![Zirveden uzaklık](dusus.png)

## Olağandışı günler (son 10 işlem günü)
Getirisi ya da hacmi, önceki 63 günün ortalamasından en az 3 standart sapma uzak olanlar.

| Tarih | Kod | Getiri | Getiri z | Hacim z |
|---|---|---|---|---|
| 2026-11-09 | ADI | 8,6 | 3,5 | 1,6 |
| 2026-11-09 | AMAT | 11,4 | 3,3 | 1,4 |
| 2026-11-09 | AVGO | 8,8 | 3,4 | 1,5 |
| 2026-11-09 | CEG | 10,5 | 3,4 | 2,1 |
| 2026-11-09 | MPWR | 16,6 | 4,7 | 1,9 |
| 2026-11-09 | NVDA | −4,3 | −1,6 | 4,7 |
| 2026-11-09 | PCAR | 3,7 | 3,1 | 1,0 |
| 2026-11-09 | TTD | 15,5 | 5,3 | 4,2 |
| 2026-11-09 | VIX | −5,7 | −3,1 | — |
| 2026-11-10 | CHTR | 10,6 | 3,1 | 1,2 |
| 2026-11-10 | NVDA | −5,5 | −2,0 | 3,8 |
| 2026-11-10 | TTWO | 8,3 | 4,0 | 3,4 |

## Piyasa genişliği ve yoğunlaşma
![Genişlik](genislik.png)

| Kod | Endekse katkı (puan) | Getiri % | Ağırlık % |
|---|---|---|---|
| AAPL | 1,27 | 10,5 | 12,1 |
| COST | 0,16 | 13,6 | 1,2 |
| CRWD | 0,11 | 20,3 | 0,5 |
| GILD | 0,07 | 14,1 | 0,5 |
| APP | 0,04 | 16,6 | 0,3 |

## Piyasa rejimi (kümeleme)
![Rejimler](rejim.png)

Bugün: **Stres** (2 işlem günüdür). Rejimler oynaklık, trend, 200 günlük ortalamaya uzaklık, VIX ve genişlikten k-ortalamalar ile çıkarıldı; tablo betimleyicidir.

| Rejim | Gün payı % | Oynaklık % | 3 ay getiri % | Sonraki 20 gün ort. % | Yükselme oranı % |
|---|---|---|---|---|---|
| Güçlü yükseliş | 35 | 15 | 13,8 | 1,2 | 66 |
| Kararsız | 43 | 19 | 4,6 | 1,6 | 67 |
| Düzeltme | 15 | 25 | −3,1 | 3,0 | 63 |
| Stres | 7 | 40 | −9,1 | 4,4 | 74 |

## Ertesi gün aralık tahmini
![Aralık](aralik.png)

Beklenen aralık: **869 puan** (%3,47); 10 günün 8'inde 444–1251 puan.

| Yöntem | Ort. mutlak hata | R² |
|---|---|---|
| Model (logaritmik HAR + VIX) | 0,459 | 0,23 |
| Yarın dün gibi | 0,548 | −0,15 |
| Yarın son ayın ortalaması | 0,478 | 0,12 |

Sınama: 2025-06-03 – 2026-11-19, ileriye doğru yürüyen pencere (aylık yeniden eğitim).

## Takvim etkileri
![Takvim](takvim.png)

2000–2026, 6762 gün, 20 iddia. Düzeltmesiz anlamlı: 1, Benjamini–Hochberg sonrası: 0.

## Araştırma: Bilanço sonrası fiyat davranışı
![Bilanço sonrası](bilanco.png)

962 bilanço açıklaması (103 şirket, 2023-08-03 – 2026-09-24). Anormal getiri piyasa modeliyle hesaplandı (her olay için önceki 220 günde hissenin Nasdaq 100'e duyarlılığı).

| İlk tepki grubu | Olay | Sonraki 2 ay ort. anormal getiri % | t | p |
|---|---|---|---|---|
| olumsuz | 321 | 0,27 | 0,26 | 0,795 |
| nötr | 320 | −0,99 | −1,47 | 0,143 |
| olumlu | 321 | 0,46 | 0,51 | 0,609 |

Olumlu ve olumsuz grup farkı: 0,19 puan (Welch t-testi p=0,891). Tepki ile sonraki getiri arasındaki sıra korelasyonu: 0,036 (p=0,267).

## Veri kalitesi
- Otomatik kontroller: 4/8 geçti.
- Fiyat kaynakları uyuşuyor: geçti
- Fiyatlar güncel: geçti
- Günlük %50 üstü hareket yok: geçti
- Finansallar güncel: geçti
- Gelir tablosu kendi içinde tutarlı: 1 sorun (MELI)
- Bilanço denkliği: 1 sorun (MSTR)
- Piyasa değeri ile hisse sayısı tutarlı: 2 sorun (CHTR, CMCSA)
- Para birimi: 3 sorun (ASML, CCEP, FER)
- 121 varlıkta 200 günden uzun temiz fiyat geçmişi var.
- Temizleme sırasında 1 tek günlük hatalı fiyat düzeltildi.
