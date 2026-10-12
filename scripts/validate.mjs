// Veri dosyalarını kontrol eder. Rutin her commit'ten önce çalıştırır:
//   node scripts/validate.mjs            -> latest.json'un gösterdiği gün
//   node scripts/validate.mjs 2026-10-06 -> belirli bir gün
// Hata varsa çıkış kodu 1 olur ve hatalar listelenir.
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const read = (p) => {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { errors.push(`${p}: okunamadı/JSON hatalı (${e.message})`); return null; }
};
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v) => v === null || isNum(v);
const TONES = ['up', 'down', 'flat', 'good', 'bad'];

function need(obj, path, check, what) {
  const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (!check(val)) errors.push(`${path}: ${what}`);
  return val;
}
const arr = (min = 1) => (v) => Array.isArray(v) && v.length >= min;
function each(list, path, fn) { (list || []).forEach((item, i) => fn(item, `${path}[${i}]`)); }
function card(c, p) {
  if (!isStr(c?.label) && !isStr(c?.code)) errors.push(`${p}.label boş`);
  if (!isStr(c?.value)) errors.push(`${p}.value boş`);
  if (c?.tone && !TONES.includes(c.tone)) errors.push(`${p}.tone geçersiz: ${c.tone}`);
}

const latest = read('data/latest.json');
const date = process.argv[2] || latest?.date;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) errors.push('latest.json: date YYYY-MM-DD olmalı');

const index = read('data/daily/index.json');
if (index && !index.includes(date)) errors.push(`data/daily/index.json içinde ${date} yok`);

const file = `data/daily/${date}.json`;
const D = existsSync(file) ? read(file) : (errors.push(`${file} yok`), null);
const G = read('data/sozluk.json');

if (D) {
  if (D.date !== date) errors.push(`date alanı (${D.date}) dosya adıyla (${date}) aynı değil`);
  need(D, 'tickers', arr(5), 'en az 5 gösterge olmalı');
  each(D.tickers, 'tickers', (t, p) => { if (!isStr(t.name) || !isStr(t.value)) errors.push(`${p} eksik`); });
  need(D, 'summary.headline', isStr, 'başlık boş');
  need(D, 'summary.lede', isStr, 'özet cümlesi boş');
  need(D, 'summary.paragraphs', arr(1), 'paragraf yok');
  need(D, 's1.mood', (v) => ['risk_off', 'temkinli', 'risk_on'].includes(v), 'risk_off | temkinli | risk_on olmalı');
  need(D, 's1.changes', arr(1), 'boş');
  each(D.s1?.changes, 's1.changes', (c, p) => { if (!['same', 'good', 'bad', 'new'].includes(c.tone)) errors.push(`${p}.tone same|good|bad|new olmalı`); });
  need(D, 's1.themes', arr(3), '3 tema olmalı');
  need(D, 's2.paragraphs', arr(1), 'boş');
  need(D, 's2.sectors', arr(5), 'sektör listesi eksik');
  each(D.s2?.sectors, 's2.sectors', (s, p) => { if (!isNum(s.chg)) errors.push(`${p}.chg sayı olmalı`); });
  for (const s of ['s3', 's4', 's5']) { need(D, `${s}.paragraphs`, arr(1), 'boş'); each(D[s]?.cards, `${s}.cards`, card); }
  need(D, 's6.paragraph', isStr, 'boş');
  need(D, 's6.today', arr(1), 'boş');
  need(D, 's6.week', arr(1), 'boş');
  each(D.s6?.today, 's6.today', (e, p) => { if (!/^\d{2}:\d{2}$/.test(e.time || '')) errors.push(`${p}.time SS:DD olmalı`); });
  for (const k of ['likely', 'alternative', 'signal']) need(D, `s7.${k}`, isStr, 'boş');
  need(D, 's8.title', isStr, 'boş');
  // Haber etkisi (isteğe bağlı): her piyasadan en fazla 2, toplam en fazla 6
  if (D.impact != null) {
    const MK = ['ABD', 'Avrupa-Asya', 'Emtia ve döviz', 'Türkiye', 'Kripto'];
    if (!Array.isArray(D.impact) || D.impact.length > 6) errors.push('impact: en fazla 6 olay içeren liste olmalı');
    const per = {};
    each(D.impact, 'impact', (e, p) => {
      if (!MK.includes(e.market)) errors.push(`${p}.market şunlardan biri olmalı: ${MK.join(', ')}`);
      per[e.market] = (per[e.market] || 0) + 1;
      if (!isStr(e.title)) errors.push(`${p}.title boş`);
      if (!Array.isArray(e.groups) || e.groups.length < 2) errors.push(`${p}.groups en az 2 grup olmalı`);
      each(e.groups, `${p}.groups`, (g, q) => {
        if (!isStr(g.name)) errors.push(`${q}.name boş`);
        if (!['up', 'down', 'flat'].includes(g.tone)) errors.push(`${q}.tone up|down|flat olmalı`);
        if (!isStr(g.question)) errors.push(`${q}.question boş`);
        if (!isStr(g.counter)) errors.push(`${q}.counter (ters okuma) boş`);
      });
    });
    for (const [m, n] of Object.entries(per)) if (n > 2) errors.push(`impact: ${m} için en fazla 2 olay`);
  }
  need(D, 's8.paragraphs', arr(1), 'boş');
  if (D.s8?.concept && G && !G.concepts[D.s8.concept]) errors.push(`s8.concept "${D.s8.concept}" sözlükte yok (data/sozluk.json'a ekle)`);
  need(D, 'news', arr(3), 'en az 3 haber');

  // neden-sonuç zincirleri
  for (const k of ['s2', 's3', 's4', 's5']) need(D, `${k}.chain`, (v) => Array.isArray(v) && v.length >= 3 && v.length <= 6 && v.every(isStr), '3-6 adımlı metin dizisi olmalı');
  // NQ bölümü
  need(D, 'nq.bias', (v) => ['engel', 'notr', 'destek'].includes(v), 'engel | notr | destek olmalı');
  need(D, 'nq.paragraphs', arr(1), 'boş');
  need(D, 'nq.tailwinds', arr(1), 'boş');
  need(D, 'nq.headwinds', arr(1), 'boş');
  need(D, 'nq.vol_times', arr(1), 'boş');
  need(D, 'nq.earnings', arr(1), 'NQ devlerinin bilanço takvimi boş');
  each(D.nq?.earnings, 'nq.earnings', (e, p) => {
    if (!isStr(e.ticker) || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errors.push(`${p} ticker/date (YYYY-MM-DD) eksik`);
    if (!['before', 'after'].includes(e.time)) errors.push(`${p}.time before|after olmalı`);
  });
  // iki görüş
  need(D, 's7.views.topic', isStr, 'boş');
  need(D, 's7.views.bull', arr(1), 'en az 1 boğa görüşü');
  need(D, 's7.views.bear', arr(1), 'en az 1 ayı görüşü');
  for (const side of ['bull', 'bear']) each(D.s7?.views?.[side], `s7.views.${side}`, (x, p) => { if (!isStr(x.text)) errors.push(`${p}.text boş`); });

  // faizler
  need(D, 'faizler.curve', arr(4), 'eğri eksik');
  each(D.faizler?.curve, 'faizler.curve', (c, p) => { if (!isNum(c.now) || !isNum(c.m1)) errors.push(`${p} now/m1 sayı olmalı`); });
  each(D.faizler?.kpis, 'faizler.kpis', card);
  need(D, 'faizler.fed.rate', isStr, 'boş');
  need(D, 'faizler.nq_note', isStr, 'NQ için anlamı boş');

  // kuresel
  need(D, 'kuresel.groups', arr(1), 'boş');
  each(D.kuresel?.groups, 'kuresel.groups', (g, p) => {
    if (!['pct', 'bp'].includes(g.unit)) errors.push(`${p}.unit pct|bp olmalı`);
    each(g.rows, `${p}.rows`, (r, q) => { for (const k of ['d1', 'w1', 'm1', 'ytd']) if (!numOrNull(r[k])) errors.push(`${q}.${k} sayı ya da null olmalı`); });
  });

  // turkiye
  const T = D.turkiye;
  each(T?.kpis, 'turkiye.kpis', card);
  need(D, 'turkiye.reading.paragraphs', arr(1), 'boş');
  need(D, 'turkiye.bist.points', arr(5), 'BIST serisi eksik');
  each(T?.bist?.points, 'turkiye.bist.points', (x, p) => { if (!isStr(x.d) || !isNum(x.v)) errors.push(`${p} {d,v} olmalı`); });
  each(T?.sectors, 'turkiye.sectors', (s, p) => { if (!isNum(s.chg)) errors.push(`${p}.chg sayı olmalı`); });
  if (T?.cpi && T.cpi.labels?.length !== T.cpi.values?.length) errors.push('turkiye.cpi labels ve values aynı uzunlukta olmalı');
  need(D, 'turkiye.rates.policy', isNum, 'sayı olmalı');
  each(T?.rates?.bonds, 'turkiye.rates.bonds', (b, p) => { if (!isNum(b.v)) errors.push(`${p}.v sayı olmalı`); });

  // kripto
  const K = D.kripto;
  each(K?.kpis, 'kripto.kpis', card);
  need(D, 'kripto.fng.now', (v) => isNum(v) && v >= 0 && v <= 100, '0-100 arası sayı');
  need(D, 'kripto.dominance.btc', isNum, 'sayı olmalı');
  need(D, 'kripto.dominance.usdt', isNum, 'sayı olmalı');
  need(D, 'kripto.levels.range', (v) => Array.isArray(v) && v.length === 2 && v.every(isNum), '[alt, üst] olmalı');
  each(K?.levels?.items, 'kripto.levels.items', (it, p) => {
    if (!isNum(it.price)) errors.push(`${p}.price sayı olmalı`);
    else if (K.levels.range && (it.price < K.levels.range[0] || it.price > K.levels.range[1])) errors.push(`${p}.price range dışında`);
  });
  each(K?.etf, 'kripto.etf', (e, p) => { if (!isNum(e.v)) errors.push(`${p}.v sayı olmalı`); });
  each(K?.coins, 'kripto.coins', (c, p) => { for (const k of ['d1', 'w1', 'm1', 'm3', 'ytd', 'y1']) if (!numOrNull(c[k])) errors.push(`${p}.${k} sayı ya da null olmalı`); });

  // makro
  const M = D.makro;
  need(D, 'makro.surprises', arr(1), 'boş');
  need(D, 'makro.countries', (v) => v && typeof v === 'object' && Object.keys(v).length > 0, 'ülke yok');
  for (const [name, C] of Object.entries(M?.countries || {})) {
    each(C.charts, `makro.countries.${name}.charts`, (c, p) => {
      if (!['bar', 'line'].includes(c.type)) errors.push(`${p}.type bar|line olmalı`);
      if (c.labels?.length !== c.values?.length) errors.push(`${p} labels ve values aynı uzunlukta olmalı`);
      if (!(c.values || []).every(numOrNull)) errors.push(`${p}.values sayı ya da null olmalı`);
    });
  }
  need(D, 'makro.upcoming', arr(1), 'boş');

  // [[terim|metin]] bağlantıları sözlükte olmalı
  const text = JSON.stringify(D);
  for (const m of text.matchAll(/\[\[([a-z0-9_-]+)\|/g)) if (G && !G.concepts[m[1]]) errors.push(`[[${m[1]}|...]] terimi sözlükte yok`);
  // Doldurulmamış yer tutucular
  for (const m of text.matchAll(/\[(routine|tarih|son|dönem|bekl\.|önc\.|güncel|toplantı)[^\]]*\]/gi)) errors.push(`Yer tutucu kalmış: ${m[0]}`);
}

if (G) {
  for (const [k, c] of Object.entries(G.concepts || {})) {
    for (const f of ['name', 'cat', 'def', 'analogy', 'rule']) if (!isStr(c[f])) errors.push(`sozluk.${k}.${f} boş`);
    if (!Array.isArray(c.chain) || !c.chain.length) errors.push(`sozluk.${k}.chain dizi olmalı`);
    if (!G.categories.includes(c.cat)) errors.push(`sozluk.${k}.cat "${c.cat}" categories listesinde yok`);
    for (const r of c.related || []) if (!G.concepts[r]) errors.push(`sozluk.${k}.related "${r}" yok`);
  }
}

// NQ devleri şirket kartları
const CO = read('data/companies.json');
if (CO) {
  for (const [tk, c] of Object.entries(CO.companies || {})) {
    for (const f of ['name', 'about']) if (!isStr(c[f])) errors.push(`companies.${tk}.${f} boş`);
    if (c.last) for (const k of ['eps', 'rev']) if (!isNum(c.last[k]?.act) || !isNum(c.last[k]?.est)) errors.push(`companies.${tk}.last.${k} act/est sayı olmalı`);
    if (c.next && !/^\d{4}-\d{2}-\d{2}$/.test(c.next.date || '')) errors.push(`companies.${tk}.next.date YYYY-MM-DD olmalı`);
    for (const k of ['eps_est', 'rev_est']) if (c.next && c.next[k] !== undefined && !numOrNull(c.next[k])) errors.push(`companies.${tk}.next.${k} sayı ya da null olmalı`);
  }
  for (const e of D?.nq?.earnings || []) if (!CO.companies?.[e.ticker]) errors.push(`nq.earnings ${e.ticker} için data/companies.json kaydı yok`);
}
if (D?.makro?.analysis) {
  const A = D.makro.analysis;
  if (!isStr(A.headline) || !Array.isArray(A.paragraphs) || A.paragraphs.length < 2) errors.push('makro.analysis headline ve en az 2 paragraf olmalı');
  each(A.effects, 'makro.analysis.effects', (e, p) => { if (!['up', 'down', 'flat'].includes(e.dir)) errors.push(`${p}.dir up|down|flat olmalı`); });
  const R = D.makro.regime;
  if (R != null) each(R.items, 'makro.regime.items', (x, p) => {
    if (!isStr(x.country)) errors.push(`${p}.country boş`);
    if (!['up', 'down'].includes(x.growth) || !['up', 'down'].includes(x.inflation)) errors.push(`${p}.growth/inflation up|down olmalı`);
  });
  each(D.makro.upcoming, 'makro.upcoming', (u, p) => {
    if (!/^\d{1,2} (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara)\b/.test(u.when || '')) errors.push(`${p}.when "13 Eki 15:30" biçiminde olmalı`);
    if (u.scen != null && (!Array.isArray(u.scen) || u.scen.some((x) => !isStr(x.if) || !isStr(x.then)))) errors.push(`${p}.scen [{if, then}] olmalı`);
  });
  each(D.makro.countries?.ABD?.charts, 'makro.countries.ABD.charts', (c, p) => { if (c.next_cons != null && typeof c.next_cons !== 'number') errors.push(`${p}.next_cons sayı olmalı`); });
} else if (D) errors.push('makro.analysis eksik');

const weeks = read('data/weekly/index.json');
if (latest?.week) {
  if (weeks && !weeks.some((w) => w.id === latest.week)) errors.push(`weekly/index.json içinde ${latest.week} yok`);
  if (!existsSync(`data/weekly/${latest.week}.json`)) errors.push(`data/weekly/${latest.week}.json yok`);
  else {
    const W = read(`data/weekly/${latest.week}.json`);
    if (W) for (const k of ['range', 'headline', 'lede']) if (!isStr(W[k])) errors.push(`weekly.${k} boş`);
    each(W?.kpis, 'weekly.kpis', (k, p) => { if (!isNum(k.chg)) errors.push(`${p}.chg sayı olmalı`); });
    if (W?.deep) {
      if (!isStr(W.deep.title) || !Array.isArray(W.deep.paragraphs) || !W.deep.paragraphs.length) errors.push('weekly.deep title/paragraphs eksik');
      each(W.deep.long_term?.assets, 'weekly.deep.long_term.assets', (a, p) => { if (!['olumlu', 'notr', 'olumsuz'].includes(a.view)) errors.push(`${p}.view olumlu|notr|olumsuz olmalı`); });
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} hata:\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log(`✓ ${date} verisi geçerli`);
