import { shell, loadDay, loadJSON, heatBg, fail, esc, map, kpi, paras, lessonBox, num, signed, tvMini, startLive } from '../app.js';
import { gauge, fngLabel, levelMap, flowBars } from '../charts.js';
import { impactSection } from '../impact.js';

const coinBg = (v) => v >= 20 ? '#7FCB9F' : v >= 5 ? '#B8E3C9' : v > 0.05 ? '#E6F5EC' : v <= -40 ? '#DB7A6C' : v <= -15 ? '#ECA89D' : v <= -3 ? '#F4CBC4' : v < -0.05 ? '#F8E1DD' : '#F0F0EC';
const PER = { d1: '24 saat', w1: '7 gün', m1: '30 gün' };
const SCALE = { d1: 1.5, w1: 4, m1: 8 };
// Kripto sektör karoları (data/crypto/sectors.json, GitHub Actions + CoinGecko)
function sectorTiles(S, per) {
  const val = (x) => (x.odd && per === 'd1' ? null : x[per]);
  const rows = [...S.items].sort((a, b) => (val(b) ?? -1e9) - (val(a) ?? -1e9));
  const fmtB = (v) => (v >= 1e12 ? `${num(v / 1e12, 2)} trilyon $` : `${num(v / 1e9, 0)} milyar $`);
  return rows.map((x) => `<div class="sec-tile" style="cursor:default;background:${heatBg(val(x), SCALE[per])}" title="${esc(x.desc)}${x.odd ? ' · Kategoriye büyük bir token eklendi/çıktı; değişim fiyat hareketi değil.' : ''}">
    <span class="sn">${esc(x.name)}</span>
    <span class="sc mono">${x[per] == null ? '—' : esc(signed(x[per], 1, '%'))}${x.odd && per === 'd1' ? ' <span class="xs muted" style="font-family:var(--sans)">⚠ veri sapması</span>' : ''}</span>
    <span class="sm">${esc(x.top3.join(' · '))}</span>
    <span class="sm muted">${esc(fmtB(x.mcap))}${x.share != null ? ` · pay %${esc(num(x.share, 1))}` : ''}</span>
  </div>`).join('');
}
function sectorSection(S, note) {
  if (!S?.items?.length) return '';
  const hasW = S.items.some((x) => x.w1 != null), hasM = S.items.some((x) => x.m1 != null);
  return `<section class="card" id="ksec">
    <div class="head-row"><span class="eyebrow">Kripto sektörleri · para nereye akıyor</span>
      <div class="chips">${Object.entries(PER).map(([k, l]) => `<button type="button" class="chip${k === 'd1' ? ' on' : ''}" data-per="${k}" ${(k === 'w1' && !hasW) || (k === 'm1' && !hasM) ? 'disabled title="Geçmiş birikiyor"' : ''}>${l}</button>`).join('')}</div></div>
    <div class="sec-tiles" id="ksec-tiles">${sectorTiles(S, 'd1')}</div>
    ${note ? `<p class="note"><strong>Rotasyon okuması:</strong> ${esc(note)}</p>` : ''}
    <span class="xs muted">Sektörün toplam piyasa değerindeki değişim, en iyiden kötüye sıralı; karoda o sektörün en büyük 3 coini. Kategoriler örtüşür (bir coin birden fazla sektörde olabilir). Stabilcoin payının artması paranın riskten çekilip kenarda beklediğini gösterir. 7 ve 30 günlük değişim günlük kayıt biriktikçe dolar. Kaynak: CoinGecko kategorileri, güncelleme ${esc((S.updated || '').slice(0, 10))}.</span>
  </section>`;
}

const TAG = { bad: 'b-bad', good: 'b-good', flat: 'b-mid' };

function fngBlock(f, live) {
  const [label, color] = fngLabel(f.now);
  return `<span class="eyebrow" style="align-self:flex-start">Korku &amp; Açgözlülük endeksi${live ? ' <i class="dot"></i>' : ''}</span>
    ${gauge(f.now)}
    <span style="font-size:18px;font-weight:700;color:${color}">${esc(label)}</span>
    <div class="small muted" style="display:flex;gap:16px">
      <span>Dün <strong class="mono" style="color:var(--ink)">${esc(f.yesterday ?? '–')}</strong></span>
      <span>Geçen hafta <strong class="mono" style="color:var(--ink)">${esc(f.week ?? '–')}</strong></span>
    </div>
    <span class="xs muted" style="text-align:center">0–24 aşırı korku · 25–44 korku · 45–55 nötr · 56–75 açgözlülük · 76–100 aşırı açgözlülük</span>`;
}

function domBlock(d, live) {
  const other = Math.max(0, 100 - d.btc - d.usdt);
  return `<div class="head-row small muted"><span>TOTAL · toplam kripto piyasa değeri${live ? ' <i class="dot"></i>canlı' : ''}</span><span class="mono" style="color:var(--ink)">${esc(d.total_label)}</span></div>
    <div class="stack" role="img" aria-label="Bitcoin yüzde ${num(d.btc, 1)}, USDT yüzde ${num(d.usdt, 1)}, diğer yüzde ${num(other, 1)}.">
      <div style="width:${d.btc}%;background:#163A9C;color:#fff">BTC %${num(d.btc, 1)}</div>
      <div style="width:${d.usdt}%;background:#8A90A0;padding:0"></div>
      <div style="flex:1;background:#9DB3EE">Diğer %${num(other, 1)}</div>
    </div>
    <div class="legend xs muted">
      <span><span class="swatch" style="background:#163A9C"></span>Bitcoin (BTC.D)</span>
      <span><span class="swatch" style="background:#8A90A0"></span>Tether USDT (USDT.D %${num(d.usdt, 1)})</span>
      <span><span class="swatch" style="background:#9DB3EE"></span>Ethereum ve diğerleri</span>
      <span style="margin-left:auto">TOTAL2 = TOTAL − Bitcoin ${esc(d.total2_label)}</span>
    </div>`;
}

async function main() {
  const ctx = await loadDay();
  const K = ctx.data.kripto;
  const S = await loadJSON('data/crypto/sectors.json').catch(() => null);
  const app = shell('kripto', { ...ctx, updated: `Veriler ${ctx.data.updated}` });

  app.innerHTML = `<main class="wrap">
    <div class="live-stamp inline" data-live-stamp hidden></div>
    <div class="row" style="align-items:stretch">
      <div class="grid" style="flex:3 1 600px;--min:190px;gap:12px">${map(K.kpis, (k) => kpi(k, 'big'))}</div>
      <section class="card" id="fng" style="flex:1 1 280px;align-items:center;gap:4px">${fngBlock(K.fng)}</section>
    </div>

    <section class="card lead">
      <span class="eyebrow accent">Claude'un kripto okuması</span>
      <h1 style="font-size:26px">${esc(K.reading.headline)}</h1>
      ${paras(K.reading.paragraphs)}
      <span class="xs muted">Bu yorum ${esc(ctx.data.updated)} fiyatlarıyla yazıldı; kartlar ve grafikler canlı.</span>
    </section>
    ${impactSection((ctx.data.impact || []).filter((e) => e.market === 'Kripto'), { title: 'Kripto: olay ve etki' })}

    <section class="card">
      <span class="eyebrow">Piyasa değeri ve dominans</span>
      <div id="dom" style="display:flex;flex-direction:column;gap:6px">${domBlock(K.dominance)}</div>
      <div class="grid" style="--min:230px;gap:12px">${map(K.dom_cards, (c) => `<div class="kpi soft" style="padding:14px"><span class="code">${esc(c.code)}</span><span class="small" style="color:var(--ink-2)">${esc(c.text)}</span></div>`)}</div>
    </section>

    ${sectorSection(S, K.sectors_note)}

    <section class="card">
      <span class="eyebrow">Canlı grafikler · TradingView</span>
      <div class="grid" style="--min:260px">
        ${['CRYPTOCAP:TOTAL', 'CRYPTOCAP:TOTAL2', 'CRYPTOCAP:BTC.D', 'CRYPTOCAP:USDT.D'].map((s, i) => `<div class="tv" id="tv-${i}" data-s="${s}"></div>`).join('')}
      </div>
    </section>

    <div class="row">
      <section class="card" style="flex:3 1 540px">
        <span class="eyebrow">Bitcoin seviye haritası</span>
        <div class="tbl-wrap"><div style="min-width:560px" id="levels">${levelMap(K.levels)}</div></div>
        <p class="small" style="color:var(--ink-2)"><strong>Nasıl okunur:</strong> ${esc(K.levels.note)}</p>
      </section>
      <section class="card" style="flex:2 1 340px">
        <span class="eyebrow">Spot Bitcoin ETF akışları</span>
        ${flowBars(K.etf)}
        <p class="small" style="color:var(--ink-2)">${esc(K.etf_note)}</p>
      </section>
    </div>

    <section class="card">
      <div class="head-row"><span class="eyebrow">Büyük coinler · performans</span><span class="small muted">Fiyat ve 1 gün canlı (24 saat), diğerleri sabah verisi</span></div>
      <div class="tbl-wrap"><table class="heatmap" style="min-width:680px">
        <thead><tr><th style="text-align:left">Coin</th><th style="text-align:right">Fiyat ($)</th><th>1 gün</th><th>1 hafta</th><th>1 ay</th><th>3 ay</th><th>Yılbaşından</th><th>1 yıl</th></tr></thead>
        <tbody>${map(K.coins, (c) => `<tr data-sym="${esc(c.sym.toLowerCase())}"><td><span class="mono" style="font-weight:600">${esc(c.sym)}</span> <span class="muted small">${esc(c.name)}</span></td>
          <td class="mono small price" style="text-align:right">${esc(c.price)}</td>
          ${['d1', 'w1', 'm1', 'm3', 'ytd', 'y1'].map((k) => `<td class="c ${k}" style="background:${coinBg(c[k])}">${esc(signed(c[k], 1, ''))}</td>`).join('')}</tr>`)}</tbody>
      </table></div>
      <p class="note"><strong>Tablo ne söylüyor:</strong> ${esc(K.coins_note)}</p>
    </section>

    <div class="row">
      <section class="card" style="flex:1 1 360px;gap:6px">
        <span class="eyebrow">Kurumsal tarafta</span>
        ${map(K.institutional, (i) => `<div class="list-row"><span class="k">${esc(i.v)}</span><div><b>${esc(i.title)}</b><small>${esc(i.note)}</small></div></div>`)}
      </section>
      <section class="card" style="flex:1 1 360px;gap:6px">
        <span class="eyebrow">Kripto şu an neye tepki veriyor</span>
        ${map(K.drivers, (d) => `<div class="list-row"><span class="badge ${TAG[d.tone] || 'b-flat'}">${esc(d.tag)}</span><div><b>${esc(d.title)}</b><small>${esc(d.note)}</small></div></div>`)}
      </section>
    </div>

    ${lessonBox(K.lesson, 'Kripto dersi')}
    <p class="source">Kaynak: Bigdata.com (sabah verisi ve haberler); canlı fiyatlar CoinGecko, Korku &amp; Açgözlülük alternative.me. CoinGecko'nun TOTAL'i daha fazla coin içerdiği için TradingView'deki TOTAL'den biraz farklı olabilir. Yatırım tavsiyesi değildir.</p>
  </main>`;

  document.getElementById('ksec')?.addEventListener('click', (e) => {
    const b = e.target.closest('.chip[data-per]');
    if (!b || b.disabled) return;
    document.querySelectorAll('#ksec .chip').forEach((c) => c.classList.toggle('on', c === b));
    document.getElementById('ksec-tiles').innerHTML = sectorTiles(S, b.dataset.per);
  });
  document.querySelectorAll('.tv[data-s]').forEach((el) => tvMini(el, el.dataset.s, { range: '3M', height: 200 }));
  if (ctx.isOld) return;

  startLive((L) => {
    if (L.fng?.now >= 0) document.getElementById('fng').innerHTML = fngBlock(L.fng, true);
    if (L.global) {
      const g = L.global;
      document.getElementById('dom').innerHTML = domBlock({
        btc: g.btcd, usdt: g.usdtd ?? K.dominance.usdt,
        total_label: num(g.total / 1e12, 2) + ' trilyon $',
        total2_label: '≈ ' + num(g.total2 / 1e12, 2) + ' trilyon $',
      }, true);
    }
    const btc = L.crypto?.btc?.price;
    if (btc) {
      const items = K.levels.items.map((it) => (it.kind === 'now' ? { ...it, price: btc, label: num(btc, 0) } : it));
      const [lo, hi] = K.levels.range;
      document.getElementById('levels').innerHTML = levelMap({ ...K.levels, range: [Math.min(lo, btc * 0.97), Math.max(hi, btc * 1.03)], items });
    }
    document.querySelectorAll('tr[data-sym]').forEach((tr) => {
      const c = L.crypto?.[tr.dataset.sym];
      if (!c) return;
      tr.querySelector('.price').textContent = num(c.price, 2);
      if (c.chg != null) { const td = tr.querySelector('.d1'); td.textContent = signed(c.chg, 1, ''); td.style.background = coinBg(c.chg); }
    });
  });
}

main().catch(fail);
