import { shell, loadDay, fail, esc, map, paras } from '../app.js';
import { macroChart } from '../charts.js';

const BADGE = { good: 'b-good', bad: 'b-bad', flat: 'b-flat' };
const TXT = { good: 't-good', bad: 't-bad', flat: 't-flat' };
const IMPACT = { high: ['b-bad', 'Yüksek'], mid: ['b-mid', 'Orta'], low: ['b-flat', 'Düşük'] };

const DIR = { up: ['▲', 'up', 'Yukarı'], down: ['▼', 'down', 'Aşağı'], flat: ['◆', 'flat', 'Karışık'] };
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
      <div class="effects">${map(A.effects, (e) => { const [ic, cls, lb] = DIR[e.dir] || DIR.flat; return `<div class="effect"><b>${esc(e.asset)}</b><span class="${cls}" title="${lb}">${ic} ${lb}</span><small>${esc(e.why)}</small></div>`; })}</div></div>` : ''}
  </div>`;
}

async function main() {
  const ctx = await loadDay();
  const M = ctx.data.makro;
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
      <div class="head-row"><span class="eyebrow">Son 7 günün sürprizleri</span><span class="small muted">Gerçekleşen, beklentiye göre</span></div>
      <div class="grid" style="--min:250px">${map(M.surprises, (s) => `<div class="kpi" style="gap:6px">
        <div class="head-row" style="flex-wrap:nowrap"><b style="font-weight:500">${esc(s.name)}</b><span class="badge ${BADGE[s.tone] || 'b-flat'}">${esc(s.verdict)}</span></div>
        <div class="mono small" style="display:flex;gap:14px;flex-wrap:wrap"><span>Gerç. <strong>${esc(s.actual)}</strong></span><span class="muted">Bekl. ${esc(s.cons)}</span><span class="muted">Önc. ${esc(s.prev)}</span></div>
        <span class="xs muted">${esc(s.meta)}</span></div>`)}</div>
      ${analysisBlock(M)}
    </section>

    <section class="card">
      <div class="head-row"><span class="eyebrow">Ülke verileri</span>
        <div class="chips" role="tablist" aria-label="Ülke seçimi">${names.map((n) => `<button type="button" role="tab" class="chip" data-c="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      </div>
      <div id="country"></div>
    </section>

    <section class="card">
      <span class="eyebrow">Önümüzdeki 2 hafta</span>
      <div class="tbl-wrap"><table class="tbl" style="min-width:620px">
        <thead><tr><th>Tarih (TSİ)</th><th>Ülke</th><th>Veri</th><th>Önem</th><th class="r">Beklenti</th><th class="r">Önceki</th></tr></thead>
        <tbody>${map(M.upcoming, (u) => { const [cls, lbl] = IMPACT[u.impact] || IMPACT.low; return `<tr>
          <td class="num small" style="white-space:nowrap">${esc(u.when)}</td><td>${esc(u.country)}</td><td style="font-weight:500">${esc(u.name)}</td>
          <td><span class="badge ${cls}">${lbl}</span></td><td class="r num">${esc(u.cons)}</td><td class="r num muted">${esc(u.prev)}</td></tr>`; })}</tbody>
      </table></div>
    </section>
    <p class="source">Kaynak: Bigdata.com ekonomik takvimi (FXStreet), TCMB/TÜİK (Borsa MCP).</p>
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
