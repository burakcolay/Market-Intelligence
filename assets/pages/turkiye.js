import { shell, loadDay, fail, esc, map, kpi, paras, lessonBox, num, startLive } from '../app.js';
import { lineChart, hbars, bondCurve } from '../charts.js';
import { impactSection } from '../impact.js';

async function main() {
  const ctx = await loadDay();
  const T = ctx.data.turkiye;
  const app = shell('turkiye', { ...ctx, updated: 'BIST ~15 dk gecikmeli' });

  const cpiPoints = T.cpi.labels.map((d, i) => ({ d, v: T.cpi.values[i] }));
  const tone = (t) => (t === 'good' ? 't-good' : t === 'bad' ? 't-bad' : 't-flat');

  app.innerHTML = `<main class="wrap">
    <div class="live-stamp inline" data-live-stamp hidden></div>
    <div class="grid" style="--min:140px">${map(T.kpis, (k) => kpi(k))}</div>

    <section class="card lead">
      <span class="eyebrow accent">Claude'un Türkiye okuması</span>
      <h1 style="font-size:26px">${esc(T.reading.headline)}</h1>
      ${paras(T.reading.paragraphs)}
    </section>
    ${impactSection((ctx.data.impact || []).filter((e) => e.market === 'Türkiye'), { title: 'Türkiye: olay ve sektör etkisi' })}

    <div class="row">
      <section class="card" style="flex:3 1 560px">
        <div class="head-row"><span class="eyebrow">${esc(T.bist.title)}</span><span class="mono small ${T.bist.tone === 'down' ? 'down' : T.bist.tone === 'up' ? 'up' : 'flat'}">${esc(T.bist.change_label)}</span></div>
        ${lineChart(T.bist.points, { highlight: T.bist.highlight, aria: 'BIST100 haftalık kapanışlar', fmt: (v) => num(v, 0) })}
      </section>
      <section class="card" style="flex:2 1 340px;gap:10px">
        <span class="eyebrow">Sektör endeksleri · bugün</span>
        ${hbars(T.sectors)}
        <p class="small" style="color:var(--ink-2)">${esc(T.sectors_note)}</p>
      </section>
    </div>

    <div class="row">
      <section class="card" style="flex:1 1 380px;gap:10px">
        <div class="head-row"><span class="eyebrow">Enflasyon · TÜFE yıllık</span><span class="mono" style="font-size:20px;font-weight:500">${esc(T.cpi.last)}</span></div>
        ${lineChart(cpiPoints, { w: 560, h: 220, padL: 44, fmt: (v) => '%' + num(v, 0), aria: 'TÜFE yıllık, son 13 ay' })}
        <p class="small" style="color:var(--ink-2)">${esc(T.cpi.note)}</p>
      </section>
      <section class="card" style="flex:1 1 380px;gap:10px">
        <span class="eyebrow">Faiz cephesi</span>
        ${bondCurve(T.rates.bonds, T.rates.policy)}
        <div class="grid" style="--min:150px;gap:8px">${map(T.rates.cards, (c) => kpi(c, 'soft'))}</div>
        <p class="small" style="color:var(--ink-2)">${esc(T.rates.note)}</p>
      </section>
    </div>

    <div class="row">
      <section class="card" style="flex:3 1 560px">
        <span class="eyebrow">Türkiye makro tablosu</span>
        <div class="tbl-wrap"><table class="tbl" style="min-width:640px">
          <thead><tr><th>Gösterge</th><th>Dönem</th><th class="r">Son</th><th class="r">Beklenti</th><th class="r">Önceki</th><th>Yorum</th></tr></thead>
          <tbody>${map(T.macro, (m) => `<tr><td style="font-weight:500">${esc(m.name)}</td><td class="muted">${esc(m.period)}</td>
            <td class="r num" style="font-weight:500">${esc(m.actual)}</td><td class="r num muted">${esc(m.cons)}</td><td class="r num muted">${esc(m.prev)}</td>
            <td class="small ${tone(m.tone)}">${esc(m.note)}</td></tr>`)}</tbody>
        </table></div>
      </section>
      <section class="card" style="flex:1 1 280px;gap:6px">
        <span class="eyebrow">Yaklaşan Türkiye verileri</span>
        ${map(T.upcoming, (u) => `<div class="list-row"><span class="k" style="width:96px;font-size:13px">${esc(u.when)}</span><b>${esc(u.name)}</b></div>`)}
      </section>
    </div>

    ${lessonBox(T.lesson, 'Türkiye dersi')}
    <p class="source">Kaynak: ${esc(T.source)} Yatırım tavsiyesi değildir.</p>
  </main>`;
  if (!ctx.isOld) startLive();
}

main().catch(fail);
