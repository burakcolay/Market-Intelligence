// "Haber etkisi" kartları: bir olay (haber, veri ya da sektörde sıra dışı hareket) hangi grupları nasıl etkiledi,
// para nereye kayabilir, ters okuma ne, neye bakılmalı. Ana sayfa hepsini, Türkiye/Kripto sayfaları kendi piyasasını gösterir.
import { esc, map } from './app.js';

const strip = (s) => esc(String(s ?? '').replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1'));
export const MARKET_ORDER = ['ABD', 'Avrupa-Asya', 'Emtia ve döviz', 'Türkiye', 'Kripto'];

export function impactCards(list, { usCodes = [], terms = strip } = {}) {
  const us = new Set(usCodes);
  const tk = (t) => (us.has(t) ? `<a class="mono" href="sirket.html?t=${esc(t)}">${esc(t)}</a>` : `<span class="mono">${esc(t)}</span>`);
  return map(list, (e) => `<article class="card impact">
    <div class="impact-top">${e.market ? `<span class="badge b-flat">${esc(e.market)}</span>` : ''}${e.trigger ? `<span class="xs muted">${esc(e.trigger)}</span>` : ''}</div>
    <h3>${esc(e.title)}</h3>
    ${e.summary ? `<p>${terms(e.summary)}</p>` : ''}
    ${e.chain?.length ? `<div class="cause">${e.chain.map((x, i) => `${i ? '<span class="arr" aria-hidden="true">→</span>' : ''}<span class="step">${esc(x)}</span>`).join('')}</div>` : ''}
    <div class="impact-groups">${map(e.groups, (g) => `<div class="ig ${g.tone === 'up' ? 'up' : g.tone === 'down' ? 'down' : 'flat'}">
      <div class="ig-h"><b>${esc(g.name)}</b><span class="mono ig-move">${esc(g.move || '')}</span></div>
      ${g.tickers?.length ? `<div class="ig-t">${g.tickers.map(tk).join(' · ')}</div>` : ''}
      ${g.priced ? `<p><span class="lbl">Piyasa ne fiyatladı</span>${terms(g.priced)}</p>` : ''}
      ${g.question ? `<p><span class="lbl">Asıl soru</span>${terms(g.question)}</p>` : ''}
      ${g.flow ? `<p><span class="lbl">Para nereye kayabilir</span>${terms(g.flow)}</p>` : ''}
      ${g.counter ? `<p><span class="lbl">Ters okuma</span>${terms(g.counter)}</p>` : ''}
    </div>`)}</div>
    ${e.checks?.length ? `<div class="impact-checks"><span class="eyebrow">Karar vermeden önce bakılacaklar</span><ol>${map(e.checks, (c) => `<li>${esc(c)}</li>`)}</ol></div>` : ''}
    ${e.sources?.length ? `<span class="xs muted">Kaynak: ${e.sources.map((x) => (x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name))).join(' · ')}</span>` : ''}
  </article>`);
}

export function impactSection(list, opts = {}) {
  if (!list?.length) return '';
  const sorted = [...list].sort((a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market));
  return `<section class="sec" id="etki">
    <div class="sec-head"><span class="num" style="background:var(--ink)">!</span><h2>${esc(opts.title || 'Haber etkisi')}</h2><span class="small muted">${esc(opts.sub || 'bir olay hangi sektörleri nasıl etkiledi, para nereye kayabilir, neye bakmalı')}</span></div>
    ${impactCards(sorted, opts)}
    <span class="xs muted">Al/sat tavsiyesi değildir; olayın hangi soruyu doğurduğunu ve neye bakılacağını gösterir.</span>
  </section>`;
}
