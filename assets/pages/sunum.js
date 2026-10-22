// Sunum modu: günlük özeti ~10 dakikalık slaytlara çevirir.
// Sahne (16:9) izleyicinin göreceği görseldir; yan panel sadece sunucu içindir (ipuçları, süre, prova seviyesi).
// İpuçları günlük dosyadaki `sunum` alanından gelir; yoksa bölümün kendi zinciri ve paragraf başları kullanılır.
import { loadDay, loadJSON, fail, esc, map, dateTR, signed, num } from '../app.js';
import { hbars } from '../charts.js';

const strip = (s) => String(s ?? '').replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1');
const first = (s, n = 9) => { const w = strip(s).split(/\s+/); return w.slice(0, n).join(' ') + (w.length > n ? '…' : ''); };
const sentence1 = (s) => strip(s).split(/(?<=[.!?])\s/)[0];
const MOOD = { risk_off: ['Riskten kaçış', 'down'], temkinli: ['Temkinli', 'flat'], risk_on: ['Risk iştahı', 'up'] };
const BIAS = { destek: ['Destek', 'up', 'Makro NQ lehine'], notr: ['Nötr', 'flat', 'Karışık rüzgâr'], engel: ['Engel', 'down', 'Makro NQ aleyhine'] };
const TONE = { up: 'up', down: 'down', flat: 'flat', good: 'up', bad: 'down' };

// ---------- görsel parçalar (sahne) ----------
const chainViz = (c) => (c?.length ? `<div class="sx-chain">${c.map((x, i) => `${i ? '<span class="sx-arr">→</span>' : ''}<span class="sx-step"><i>${i + 1}</i>${esc(x)}</span>`).join('')}</div>` : '');
const cardsViz = (cards) => (cards?.length ? `<div class="sx-cards">${map(cards.slice(0, 6), (c) => `<div class="sx-card"><span class="l">${esc(c.label)}</span><b class="mono">${esc(c.value)}</b><span class="s ${TONE[c.tone] || ''}">${esc(c.sub || '')}</span></div>`)}</div>` : '');
// en çok yükselen ve en çok düşen n tanesi (sıra korunur)
const edges = (list, n) => { const a = [...list].sort((x, y) => y.chg - x.chg); return a.length <= 2 * n ? a : [...a.slice(0, n), ...a.slice(-n)]; };
const head = (eyebrow, title) => `<div class="sx-head"><span class="sx-eye">${esc(eyebrow)}</span><h1>${esc(strip(title))}</h1></div>`;

function buildSlides(D, ext) {
  const S = [];
  const add = (id, sec, target, stage, src = []) => S.push({ id, sec, target, stage, src: src.filter(Boolean) });
  const [moodTxt, moodCls] = MOOD[D.s1?.mood] || MOOD.temkinli;

  add('kapak', 'Günün özeti', 45, `
    <div class="sx-cover">
      <span class="sx-date">${esc(dateTR(D.date))}</span>
      <h1>${esc(strip(D.summary.headline))}</h1>
      <div class="sx-themes">${map(D.s1?.themes, (t, i) => `<div><i>${i + 1}</i><b>${esc(t.title)}</b></div>`)}</div>
      <span class="sx-mood ${moodCls}">Piyasa ruh hali: ${esc(moodTxt)}</span>
    </div>`, [D.summary.lede, ...(D.s1?.themes || []).map((t) => `${t.title}: ${t.text}`)]);

  add('rakamlar', 'Rakamlar', 25, `${head('Tablo', 'Dün kapanış ve bu sabah')}
    <div class="sx-tick">${map(D.tickers, (t) => `<div class="${TONE[t.tone] || ''}"><span>${esc(t.name)}</span><b class="mono">${esc(t.value)}</b><em class="mono">${esc(t.chg)}</em></div>`)}</div>`);

  if (D.s1?.changes?.length) {
    const TAG = { same: 'flat', good: 'up', bad: 'down', new: 'new' };
    add('dun', 'Dünle kıyas', 40, `${head('Dünkü okumamız', 'Ne doğrulandı, ne değişti?')}
      <div class="sx-changes">${map(D.s1.changes.slice(0, 7), (c) => `<div><span class="sx-tag ${TAG[c.tone] || ''}">${esc(c.tag)}</span><span>${esc(strip(c.text))}</span></div>`)}</div>`, [D.s1.mood_note]);
  }

  add('abd', 'ABD', 60, `${head('ABD', D.s2?.title || 'Wall Street ne fiyatladı?')}
    ${chainViz(D.s2?.chain)}
    ${D.s2?.sectors?.length ? `<div class="sx-bars">${hbars(edges(D.s2.sectors, 4))}</div>` : ''}`, D.s2?.paragraphs);

  add('avrupa', 'Avrupa ve Asya', 45, `${head('Avrupa ve Asya', D.s3?.title || 'Bölgeler ne söylüyor?')}${chainViz(D.s3?.chain)}${cardsViz(D.s3?.cards)}`, D.s3?.paragraphs);

  add('para', 'Para, faiz, emtia', 50, `${head('Para · faiz · emtia', D.s4?.title || 'Petrol, faiz, dolar, altın')}${chainViz(D.s4?.chain)}${cardsViz(D.s4?.cards)}`, D.s4?.paragraphs);

  if (D.impact?.length) {
    add('etki', 'Olay ve sektör etkisi', 60, `${head('Olay ve sektör etkisi', 'Kim kazandı, kim kaybetti, para nereye kayabilir?')}
      <div class="sx-impact n${Math.min(D.impact.length, 4)}">${map(D.impact.slice(0, 4), (e) => `<div class="sx-imp">
        <span class="sx-mk">${esc(e.market || '')}</span><b>${esc(strip(e.title))}</b>
        <div class="sx-groups">${map(e.groups, (g) => `<span class="${TONE[g.tone] || 'flat'}">${g.tone === 'up' ? '▲' : g.tone === 'down' ? '▼' : '◆'} ${esc(g.name.split(' (')[0])}</span>`)}</div></div>`)}</div>`,
      D.impact.flatMap((e) => [e.summary, ...(e.groups || []).map((g) => `${g.name} — fiyatlanan: ${g.priced}${g.flow ? ' Para nereye: ' + g.flow : ''} Ters okuma: ${g.counter}`)]));
  }

  if (D.nq) {
    const [bt, bc, bs] = BIAS[D.nq.bias] || BIAS.notr;
    add('nq', 'NQ için makro rüzgâr', 50, `${head('Nasdaq 100 vadelisi (NQ)', 'Makro rüzgâr bugün nereden esiyor?')}
      <div class="sx-nq"><div class="sx-bias ${bc}"><b>${bt}</b><span>${bs}</span></div>
        <div class="sx-winds"><div class="up"><span>Lehine</span>${map(D.nq.tailwinds, (t) => `<p>${esc(t.title)}</p>`)}</div>
        <div class="down"><span>Aleyhine</span>${map(D.nq.headwinds, (t) => `<p>${esc(t.title)}</p>`)}</div></div></div>
      ${D.nq.watch ? `<div class="sx-watch"><span>Bugün izlenecek</span>${esc(strip(D.nq.watch))}</div>` : ''}
      <span class="sx-foot">Al/sat sinyali değildir.</span>`, D.nq.paragraphs);
  }

  const today = D.s6?.today || [];
  if (today.length) {
    const [y, m, d] = D.date.split('-').map(Number);
    const MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const key = `${d} ${MON[m - 1]}`;
    const scen = (D.makro?.upcoming || []).filter((u) => u.scen?.length && (u.when || '').startsWith(key + ' ')).slice(0, 2);
    add('takvim', 'Bugünün takvimi', 40, `${head('Takvim · TSİ', 'Bugün ne zaman ne var?')}
      <div class="sx-cal ${scen.length ? 'with-scen' : ''}"><div class="sx-times">${map(today.slice(0, 8), (t) => `<div class="i-${esc(t.impact)}"><b class="mono">${esc(t.time)}</b><span>${esc(t.title)}</span></div>`)}</div>
      ${scen.length ? `<div class="sx-scen">${map(scen, (u) => `<div><b>${esc(u.name)} <em>${esc((u.when || '').split(' ').slice(2).join(' '))}</em></b>${map(u.scen, (s2, i) => `<p><span>${i ? '▼' : '▲'} ${esc(s2.if)}</span>${esc(s2.then)}</p>`)}</div>`)}</div>` : ''}</div>`,
      [D.s6?.paragraph]);
  }

  add('turkiye', 'Türkiye', 50, `${head('Türkiye', D.turkiye?.reading?.headline || 'Borsa İstanbul')}${chainViz(D.s5?.chain)}
    <div class="sx-split">${cardsViz((D.s5?.cards || []).slice(0, 4))}${D.turkiye?.sectors?.length ? `<div class="sx-bars">${hbars(edges(D.turkiye.sectors, 3))}</div>` : ''}</div>`,
    [...(D.s5?.paragraphs || []), D.turkiye?.sectors_note]);

  if (D.kripto) {
    const K = D.kripto, sec = ext.sectors?.items?.filter((x) => !x.odd) || [];
    add('kripto', 'Kripto', 45, `${head('Kripto', K.reading?.headline || 'Kripto')}
      ${cardsViz((K.kpis || []).slice(0, 4).map((k) => ({ label: k.code || k.label, value: k.value, sub: k.sub, tone: k.tone })))}
      ${sec.length ? `<div class="sx-tiles">${map([...sec].sort((a, b) => (b.d1 ?? 0) - (a.d1 ?? 0)).slice(0, 8), (x) => `<div class="${(x.d1 ?? 0) >= 0 ? 'up' : 'down'}"><span>${esc(x.name)}</span><b class="mono">${esc(signed(x.d1, 1, '%'))}</b></div>`)}</div>` : ''}`,
      [...(K.reading?.paragraphs || []), K.sectors_note]);
  }

  if (D.s7) {
    const cut = (s) => strip(s).replace(/^[^:]{0,30}:\s*/, '');
    add('okuma', 'Benim okumam', 50, `${head('Benim okumam', 'Bugün en olası ne olur?')}
      <div class="sx-read"><div class="main"><span>En olası</span><p>${esc(sentence1(cut(D.s7.likely)))}</p></div>
      <div><span>Alternatif</span><p>${esc(sentence1(cut(D.s7.alternative)))}</p></div>
      <div class="sig"><span>Tek sinyal</span><p>${esc(cut(D.s7.signal))}</p></div></div>`, [D.s7.likely, D.s7.alternative, D.s7.signal]);
    const V = D.s7.views;
    if (V?.bull?.length || V?.bear?.length) {
      add('gorusler', 'İki görüş', 40, `${head('İki görüş', V.topic)}
        <div class="sx-views"><div class="up"><span>Boğa</span>${map(V.bull, (b) => `<p>${esc(first(b.text, 16))}<em>${esc(b.who)}</em></p>`)}</div>
        <div class="down"><span>Ayı</span>${map(V.bear, (b) => `<p>${esc(first(b.text, 16))}<em>${esc(b.who)}</em></p>`)}</div></div>`, [V.split]);
    }
  }

  if (D.s8) {
    const g = ext.glossary?.concepts?.[D.s8.concept];
    add('ders', 'Günün dersi', 35, `${head('Günün dersi', g?.name || D.s8.title)}
      ${g?.chain?.length ? chainViz(g.chain) : ''}
      ${g?.analogy ? `<div class="sx-analogy"><span>Benzetme</span>${esc(g.analogy)}</div>` : ''}
      ${D.s8.rule ? `<div class="sx-rule"><span>Kural</span>${esc(strip(D.s8.rule))}</div>` : ''}`, [g?.def, ...(D.s8.paragraphs || [])]);
  }

  add('kapanis', 'Kapanış', 15, `<div class="sx-cover end"><span class="sx-date">Bugün tek bir şeye bakacaksak</span>
    <h1>${esc(strip(D.s7?.signal || D.nq?.watch || '').replace(/^[^:]{0,30}:\s*/, ''))}</h1>
    <span class="sx-foot">Market Intelligence · ${esc(dateTR(D.date, false))} · Yatırım tavsiyesi değildir.</span></div>`);
  return S;
}

// ---------- sunucu paneli ----------
const FRAME = ['Ne oldu?', 'Neden oldu?', 'Zincir: neyi etkiledi?', 'Dünle kıyas', 'Ne izlenecek?'];
function notesHTML(sl, cue, level, showText) {
  const fade = (s) => (level === 1 ? esc(s) : level === 2 ? `${esc(String(s).split(/\s+/).slice(0, 2).join(' '))} <span class="muted">…</span>` : '');
  const cues = cue?.cues?.length ? cue.cues : sl.src.slice(0, 3).map((p) => first(p, 7));
  return `
    ${level < 3 && cue?.hook ? `<div class="nt-hook"><span>Açılış sorusu</span>${esc(cue.hook)}</div>` : ''}
    ${level < 3 ? `<div class="nt-block"><span>${cue?.cues?.length ? 'İpuçları' : 'Paragraf başları (otomatik)'}</span><ol>${cues.map((c) => `<li>${fade(c)}</li>`).join('')}</ol></div>` : '<div class="nt-block"><span>Seviye 3</span><p class="muted">İpucu yok: sadece görselden anlat.</p></div>'}
    ${level === 1 && cue?.analogy ? `<div class="nt-block"><span>Benzetme</span><p>${esc(cue.analogy)}</p></div>` : ''}
    ${level < 3 && cue?.pitfall ? `<div class="nt-warn"><span>Dikkat</span>${esc(cue.pitfall)}</div>` : ''}
    ${level < 3 && cue?.takeaway ? `<div class="nt-block"><span>Akılda kalan</span><p><b>${esc(cue.takeaway)}</b></p></div>` : ''}
    <div class="nt-frame">${FRAME.map((f) => `<span>${f}</span>`).join('')}</div>
    ${showText ? `<div class="nt-text"><span>Kaynak metin (T ile kapat)</span>${map(sl.src, (p) => `<p>${esc(strip(p))}</p>`)}</div>` : ''}`;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* özel pencere */ } },
};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function main() {
  const ctx = await loadDay();
  const D = ctx.data;
  const [sectors, glossary] = await Promise.all([loadJSON('data/crypto/sectors.json').catch(() => null), loadJSON('data/sozluk.json').catch(() => null)]);
  const all = buildSlides(D, { sectors, glossary });
  const CUES = D.sunum || {};
  const markKey = `sunum-mark:${D.date}`;
  let marks = store.get(markKey, {});
  let level = store.get('sunum-level', 1), notes = store.get('sunum-notes', true), showText = false, onlyHard = false;
  let slides = all, i = 0, slideStart = Date.now(), runStart = null;
  const total = all.reduce((a, s) => a + s.target, 0);

  document.body.innerHTML = `<div class="sn-wrap">
    <div class="sn-main"><div class="sn-fit" id="fit"><div class="sn-stage" id="stage"></div></div>
      <div class="sn-bar">
        <a href="index.html${ctx.isOld ? '?d=' + D.date : ''}" class="sn-btn">← Panel</a>
        <button class="sn-btn" data-a="prev" aria-label="Önceki">‹</button><span id="pos" class="mono"></span><button class="sn-btn" data-a="next" aria-label="Sonraki">›</button>
        <div class="sn-prog"><i id="prog"></i></div>
        <span id="clock" class="mono"></span>
        <button class="sn-btn" data-a="level" title="L">Seviye <b id="lv"></b></button>
        <button class="sn-btn" data-a="notes" title="N">Notlar</button>
        <button class="sn-btn" data-a="full" title="F">Tam ekran</button>
      </div></div>
    <aside class="sn-notes" id="notes"></aside></div>`;
  const $ = (id) => document.getElementById(id);

  const fit = () => {
    const box = $('fit').getBoundingClientRect();
    const k = Math.min(box.width / 1280, box.height / 720);
    $('stage').style.transform = `scale(${k})`;
  };
  const render = () => {
    const sl = slides[i];
    $('stage').innerHTML = `<div class="sx slide-${sl.id}">${sl.stage}<span class="sx-brand">Market Intelligence · ${esc(sl.sec)}</span></div>`;
    $('pos').textContent = `${i + 1}/${slides.length}`;
    $('prog').style.width = `${((i + 1) / slides.length) * 100}%`;
    $('lv').textContent = level;
    document.querySelector('.sn-wrap').classList.toggle('no-notes', !notes);
    const done = all.filter((s) => marks[s.id]).length;
    const hard = all.filter((s) => marks[s.id] === 'hard');
    $('notes').innerHTML = `
      <div class="nt-top"><span class="nt-sec">${i + 1}. ${esc(sl.sec)}</span><span class="mono" id="st"></span></div>
      ${notesHTML(sl, CUES[sl.id], level, showText)}
      <div class="nt-mark"><span>Bu slaytı anlatabildin mi?</span>
        <button data-m="ok" class="${marks[sl.id] === 'ok' ? 'on' : ''}">1 · Anlattım</button><button data-m="hard" class="${marks[sl.id] === 'hard' ? 'on' : ''}">2 · Takıldım</button></div>
      <div class="nt-sum">Prova: ${done}/${all.length} işaretli${hard.length ? ` · takıldıkların: ${hard.map((s) => esc(s.sec)).join(', ')}` : ''}
        ${hard.length || onlyHard ? `<button data-a="hard">${onlyHard ? 'Tüm slaytlar' : 'Sadece takıldıklarım'}</button>` : ''}</div>
      <div class="nt-keys">← → geç · N notlar · L seviye · T kaynak metin · F tam ekran · 1/2 işaretle · R süreyi sıfırla</div>`;
    slideStart = Date.now();
    tick();
    fit();
  };
  const tick = () => {
    const sl = slides[i]; if (!sl) return;
    const el = (Date.now() - slideStart) / 1000, run = runStart ? (Date.now() - runStart) / 1000 : 0;
    const st = $('st'); if (st) { st.textContent = `${mmss(el)} / ${mmss(sl.target)}`; st.className = 'mono ' + (el > sl.target * 1.25 ? 'down' : el > sl.target ? 'warn' : ''); }
    $('clock').textContent = `${mmss(run)} / ${mmss(total)}`;
  };
  const go = (d) => { const n = Math.max(0, Math.min(slides.length - 1, i + d)); if (!runStart) runStart = Date.now(); if (n !== i) { i = n; showText = false; render(); } };
  const act = (a) => {
    if (a === 'next') go(1); else if (a === 'prev') go(-1);
    else if (a === 'level') { level = level % 3 + 1; store.set('sunum-level', level); render(); }
    else if (a === 'notes') { notes = !notes; store.set('sunum-notes', notes); render(); }
    else if (a === 'text') { showText = !showText; render(); }
    else if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
    else if (a === 'hard') { onlyHard = !onlyHard; const h = all.filter((s) => marks[s.id] === 'hard'); slides = onlyHard && h.length ? h : all; i = 0; render(); }
    else if (a === 'reset') { runStart = Date.now(); slideStart = Date.now(); tick(); }
  };
  const mark = (m) => { const id = slides[i].id; marks[id] = marks[id] === m ? undefined : m; store.set(markKey, marks); render(); };

  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,select,textarea')) return;
    const k = e.key;
    if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); go(1); }
    else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(-1); }
    else if (k === 'Home') { i = 0; render(); } else if (k === 'End') { i = slides.length - 1; render(); }
    else if (/^[nN]$/.test(k)) act('notes'); else if (/^[lL]$/.test(k)) act('level'); else if (/^[tT]$/.test(k)) act('text');
    else if (/^[fF]$/.test(k)) act('full'); else if (/^[rR]$/.test(k)) act('reset');
    else if (k === '1') mark('ok'); else if (k === '2') mark('hard');
  });
  document.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a],[data-m]');
    if (b?.dataset.a) act(b.dataset.a); else if (b?.dataset.m) mark(b.dataset.m);
    else if (e.target.closest('#fit')) { const r = $('fit').getBoundingClientRect(); go(e.clientX - r.left < r.width / 3 ? -1 : 1); }
  });
  let tx = null;
  $('fit').addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  $('fit').addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); tx = null; });
  window.addEventListener('resize', fit);
  setInterval(tick, 1000);
  render();
}

main().catch(fail);
