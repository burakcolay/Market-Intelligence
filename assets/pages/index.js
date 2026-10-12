import { shell, loadDay, loadJSON, fail, esc, map, kpi, paras, dateTR, toneClass, tvMini, liveKeyFor, startLive, num, signed } from '../app.js';
import { sectorHeat } from '../charts.js';

const MOODS = {
  risk_off: { name: 'Risk kaçışı', color: '#B42318', idx: 0 },
  temkinli: { name: 'Temkinli', color: '#B7791F', idx: 1 },
  risk_on: { name: 'Risk iştahı', color: '#0B7A47', idx: 2 },
};
const IMPACT = { high: '#B42318', mid: '#C98A12', low: '#8A90A0', session: '#8A90A0' };
const TOC = [['s1', 'Büyük resim'], ['s2', 'ABD'], ['nq', 'NQ için makro rüzgâr'], ['s3', 'Avrupa ve Asya'], ['s4', 'Para, faiz, emtia'], ['s5', 'Türkiye'], ['s6', 'Önümüzdeki günler'], ['s7', 'Benim okumam'], ['s8', 'Günün dersi']];
const NUM = Object.fromEntries(TOC.map(([id], i) => [id, i + 1]));
const BIAS = {
  engel: { name: 'Engelleyici', color: '#B42318', idx: 0 },
  notr: { name: 'Nötr', color: '#B7791F', idx: 1 },
  destek: { name: 'Destekleyici', color: '#0B7A47', idx: 2 },
};

// Neden-sonuç zinciri: ["Petrol düştü", "Enflasyon beklentisi azaldı", ...]
function chainRow(list) {
  if (!list?.length) return '';
  return `<div class="cause" aria-label="Neden-sonuç zinciri">${list.map((x, i) => `${i ? '<span class="arr" aria-hidden="true">→</span>' : ''}<span class="step">${esc(x)}</span>`).join('')}</div>`;
}

// [[id|metin]] -> tıklanabilir terim
function withTerms(text) {
  return esc(text).replace(/\[\[([a-z0-9_-]+)\|([^\]]+)\]\]/g, (_, id, t) => `<button type="button" class="term" data-term="${id}">${t}</button>`);
}

function secHead(n, title, extra = '') {
  return `<div class="sec-head"><span class="num">${n}</span><h2>${esc(title)}</h2>${extra}</div>`;
}

// İstanbul saatini dakika olarak verir
function istanbulMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const h = +p.find((x) => x.type === 'hour').value, m = +p.find((x) => x.type === 'minute').value;
  return h * 60 + m;
}
function istanbulDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function nqSection(N, n, D) {
  const b = BIAS[N.bias] || BIAS.notr;
  const item = (x) => `<div class="list-row"><div><b>${esc(x.title)}</b><small>${esc(x.note)}</small></div></div>`;
  return `<section class="sec" id="nq">${secHead(n, 'NQ için makro rüzgâr', '<span class="small muted">Nasdaq 100 · bugün</span>')}
    <div class="row">
      <div class="mood">
        <span class="eyebrow">Makronun yönü</span>
        <div class="state"><span class="dot" style="background:${b.color}"></span><span class="name">${esc(b.name)}</span></div>
        <div class="bar" aria-hidden="true">${[0, 1, 2].map((i) => `<span style="${i === b.idx ? 'background:' + b.color : ''}"></span>`).join('')}</div>
        <div class="scale"><span>Engelleyici</span><span>Nötr</span><span>Destekleyici</span></div>
      </div>
      <div style="flex:2 1 380px;display:flex;flex-direction:column;gap:10px">
        ${map(N.paragraphs, (p) => `<p>${withTerms(p)}</p>`)}
      </div>
    </div>
    <div class="grid" style="--min:280px;gap:16px">
      <div class="wind up-wind"><span class="eyebrow">Destekleyenler</span>${map(N.tailwinds, item)}</div>
      <div class="wind down-wind"><span class="eyebrow">Baskılayanlar</span>${map(N.headwinds, item)}</div>
    </div>
    <div class="grid" style="--min:300px;gap:16px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <span class="eyebrow">Volatilite saatleri · TSİ</span>
        ${map(N.vol_times, (e) => `<div class="event"><span class="t">${esc(e.time)}</span><span class="d" style="background:${IMPACT[e.impact] || IMPACT.low}"></span><div><b>${esc(e.title)}</b><small>${esc(e.note || '')}</small></div></div>`)}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">US100 · canlı, son 1 ay</span><div class="tv" id="tv-nq"></div></div>
    </div>
    <a class="note small" href="bilancolar.html" style="text-decoration:none"><strong>NQ devlerinin bilanço takvimi</strong> artık ABD Hisseleri bölümünde →</a>
    ${N.watch ? `<p class="note"><strong>Bugün neye bak:</strong> ${esc(N.watch)}</p>` : ''}
    <span class="xs muted">Al/sat sinyali değildir; HTF bias'ını kurarken makro arka planı hesaba katman içindir.</span>
  </section>`;
}

function viewsBox(V) {
  if (!V) return '';
  const side = (list) => map(list, (x) => `<li><span>${esc(x.text)}</span>${x.who ? `<small>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.who)}</a>` : esc(x.who)}</small>` : ''}</li>`);
  return `<div class="views">
    <div class="head-row"><span class="eyebrow">İki görüş</span><b class="small">${esc(V.topic)}</b></div>
    <div class="grid" style="--min:260px;gap:12px">
      <div class="side bull"><span class="eyebrow">Boğa: yükseliş bekleyenler</span><ul>${side(V.bull)}</ul></div>
      <div class="side bear"><span class="eyebrow">Ayı: düşüş bekleyenler</span><ul>${side(V.bear)}</ul></div>
    </div>
    ${V.split ? `<p class="note"><strong>Neden ayrışıyorlar:</strong> ${esc(V.split)}</p>` : ''}
  </div>`;
}

async function main() {
  const ctx = await loadDay();
  const { data: D, date } = ctx;
  const app = shell('index', { ...ctx, updated: `Analiz ${D.updated}` });
  const glossary = await loadJSON('data/sozluk.json').catch(() => ({ concepts: {} }));
  const US_CODES = D.impact?.length ? ((await loadJSON('data/us/universe.json').catch(() => ({ rows: [] }))).rows || []).map((r) => r.t) : [];

  const isToday = date === istanbulDate();
  const nowMin = istanbulMinutes();
  const AX0 = 9 * 60, AX1 = 23 * 60 + 30;
  const pos = (m) => Math.max(0, Math.min(100, ((m - AX0) / (AX1 - AX0)) * 100));

  const mood = MOODS[D.s1.mood] || MOODS.temkinli;
  const S = D.summary;

  const tickers = `<div class="ticker-bar"><div class="inner">${map(D.tickers, (t) => {
    const lk = liveKeyFor(t.name, t.value);
    return `<div class="tick" ${lk ? `data-live="${lk}" data-snap="${esc(t.value)}"` : ''}><span class="n">${esc(t.name)}</span><span class="v">${esc(t.value)}</span><span class="c ${toneClass(t.tone)}">${esc(t.chg)}</span></div>`;
  })}</div><div class="live-stamp" data-live-stamp hidden></div></div>`;

  const summary = `<section class="card lead summary" aria-label="Günün özeti">
    <div class="head-row"><span class="eyebrow accent">Claude'un günlük özeti</span><span class="mono xs muted">${esc(dateTR(date, false))} ${esc(D.updated)} · okuma ~${S.read_min || 5} dk</span></div>
    <h1>${esc(S.headline)}</h1>
    <p class="lede">${esc(S.lede)}</p>
    ${map(S.paragraphs, (p) => `<p class="body">${withTerms(p)}</p>`)}
    <span class="xs muted">Yazılar ${esc(D.updated)} fiyatlarıyla yazıldı; üstteki şerit ve fiyat kartları canlı.</span>
    <span class="small muted" style="padding-top:4px;border-top:1px solid var(--line-soft)">Aşağıda yazının tamamı, anlatım sırasına göre bölümlere ayrılmış halde.</span>
    <nav class="toc" aria-label="Anlatım sırası">${TOC.filter(([id]) => id !== 'nq' || D.nq).map(([id, t]) => `<a href="#${id}"><b>${NUM[id]}</b> ${esc(t)}</a>`).join('')}</nav>
  </section>`;

  // Haber etkisi: günün en çok fiyat hareketi yaratan haberleri, etkilenen gruplar ve her grup için asıl soru
  const NQ100 = new Set(US_CODES);
  const tk = (t) => (NQ100.has(t) ? `<a class="mono" href="sirket.html?t=${esc(t)}">${esc(t)}</a>` : `<span class="mono">${esc(t)}</span>`);
  const impact = (D.impact || []).length ? `<section class="sec" id="etki">
    <div class="sec-head"><span class="num" style="background:var(--ink)">!</span><h2>Haber etkisi</h2><span class="small muted">günün fiyatı en çok oynatan haberi, kimi nasıl etkiledi ve neye bakmalı</span></div>
    ${map(D.impact, (e) => `<article class="card impact">
      <h3>${esc(e.title)}</h3>
      ${e.summary ? `<p>${withTerms(e.summary)}</p>` : ''}
      <div class="impact-groups">${map(e.groups, (g) => `<div class="ig ${g.tone === 'up' ? 'up' : g.tone === 'down' ? 'down' : 'flat'}">
        <div class="ig-h"><b>${esc(g.name)}</b><span class="mono ig-move">${esc(g.move || '')}</span></div>
        <div class="ig-t">${map(g.tickers || [], (t) => tk(t)).replace(/<\/(a|span)><(a|span)/g, '</$1> · <$2')}</div>
        ${g.priced ? `<p><span class="lbl">Piyasa ne fiyatladı</span>${withTerms(g.priced)}</p>` : ''}
        ${g.question ? `<p><span class="lbl">Asıl soru</span>${withTerms(g.question)}</p>` : ''}
        ${g.counter ? `<p><span class="lbl">Ters okuma</span>${withTerms(g.counter)}</p>` : ''}
      </div>`)}</div>
      ${e.checks?.length ? `<div class="impact-checks"><span class="eyebrow">Karar vermeden önce bakılacaklar</span><ol>${map(e.checks, (c) => `<li>${esc(c)}</li>`)}</ol></div>` : ''}
      ${e.sources?.length ? `<span class="xs muted">Kaynak: ${e.sources.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(' · ')}</span>` : ''}
    </article>`)}
    <span class="xs muted">Al/sat tavsiyesi değildir; haberin hangi soruyu doğurduğunu ve neye bakılacağını gösterir.</span>
  </section>` : '';

  const s1 = `<section class="sec" id="s1">${secHead(NUM.s1, 'Büyük resim')}
    <div class="row">
      <div class="mood">
        <span class="eyebrow">Piyasa modu</span>
        <div class="state"><span class="dot" style="background:${mood.color}"></span><span class="name">${esc(mood.name)}</span><span class="small muted">${esc(D.s1.mood_note || '')}</span></div>
        <div class="bar" aria-hidden="true">${[0, 1, 2].map((i) => `<span style="${i === mood.idx ? 'background:' + mood.color : ''}"></span>`).join('')}</div>
        <div class="scale"><span>Risk kaçışı</span><span>Temkinli</span><span>Risk iştahı</span></div>
      </div>
      <div style="flex:2 1 380px;display:flex;flex-direction:column;gap:10px">
        <span class="eyebrow">Dünden bugüne</span>
        ${map(D.s1.changes, (c) => `<div class="change"><span class="tag tag-${esc(c.tone)}">${esc(c.tag)}</span><span>${esc(c.text)}</span></div>`)}
      </div>
    </div>
    <span class="eyebrow">Günün 3 ana teması</span>
    <div class="grid" style="--min:240px;gap:12px">${map(D.s1.themes, (t) => `<div class="theme"><b>${esc(t.title)}</b><span>${esc(t.text)}</span></div>`)}</div>
  </section>`;

  const s2 = `<section class="sec" id="s2">${secHead(NUM.s2, 'ABD')}
    ${chainRow(D.s2.chain)}
    ${map(D.s2.paragraphs, (p) => `<p>${withTerms(p)}</p>`)}
    <div class="term-slot"></div>
    <div class="grid" style="--min:300px;gap:16px">
      <div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">S&amp;P 500 sektörleri · 1 gün</span>${sectorHeat(D.s2.sectors)}</div>
      <div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">S&amp;P 500 · canlı, son 3 ay</span><div class="tv" id="tv-spx"></div></div>
    </div>
  </section>`;

  const simple = (id, n, title, sec, pos = 'before') => {
    const cards = `<div class="grid">${map(sec.cards, (c) => kpi(c, 'soft'))}</div>`;
    return `<section class="sec" id="${id}">${secHead(n, title)}
      ${chainRow(sec.chain)}
      ${pos === 'before' ? cards + map(sec.paragraphs, (p) => `<p>${withTerms(p)}</p>`) : map(sec.paragraphs, (p) => `<p>${withTerms(p)}</p>`) + cards}
      ${id === 's5' ? '<a class="small" href="turkiye.html">Türkiye sekmesinde detaylar: sektörler, enflasyon, faiz eğrisi →</a>' : ''}
    </section>`;
  };

  const s6d = D.s6;
  const bist = [10 * 60, 18 * 60], us = [16 * 60 + 30, 23 * 60];
  const s6 = `<section class="sec" id="s6">${secHead(NUM.s6, 'Önümüzdeki günler')}
    <p>${withTerms(s6d.paragraph)}</p>
    <div class="row">
      <div style="flex:1 1 360px;display:flex;flex-direction:column;gap:10px">
        <div class="head-row"><span class="eyebrow">${isToday ? 'Bugün' : esc(dateTR(date, false))} · TSİ</span>${isToday ? `<span class="xs down">Şimdi ${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}</span>` : ''}</div>
        <div class="timeline">
          <div class="labels"><span>BIST 10:00–18:00</span><span>ABD 16:30–23:00</span></div>
          <div class="track" aria-hidden="true">
            <span style="left:${pos(bist[0])}%;width:${pos(bist[1]) - pos(bist[0])}%;background:#C9D5F6"></span>
            <span style="left:${pos(us[0])}%;width:${pos(us[1]) - pos(us[0])}%;background:#F4D9A8;opacity:.85"></span>
            ${isToday && nowMin >= AX0 && nowMin <= AX1 ? `<span class="now" style="left:${pos(nowMin)}%"></span>` : ''}
          </div>
        </div>
        ${map(s6d.today, (e) => `<div class="event ${isToday && toMin(e.time) < nowMin ? 'past' : ''}">
          <span class="t">${esc(e.time)}</span><span class="d" style="background:${IMPACT[e.impact] || IMPACT.low}"></span>
          <div><b>${esc(e.title)}</b><small>${esc(e.detail)}</small></div></div>`)}
      </div>
      <div style="flex:1 1 360px;display:flex;flex-direction:column;gap:10px">
        <span class="eyebrow">Bu hafta ve gelecek hafta</span>
        ${map(s6d.week, (e) => `<div class="wk"><span class="w">${esc(e.when)}</span><b>${esc(e.title)}</b><small>${esc(e.expect)}</small></div>`)}
        ${s6d.earnings?.length ? `<span class="eyebrow" style="padding-top:8px">Öne çıkan bilançolar</span>
        <div class="pills">${map(s6d.earnings, (b) => `<span class="pill"><strong class="mono">${esc(b.ticker)}</strong> ${esc(b.when)}</span>`)}</div>` : ''}
      </div>
    </div>
  </section>`;

  const s7 = `<section class="sec" id="s7">${secHead(NUM.s7, 'Benim okumam', '<span class="small muted">önümüzdeki 1-2 hafta</span>')}
    <div class="grid" style="--min:260px;gap:12px">
      <div class="scen main"><span class="eyebrow">En olası senaryo</span><span>${esc(D.s7.likely)}</span></div>
      <div class="scen"><span class="eyebrow">Alternatif senaryo</span><span>${esc(D.s7.alternative)}</span></div>
      <div class="scen"><span class="eyebrow">İzlenecek sinyal</span><span>${esc(D.s7.signal)}</span></div>
    </div>
    ${viewsBox(D.s7.views)}
    <span class="xs muted">Bu bölüm al/sat tavsiyesi değil, piyasa okumasıdır.</span>
  </section>`;

  const s8 = `<section class="sec lesson" id="s8">${secHead(NUM.s8, 'Günün dersi: ' + D.s8.title)}
    ${map(D.s8.paragraphs, (p) => `<p>${withTerms(p)}</p>`)}
    ${D.s8.rule ? `<p class="rule"><strong>Altın kural:</strong> ${esc(D.s8.rule)}</p>` : ''}
    <a class="small" href="sozluk.html${D.s8.concept ? '#' + esc(D.s8.concept) : ''}">Sözlükte aç →</a>
  </section>`;

  const nq = D.nq ? nqSection(D.nq, NUM.nq, D) : '';

  const regions = ['Tümü', ...new Set(D.news.map((n) => n.region))];
  const news = `<section class="card" style="padding:24px">
    <div class="head-row"><span class="eyebrow">Ek · Haber akışı</span>
      <div class="chips" role="tablist" aria-label="Bölge filtresi">${regions.map((r, i) => `<button type="button" role="tab" class="chip ${i === 0 ? 'on' : ''}" data-region="${esc(r)}">${esc(r)}</button>`).join('')}</div>
    </div>
    <div id="news">${map(D.news, (n) => `<div class="news" data-r="${esc(n.region)}"><div class="meta"><span>${esc(n.date)}</span><span>${esc(n.region)}</span></div><div><b>${esc(n.title)}</b><span class="why">${esc(n.why)}</span></div></div>`)}</div>
  </section>`;

  app.innerHTML = tickers + `<main class="wrap narrow">
    ${summary}${impact}${s1}${s2}${nq}
    ${simple('s3', NUM.s3, 'Avrupa ve Asya', D.s3)}
    ${simple('s4', NUM.s4, 'Para, faiz ve emtia', D.s4)}
    ${simple('s5', NUM.s5, 'Türkiye', D.s5)}
    ${s6}${s7}${s8}${news}
    <p class="source">${esc(D.sources || '')} Yatırım tavsiyesi değildir.</p>
  </main>`;

  tvMini(document.getElementById('tv-spx'), 'FOREXCOM:SPXUSD', { range: '3M', height: 220 });
  const tvNq = document.getElementById('tv-nq');
  if (tvNq) tvMini(tvNq, 'CAPITALCOM:US100', { range: '1M', height: 220 });
  if (!ctx.isOld) startLive(() => {});

  // Terim açıklamaları
  app.addEventListener('click', (e) => {
    const b = e.target.closest('.term');
    if (b) {
      const c = glossary.concepts[b.dataset.term];
      const slot = b.closest('.sec').querySelector('.term-slot') || b.closest('.sec');
      if (!c) return;
      slot.innerHTML = `<div class="term-note" role="note"><div class="head-row"><b>${esc(c.name)}</b><button type="button" class="x">Kapat</button></div>
        <span>${esc(c.def)}</span><a class="small" href="sozluk.html#${esc(b.dataset.term)}">Sözlükte aç ve dersi oku →</a></div>`;
      return;
    }
    if (e.target.closest('.term-note .x')) { e.target.closest('.term-note').remove(); return; }
    const chip = e.target.closest('.chip[data-region]');
    if (chip) {
      app.querySelectorAll('.chip[data-region]').forEach((c) => c.classList.toggle('on', c === chip));
      const r = chip.dataset.region;
      app.querySelectorAll('#news .news').forEach((n) => { n.style.display = r === 'Tümü' || n.dataset.r === r ? '' : 'none'; });
    }
  });
}

main().catch(fail);
