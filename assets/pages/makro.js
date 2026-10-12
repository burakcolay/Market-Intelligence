import { shell, loadDay, loadJSON, fail, esc, map, paras } from '../app.js';
import { macroChart } from '../charts.js';

const BADGE = { good: 'b-good', bad: 'b-bad', flat: 'b-flat' };
const TXT = { good: 't-good', bad: 't-bad', flat: 't-flat' };
const IMPACT = { high: ['b-bad', 'Yüksek'], mid: ['b-mid', 'Orta'], low: ['b-flat', 'Düşük'] };
const DIR = { up: ['▲', 'up', 'Yukarı'], down: ['▼', 'down', 'Aşağı'], flat: ['◆', 'flat', 'Dengede'] };
const low = (s) => String(s || '').toLocaleLowerCase('tr');

// Sürpriz kartları önem sırasına: piyasayı en çok oynatan veriler başta.
const PRIORITY = [['tarım dışı', 1], ['çekirdek tüfe', 2], ['çekirdek pce', 2], ['tüfe', 3], ['hicp', 3], ['pce', 3], ['faiz kararı', 3], ['üfe', 4],
  ['perakende', 5], ['gsyh', 5], ['ism', 6], ['pmi', 6], ['işsizlik', 7], ['başvuru', 7], ['sanayi', 8], ['sipariş', 8], ['güven', 9]];
const COUNTRY_W = { ABD: 0, 'Euro Bölgesi': 1, Almanya: 1, Türkiye: 2 };
function rank(s, i) {
  const n = low(s.name);
  const p = (PRIORITY.find(([k]) => n.includes(k)) || [0, 10])[1];
  const c = COUNTRY_W[(s.meta || '').split('·')[0].trim()] ?? 3;
  return p * 100 + c * 10 + i / 100;
}

function surpriseCards(list) {
  const sorted = (list || []).map((s, i) => [rank(s, i), s]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  return `<div class="grid surp-grid">${map(sorted, (s) => `<div class="surp">
    <div class="surp-h"><b>${esc(s.name)}</b><span class="badge ${BADGE[s.tone] || 'b-flat'}">${esc(s.verdict)}</span></div>
    <div class="surp-n mono"><div><span>Gerçekleşen</span><strong>${esc(s.actual)}</strong></div><div><span>Beklenti</span>${esc(s.cons)}</div><div><span>Önceki</span>${esc(s.prev)}</div></div>
    ${s.note ? `<p class="surp-note">${esc(s.note)}</p>` : ''}
    <span class="xs muted">${esc(s.meta)}</span></div>`)}</div>`;
}

function analysisBlock(M) {
  const A = M.analysis;
  if (!A) return M.surprises_note ? `<p class="note"><strong>Veriler ne söylüyor:</strong> ${esc(M.surprises_note)}</p>` : '';
  const chain = A.chain?.length ? `<div class="cause">${A.chain.map((x, i) => `${i ? '<span class="arr">→</span>' : ''}<span class="step">${esc(x)}</span>`).join('')}</div>` : '';
  return `<div class="analysis">
    <span class="eyebrow accent">Veriler ne söylüyor</span>
    <h2>${esc(A.headline)}</h2>
    ${chain}
    ${paras(A.paragraphs)}
    ${A.effects?.length ? `<div><span class="eyebrow">Piyasalara olası etkisi</span>
      <div class="effects">${map(A.effects, (e) => { const [ic, cls, lb] = DIR[e.dir] || DIR.flat; return `<div class="effect"><b>${esc(e.asset)}</b><span class="${cls}" title="${lb}">${ic} ${lb}</span><small>${esc(e.why)}</small>${e.hinge ? `<small class="hinge"><b>Neye bağlı:</b> ${esc(e.hinge)}</small>` : ''}</div>`; })}</div></div>` : ''}
  </div>`;
}

// Büyüme × enflasyon dört bölge. Varlık notları genel tarihsel eğilimdir, tavsiye değildir.
const QUAD = [
  { g: 'up', i: 'down', name: 'İdeal ortam', sub: 'büyüme hızlanıyor, enflasyon düşüyor', assets: 'Tarihsel olarak hisseler, özellikle teknoloji en iyi bu bölgede gider; tahviller de destek görür.' },
  { g: 'up', i: 'up', name: 'Aşırı ısınma', sub: 'büyüme hızlanıyor, enflasyon artıyor', assets: 'Emtia, enerji, bankalar ve döngüsel hisseler öne çıkar; faizler yükselir, uzun vadeli tahviller zayıflar.' },
  { g: 'down', i: 'down', name: 'Yavaşlama', sub: 'büyüme yavaşlıyor, enflasyon düşüyor', assets: 'Merkez bankası indirim alanı bulur; tahviller ve savunmacı sektörler (sağlık, kamu hizmeti) öne çıkar.' },
  { g: 'down', i: 'up', name: 'Stagflasyon', sub: 'büyüme yavaşlıyor, enflasyon artıyor', assets: 'En zor bölge: hisse ve tahvil birlikte zorlanır; altın, emtia ve nakit görece korunaklı kalır.' },
];
function regimeBlock(R) {
  if (!R?.items?.length) return '';
  const cell = (q) => {
    const here = R.items.filter((x) => x.growth === q.g && x.inflation === q.i);
    return `<div class="quad ${here.length ? 'on' : ''} q-${q.g}${q.i}">
      <b>${esc(q.name)}</b><span class="xs muted">${esc(q.sub)}</span>
      <div class="quad-c">${here.map((x) => `<span class="chip on">${esc(x.country)}</span>`).join('')}</div>
      <small>${esc(q.assets)}</small></div>`;
  };
  return `<section class="card">
    <div class="head-row"><span class="eyebrow">Makro rejim haritası</span><span class="small muted">Her ülke büyüme ve enflasyonun yönüne göre dört bölgeden birinde</span></div>
    <div class="reg-x"><span>Enflasyon düşüyor</span><span>Enflasyon artıyor</span></div>
    <div class="reg-grid">${QUAD.map(cell).join('')}</div>
    <div class="reg-notes">${map(R.items, (x) => `<p><b>${esc(x.country)}:</b> ${esc(x.note)}</p>`)}</div>
    <span class="xs muted">${esc(R.note || '')} Varlık notları genel tarihsel eğilimdir, al/sat tavsiyesi değildir.</span>
  </section>`;
}

// Ekonomik sürpriz endeksi (analytics/mi/surprise.py üretir)
const CAT = { activity: ['Büyüme verileri', '#1F4FD1'], inflation: ['Enflasyon verileri', '#C2410C'] };
function spark(S, country) {
  const W = 300, H = 120, X0 = 30, X1 = 296, YT = 10, YB = 104;
  const n = S.dates.length;
  const x = (i) => X0 + (n < 2 ? 0 : (i * (X1 - X0)) / (n - 1));
  const y = (v) => YT + ((1 - v) / 2) * (YB - YT);
  const lines = Object.entries(CAT).map(([k, [, col]]) => {
    const pts = S.series[country][k].map((p, i) => (p.v == null ? null : `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)).filter(Boolean);
    const last = [...S.series[country][k]].reverse().find((p) => p.v != null);
    const li = S.series[country][k].lastIndexOf(last);
    return pts.length ? `<polyline fill="none" stroke="${col}" stroke-width="2.2" points="${pts.join(' ')}"/><circle cx="${x(li).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="3.5" fill="${col}"/>` : '';
  }).join('');
  const d = (s) => { const [, m, g] = s.split('-'); return `${+g}.${+m}`; };
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(country)} sürpriz endeksi">
    <line x1="${X0}" y1="${y(0)}" x2="${X1}" y2="${y(0)}" stroke="#C9CCD4"/>
    <text x="${X0 - 4}" y="${y(1) + 4}" text-anchor="end" style="font-size:10px">+1</text>
    <text x="${X0 - 4}" y="${y(0) + 3}" text-anchor="end" style="font-size:10px">0</text>
    <text x="${X0 - 4}" y="${y(-1)}" text-anchor="end" style="font-size:10px">−1</text>
    ${lines}
    <text x="${X0}" y="${H - 2}" style="font-size:10px">${d(S.dates[0])}</text><text x="${X1}" y="${H - 2}" text-anchor="end" style="font-size:10px">${d(S.dates[n - 1])}</text>
  </svg>`;
}
function readSurprise(p, k) {
  if (!p || p.v == null) return `<span class="muted">veri yok</span>`;
  const v = p.v.toFixed(2).replace('.', ',').replace('-', '−');
  const word = k === 'activity'
    ? (p.v >= 0.3 ? 'beklentiden güçlü' : p.v <= -0.3 ? 'beklentiden zayıf' : 'beklentiye yakın')
    : (p.v >= 0.3 ? 'beklentiden sıcak' : p.v <= -0.3 ? 'beklentiden soğuk' : 'beklentiye yakın');
  return `<span class="mono">${p.v > 0 ? '+' : ''}${v}</span> · ${word} <span class="muted">(${p.n} veri)</span>`;
}
function surpriseIndex(S) {
  if (!S?.dates?.length) return '';
  const countries = Object.keys(S.series).filter((c) => ['Tümü', 'ABD', 'Euro Bölgesi', 'Türkiye'].includes(c));
  const ev = [...(S.events || [])].reverse().slice(0, 10);
  return `<section class="card">
    <div class="head-row"><span class="eyebrow">Ekonomik sürpriz endeksi</span>
      <span class="small muted"><span style="color:${CAT.activity[1]}">━ ${CAT.activity[0]}</span> &nbsp; <span style="color:${CAT.inflation[1]}">━ ${CAT.inflation[0]}</span></span></div>
    <p class="small" style="color:var(--ink-2);max-width:820px">Son ${S.window_days} günde açıklanan verilerin kaçı beklentiyi aştı, kaçı altında kaldı. +1: hepsi beklentiden güçlü (büyüme) ya da sıcak (enflasyon); −1: hepsi zayıf ya da soğuk. Büyüme verileri zayıf, enflasyon sıcak gelirse merkez bankası için en zor karışım budur. Endeks yalnızca yönü sayar, sapmanın büyüklüğünü değil.</p>
    <div class="grid" style="--min:260px;gap:12px">${countries.map((c) => `<div class="chart-card">
      <b>${esc(c)}</b>${spark(S, c)}
      <div class="small">Büyüme: ${readSurprise(S.series[c].activity.at(-1), 'activity')}</div>
      <div class="small">Enflasyon: ${readSurprise(S.series[c].inflation.at(-1), 'inflation')}</div></div>`).join('')}</div>
    <details class="surp-ev"><summary class="small">Endekse giren son veriler</summary>
      <table class="tbl"><tbody>${map(ev, (e) => `<tr><td class="num small">${esc(e.date.slice(5).split('-').reverse().join('.'))}</td><td>${esc(e.country)}</td><td>${esc(e.name)}</td>
        <td class="r num">${esc(e.actual)}</td><td class="r num muted">${esc(e.cons)}</td><td>${e.score > 0 ? '<span class="up">▲</span>' : e.score < 0 ? '<span class="down">▼</span>' : '<span class="muted">◆</span>'} <span class="xs muted">${e.cat === 'inflation' ? 'enflasyon' : 'büyüme'}</span></td></tr>`)}</tbody></table>
    </details>
    <span class="xs muted">Panelin günlük dosyalarından otomatik hesaplanır (analytics/mi/surprise.py); geçmiş biriktikçe çizgi uzar.</span>
  </section>`;
}

// Takvim: "13 Eki 09:00" → Date
const MON = { Oca: 0, Şub: 1, Mar: 2, Nis: 3, May: 4, Haz: 5, Tem: 6, Ağu: 7, Eyl: 8, Eki: 9, Kas: 10, Ara: 11 };
const MON_FULL = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DOW = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
function upcomingTable(list, today) {
  const [Y, Mo, D] = today.split('-').map(Number);
  const t0 = Date.UTC(Y, Mo - 1, D);
  const dayOf = (w) => { const m = /^(\d{1,2})\s+(\S+)/.exec(w || ''); if (!m || MON[m[2]] == null) return null; let t = Date.UTC(Y, MON[m[2]], +m[1]); if (t < t0 - 200 * 864e5) t = Date.UTC(Y + 1, MON[m[2]], +m[1]); return t; };
  // güne göre grupla; her gün kendi kutusunda
  const days = [];
  for (const u of list || []) {
    const t = dayOf(u.when);
    if (!days.length || days.at(-1).t !== t) days.push({ t, items: [] });
    days.at(-1).items.push(u);
  }
  const ev = (u, open) => {
    const [cls, lbl] = IMPACT[u.impact] || IMPACT.low;
    const time = (u.when || '').split(' ').slice(2).join(' ');
    const scen = u.scen?.length ? `<details class="up-scen" ${open ? 'open' : ''}><summary>Beklentiden saparsa ne olur</summary>
      <div class="scen-g">${u.scen.map((x, i) => `<div><span class="scen-if">${i ? '▼' : '▲'} ${esc(x.if)}</span>${esc(x.then)}</div>`).join('')}</div></details>` : '';
    return `<div class="up-ev ${u.impact === 'high' ? 'hi' : ''}">
      <div class="up-main">
        <span class="up-time mono">${esc(time || u.when)}</span>
        <div class="up-what"><b>${esc(u.name)}</b><span class="xs muted">${esc(u.country)}</span></div>
        <span class="badge ${cls}">${lbl}</span>
        <div class="up-nums mono"><span><small>Beklenti</small>${esc(u.cons)}</span><span class="muted"><small>Önceki</small>${esc(u.prev)}</span></div>
      </div>${scen}</div>`;
  };
  return `<div class="up-list">${days.map((d) => {
    const diff = d.t == null ? 99 : Math.round((d.t - t0) / 864e5), dt = new Date(d.t);
    const tag = diff === 0 ? '<span class="badge b-bad">Bugün</span>' : diff === 1 ? '<span class="badge b-mid">Yarın</span>' : '';
    const title = d.t == null ? 'Tarih belirsiz' : `${DOW[dt.getUTCDay()]}, ${dt.getUTCDate()} ${MON_FULL[dt.getUTCMonth()]}`;
    return `<div class="up-daybox ${diff <= 1 ? 'soon' : ''}"><div class="up-day">${tag}<span>${title}</span><span class="xs muted">${d.items.length} veri</span></div>
      ${d.items.map((u) => ev(u, diff <= 1)).join('')}</div>`;
  }).join('')}</div>`;
}

async function main() {
  const ctx = await loadDay();
  const M = ctx.data.makro;
  const S = await loadJSON('data/analytics/surprise.json').catch(() => null);
  const app = shell('makro', { ...ctx, updated: `Veriler ${ctx.data.updated}` });
  const names = Object.keys(M.countries);
  const fromHash = decodeURIComponent(location.hash.slice(1));
  let current = names.includes(fromHash) ? fromHash : names[0];

  const chartCard = (c) => `<div class="chart-card">
    <div class="top"><div><b>${esc(c.title)}</b><div class="xs muted">${esc(c.sub)}</div></div>
      <div><div class="last">${esc(c.last)}</div><div class="xs ${TXT[c.tone] || ''}" style="text-align:right">${esc(c.trend)}</div></div></div>
    ${macroChart(c)}
    <span class="small" style="color:var(--ink-2)">${esc(c.note)}</span>
    <div class="foot"><span>Önceki: <span class="mono">${esc(c.prev)}</span></span><span>Sonraki: <span class="mono">${esc(c.next)}</span></span></div>
  </div>`;

  const countryBody = (name) => {
    const C = M.countries[name];
    const charts = C.charts?.length ? `<div class="grid" style="--min:320px;gap:14px">${map(C.charts, chartCard)}</div>` : '';
    const rows = map(C.rows, (r) => r.group
      ? `<tr class="group"><td colspan="7">${esc(r.group)}</td></tr>`
      : `<tr><td style="font-weight:500">${esc(r.name)}</td><td class="muted">${esc(r.period)}</td>
          <td class="r num" style="font-weight:500">${esc(r.actual)}</td><td class="r num muted">${esc(r.cons)}</td><td class="r num muted">${esc(r.prev)}</td>
          <td><span class="xs ${TXT[r.tone] || ''}" style="font-weight:600">${esc(r.surprise)}</span></td><td class="num small">${esc(r.next)}</td></tr>`);
    return `${charts}
      <div class="tbl-wrap"><table class="tbl" style="min-width:720px">
        <thead><tr><th>Gösterge</th><th>Dönem</th><th class="r">Son</th><th class="r">Beklenti</th><th class="r">Önceki</th><th>Sürpriz</th><th>Sonraki açıklama</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      ${C.note ? `<span class="xs muted">${esc(C.note)}</span>` : ''}`;
  };

  app.innerHTML = `<main class="wrap">
    <section class="card">
      <div class="head-row"><span class="eyebrow">Önümüzdeki 2 hafta</span><span class="small muted">Önemli verilerde: beklentiden saparsa ne olur</span></div>
      ${upcomingTable(M.upcoming, ctx.data.date)}
    </section>

    <section class="card">
      <div class="head-row"><span class="eyebrow">Son 7 günün sürprizleri</span><span class="small muted">Önem sırasına göre · gerçekleşen, beklentiye göre</span></div>
      ${surpriseCards(M.surprises)}
      ${analysisBlock(M)}
    </section>

    ${regimeBlock(M.regime)}
    ${surpriseIndex(S)}

    <section class="card">
      <div class="head-row"><span class="eyebrow">Ülke verileri</span>
        <div class="chips" role="tablist" aria-label="Ülke seçimi">${names.map((n) => `<button type="button" role="tab" class="chip" data-c="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      </div>
      <div id="country"></div>
    </section>
    <p class="source">Kaynak: Bigdata.com ekonomik takvimi (FXStreet), TCMB/TÜİK (Borsa MCP). Sürpriz endeksi panelin kendi verisinden hesaplanır.</p>
  </main>`;

  const box = document.getElementById('country');
  const render = () => {
    app.querySelectorAll('.chip[data-c]').forEach((c) => c.classList.toggle('on', c.dataset.c === current));
    box.style.display = 'flex'; box.style.flexDirection = 'column'; box.style.gap = '14px';
    box.innerHTML = countryBody(current);
  };
  app.addEventListener('click', (e) => {
    const c = e.target.closest('.chip[data-c]');
    if (!c) return;
    current = c.dataset.c;
    history.replaceState(null, '', '#' + encodeURIComponent(current));
    render();
  });
  render();
}

main().catch(fail);
