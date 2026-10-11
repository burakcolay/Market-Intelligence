import { shell, fail, esc, map, loadJSON, heatBg } from '../app.js';
import { n, pct, pctv, tone } from '../us.js';

const app = shell('analiz');
const REPO = 'https://github.com/burakcolay/Market-Intelligence';
const sgn = (v, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${n(Math.abs(v), d)}`);

// Korelasyon rengi: −1 mavi, 0 beyaz, +1 kırmızı
function corrBg(v) {
  if (v == null) return '#F0F0EC';
  const a = Math.min(1, Math.abs(v));
  return v >= 0 ? `rgba(180,35,24,${0.08 + a * 0.75})` : `rgba(31,79,209,${0.08 + a * 0.75})`;
}

// Basit çizgi grafik: series [{name, color, pts:[[x,y]]}]
function lineSVG(series, { h = 240, zero = true, yfmt = (v) => n(v, 1), xlabels = null } = {}) {
  const all = series.flatMap((s) => s.pts.map((p) => p[1])).filter((v) => v != null);
  if (!all.length) return '';
  let lo = Math.min(...all), hi = Math.max(...all);
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const W = 1000, L = 46, R = 8, T = 8, B = 22;
  const len = Math.max(...series.map((s) => s.pts.length));
  const x = (i) => L + (i / Math.max(1, len - 1)) * (W - L - R);
  const y = (v) => T + ((hi - v) / (hi - lo)) * (h - T - B);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const path = (s) => s.pts.map((p, i) => (p[1] == null ? '' : `${i && s.pts[i - 1][1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`)).join('');
  const xl = xlabels || [series[0].pts[0][0], series[0].pts[Math.floor(len / 2)]?.[0], series[0].pts[len - 1][0]];
  return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:auto;display:block" role="img">
    ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line-soft)"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${esc(yfmt(t))}</text>`).join('')}
    ${zero && lo < 0 && hi > 0 ? `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-width=".8"/>` : ''}
    ${series.map((s) => `<path d="${path(s)}" fill="none" stroke="${s.color}" stroke-width="1.8"/>`).join('')}
    ${xl.map((t, i) => `<text x="${[L, (L + W - R) / 2, W - R][i]}" y="${h - 4}" text-anchor="${['start', 'middle', 'end'][i]}" font-size="10.5" fill="var(--muted)">${esc(String(t ?? ''))}</text>`).join('')}
  </svg>
  <div class="legend-row">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

const pv = (p) => (p == null ? '—' : p < 0.001 ? '<0,001' : n(p, 3));
const verdict = (p) => (p == null ? '' : p < 0.05 ? '<span class="badge b-good">anlamlı</span>' : '<span class="badge b-flat">anlamlı değil</span>');

async function main() {
  const R = await loadJSON('data/analytics/summary.json').catch(() => null);
  if (!R) { app.innerHTML = '<div class="wrap"><section class="card"><p>Analiz verisi henüz üretilmedi. GitHub Actions ilk çalışmadan sonra burada görünecek.</p></section></div>'; return; }
  const g = R.regime, E = R.earnings_study || {}, I = R.insider_study || {};
  let corrWin = 'm63';
  const corrTable = () => `<div class="tbl-wrap"><table class="corr"><thead><tr><th></th>${map(R.corr.labels, (l) => `<th><span>${esc(l)}</span></th>`)}</tr></thead><tbody>
    ${map(R.corr.labels, (l, i) => `<tr><th>${esc(l)}</th>${map(R.corr[corrWin][i], (v, j) => `<td style="background:${corrBg(i === j ? null : v)}" title="${esc(l)} ↔ ${esc(R.corr.labels[j])}">${i === j ? '' : n(v, 2)}</td>`)}</tr>`)}
  </tbody></table></div>`;
  const PCOL = ['#1F4FD1', '#D97706', '#0B7A47', '#7C3AED'];
  const stocks = (R.risk || []).filter((x) => x.cls === 'hisse' && x.beta != null);
  const ddNow = (R.drawdowns || []).filter((x) => x.cls === 'hisse').sort((a, b) => a.current_drawdown - b.current_drawdown).slice(0, 8);
  const tr = R.trend || {};
  const trTot = Object.values(tr).reduce((s, v) => s + v, 0) || 1;
  const buckets = E.drift_by_bucket || {};
  const PATHC = { olumsuz: '#B42318', nötr: '#8A90A0', olumlu: '#0B7A47' };
  const RC = { 'Güçlü yükseliş': '#0B7A47', 'Kararsız': '#8A90A0', 'Yükseliş': '#0B7A47', 'Düzeltme': '#D97706', 'Stres': '#B42318' };
  const Bd = R.breadth, G = R.regime_ml, M = R.range_model, C = R.calendar;

  const breadthSec = () => {
    if (!Bd) return '';
    const n_ = Bd.now, c3 = Bd.concentration['3a'] || {}, c1y = Bd.concentration['1y'] || {};
    const col = (k) => Bd.series_cols.indexOf(k);
    return `<section class="card"><span class="eyebrow accent">Piyasa genişliği ve yoğunlaşma</span>
      <h2 style="font-size:20px">Yükselişi kaç hisse taşıyor?</h2>
      <div class="grid" style="--min:170px">
        <div class="kpi"><span class="l">200 g. ortalama üstü</span><span class="v">%${n(n_.p200, 0)}</span><span class="s ${n_.p200 >= n_.p200_1m ? 'up' : 'down'}">1 ay önce %${n(n_.p200_1m, 0)}</span></div>
        <div class="kpi"><span class="l">50 g. ortalama üstü</span><span class="v">%${n(n_.p50, 0)}</span><span class="s flat">kısa vadeli katılım</span></div>
        <div class="kpi"><span class="l">52 haftalık zirve / dip</span><span class="v">${n_.new_high} / ${n_.new_low}</span><span class="s flat">bugün yeni zirve ve dip yapan hisse</span></div>
        <div class="kpi"><span class="l">İlk 10 şirketin payı (3 ay)</span><span class="v">${c3.top10_share == null ? '—' : '%' + n(c3.top10_share, 0)}</span><span class="s flat">endeks getirisinden</span></div>
        <div class="kpi"><span class="l">Eşit ağırlık − endeks (1 yıl)</span><span class="v ${tone(c1y.equal_weight_ret - c1y.index_ret)}">${sgn(c1y.equal_weight_ret - c1y.index_ret)} puan</span><span class="s flat">eksi: devler sürüklüyor</span></div>
      </div>
      ${lineSVG([{ name: '200 g. ortalama üstü hisse %', color: '#1F4FD1', pts: Bd.series.map((r) => [r[0], r[col('p200')]]) }, { name: '50 g. ortalama üstü hisse %', color: '#D97706', pts: Bd.series.map((r) => [r[0], r[col('p50')]]) }], { zero: false, yfmt: (v) => '%' + n(v, 0) })}
      ${lineSVG([{ name: 'Nasdaq 100 (piyasa değeri ağırlıklı)', color: '#16181D', pts: Bd.series.map((r) => [r[0], r[col('ndx')]]) }, { name: 'Eşit ağırlıklı sepet', color: '#7C3AED', pts: Bd.series.map((r) => [r[0], r[col('ew')]]) }], { zero: false, h: 200, yfmt: (v) => n(v, 0) })}
      <div class="row2">
        <div><b class="small">Son 3 ayda endekse en çok katkı</b><div class="tbl-wrap"><table class="tbl"><tbody>${map(c3.leaders || [], (x) => `<tr><td><a href="sirket.html?t=${esc(x.code)}"><b class="mono">${esc(x.code)}</b></a></td><td class="r num">${sgn(x.contrib, 2)} puan</td><td class="r num muted">ağırlık %${n(x.weight, 1)}</td></tr>`)}</tbody></table></div></div>
        <div><b class="small">En çok aşağı çekenler</b><div class="tbl-wrap"><table class="tbl"><tbody>${map(c3.laggards || [], (x) => `<tr><td><a href="sirket.html?t=${esc(x.code)}"><b class="mono">${esc(x.code)}</b></a></td><td class="r num down">${sgn(x.contrib, 2)} puan</td><td class="r num muted">ağırlık %${n(x.weight, 1)}</td></tr>`)}</tbody></table></div></div>
      </div>
      <p class="small muted">Endeks yükselirken genişlik düşüyorsa yükseliş az sayıda dev şirkete dayanıyor demektir; bu şirketlerden biri sendelediğinde endeksi taşıyacak geniş bir taban yoktur. Not: evren bugünkü Nasdaq 100 olduğu için geçmiş genişlik olduğundan biraz yüksek görünür.</p></section>`;
  };

  const regimeSec = () => {
    if (!G) return '';
    const tl = G.timeline;
    return `<section class="card"><span class="eyebrow accent">Makine öğrenmesi · kümeleme</span>
      <h2 style="font-size:20px">Piyasa hangi rejimde?</h2>
      <p class="muted small">Her gün beş özellikle tarif edildi: 1 aylık oynaklık, 3 aylık getiri, 200 günlük ortalamaya uzaklık, VIX ve genişlik. K-ortalamalar (k-means) bu günleri dört gruba ayırdı; gruplara merkezlerine bakılarak ad verildi.</p>
      <div class="grid" style="--min:170px">
        <div class="kpi"><span class="l">Bugünkü rejim</span><span class="v" style="color:${RC[G.current] || 'inherit'}">${esc(G.current)}</span><span class="s flat">${G.streak} işlem günüdür (${esc(G.since)}'den beri)</span></div>
        <div class="kpi"><span class="l">Ertesi gün aynı rejimde kalma</span><span class="v">%${n(G.stay_prob, 0)}</span><span class="s flat">geçmiş geçişlere göre</span></div>
      </div>
      <div class="regime-strip">${map(tl, (x) => `<i style="background:${RC[x[1]] || '#ccc'}" title="${esc(x[0])}: ${esc(x[1])}"></i>`)}</div>
      <div class="legend-row"><span>${esc(tl[0][0])}</span>${map(G.table, (r) => `<span><i style="background:${RC[r.regime]}"></i>${esc(r.regime)}</span>`)}<span>${esc(tl[tl.length - 1][0])}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Rejim</th><th class="r">Günlerin payı</th><th class="r">Ort. süre</th><th class="r">Oynaklık</th><th class="r">3 ay getiri</th><th class="r">Genişlik</th><th class="r">Sonraki ${G.horizon} gün ort.</th><th class="r">Yükselme oranı</th><th class="r">En kötü %5</th></tr></thead><tbody>
      ${map(G.table, (r) => `<tr class="${r.regime === G.current ? 'me' : ''}"><td><b style="color:${RC[r.regime]}">${esc(r.regime)}</b></td><td class="r num">%${n(r.share, 0)}</td><td class="r num">${n(r.avg_days, 0)} gün</td><td class="r num">%${n(r.vol21, 0)}</td><td class="r num">${sgn(r.ret63)}%</td><td class="r num">%${n(r.breadth, 0)}</td><td class="r num ${tone(r.fwd_mean)}">${sgn(r.fwd_mean)}%</td><td class="r num">%${n(r.fwd_hit, 0)}</td><td class="r num down">${sgn(r.fwd_worst)}%</td></tr>`)}
      </tbody></table></div>
      <p class="small muted">Bu tablo tahmin değil, geçmişteki benzer günlerin ardından ne olduğunu özetler. Kümeleme tüm geçmiş veriyle yapıldığı için betimleyicidir; ileriye dönük sinyal olarak kullanılmamalı.</p></section>`;
  };

  const rangeSec = () => {
    if (!M) return '';
    const x = M.next;
    return `<section class="card"><span class="eyebrow accent">Tahmin modeli</span>
      <h2 style="font-size:20px">Bir sonraki işlem günü Nasdaq 100 ne kadar oynar?</h2>
      <div class="grid" style="--min:190px">
        <div class="kpi big"><span class="l">Beklenen aralık (en yüksek − en düşük)</span><span class="v">${n(x.points, 0)} puan</span><span class="s flat">%${n(x.pct, 2)} · son 1 yıl ort. %${n(M.avg_range_1y, 2)}</span></div>
        <div class="kpi"><span class="l">10 günün 8'inde bu aralıkta</span><span class="v">${n(x.points_lo, 0)} – ${n(x.points_hi, 0)}</span><span class="s flat">sınamada isabet %${n(M.interval_hit, 0)}</span></div>
        <div class="kpi"><span class="l">Basit kurallara göre iyileşme</span><span class="v ${M.improvement > 0 ? 'up' : 'down'}">%${n(M.improvement, 0)}</span><span class="s flat">ortalama mutlak hata</span></div>
      </div>
      ${lineSVG([{ name: 'Gerçekleşen aralık %', color: '#16181D', pts: M.recent.map((r) => [r[0], r[1]]) }, { name: 'Modelin tahmini %', color: '#1F4FD1', pts: M.recent.map((r) => [r[0], r[2]]) }], { zero: false, h: 200, yfmt: (v) => '%' + n(v, 1) })}
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Yöntem (${esc(M.test_period[0])} – ${esc(M.test_period[1])}, ${M.n_test} gün)</th><th class="r">Ort. mutlak hata</th><th class="r">R²</th></tr></thead><tbody>
        <tr class="me"><td>Model (logaritmik HAR + VIX)</td><td class="r num">${n(M.model.mae, 3)}</td><td class="r num">${n(M.model.r2, 2)}</td></tr>
        <tr><td>"Yarın dün gibi olur"</td><td class="r num">${n(M.naive_yesterday.mae, 3)}</td><td class="r num">${n(M.naive_yesterday.r2, 2)}</td></tr>
        <tr><td>"Yarın son ayın ortalaması olur"</td><td class="r num">${n(M.naive_month.mae, 3)}</td><td class="r num">${n(M.naive_month.r2, 2)}</td></tr>
      </tbody></table></div>
      <p class="small muted">Model dünün, son haftanın ve son ayın aralığına ve VIX'e bakar. Sınama ileriye doğru yürüyerek yapıldı: model her ay yalnızca o güne kadarki veriyle yeniden eğitildi ve görmediği sonraki ayı tahmin etti. Yön tahmini yapmaz; yalnızca ne kadar hareket beklendiğini söyler.</p></section>`;
  };

  const calSec = () => {
    if (!C) return '';
    const T = C.tests.slice().sort((a, b) => a.p - b.p);
    const vb = (v) => (v === 'kararlı ve anlamlı' ? 'b-good' : v === 'fark yok' ? 'b-flat' : 'b-mid');
    return `<section class="card"><span class="eyebrow accent">Hipotez testi</span>
      <h2 style="font-size:20px">Takvim etkileri gerçek mi?</h2>
      <p class="muted small">${esc(C.start.slice(0, 4))}–${esc(C.end.slice(0, 4))}, ${n(C.n_days, 0)} işlem günü. ${C.tests.length} iddia test edildi: düzeltmesiz ${C.naive_significant} tanesi anlamlı görünüyor, çoklu test düzeltmesinden (Benjamini–Hochberg) sonra ${C.adj_significant} tanesi kalıyor. "Kararlı" = etki verinin iki yarısında (${esc(C.split.slice(0, 4))} öncesi ve sonrası) aynı yönde.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>İddia</th><th class="r">Gün</th><th class="r">Ort. günlük getiri</th><th class="r">Diğer günler</th><th class="r">p</th><th class="r">Düzeltilmiş p</th><th class="r">1. yarı / 2. yarı fark</th><th>Sonuç</th></tr></thead><tbody>
      ${map(T, (t) => `<tr><td>${esc(t.name.replace(/^gün:|^ay:/, ''))}</td><td class="r num">${n(t.n, 0)}</td><td class="r num ${tone(t.mean)}">${sgn(t.mean, 3)}%</td><td class="r num">${sgn(t.rest, 3)}%</td><td class="r num">${pv(t.p)}</td><td class="r num">${pv(t.p_adj)}</td><td class="r num">${sgn(t.diff_1, 3)} / ${sgn(t.diff_2, 3)}</td><td><span class="badge ${vb(t.verdict)}">${esc(t.verdict)}</span></td></tr>`)}
      </tbody></table></div>
      <p class="small muted">Çok sayıda test yapınca bazıları şans eseri anlamlı çıkar: 20 testte %5 düzeyinde ortalama 1 tane. Düzeltme bu yanılgıyı ayıklar. Gün içinde ve işlem maliyetleri hesaba katılmadan ölçülmüştür.</p></section>`;
  };

  app.innerHTML = `<div class="wrap">
    <section class="card lead">
      <span class="eyebrow accent">Veri analizi · ${esc(R.updated)} kapanışı</span>
      <h1 class="page-h">Piyasa analizi</h1>
      <p class="muted">Python, Pandas, SQL ve istatistiksel testlerle her gün otomatik üretilir. Rakamlar 5 yıllık günlük fiyat ve SEC verisinden.</p>
      <div class="grid" style="--min:170px">
        <div class="kpi"><span class="l">Nasdaq 100 trendi</span><span class="v">${esc(g.trend)}</span><span class="s ${g.dist_ma200 > 0 ? 'up' : 'down'}">200 günlük ortalamanın ${sgn(g.dist_ma200)}% ${g.dist_ma200 > 0 ? 'üstünde' : 'altında'}</span></div>
        <div class="kpi"><span class="l">Oynaklık rejimi</span><span class="v">${esc(g.vol_level)}</span><span class="s flat">şimdi %${n(g.vol_now, 1)} · ortanca %${n(g.vol_median, 1)}</span></div>
        <div class="kpi"><span class="l">Trendi yukarı hisseler</span><span class="v">%${n(((tr['güçlü yükseliş'] || 0) + (tr['yükseliş'] || 0)) / trTot * 100, 0)}</span><span class="s flat">200 günlük ortalamanın üstünde</span></div>
        <div class="kpi"><span class="l">Olağandışı hareket</span><span class="v">${(R.anomalies || []).length}</span><span class="s flat">son 10 işlem günü</span></div>
      </div>
    </section>

    <section class="card yorum"><span class="eyebrow accent">Veriler ne söylüyor</span><ul>${map(R.narrative, (s) => `<li class="flat">${esc(s)}</li>`)}</ul></section>

    <div class="row2">
      <section class="card"><div class="head-row"><span class="eyebrow">Sektör dönüşümü</span><span class="xs muted">eşit ağırlıklı getiri %</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sektör</th><th class="r">1 hafta</th><th class="r">1 ay</th><th class="r">3 ay</th><th>Öncü / geride</th></tr></thead><tbody>
        ${map(R.sectors, (s) => `<tr><td>${esc(s.sector)} <small class="muted">${s.n}</small></td>${map(['r_1w', 'r_1m', 'r_3m'], (k) => `<td class="r num" style="background:${heatBg(s[k], 2)}">${sgn(s[k])}</td>`)}<td class="small"><a href="sirket.html?t=${esc(s.leader)}">${esc(s.leader)}</a> / <a href="sirket.html?t=${esc(s.laggard)}">${esc(s.laggard)}</a></td></tr>`)}
        </tbody></table></div>
        <p class="small muted">Kısa vadede öne geçen sektör uzun vadede de öndeyse dönüşüm kalıcıdır; yalnızca 1 haftada öndeyse çoğunlukla tepki alımıdır.</p></section>
      <section class="card"><div class="head-row"><span class="eyebrow">Varlıklar arası ilişki</span><div class="chips"><button class="chip on" data-cw="m63">3 ay</button><button class="chip" data-cw="m252">1 yıl</button></div></div>
        <div id="corr">${corrTable()}</div>
        <p class="small muted">Kırmızı birlikte, mavi ters yönde hareket. Çeşitlendirme ancak düşük ya da ters ilişkili varlıklarla işe yarar.</p></section>
    </div>

    <section class="card"><div class="head-row"><span class="eyebrow">İlişkiler zamanla nasıl değişiyor</span><span class="xs muted">63 günlük kayan korelasyon</span></div>
      ${lineSVG((R.pairs || []).map((p, i) => ({ name: `${p.label} (şimdi ${n(p.now, 2)}, 1 yıl önce ${p.year_ago == null ? '—' : n(p.year_ago, 2)})`, color: PCOL[i], pts: p.series })), { yfmt: (v) => n(v, 1) })}
      <p class="small muted">Korelasyon sabit değildir: kriz dönemlerinde çoğu riskli varlık aynı yöne gider. Bu yüzden geçmiş bir yılın ilişkisine dayanan çeşitlendirme, tam gerektiği anda zayıflayabilir.</p></section>

    <div class="row2">
      <section class="card"><span class="eyebrow">Risk haritası: en yüksek beta</span>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hisse</th><th class="r">Beta</th><th class="r">Yıllık oynaklık</th><th class="r">Oynaklık yüzdeliği</th></tr></thead><tbody>
        ${map(stocks.sort((a, b) => b.beta - a.beta).slice(0, 10), (x) => `<tr><td><a href="sirket.html?t=${esc(x.code)}"><b class="mono">${esc(x.code)}</b></a> <small class="muted">${esc(x.name || '')}</small></td><td class="r num">${n(x.beta, 2)}</td><td class="r num">%${n(x.vol_1y, 0)}</td><td class="r num">${n(x.vol_pctile, 0)}</td></tr>`)}
        </tbody></table></div>
        <p class="small muted">Beta 2: endeks %1 hareket ettiğinde hisse ortalama %2 hareket eder. Yüzdelik 100'e yakınsa hisse şu an son 5 yılının en oynak dönemindedir.</p></section>
      <section class="card"><span class="eyebrow">Zirvesinden en uzak hisseler</span>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hisse</th><th class="r">Şu an zirveden</th><th class="r">5 yılın en büyük düşüşü</th></tr></thead><tbody>
        ${map(ddNow, (x) => `<tr><td><a href="sirket.html?t=${esc(x.code)}"><b class="mono">${esc(x.code)}</b></a> <small class="muted">${esc(x.name || '')}</small></td><td class="r num down">${sgn(x.current_drawdown)}%</td><td class="r num">${sgn(x.max_drawdown)}% <small class="muted">${esc(x.trough_date)}</small></td></tr>`)}
        </tbody></table></div></section>
    </div>

    ${breadthSec()}
    ${regimeSec()}
    ${rangeSec()}
    ${calSec()}

    ${E.avg_path ? `<section class="card">
      <span class="eyebrow accent">Araştırma · olay çalışması</span>
      <h2 style="font-size:20px">Bilanço sonrası fiyat davranışı</h2>
      <p class="muted small">${E.n} bilanço açıklaması, ${E.companies} şirket (${esc(E.period[0])} – ${esc(E.period[1])}). Anormal getiri piyasa modeliyle: her olay için hissenin endekse duyarlılığı olaydan önceki dönemde tahmin edildi, olay günlerindeki fark ölçüldü.</p>
      ${lineSVG(Object.entries(E.avg_path).map(([k, v]) => ({ name: `İlk tepkisi ${k}`, color: PATHC[k] || '#1F4FD1', pts: v.map((y, i) => [E.path_days[i], y]) })), { xlabels: ['gün −5', 'gün ' + E.path_days[Math.floor(E.path_days.length / 2)], 'gün +40'], yfmt: (v) => n(v, 1) + '%' })}
      <div class="grid" style="--min:200px">
        <div class="kpi"><span class="l">Bilanço günü oynaklığı</span><span class="v">${n(E.react_ratio, 1)} kat</span><span class="s flat">sıradan 2 günlük döneme göre</span></div>
        <div class="kpi"><span class="l">Olumlu − olumsuz sürüklenme</span><span class="v">${sgn(E.drift_spread.diff, 2)} puan</span><span class="s flat">gün 2–40 · p ${pv(E.drift_spread.p)} ${verdict(E.drift_spread.p)}</span></div>
        <div class="kpi"><span class="l">Tepki ↔ sonrası (Spearman)</span><span class="v">${n(E.spearman.rho, 3)}</span><span class="s flat">p ${pv(E.spearman.p)} ${verdict(E.spearman.p)}</span></div>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>İlk tepki grubu</th><th class="r">Olay</th><th class="r">Sonraki 2 ay ort. %</th><th class="r">%95 güven aralığı</th><th class="r">p</th></tr></thead><tbody>
      ${map(Object.entries(buckets), ([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${v.n}</td><td class="r num ${tone(v.mean)}">${sgn(v.mean, 2)}</td><td class="r num">${v.ci95 ? `${sgn(v.ci95[0], 2)} / ${sgn(v.ci95[1], 2)}` : '—'}</td><td class="r num">${pv(v.p)}</td></tr>`)}
      </tbody></table></div>
    </section>` : ''}

    ${I.alim ? `<section class="card"><span class="eyebrow accent">Araştırma · olay çalışması</span><h2 style="font-size:20px">Yöneticiler alınca hisse ne yapıyor?</h2>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Olay</th><th>Pencere</th><th class="r">Olay</th><th class="r">Ort. anormal getiri %</th><th class="r">Pozitif oran</th><th class="r">p</th><th></th></tr></thead><tbody>
      ${map([['alim', 'Piyasadan alım'], ['plansiz_satis', 'Plansız satış']], ([k, l]) => map([['car20', '1–20 gün'], ['car40', '1–40 gün']], ([w, wl]) => { const v = I[k]?.[w] || {}; return `<tr><td>${l}</td><td>${wl}</td><td class="r num">${v.n ?? 0}</td><td class="r num ${tone(v.mean)}">${sgn(v.mean, 2)}</td><td class="r num">${v.hit == null ? '—' : '%' + n(v.hit, 0)}</td><td class="r num">${pv(v.p)}</td><td>${verdict(v.p)}</td></tr>`; }))}
      </tbody></table></div>
      <p class="small muted">Aynı şirkette 30 gün içindeki işlemler tek olay sayıldı (${I.alim.raw_events} alım bildirimi → ${I.alim.car40?.n ?? 0} olay, ${I.alim.companies} şirket). ${I.alim.period ? `Olaylar ${esc(I.alim.period[0])} – ${esc(I.alim.period[1])} arasına yığılmış; aynı piyasa ortamını paylaştıkları için tam bağımsız değiller ve anlamlılık olduğundan güçlü görünebilir.` : ''} Satışların çoğu önceden planlandığından yalnızca plansız satışlar ayrıca incelendi.</p></section>` : ''}

    ${R.anomalies?.length ? `<section class="card"><div class="head-row"><span class="eyebrow">Olağandışı günler</span><span class="xs muted">getirisi ya da hacmi önceki 63 günün normalinden en az 3 standart sapma uzak</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tarih</th><th>Varlık</th><th class="r">Getiri</th><th class="r">Getiri z</th><th class="r">Hacim z</th></tr></thead><tbody>
      ${map(R.anomalies.slice().sort((a, b) => b.date.localeCompare(a.date)), (a) => `<tr><td class="num">${esc(a.date)}</td><td><b class="mono">${esc(a.code)}</b> <small class="muted">${esc(a.name || '')}</small></td><td class="r num ${tone(a.ret)}">${sgn(a.ret, 2)}</td><td class="r num">${a.z_ret == null ? '—' : sgn(a.z_ret, 1)}</td><td class="r num">${a.z_vol == null ? '—' : sgn(a.z_vol, 1)}</td></tr>`)}
      </tbody></table></div></section>` : ''}

    <section class="card"><span class="eyebrow">Yöntem ve kaynak kod</span>
      <div class="facts">
        <div><b>Veri hattı</b><span>Yahoo Finance (yedek Stooq) ve SEC EDGAR → Pandas ile temizlik → SQLite veritabanı → istatistik → JSON ve haftalık rapor. GitHub Actions ile her gün otomatik.</span></div>
        <div><b>Kaynak kod</b><span><a href="${REPO}/tree/main/analytics" target="_blank" rel="noopener">analytics/</a> · <a href="${REPO}/tree/main/analytics/sql" target="_blank" rel="noopener">SQL sorguları</a> · <a href="${REPO}/tree/main/analytics/notebooks" target="_blank" rel="noopener">Jupyter defterleri</a> · <a href="${REPO}/tree/main/reports" target="_blank" rel="noopener">Haftalık raporlar</a></span></div>
        <div><b>Sınırlamalar</b><span>Evren bugünkü Nasdaq 100 (hayatta kalma yanlılığı); ücretsiz fiyat kaynağı; olay saatleri gün bazında.</span></div>
      </div></section>
    <p class="source">Bilgi amaçlıdır, yatırım tavsiyesi değildir.</p>
  </div>`;
  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cw]'); if (!b) return;
    corrWin = b.dataset.cw;
    app.querySelectorAll('[data-cw]').forEach((x) => x.classList.toggle('on', x === b));
    document.getElementById('corr').innerHTML = corrTable();
  });
}
main().catch(fail);
