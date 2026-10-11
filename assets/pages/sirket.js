import { shell, fail, esc, map, tvMini } from '../app.js';
import { yorumla, yorumBox } from '../yorum.js';
import { n, pct, pctv, tone, usd, loadUS, q, bars, qLabel, ago, chgBadge, star, toggleWatch } from '../us.js';

const T = (new URLSearchParams(location.search).get('t') || 'AAPL').toUpperCase();
const app = shell('hisseler');
const TABS = [['ozet', 'Özet'], ['fin', 'Finansal tablolar'], ['oran', 'Oranlar'], ['buyume', 'Büyüme ve ortaklar'], ['sektor', 'Sektör kıyası'], ['acik', 'Açıklamalar'], ['yat', 'Büyük yatırımcılar'], ['ic', 'İçeriden işlemler']];
// [anahtar, ad, biçim, vurgulu]
const STMT = {
  gelir: ['Gelir tablosu', [['revenue', 'Satış gelirleri', 0, 1], ['cogs', 'Satış maliyeti'], ['gross', 'Brüt kâr', 0, 1], ['rnd', 'Ar-Ge gideri'], ['sga', 'Pazarlama, genel yönetim'], ['opinc', 'Faaliyet kârı', 0, 1], ['ebitda', 'FAVÖK'], ['interest', 'Faiz gideri'], ['pretax', 'Vergi öncesi kâr'], ['tax', 'Vergi'], ['net', 'Net kâr', 0, 1], ['eps', 'Hisse başı kâr ($)', 'eps'], ['shDil', 'Ortalama hisse sayısı (seyreltilmiş)', 'sh']]],
  bilanco: ['Bilanço', [['_', 'Varlıklar'], ['cash', 'Nakit'], ['stInv', 'Kısa vadeli yatırımlar'], ['recv', 'Ticari alacaklar'], ['inv', 'Stoklar'], ['curAssets', 'Dönen varlıklar', 0, 1], ['ppe', 'Maddi duran varlıklar'], ['goodwill', 'Şerefiye'], ['intang', 'Maddi olmayan varlıklar'], ['assets', 'Toplam varlıklar', 0, 1], ['_', 'Yükümlülükler'], ['payables', 'Ticari borçlar'], ['stDebt', 'Kısa vadeli finansal borç'], ['curLiab', 'Kısa vadeli yükümlülükler', 0, 1], ['debt', 'Uzun vadeli finansal borç'], ['liab', 'Toplam yükümlülükler', 0, 1], ['_', 'Özkaynak'], ['retained', 'Geçmiş yıl kârları'], ['equity', 'Özkaynaklar', 0, 1], ['netDebt', 'Net borç (− ise net nakit)']]],
  nakit: ['Nakit akışı', [['net', 'Net kâr'], ['da', 'Amortisman'], ['sbc', 'Hisse bazlı ödemeler'], ['ocf', 'Faaliyet nakit akışı', 0, 1], ['capex', 'Yatırım harcaması'], ['fcf', 'Serbest nakit akışı', 0, 1], ['acq', 'Şirket satın almaları'], ['buyback', 'Hisse geri alımı'], ['divPaid', 'Ödenen temettü']]],
};
// Oranlar: [anahtar, ad, biçim, açıklama]
const RATIOS = [
  ['_', 'Kârlılık'], ['grossM', 'Brüt marj', 'p'], ['opM', 'Faaliyet marjı', 'p'], ['ebitdaM', 'FAVÖK marjı', 'p'], ['netM', 'Net marj', 'p'], ['fcfM', 'Serbest nakit marjı', 'p'],
  ['roe', 'Özkaynak kârlılığı (ROE)', 'p', 'Net kâr / ortalama özkaynak. Ortakların koyduğu her 100 dolara yılda kaç dolar kâr.'],
  ['roa', 'Aktif kârlılığı (ROA)', 'p', 'Net kâr / ortalama toplam varlık.'],
  ['roic', 'Yatırılan sermaye getirisi (ROIC)', 'p', 'Vergi sonrası faaliyet kârı / (özkaynak + borç − nakit). İşin kendisinin ne kadar verimli olduğunu borçtan bağımsız gösterir.'],
  ['_', 'Borç ve likidite'], ['current', 'Cari oran', 'x', 'Dönen varlıklar / kısa vadeli yükümlülükler. 1\'in altı kısa vadeli borcun eldeki dönen varlıktan büyük olduğunu gösterir.'], ['quick', 'Asit-test oranı', 'x', 'Stoklar hariç cari oran.'],
  ['debtEq', 'Borç / özkaynak', 'x'], ['netDebtEbitda', 'Net borç / FAVÖK', 'x', 'Borcun kaç yıllık FAVÖK ile kapanacağı. Eksi değer net nakit demek.'], ['intCover', 'Faiz karşılama', 'x', 'Faaliyet kârı / faiz gideri.'],
  ['_', 'Verimlilik ve harcama'], ['invTurn', 'Stok devir hızı', 'x'], ['recvDays', 'Alacak tahsil süresi (gün)', 'd'], ['taxRate', 'Efektif vergi oranı', 'p'],
  ['rndPct', 'Ar-Ge / satış', 'p'], ['sbcPct', 'Hisse bazlı ödeme / satış', 'p', 'Çalışanlara hisseyle yapılan ödeme. Yüksekse ortakların payı her yıl sulanır.'], ['capexPct', 'Yatırım harcaması / satış', 'p'], ['payout', 'Temettü dağıtım oranı', 'p'],
];
const QR = new Set(['grossM', 'opM', 'ebitdaM', 'netM', 'fcfM', 'current', 'quick', 'debtEq', 'taxRate', 'rndPct', 'sbcPct']);
const fmtR = (v, f) => (v == null || !isFinite(v) ? '—' : f === 'p' ? pctv(v, 1) : f === 'x' ? n(v, 2) : f === 'd' ? n(v, 0) : n(v, 1));
const fmtS = (v, f) => (f === 'eps' ? n(v, 2) : f === 'sh' ? (v == null ? '—' : n(v / 1e6, 0) + ' Mn') : usd(v));
const withCalc = (r) => ({ ...r, ebitda: r.opinc != null && r.da != null ? r.opinc + r.da : null, fcf: r.ocf != null ? r.ocf - (r.capex || 0) : null, netDebt: r.debt != null || r.stDebt != null ? (r.debt || 0) + (r.stDebt || 0) - (r.cash || 0) - (r.stInv || 0) : null });
const tip = (t) => (t ? `<span class="qm" tabindex="0" data-tip="${esc(t)}">?</span>` : '');
const kpi = (l, v, s = '', cls = '') => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span>${s ? `<span class="s ${cls}">${s}</span>` : ''}</div>`;

async function main() {
  const [c, F, TR, U] = await Promise.all([loadUS(`co/${T}.json`), loadUS('funds.json').catch(() => null), loadUS('tr.json').catch(() => ({})), loadUS('universe.json').catch(() => null)]);
  document.title = `${T} · ${c.name} · Market Intelligence`;
  const about = TR.about?.[T], notes = TR.notes || {}, news = TR.news?.[T] || [];
  const f = c.fin || {}, t = f.ttm || {}, v = c.val || {}, p = c.px || {};
  const A = f.annual || [], Q = f.quarterly || [];
  const holders = (F?.holders?.[T] || []).slice().sort((a, b) => b.value - a.value);
  const since = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  const ins = (c.insiders || []).filter((x) => x.date >= since && (x.buy || x.sell));
  const buy = ins.reduce((s, x) => s + x.buy, 0), sell = ins.reduce((s, x) => s + x.sell, 0);
  const nm = t.revenue && t.net != null ? (t.net / t.revenue) * 100 : null;
  const fcf = t.ocf != null ? t.ocf - (t.capex || 0) : null;
  const earn = (c.filings || []).find((x) => x.items?.includes('2.02'));
  const Y = yorumla(c, (U?.rows || []).filter((r) => r.sector === c.sector));
  const adders = holders.filter((h) => h.chg === 'new' || h.chg === 'add').length;

  const ozet = () => `${Y.ozet.good.length || Y.ozet.bad.length ? `<div class="row2">
      <section class="card yorum"><span class="eyebrow" style="color:var(--up)">Güçlü yanlar</span><ul>${map(Y.ozet.good, (x) => `<li class="good">${x.s}</li>`) || '<li class="flat">Belirgin bir güçlü yan çıkmadı.</li>'}</ul></section>
      <section class="card yorum"><span class="eyebrow" style="color:var(--down)">Dikkat edilecekler</span><ul>${map(Y.ozet.bad, (x) => `<li class="bad">${x.s}</li>`) || '<li class="flat">Belirgin bir zayıf yan çıkmadı.</li>'}</ul></section>
    </div>` : ''}<div class="row2">
      <section class="card"><span class="eyebrow">Fiyat, 1 yıl</span><div id="tv" class="tv"></div></section>
      <section class="card"><span class="eyebrow">Çeyreklik gelir ve net kâr</span>${bars(Q.slice(-8).map((x) => ({ label: qLabel(x.end), v: x.revenue, v2: x.net })), { names: ['Gelir', 'Net kâr'] })}</section>
    </div>
    <div class="row2">
      <section class="card"><span class="eyebrow">Ne iş yapar</span>${about ? `<p>${esc(about)}</p>` : `<p class="muted">${esc(c.sic || '')}</p><p class="xs muted">Türkçe özet yakında.</p>`}</section>
      <section class="card"><span class="eyebrow">Kısaca</span><div class="facts">
        ${earn ? `<div><b>Son bilanço açıklaması</b><span>${esc(earn.date)} · ${ago(earn.date)}</span></div>` : ''}
        <div><b>Yöneticiler, son 6 ay</b><span>${ins.length ? `${buy ? usd(buy) + ' alım' : 'alım yok'}, ${sell ? usd(sell) + ' satış' : 'satış yok'}` : 'İşlem yok'}</span>${ins.length ? `<span class="badge ${buy > sell ? 'b-good' : 'b-bad'}">${buy > sell ? 'Net alıcı' : 'Net satıcı'}</span>` : ''}</div>
        <div><b>Takip ettiğimiz büyük fonlar</b><span>${holders.length ? `${holders.length} fon tutuyor${adders ? `, ${adders} tanesi son çeyrekte artırdı` : ''}` : 'Hiçbiri tutmuyor'}</span></div>
        ${c.m?.fscore ? `<div><b>Finansal sağlık (F-skoru)</b><span>${c.m.fscore.score}/${c.m.fscore.n} madde olumlu</span><span class="badge ${c.m.fscore.score / c.m.fscore.n >= 0.7 ? 'b-good' : c.m.fscore.score / c.m.fscore.n <= 0.35 ? 'b-bad' : 'b-mid'}">${c.m.fscore.score / c.m.fscore.n >= 0.7 ? 'Güçlü' : c.m.fscore.score / c.m.fscore.n <= 0.35 ? 'Zayıf' : 'Orta'}</span></div>` : ''}
        ${c.m ? `<div><b>Kârlılık</b><span>ROE ${pctv(c.m.ttm.roe, 0)}, ROIC ${pctv(c.m.ttm.roic, 0)}, faaliyet marjı ${pctv(c.m.ttm.opM, 0)}</span></div>` : ''}
        <div><b>Bilanço</b><span>${usd(f.bs?.cash)} nakit, ${usd(f.bs?.debt)} uzun vadeli borç</span><span class="badge ${f.bs?.cash > f.bs?.debt ? 'b-good' : 'b-mid'}">${f.bs?.cash > f.bs?.debt ? 'Net nakit' : 'Net borç'}</span></div>
      </div></section>
    </div>`;

  let per = 'y', stmt = 'gelir';
  const M = c.m || null;
  const perBtns = (attr = 'per') => `<div class="chips"><button class="chip ${per === 'q' ? 'on' : ''}" data-${attr}="q">Çeyreklik</button><button class="chip ${per === 'y' ? 'on' : ''}" data-${attr}="y">Yıllık</button></div>`;
  const lab = (r) => (per === 'q' ? qLabel(r.end) : String(r.fy || r.end.slice(0, 4)));
  const fin = () => {
    const L = (per === 'q' ? Q : A).map(withCalc);
    const [title, rows] = STMT[stmt];
    const shown = rows.filter(([k]) => k === '_' || L.some((r) => r[k] != null));
    const chart = stmt === 'gelir' ? bars(L.slice(-10).map((r) => ({ label: lab(r), v: r.revenue, v2: r.net })), { names: ['Satış', 'Net kâr'] })
      : stmt === 'bilanco' ? bars(L.slice(-10).map((r) => ({ label: lab(r), v: r.assets, v2: r.equity })), { names: ['Toplam varlık', 'Özkaynak'] })
      : bars(L.slice(-10).map((r) => ({ label: lab(r), v: r.ocf, v2: r.fcf })), { names: ['Faaliyet nakit akışı', 'Serbest nakit akışı'] });
    return `<section class="card"><div class="head-row"><div class="chips">${map(Object.entries(STMT), ([k, [t]]) => `<button class="chip ${stmt === k ? 'on' : ''}" data-stmt="${k}">${t}</button>`)}</div>${perBtns()}</div>${chart}</section>
      ${yorumBox(Y[stmt], `${title}: ne anlatıyor?`)}
      <section class="card" style="padding:8px 12px"><div class="tbl-wrap"><table class="tbl fin"><thead><tr><th>${esc(title)}</th>${map(L, (r) => `<th class="r">${esc(lab(r))}</th>`)}</tr></thead><tbody>
      ${map(shown, ([k, l, f, b]) => (k === '_' ? `<tr class="group"><td colspan="${L.length + 1}">${l}</td></tr>` : `<tr class="${b ? 'strong' : ''}"><td>${l}</td>${map(L, (r) => `<td class="r num">${fmtS(r[k], f)}</td>`)}</tr>`))}
      </tbody></table></div></section>
      <p class="source">Kaynak: SEC EDGAR (XBRL), şirketin kendi bildirimleri.${f.currency && f.currency !== 'USD' ? ` Rakamlar ${esc(f.currency)} cinsinden.` : ''}${f.currency_orig ? ` Şirket ${esc(f.currency_orig)} ile raporluyor; rakamlar bugünkü kurla (1 ${esc(f.currency_orig)} = $${n(f.fx, 3)}) dolara çevrildi, geçmiş yıllar da aynı kurla.` : ''} Bazı şirketler bazı kalemleri ayrı bildirmez; o satırlar boş kalır. Çeyreklik nakit akışı ve 4. çeyrek, yılbaşından bu yana toplamlardan çıkarılarak hesaplanır.</p>`;
  };

  const oran = () => {
    if (!M) return '<section class="card"><p class="muted">Oranlar bir sonraki veri güncellemesinde gelecek.</p></section>';
    const L = per === 'q' ? M.quarterly : M.annual;
    const rows = RATIOS.filter(([k]) => k === '_' || ((per === 'y' || QR.has(k)) && (L.some((r) => r[k] != null) || M.ttm[k] != null)));
    return `<section class="card"><div class="head-row"><span class="eyebrow">Değerleme, bugün</span></div>
      <div class="grid" style="--min:140px">${kpi(`F/K ${q('fk')}`, v.pe > 0 ? n(v.pe, 1) : '—')}${kpi(`PD/DD ${tip('Piyasa değeri / özkaynak. Şirketin defter değerinin kaç katına fiyatlandığı.')}`, n(M.val.pb, 1))}${kpi(`FD/FAVÖK ${tip('Firma değeri (piyasa değeri + net borç) / son 12 ay FAVÖK. Borçlu ve borçsuz şirketleri aynı terazide tartar.')}`, n(M.val.evEbitda, 1))}${kpi(`FD/Satış`, n(M.val.evSales, 1))}${kpi(`Serbest nakit verimi ${q('fcfy')}`, pctv(M.val.fcfYield, 1))}${kpi('Temettü verimi', pctv(M.val.divYield, 2))}${kpi(`Geri alım verimi ${tip('Son 12 ayda geri alınan hisse tutarı / piyasa değeri.')}`, pctv(M.val.buybackYield, 1))}</div>
      ${Y.degerleme.length ? `<ul class="yorum-ul">${map(Y.degerleme, (x) => `<li class="${x.t}">${x.s}</li>`)}</ul>` : ''}</section>
      <div class="row3y">${yorumBox(Y.karlilik, 'Kârlılık')}${yorumBox(Y.borc, 'Borç ve likidite')}${yorumBox(Y.verimlilik, 'Verimlilik ve harcama')}</div>
      <section class="card" style="padding:8px 12px"><div class="head-row" style="padding:8px 4px 0"><span class="eyebrow">Finansal oranlar</span>${perBtns()}</div><div class="tbl-wrap"><table class="tbl fin"><thead><tr><th></th><th class="r ttm">Son 12 ay</th>${map(L, (r) => `<th class="r">${esc(lab(r))}</th>`)}</tr></thead><tbody>
      ${map(rows, ([k, l, fm, t]) => (k === '_' ? `<tr class="group"><td colspan="${L.length + 2}">${l}</td></tr>` : `<tr><td>${l} ${tip(t)}</td><td class="r num ttm">${fmtR(M.ttm[k], fm)}</td>${map(L, (r) => `<td class="r num">${fmtR(r[k], fm)}</td>`)}</tr>`))}
      </tbody></table></div></section>`;
  };

  const buyume = () => {
    if (!M) return '<section class="card"><p class="muted">Bir sonraki veri güncellemesinde gelecek.</p></section>';
    const G = M.growth, F = M.fscore;
    const gRow = (k, l) => `<tr><td>${l}</td>${map(['y1', 'y3', 'y5'], (y) => `<td class="r num ${tone(G[k]?.[y])}">${pct(G[k]?.[y], 1)}</td>`)}</tr>`;
    const sh = A.filter((r) => r.shDil != null);
    const shChg = sh.length > 1 ? (sh.at(-1).shDil / sh[0].shDil - 1) * 100 : null;
    return `${yorumBox(Y.buyume, 'Büyüme: ne anlatıyor?')}<div class="row2">
      <section class="card"><span class="eyebrow">Yıllık bileşik büyüme ${tip('Her yıl ortalama yüzde kaç büyüdüğü. Başlangıç ya da bitiş değeri negatifse hesaplanmaz.')}</span>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="r">1 yıl</th><th class="r">3 yıl</th><th class="r">5 yıl</th></tr></thead><tbody>
        ${gRow('revenue', 'Satışlar')}${gRow('opinc', 'Faaliyet kârı')}${gRow('net', 'Net kâr')}${gRow('eps', 'Hisse başı kâr')}${gRow('fcf', 'Serbest nakit akışı')}${G.dps?.y1 != null ? gRow('dps', 'Hisse başı temettü') : ''}
        </tbody></table></div></section>
      ${F ? `<section class="card"><div class="head-row"><span class="eyebrow">Finansal sağlık (F-skoru) ${tip('Piotroski F-skoru: kârlılık, borç ve verimlilikte son yılın bir öncekine göre iyileşip iyileşmediğine bakan 9 maddelik kontrol. 7 ve üstü güçlü, 3 ve altı zayıf sayılır.')}</span><span class="xs muted">${esc(String(F.year))} ile önceki yıl</span></div>
        <div class="fscore"><b class="mono">${F.score}<small>/${F.n}</small></b><span class="badge ${F.score / F.n >= 0.7 ? 'b-good' : F.score / F.n <= 0.35 ? 'b-bad' : 'b-mid'}">${F.score / F.n >= 0.7 ? 'Güçlü' : F.score / F.n <= 0.35 ? 'Zayıf' : 'Orta'}</span></div>
        <div class="checks">${map(F.items, (x) => `<div class="${x.ok == null ? 'na' : x.ok ? 'ok' : 'no'}"><i>${x.ok == null ? '–' : x.ok ? '✓' : '✕'}</i>${esc(x.label)}</div>`)}</div>
        <ul class="yorum-ul">${map(Y.fscore, (x) => `<li class="${x.t}">${x.s}</li>`)}</ul></section>` : ''}
    </div>
    <div class="row2">
      <section class="card"><div class="head-row"><span class="eyebrow">Hisse sayısı</span><span class="xs ${shChg != null ? (shChg < 0 ? 'up' : 'down') : 'muted'}">${shChg != null ? `${sh.length - 1} yılda ${pct(shChg, 0)}` : ''}</span></div>
        ${bars(sh.map((r) => ({ label: String(r.fy), v: r.shDil })), { fmt: (x) => n(x / 1e6, 0) + ' Mn' })}
        <p class="small muted">${shChg == null ? '' : shChg < -2 ? 'Şirket geri alımlarla hisse sayısını azaltıyor; her hisseye düşen kâr payı büyüyor.' : shChg > 5 ? 'Hisse sayısı artıyor: hisse bazlı ödemeler ya da yeni ihraç ortakların payını sulandırıyor.' : 'Hisse sayısı yatay.'}</p></section>
      <section class="card"><span class="eyebrow">Ortaklara dönen nakit</span>
        ${bars(A.slice(-8).map((r) => ({ label: String(r.fy), v: r.buyback, v2: r.divPaid })), { names: ['Geri alım', 'Temettü'] })}
        <p class="small muted">Son 12 ayda ${usd(f.ttm?.buyback)} geri alım, ${usd(f.ttm?.divPaid)} temettü.</p></section>
    </div>${yorumBox(Y.ortaklar, 'Ortaklar açısından')}`;
  };

  const sektor = () => {
    const P = (U?.rows || []).filter((r) => r.sector === c.sector).sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
    if (P.length < 2) return '<section class="card"><p class="muted">Bu sektörde kıyaslanacak başka şirket yok.</p></section>';
    const COLS = [['mcap', 'Piyasa değeri', usd, 1], ['pe', 'F/K', (x) => (x > 0 ? n(x, 1) : '—'), -1], ['evEbitda', 'FD/FAVÖK', (x) => (x > 0 ? n(x, 1) : '—'), -1], ['revGrowth', 'Büyüme', (x) => pct(x, 0), 1], ['g3', '3 yıllık büyüme', (x) => pct(x, 0), 1], ['opMargin', 'Faaliyet marjı', (x) => pctv(x, 0), 1], ['roic', 'ROIC', (x) => pctv(x, 0), 1], ['debtEq', 'Borç/özkaynak', (x) => n(x, 2), -1], ['fscore', 'F-skoru', (x) => (x == null ? '—' : String(x)), 1]];
    const rank = (k, better) => { const vals = P.filter((r) => r[k] != null && (k !== 'pe' && k !== 'evEbitda' || r[k] > 0)).sort((a, b) => (b[k] - a[k]) * better); const i = vals.findIndex((r) => r.t === T); return i < 0 ? null : [i + 1, vals.length]; };
    const med = (k) => { const v = P.map((r) => r[k]).filter((x) => x != null && (k !== 'pe' && k !== 'evEbitda' || x > 0)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    return `${yorumBox(Y.sektor, 'Sektöre göre konumu')}<section class="card"><div class="head-row"><span class="eyebrow">${esc(c.sector)} · ${P.length} şirket</span><span class="xs muted">Sıra: sektör içinde kaçıncı (daha iyi olan önde)</span></div>
      <div class="grid" style="--min:150px">${map(COLS.slice(1), ([k, l, f, b]) => { const r = rank(k, b); return `<div class="kpi"><span class="l">${l}</span><span class="v">${f(P.find((x) => x.t === T)?.[k])}</span><span class="s muted">sektör ortancası ${f(med(k))}${r ? ` · ${r[0]}/${r[1]}` : ''}</span></div>`; })}</div></section>
      <section class="card" style="padding:8px 12px"><div class="tbl-wrap"><table class="tbl us"><thead><tr><th>Şirket</th>${map(COLS, ([, l]) => `<th class="r">${l}</th>`)}</tr></thead><tbody>
      ${map(P, (r) => `<tr data-href="sirket.html?t=${r.t}" class="${r.t === T ? 'me' : ''}"><td><a href="sirket.html?t=${r.t}" class="co"><b>${esc(r.t)}</b><small>${esc(r.name)}</small></a></td>${map(COLS, ([k, , fm]) => `<td class="r num">${fm(r[k])}</td>`)}</tr>`)}
      </tbody></table></div></section>`;
  };

  const acik = () => `${news.length ? `<section class="card"><span class="eyebrow">Haberler</span>${map(news, (x) => `<div class="filing"><span class="w">${esc(x.date)}</span><div><b>${esc(x.title)}</b>${x.why ? `<small>${esc(x.why)}</small>` : ''}</div></div>`)}</section>` : ''}
    <section class="card"><div class="head-row"><span class="eyebrow">SEC açıklamaları</span><span class="xs muted">8-K ${q('k8')}</span></div>
    ${map(c.filings || [], (x) => `<a class="filing" href="${esc(x.url)}" target="_blank" rel="noopener"><span class="badge ${x.form === '8-K' ? 'b-mid' : 'b-flat'}">${esc(x.form)}</span><div><b>${esc(x.label)}</b>${notes[x.acc] ? `<small>${esc(notes[x.acc])}</small>` : ''}</div><span class="w">${esc(x.date)}</span></a>`) || '<p class="muted">Açıklama yok.</p>'}</section>`;

  const yat = () => (holders.length ? `<section class="card"><div class="head-row"><span class="eyebrow">Takip ettiğimiz büyük fonlar ${q('f13')}</span><span class="xs muted">${esc(holders[0].period || '')} çeyrek sonu</span></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fon</th><th class="r">Pozisyon</th><th class="r">Portföydeki payı</th><th class="r">Adet değişimi</th><th>Son çeyrek</th></tr></thead><tbody>
    ${map(holders, (h) => `<tr><td><b>${esc(h.person)}</b><br><small class="muted">${esc(h.fund)}</small></td><td class="r num">${usd(h.value)}</td><td class="r num">${pctv(h.w, 1)}</td><td class="r num">${h.prevShares && h.chg !== 'new' ? `<span class="${tone(h.shares - h.prevShares)}">${pct((h.shares / h.prevShares - 1) * 100, 0)}</span>` : '—'}</td><td>${chgBadge(h.chg)}</td></tr>`)}
    </tbody></table></div><p class="source">13F bildirimleri çeyrek sonundan 45 gün sonraya kadar gecikmeli gelir.</p></section>`
    : '<section class="card"><b>Takip ettiğimiz büyük fonlardan hiçbiri bu hisseyi tutmuyor.</b><p class="muted small">Liste: Berkshire, Bridgewater, Renaissance, Pershing Square, ARK, Coatue, Tiger Global ve diğerleri.</p></section>');

  const ic = () => `<section class="card"><div class="head-row"><span class="eyebrow">Yönetici alım satımları ${q('form4')}</span><span class="xs muted">son 6 ay</span></div>
    ${ins.length ? `<div class="grid" style="--min:150px">${kpi('Alım', usd(buy))}${kpi('Satış', usd(sell))}${kpi(`Plana bağlı satış ${q('plan')}`, sell ? pctv((ins.filter((x) => x.plan).reduce((s, x) => s + x.sell, 0) / sell) * 100, 0) : '—')}</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Kişi</th><th>Tarih</th><th class="r">Tutar</th><th class="r">Adet</th><th></th></tr></thead><tbody>
    ${map(ins, (x) => `<tr><td><b>${esc(x.owner || '')}</b><br><small class="muted">${esc(x.title || '')}</small></td><td class="num">${esc(x.date)}</td><td class="r num ${x.buy > x.sell ? 'up' : 'down'}">${x.buy > x.sell ? '+' : '−'}${usd(Math.abs(x.buy - x.sell))}</td><td class="r num">${n(x.buy > x.sell ? x.shBuy : x.shSell)}</td><td>${x.plan ? '<span class="badge b-flat">Plan</span>' : ''}</td></tr>`)}
    </tbody></table></div>` : '<p class="muted">Son 6 ayda piyasadan alım ya da satış bildirimi yok. Hisse ödülü ve opsiyon kullanımları sayılmaz.</p>'}</section>`;

  const VIEW = { ozet, fin, oran, buyume, sektor, acik, yat, ic };
  app.innerHTML = `<div class="wrap">
    <a class="small" href="hisseler.html">← Tüm hisseler</a>
    <section class="card lead">
      <div class="co-head">
        <div><div class="co-tk">${esc(T)} ${star(T)}</div><h1 class="page-h">${esc(c.name)}</h1><span class="muted small">${esc(c.sector || c.sic || '')}</span></div>
        <div class="co-px"><b class="mono">${p.price != null ? '$' + n(p.price, 2) : '—'}</b> <span class="mono ${tone(p.chg)}">${pct(p.chg, 2)}</span><small>son kapanış · ${esc(c.updated || '')}</small></div>
      </div>
      <div class="grid" style="--min:140px">
        ${kpi('Piyasa değeri', usd(v.mcap))}
        ${kpi(`F/K ${q('fk')}`, v.pe > 0 ? n(v.pe, 1) : '—', v.pe > 0 ? '' : 'zarar ya da veri yok', 'flat')}
        ${kpi(`Gelir, son 12 ay ${q('ttm')}`, usd(t.revenue), `${pct(t.revGrowth, 0)} yıllık`, tone(t.revGrowth))}
        ${kpi(`Net marj ${q('marj')}`, pctv(nm, 0))}
        ${kpi(`Serbest nakit verimi ${q('fcfy')}`, pctv(v.fcfYield, 1), `${usd(fcf)} / yıl`, 'flat')}
      </div>
    </section>
    <nav class="tabs" role="tablist">${map(TABS, ([k, l]) => `<button role="tab" data-tab="${k}">${l}</button>`)}</nav>
    <div id="body" class="us-body"></div>
    <p class="source">Kaynak: SEC EDGAR. Yatırım tavsiyesi değildir.</p>
  </div>`;
  const body = document.getElementById('body');
  let cur = 'ozet';
  const show = (k) => {
    cur = k;
    history.replaceState(null, '', '#' + k);
    app.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
    body.innerHTML = VIEW[k]();
    if (k === 'ozet') tvMini(document.getElementById('tv'), `NASDAQ:${T.replace('.', '')}`, { range: '12M', height: 220 });
  };
  app.addEventListener('click', (e) => {
    const s = e.target.closest('[data-star]'); if (s) { s.classList.toggle('on', toggleWatch(s.dataset.star)); return; }
    const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab);
    const pr = e.target.closest('[data-per]'); if (pr) { per = pr.dataset.per; show(cur); }
    const sm = e.target.closest('[data-stmt]'); if (sm) { stmt = sm.dataset.stmt; show('fin'); }
    const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a')) location.href = tr.dataset.href;
  });
  const h = location.hash.slice(1);
  show(h in VIEW ? h : 'ozet');
}
main().catch(fail);
