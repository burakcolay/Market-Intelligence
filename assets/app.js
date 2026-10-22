// Ortak yardımcılar: veri yükleme, başlık/menü, biçimlendirme.

export const PAGES = [
  { key: 'index', href: 'index.html', label: 'Ana Sayfa' },
  { key: 'faizler', href: 'faizler.html', label: 'Faizler & Fed' },
  { key: 'kuresel', href: 'kuresel.html', label: 'Küresel' },
  { key: 'hisseler', href: 'hisseler.html', label: 'ABD Hisseleri' },
  { key: 'analiz', href: 'analiz.html', label: 'Analiz' },
  { key: 'kripto', href: 'kripto.html', label: 'Kripto' },
  { key: 'turkiye', href: 'turkiye.html', label: 'Türkiye' },
  { key: 'makro', href: 'makro.html', label: 'Makro & Takvim' },
  { key: 'haftalik', href: 'haftalik.html', label: 'Haftalık Özet' },
  { key: 'sozluk', href: 'sozluk.html', label: 'Sözlük' },
  { key: 'sunum', href: 'sunum.html', label: 'Sunum ▶' },
];

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const map = (arr, fn) => (arr || []).map(fn).join('');

export function dateTR(iso, withDay = true) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${d} ${MONTHS[m - 1]} ${y}` + (withDay ? `, ${DAYS[dt.getUTCDay()]}` : '');
}

// Sayı biçimleri (Türkçe: virgül ondalık, nokta binlik)
export function num(v, dec = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  return Number(v).toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function signed(v, dec = 2, suffix = '%') {
  if (v === null || v === undefined) return '–';
  const s = num(Math.abs(v), dec);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + s + suffix;
}

export const toneClass = (t) => ({ up: 'up', down: 'down', good: 'up', bad: 'down' }[t] || 'flat');
export const signTone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');

// Isı rengi (performans tabloları)
export function heatBg(v, scale = 1) {
  if (v === null || v === undefined) return '#F0F0EC';
  const x = v / scale;
  if (x >= 3) return '#9FD8B8';
  if (x >= 1) return '#C8EBD6';
  if (x > 0.05) return '#E6F5EC';
  if (x <= -3) return '#E89A8E';
  if (x <= -1) return '#F1C1B9';
  if (x < -0.05) return '#F8E1DD';
  return '#F0F0EC';
}

// --- veri yükleme ---
async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path} yüklenemedi (${r.status})`);
  return r.json();
}

export function selectedDate() {
  const d = new URLSearchParams(location.search).get('d');
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export async function loadDay() {
  const [latest, dates] = await Promise.all([getJSON('data/latest.json'), getJSON('data/daily/index.json').catch(() => [])]);
  const date = selectedDate() || latest.date;
  const data = await getJSON(`data/daily/${date}.json`);
  return { date, latest, dates, data, isOld: date !== latest.date };
}

export const loadJSON = getJSON;

// --- iskelet ---
function withDate(href) {
  const d = selectedDate();
  return d ? `${href}?d=${d}` : href;
}

export function shell(active, { date, dates = [], updated, isOld, latest } = {}) {
  const nav = map(PAGES, (p) => `<a href="${withDate(p.href)}" class="${p.key === active ? 'active' : ''}">${esc(p.label)}</a>`);
  const options = [...dates].sort().reverse().map((d) => `<option value="${d}" ${d === date ? 'selected' : ''}>${esc(dateTR(d, false))}</option>`).join('');
  const dateBox = date
    ? `<label class="date-box"><span>${esc(dateTR(date))}${updated ? ' · ' + esc(updated) : ''}</span>${dates.length > 1 ? `<select aria-label="Gün seç" id="day-pick">${options}</select>` : ''}</label>`
    : '';
  document.body.innerHTML = `
    <header class="site-header">
      <div class="inner">
        <div class="brand-row">
          <a href="${withDate('index.html')}" class="brand" style="text-decoration:none;color:inherit"><b>Market Intelligence</b><span>Günlük küresel piyasa takibi</span></a>
          ${dateBox}
        </div>
        <nav class="nav" aria-label="Bölümler">${nav}</nav>
      </div>
      ${isOld && latest ? `<div class="old-banner">Arşivdeki bir günü görüyorsun. <a href="${location.pathname.split('/').pop() || 'index.html'}">Bugüne dön →</a></div>` : ''}
    </header>
    <div id="app"></div>`;
  const act = document.querySelector('.nav a.active');
  if (act) act.parentElement.scrollLeft = act.offsetLeft - 16;
  const pick = document.getElementById('day-pick');
  if (pick) pick.addEventListener('change', () => {
    const u = new URL(location.href);
    if (pick.value === latest?.date) u.searchParams.delete('d'); else u.searchParams.set('d', pick.value);
    location.href = u.toString();
  });
  return document.getElementById('app');
}

export function fail(err) {
  console.error(err);
  const el = document.getElementById('app') || document.body;
  el.innerHTML = `<div class="error">Veri yüklenemedi: ${esc(err.message)}</div>`;
}

// Ortak bileşenler
export function kpi(k, cls = '') {
  const lk = liveKeyFor(k.code || k.label, k.value);
  return `<div class="kpi ${cls}" ${lk ? `data-live="${lk}" data-snap="${esc(k.value)}"` : ''}>
    ${k.code ? `<div class="head-row"><span class="code">${esc(k.code)}</span><span class="l">${esc(k.label)}</span></div>` : `<span class="l">${esc(k.label)}</span>`}
    <span class="v">${esc(k.value)}</span>
    ${k.sub ? `<span class="s ${toneClass(k.tone)}">${esc(k.sub)}</span>` : ''}
    ${lk ? '<span class="live-line"></span>' : ''}
  </div>`;
}

export function paras(list, cls = '') {
  // [[id|metin]] işaretini düz metne çevir (terim kutusu olmayan sayfalar için)
  return map(list, (p) => `<p class="${cls}">${esc(String(p).replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1'))}</p>`);
}

export function lessonBox(l, eyebrow) {
  if (!l) return '';
  return `<section class="card lesson">
    <span class="eyebrow dark">${esc(eyebrow)}: ${esc(l.title)}</span>
    ${paras(l.paragraphs)}
    ${l.rule ? `<p class="rule"><strong>Altın kural:</strong> ${esc(l.rule)}</p>` : ''}
  </section>`;
}

// TradingView gömülü grafik (canlı). Yüklenemezse yerine not gösterilir.
export function tvMini(el, symbol, { range = '3M', height = 220 } = {}) {
  el.innerHTML = '';
  el.style.minHeight = height + 'px';
  const box = document.createElement('div');
  box.className = 'tradingview-widget-container';
  const inner = document.createElement('div');
  inner.className = 'tradingview-widget-container__widget';
  box.appendChild(inner);
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
  s.async = true;
  s.textContent = JSON.stringify({ symbol, width: '100%', height, locale: 'tr', dateRange: range, colorTheme: 'light', isTransparent: true, autosize: false, largeChartUrl: '' });
  s.onerror = () => { el.innerHTML = '<div class="tv-fallback">Canlı grafik yüklenemedi.</div>'; };
  box.appendChild(s);
  el.appendChild(box);
}

// ---------------- Canlı fiyatlar ----------------
// Kartın etiketi -> /api/live içindeki anahtar
const LIVE_KEYS = {
  'S&P 500': 'spx', 'Nasdaq 100': 'ndx', 'Nasdaq': 'ndx', 'Dow Jones': 'dji', 'VIX': 'vix',
  'ABD 10Y': 'us10y', 'ABD 10 yıllık': 'us10y', '30 yıllık': 'us30y', 'ABD 30 yıllık': 'us30y',
  'BIST 100': 'xu100', 'BIST 30': 'xu030',
  'USD/TRY': 'usdtry', 'EUR/TRY': 'eurtry', 'EUR/USD': 'eurusd',
  'Ons altın': 'gold', 'Altın': 'gold', 'Gram altın': 'gramgold', 'Brent': 'brent',
  'Euro Stoxx 50': 'sx5e', 'DAX': 'dax', 'Nikkei 225': 'n225', 'Hang Seng': 'hsi',
  'Bitcoin': 'c:btc', 'BTC': 'c:btc', 'Ethereum': 'c:eth', 'ETH': 'c:eth',
  'TOTAL': 'g:total', 'TOTAL2': 'g:total2', 'BTC.D': 'g:btcd', 'USDT.D': 'g:usdtd',
};
const YIELDS = new Set(['us10y', 'us30y']);
const DEC = { xu100: 0, xu030: 0, gold: 0, gramgold: 0, eurusd: 3, 'c:btc': 0, 'c:eth': 0, 'g:btcd': 1, 'g:usdtd': 1 };

// Değer "+0,86%" gibi bir değişimse kart canlı fiyata çevrilmez
export function liveKeyFor(label, value) {
  const k = LIVE_KEYS[label];
  if (!k || /^[+−-]/.test(String(value || '').trim())) return null;
  return k;
}

// "7.813,74" / "%5,26" / "2,92 tr $" -> sayı
export function parseTR(str) {
  const m = String(str ?? '').replace(/[≈~]/g, '').match(/-?[\d.]+(?:,\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
  if (/\btr\b/.test(str)) n *= 1e12; else if (/\bmlr\b/.test(str)) n *= 1e9;
  return n;
}

export async function fetchLive() {
  try {
    const r = await fetch('/api/live', { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Anahtara göre canlı değer: { price, chg (%, 24s/günlük), bp? }
export function liveValue(L, key) {
  if (!L || !key) return null;
  if (key.startsWith('c:')) { const c = L.crypto?.[key.slice(2)]; return c ? { price: c.price, chg: c.chg } : null; }
  if (key.startsWith('g:')) {
    const g = L.global; if (!g) return null;
    const f = key.slice(2);
    return g[f] != null ? { price: g[f], chg: f === 'total' ? g.chg : null } : null;
  }
  const m = L.markets?.[key];
  if (!m) return null;
  return { price: m.price, chg: m.chg, bp: YIELDS.has(key) && m.prev != null ? (m.price - m.prev) * 100 : null };
}

// Canlı değeri, sabah yazılan değerin biçimine uydurarak yazar
export function formatLive(key, price, snap) {
  const s = String(snap || '');
  if (key === 'g:total' || key === 'g:total2') return (s.startsWith('≈') ? '≈' : '') + num(price / 1e12, 2) + ' tr $';
  const dec = DEC[key] ?? 2;
  const pre = s.trim().startsWith('%') || s.includes('≈%') ? '%' : '';
  const suf = s.includes('$') ? ' $' : s.includes('TL') ? ' TL' : '';
  return pre + num(price, dec) + suf;
}

function chgText(v) {
  if (v.bp != null) return `${v.bp > 0 ? '▲' : v.bp < 0 ? '▼' : '•'} ${num(Math.abs(v.bp), 0)} bp`;
  if (v.chg == null) return '';
  return `${v.chg > 0 ? '▲' : v.chg < 0 ? '▼' : '•'} %${num(Math.abs(v.chg), 2)}`;
}
function sinceText(key, v, snap) {
  const old = parseTR(snap);
  if (old == null || !old) return '';
  if (key.startsWith('g:btcd') || key.startsWith('g:usdtd') || YIELDS.has(key)) {
    const d = v.price - old;
    if (Math.abs(d) < 0.005) return `rutinde ${snap} · değişmedi`;
    return `rutinde ${snap} · o andan beri ${d > 0 ? '+' : '−'}${num(Math.abs(d), 2)} puan`;
  }
  const p = ((v.price - old) / old) * 100;
  return `rutinde ${snap} · o andan beri ${signed(p, 1)}`;
}

// Sayfadaki tüm [data-live] öğelerini günceller
export function applyLive(L, root = document) {
  if (!L) return;
  root.querySelectorAll('[data-live]').forEach((el) => {
    const key = el.dataset.live, snap = el.dataset.snap;
    const v = liveValue(L, key);
    if (!v || v.price == null || Number.isNaN(v.price)) return;
    el.classList.add('is-live');
    const ve = el.querySelector('.v'); if (ve) ve.textContent = formatLive(key, v.price, snap);
    if (el.classList.contains('tick')) {
      const c = el.querySelector('.c');
      const val = v.bp ?? v.chg;
      if (c && val != null) { c.textContent = chgText(v); c.className = 'c ' + (key === 'vix' || YIELDS.has(key) ? (val > 0 ? 'down' : val < 0 ? 'up' : 'flat') : signTone(val)); }
      el.title = sinceText(key, v, snap);
    } else {
      const line = el.querySelector('.live-line');
      if (line && el.classList.contains('live-only')) {
        // sadece canlı: sabah notunu ve "rutinde…" satırını gösterme
        const ct = chgText(v), val = v.bp ?? v.chg;
        line.innerHTML = `<i class="dot"></i>canlı${ct ? ` · 24 saat <b class="${val > 0 ? 'up' : val < 0 ? 'down' : 'flat'}">${esc(ct)}</b>` : ''}`;
      } else if (line) {
        const ct = chgText(v);
        line.innerHTML = `<i class="dot"></i>canlı${ct ? ' · bugün ' + esc(ct) : ''}<br><span>${esc(sinceText(key, v, snap))}</span>`;
      }
    }
  });
  document.querySelectorAll('[data-live-stamp]').forEach((el) => {
    const t = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(L.ts));
    el.innerHTML = `<i class="dot"></i>Canlı fiyatlar · ${t} · BIST ~15 dk gecikmeli`;
    el.hidden = false;
  });
}

// İlk yüklemede ve her 60 sn'de bir (sekme açıkken) canlı veriyi çeker
export function startLive(onData) {
  let busy = false;
  const tick = async () => {
    if (busy || document.hidden) return;
    busy = true;
    const L = await fetchLive();
    busy = false;
    if (L) { applyLive(L); onData?.(L); }
  };
  tick();
  setInterval(tick, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
