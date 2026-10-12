// SVG grafik üreticileri. Hepsi string döndürür.
import { esc, num, signed } from './app.js';

const BLUE = '#1F4FD1', NAVY = '#163A9C', GRID = '#EEEEEA', AXIS = '#C9CCD4';

function niceStep(range, count) {
  const raw = range / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

// Tek seri çizgi grafik. points: [{d, v}]
export function lineChart(points, o = {}) {
  const W = o.w || 640, H = o.h || 230, L = o.padL || 56, R = 16, T = 16, B = 34;
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (!vals.length) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const step = niceStep(hi - lo || 1, 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  const y = (v) => T + ((hi - v) / (hi - lo || 1)) * (H - T - B);
  const fmt = o.fmt || ((v) => num(v, 0));
  let grid = '';
  for (let v = lo; v <= hi + step / 2; v += step) {
    grid += `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${W - R}" y2="${y(v).toFixed(1)}" stroke="${GRID}"/>
      <text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  let hl = '';
  if (o.highlight) {
    const i0 = points.findIndex((p) => p.d === o.highlight.from);
    if (i0 >= 0) {
      const x0 = x(i0) + 4, x1 = W - R;
      hl = `<rect x="${x0.toFixed(1)}" y="${T}" width="${(x1 - x0).toFixed(1)}" height="${H - T - B}" fill="#FBE7E4"/>
        <text class="lbl" x="${(x1 - 4).toFixed(1)}" y="${T + 13}" text-anchor="end" style="fill:#9E2A20">${esc(o.highlight.label)}</text>`;
    }
  }
  const pts = [];
  points.forEach((p, i) => { if (p.v != null) pts.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`); });
  const li = points.length - 1;
  const n = points.length, every = Math.max(1, Math.round(n / 6));
  let xl = '';
  points.forEach((p, i) => {
    if (i % every === 0 || i === li) {
      if (i !== li && li - i < every * 0.6) return;
      xl += `<text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(p.d)}</text>`;
    }
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || '')}">
    ${grid}${hl}
    <polyline fill="none" stroke="${BLUE}" stroke-width="2.5" stroke-linejoin="round" points="${pts.join(' ')}"/>
    ${points[li].v != null ? `<circle cx="${x(li).toFixed(1)}" cy="${y(points[li].v).toFixed(1)}" r="5" fill="${NAVY}"/>` : ''}
    ${xl}
  </svg>`;
}

// Makro grafik kartı içindeki küçük grafik (bar ya da çizgi, opsiyonel hedef çizgisi)
export function macroChart(c) {
  const W = 340, H = 150, X0 = 34, X1 = 334, YT = 10, YB = 128;
  const vals = c.values.filter((v) => v != null);
  const hasCons = c.next_cons != null;           // sıradaki açıklamanın beklentisi: grafiğin sağında boş halka
  if (hasCons) vals.push(c.next_cons);
  const n = c.values.length, slot = (X1 - X0) / (n + (hasCons ? 1 : 0));
  let min, max;
  if (c.type === 'bar') { min = Math.min(0, ...vals); max = Math.max(0, ...vals); }
  else {
    const ext = c.target != null ? [...vals, c.target] : vals;
    const pad = (Math.max(...ext) - Math.min(...ext)) * 0.1 || 0.2;
    const st = niceStep(Math.max(...ext) - Math.min(...ext) + 2 * pad, 4);
    min = Math.floor((Math.min(...ext) - pad) / st) * st; max = Math.ceil((Math.max(...ext) + pad) / st) * st;
  }
  const y = (v) => YT + ((max - v) / (max - min || 1)) * (YB - YT);
  const cx = (i) => X0 + i * slot + slot / 2;
  const fmt = (v) => (c.type === 'bar' ? Math.round(v) + (c.unit || '') : '%' + num(v, 1));
  let body = '';
  const pts = [];
  c.values.forEach((v, i) => {
    if (v == null) return;
    const last = i === n - 1;
    if (c.type === 'bar') {
      const w = slot * 0.62, top = Math.min(y(v), y(0)), h = Math.max(1.5, Math.abs(y(v) - y(0)));
      body += `<rect x="${(cx(i) - w / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${last ? NAVY : v < 0 ? '#E89A8E' : '#9DB3EE'}"/>`;
    } else {
      pts.push(`${cx(i).toFixed(1)},${y(v).toFixed(1)}`);
      body += `<circle cx="${cx(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${last ? 4.5 : 2.5}" fill="${last ? NAVY : BLUE}"/>`;
    }
  });
  if (hasCons) {
    const lastI = c.values.map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
    const xc = cx(n), yc = y(c.next_cons);
    const lv = c.values[lastI];
    if (c.type === 'bar') {
      const w = slot * 0.62, top = Math.min(yc, y(0)), h = Math.max(1.5, Math.abs(yc - y(0)));
      body += `<rect x="${(xc - w / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="none" stroke="${NAVY}" stroke-dasharray="3 2"/>`;
    } else if (lastI >= 0) {
      body += `<line x1="${cx(lastI).toFixed(1)}" y1="${y(lv).toFixed(1)}" x2="${xc.toFixed(1)}" y2="${yc.toFixed(1)}" stroke="${BLUE}" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="${xc.toFixed(1)}" cy="${yc.toFixed(1)}" r="4.5" fill="#fff" stroke="${BLUE}" stroke-width="2"/>`;
    }
    body += `<text x="${xc.toFixed(1)}" y="${(Math.min(yc, y(lv ?? c.next_cons)) - 9).toFixed(1)}" text-anchor="middle" style="font-size:9.5px;fill:${NAVY}">bekl.</text>`;
  }
  if (pts.length) body = `<polyline fill="none" stroke="${BLUE}" stroke-width="2.5" points="${pts.join(' ')}"/>` + body;
  const base = c.type === 'bar' ? y(0) : YB;
  const target = c.target != null
    ? `<line x1="${X0 - 4}" y1="${y(c.target).toFixed(1)}" x2="${X1}" y2="${y(c.target).toFixed(1)}" stroke="#0B7A47" stroke-dasharray="4 3"/>
       <text x="${X1}" y="${(y(c.target) - 4).toFixed(1)}" text-anchor="end" style="fill:#0B7A47;font-size:10px">${esc(c.target_label || '')}</text>` : '';
  const xi = [0, Math.floor((n - 1) / 2), n - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}, son ${n} ay. Son değer ${esc(c.last)}.${hasCons ? ` Sıradaki açıklamada beklenti ${esc(c.next_cons)}.` : ''}">
    <line x1="${X0 - 4}" y1="${base.toFixed(1)}" x2="${X1}" y2="${base.toFixed(1)}" stroke="${AXIS}"/>
    <text x="${X0 - 6}" y="${YT + 4}" text-anchor="end" style="font-size:10px">${esc(fmt(max))}</text>
    <text x="${X0 - 6}" y="${(base + 3).toFixed(1)}" text-anchor="end" style="font-size:10px">${esc(c.type === 'bar' ? '0' : fmt(min))}</text>
    ${target}${body}
    ${xi.map((i) => `<text x="${cx(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" style="font-size:10px">${esc(c.labels[i] || '')}</text>`).join('')}
  </svg>`;
}

// ABD verim eğrisi: bugün vs 1 ay önce
export function yieldCurve(curve) {
  const W = 640, H = 300, L = 50, R = 20, T = 20, B = 34;
  const all = curve.flatMap((c) => [c.now, c.m1]);
  const st = 0.5;
  const lo = Math.floor(Math.min(...all) / st) * st, hi = Math.ceil(Math.max(...all) / st) * st;
  const x = (i) => L + 20 + (i * (W - L - R - 40)) / (curve.length - 1);
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  let grid = '';
  for (let v = lo; v <= hi + 0.001; v += st) grid += `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${W - R}" y2="${y(v).toFixed(1)}" stroke="${GRID}"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">%${num(v, 1)}</text>`;
  const line = (k) => curve.map((c, i) => `${x(i).toFixed(1)},${y(c[k]).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="ABD verim eğrisi, bugün ve bir ay önce.">
    ${grid}
    <polyline fill="none" stroke="#8A90A0" stroke-width="2" stroke-dasharray="5 4" points="${line('m1')}"/>
    <polyline fill="none" stroke="${BLUE}" stroke-width="2.5" points="${line('now')}"/>
    ${curve.map((c, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(c.now).toFixed(1)}" r="3.5" fill="${BLUE}"/><text x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(c.tenor)}</text>`).join('')}
  </svg>`;
}

// Türkiye tahvil eğrisi + politika faizi çizgisi
export function bondCurve(bonds, policy) {
  const W = 560, H = 190, L = 20, R = 20;
  const vals = [...bonds.map((b) => b.v), policy];
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const y = (v) => 24 + ((hi - v) / (hi - lo)) * 110;
  const x = (i) => L + 40 + (i * (W - L - R - 80)) / Math.max(1, bonds.length - 1);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Türkiye tahvil faizleri ve politika faizi.">
    <line x1="${L}" y1="${y(policy).toFixed(1)}" x2="${W - R}" y2="${y(policy).toFixed(1)}" stroke="#8A5A00" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text class="lbl halo" x="${L}" y="${(y(policy) - 6).toFixed(1)}" text-anchor="start" style="fill:#8A5A00">Politika faizi %${num(policy, 0)}</text>
    <polyline fill="none" stroke="${BLUE}" stroke-width="2.5" points="${bonds.map((b, i) => `${x(i).toFixed(1)},${y(b.v).toFixed(1)}`).join(' ')}"/>
    ${bonds.map((b, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(b.v).toFixed(1)}" r="5" fill="${NAVY}"/>
      <text x="${x(i).toFixed(1)}" y="${(y(b.v) - 12).toFixed(1)}" text-anchor="middle" style="fill:#16181D;font-size:12px;font-weight:500">%${num(b.v, 2)}</text>
      <text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.tenor)}</text>`).join('')}
  </svg>`;
}

// Korku & Açgözlülük göstergesi
export function gauge(v) {
  const cx = 120, cy = 120, R = 98;
  const pt = (p) => { const a = Math.PI * (1 - p / 100); return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
  const arc = (a, b, color) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="18"/>`; };
  const na = Math.PI * (1 - v / 100), NL = 78;
  return `<svg class="chart" viewBox="0 0 240 142" role="img" aria-label="Korku ve Açgözlülük endeksi ${v}." style="max-width:300px;margin:0 auto">
    ${arc(0, 24.5, '#B42318')}${arc(25.5, 44.5, '#E8915C')}${arc(45.5, 55, '#C9CCD4')}${arc(56, 75, '#8BC48A')}${arc(76, 100, '#2F7D3A')}
    <line x1="${cx}" y1="${cy}" x2="${(cx + NL * Math.cos(na)).toFixed(1)}" y2="${(cy - NL * Math.sin(na)).toFixed(1)}" stroke="#16181D" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#16181D"/>
    <text x="${cx}" y="98" text-anchor="middle" style="font-size:30px;font-weight:500;fill:#16181D">${v}</text>
    <text x="22" y="138" text-anchor="middle" style="font-size:10px">0</text>
    <text x="218" y="138" text-anchor="middle" style="font-size:10px">100</text>
  </svg>`;
}
export function fngLabel(v) {
  if (v < 25) return ['Aşırı korku', '#B42318'];
  if (v < 45) return ['Korku', '#C2571A'];
  if (v <= 55) return ['Nötr', '#5B6170'];
  if (v <= 75) return ['Açgözlülük', '#3F7D3A'];
  return ['Aşırı açgözlülük', '#2F7D3A'];
}

// Bitcoin seviye haritası. Etiketler çakışmasın diye satırlara otomatik dağıtılır.
export function levelMap(lv) {
  const W = 640, X0 = 20, X1 = 620, BAR = 72;
  const [LO, HI] = lv.range;
  const px = (p) => X0 + ((p - LO) / (HI - LO)) * (X1 - X0);
  const color = { past: '#8A90A0', support: '#0B7A47', now: '#16181D', resistance: '#B42318', ref: '#8A5A00', target: '#1F4FD1' };
  // satırlar: 0 üst, 1 alt, 2 üst-üst, 3 alt-alt
  const rows = [[], [], [], []];
  const MIN_GAP = 60;
  const items = [...lv.items].sort((a, b) => a.price - b.price).map((it) => {
    const x = px(it.price);
    const pref = { now: 1, ref: 3, past: 1 }[it.kind] ?? 0;
    let r = pref;
    const order = [pref, ...[0, 1, 3, 2].filter((x) => x !== pref)];
    for (const cand of order) { if (rows[cand].every((ox) => Math.abs(ox - x) >= MIN_GAP)) { r = cand; break; } }
    rows[r].push(x);
    return { ...it, x, r };
  });
  const used = { top2: rows[2].length > 0, bot2: rows[3].length > 0 };
  const off = used.top2 ? 30 : 0;
  const H = 150 + off + (used.bot2 ? 30 : 0);
  const by = BAR + off;
  const geo = {
    0: { y1: by - 24, y2: by + 14, t1: by - 32, t2: by - 46 },
    1: { y1: by - 4, y2: by + 34, t1: by + 52, t2: by + 66 },
    2: { y1: by - 54, y2: by + 14, t1: by - 62, t2: by - 76 },
    3: { y1: by - 4, y2: by + 64, t1: by + 82, t2: by + 96 },
  };
  const zone = lv.zone ? `<rect x="${px(lv.zone[0]).toFixed(1)}" y="${by}" width="${(px(lv.zone[1]) - px(lv.zone[0])).toFixed(1)}" height="10" fill="#C9D5F6"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bitcoin seviye haritası: ${esc(items.map((i) => i.name + ' ' + i.label).join(', '))}.">
    <rect x="${X0}" y="${by}" width="${X1 - X0}" height="10" rx="5" fill="${GRID}"/>${zone}
    ${items.map((it) => { const g = geo[it.r], c = color[it.kind] || '#5B6170'; return `<line x1="${it.x.toFixed(1)}" y1="${g.y1}" x2="${it.x.toFixed(1)}" y2="${g.y2}" stroke="${c}" stroke-width="${it.kind === 'now' ? 4 : 2}"/>`; }).join('')}
    ${items.map((it) => { const g = geo[it.r], c = color[it.kind] || '#5B6170'; return `
      <text class="lbl halo" x="${it.x.toFixed(1)}" y="${g.t1}" text-anchor="middle" style="fill:${c};font-size:12px">${esc(it.name)}</text>
      <text class="halo" x="${it.x.toFixed(1)}" y="${g.t2}" text-anchor="middle">${esc(it.label)}</text>`; }).join('')}
  </svg>`;
}

// Basit dikey bar (ETF akışları gibi, pozitif/negatif)
export function flowBars(list) {
  // HTML çizim: genişlik ne olursa olsun yazı boyu sabit kalır.
  // Gün etiketli olmayan kalemler (ör. "Eylül" aylık toplamı) ayrı kutuda; günlük çubuklar kendi aralarında ölçeklenir.
  const totals = list.filter((d) => !/\d/.test(d.label)), days = list.filter((d) => /\d/.test(d.label));
  // yukarı ve aşağı alan, en büyük giriş ve çıkışa göre bölünür; toplam 180 px
  const mp = Math.max(0, ...days.map((d) => d.v)), mn = Math.max(0, ...days.map((d) => -d.v));
  const tot = mp + mn || 1, upH = (mp / tot) * 100, dnH = (mn / tot) * 100;
  const col = (d, i) => {
    const h = Math.max(2, (Math.abs(d.v) / tot) * 180);
    const fill = d.v < 0 ? '#E89A8E' : i === days.length - 1 ? '#163A9C' : '#9DB3EE';
    return `<div class="fb-col">
      <div class="fb-up">${d.v >= 0 ? `<span class="fb-t">${esc(d.text)}</span><i style="height:${h}px;background:${fill}"></i>` : ''}</div>
      <div class="fb-dn">${d.v < 0 ? `<i style="height:${h}px;background:${fill}"></i><span class="fb-t down">${esc(d.text)}</span>` : ''}</div>
      <span class="fb-l">${esc(d.label)}</span></div>`;
  };
  return `<div class="fb" role="img" aria-label="${esc(list.map((d) => d.label + ' ' + d.text).join(', '))}">
    ${totals.map((d) => `<div class="fb-total"><span class="xs muted">${esc(d.label)} toplamı</span><b class="mono ${d.v < 0 ? 'down' : 'up'}">${esc(d.text)}</b></div>`).join('')}
    <div class="fb-days" style="--up:${upH};--dn:${dnH}">${days.map(col).join('')}</div>
  </div>`;
}

// Yatay sapma çubukları (sektörler): HTML
export function hbars(list, scale) {
  const sc = scale || Math.max(2, ...list.map((s) => Math.abs(s.chg)));
  return list.map((s) => {
    const w = Math.min(50, (Math.abs(s.chg) / sc) * 50);
    const col = s.chg >= 0 ? '#0B7A47' : '#B42318';
    return `<div class="hbar"><span>${esc(s.name)}</span>
      <div class="track"><span class="fill" style="left:${s.chg >= 0 ? 50 : 50 - w}%;width:${w}%;background:${col}"></span></div>
      <span class="val" style="color:${col}">${esc(signed(s.chg))}</span></div>`;
  }).join('');
}

// S&P sektör ısı haritası kareleri: HTML
export function sectorHeat(list) {
  const bg = (v) => (v >= 1 ? '#0B6B3F' : v >= 0 ? '#2F8A5B' : v > -1 ? '#C2493E' : '#9E2A20');
  return `<div class="heat">${list.map((s) => `<div style="background:${bg(s.chg)}"><b>${esc(s.name)}</b><span>${esc(signed(s.chg))}</span></div>`).join('')}</div>`;
}
