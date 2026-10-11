// ABD verisi: Nasdaq 100 şirketlerinin finansalları, SEC açıklamaları, yönetici işlemleri, büyük fonların 13F portföyleri, kapanış fiyatları.
// tetik: 2
// Kaynaklar: SEC EDGAR (kamu verisi), Wikipedia (endeks listesi), CNBC (fiyat, deneme aşaması).
// Çalıştır: node scripts/us/build.mjs [daily|all]   (GitHub Actions üzerinde çalışır)
import fs from 'node:fs/promises';
import path from 'node:path';
import { metrics } from './metrics.mjs';

const MODE = process.argv[2] || 'daily';
const UA = 'PiyasaPaneli codegridteknoloji@gmail.com';
const OUT = 'data/us';
const CO = `${OUT}/co`;
const log = [];
const L = (...a) => { const s = a.join(' '); console.log(s); log.push(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

let last = 0;
async function get(url, type = 'json', headers = {}) {
  const isSec = /sec\.gov/.test(url);
  if (isSec) { const w = last + 140 - Date.now(); if (w > 0) await sleep(w); last = Date.now(); }
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : '*/*', ...headers } });
      if (r.ok) return type === 'json' ? await r.json() : await r.text();
      if (r.status === 404) throw Object.assign(new Error(`404 ${url}`), { code: 404 });
      if (r.status === 429 || r.status >= 500 || r.status === 403) { await sleep(1500 * (i + 1)); continue; }
      throw new Error(`${r.status} ${url}`);
    } catch (e) { if (e.code === 404 || i === 3) throw e; await sleep(1000 * (i + 1)); }
  }
  throw new Error(`deneme bitti ${url}`);
}
const readJSON = async (p, d = null) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return d; } };
const writeJSON = (p, o) => fs.writeFile(p, JSON.stringify(o));
const pad = (cik) => String(cik).padStart(10, '0');
const acc0 = (a) => a.replace(/-/g, '');

/* ---------------- 1. Endeks listesi ---------------- */
const FALLBACK = 'AAPL MSFT NVDA AMZN META AVGO GOOGL TSLA COST NFLX PLTR TMUS ASML CSCO AMD AZN LIN ISRG INTU PEP TXN BKNG QCOM ADBE AMGN HON AMAT PDD GILD CMCSA PANW ADP MU APP LRCX VRTX ADI KLAC MELI SBUX INTC CRWD CEG MSTR ABNB DASH ORLY CTAS SNPS MDLZ FTNT MAR REGN CDNS PYPL ADSK WDAY MNST CSX AXON CHTR ROP AEP NXPI PCAR FAST PAYX TEAM KDP ZS EXC IDXX DDOG CPRT VRSK FANG CCEP ROST XEL TTWO LULU EA KHC GEHC CTSH BKR TTD ODFL MCHP CSGP CDW DXCM WBD BIIB ON GFS ARM SHOP'.split(' ');
// SEC adları çoğu zaman büyük harf: "ADVANCED MICRO DEVICES INC" -> "Advanced Micro Devices"
const KEEP = new Set(['ASML', 'NXP', 'PDD', 'CSX', 'AMD', 'KLA', 'IDEXX', 'CDW', 'GE', 'ON', 'AEP', 'ADP', 'NVIDIA', 'PACCAR', 'II', 'III', 'ARM', 'MSCI', 'AT&T']);
const STRIP = /[,.]?\s+(INC|CORP|CORPORATION|CO|COMPANY|LTD|PLC|N\.?V|S\.?A|HOLDINGS?|HLDG|GROUP|INCORPORATED|SE|AG)\.?(?=\s|$|\/)/gi;
function prettyName(n) {
  let s = String(n || '').replace(/\/[A-Z]{2,3}\/?$/, '').replace(STRIP, '').replace(/[,.\s]+$/, '').trim();
  if (s === s.toUpperCase()) s = s.split(/\s+/).map((w) => (KEEP.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
  return s.replace(/\bCom$/, '').trim();
}
// Wikipedia sektörü gelmezse SEC'in SIC kodundan kaba sektör
const SECTOR_OVR = { GOOGL: 'İletişim', GOOG: 'İletişim', META: 'İletişim', NFLX: 'İletişim', WBD: 'İletişim', EA: 'İletişim', TTWO: 'İletişim', AMZN: 'Perakende', MELI: 'Perakende', PDD: 'Perakende', TSLA: 'Otomotiv', ABNB: 'Seyahat ve eğlence', BKNG: 'Seyahat ve eğlence', MAR: 'Seyahat ve eğlence', DASH: 'Tüketici hizmetleri', PAYX: 'Teknoloji', ADP: 'Teknoloji', MSTR: 'Teknoloji', SPCX: 'Havacılık ve uzay', RKLB: 'Havacılık ve uzay' };
function sectorOf(sic, t) {
  if (SECTOR_OVR[t]) return SECTOR_OVR[t];
  const n = +sic; if (!n) return '';
  const r = [[3674, 3674, 'Yarı iletken'], [3559, 3559, 'Yarı iletken'], [3825, 3827, 'Yarı iletken'], [7370, 7379, 'Teknoloji'], [3570, 3579, 'Teknoloji'], [3600, 3699, 'Teknoloji'], [4800, 4899, 'İletişim'], [2830, 2836, 'Sağlık'], [3840, 3851, 'Sağlık'], [8000, 8099, 'Sağlık'], [2000, 2099, 'Gıda ve içecek'], [4900, 4999, 'Enerji ve kamu hizmeti'], [1300, 1399, 'Enerji ve kamu hizmeti'], [2900, 2999, 'Enerji ve kamu hizmeti'], [3710, 3716, 'Otomotiv'], [3720, 3769, 'Havacılık ve uzay'], [5000, 5999, 'Perakende'], [6000, 6799, 'Finans'], [7000, 7999, 'Tüketici hizmetleri'], [4000, 4799, 'Ulaştırma']];
  return r.find(([a, b]) => n >= a && n <= b)?.[2] || 'Sanayi';
}
const SECTOR_TR = { 'Information Technology': 'Teknoloji', 'Communication Services': 'İletişim', 'Consumer Discretionary': 'Tüketici (döngüsel)', 'Consumer Staples': 'Temel tüketim', 'Health Care': 'Sağlık', Industrials: 'Sanayi', Utilities: 'Kamu hizmetleri', Financials: 'Finans', Energy: 'Enerji', Materials: 'Malzeme', 'Real Estate': 'Gayrimenkul' };
const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#160;|&nbsp;/g, ' ').replace(/\[\d+\]/g, '').trim();
async function nasdaq100() {
  // 1) Wikipedia tablosu (GICS sektörüyle)
  try {
    const html = await get('https://en.wikipedia.org/wiki/Nasdaq-100', 'text');
    const i = html.search(/<table[^>]*id="constituents"/);
    const tbl = i >= 0 ? html.slice(i, html.indexOf('</table>', i)) : '';
    const out = new Map();
    for (const tr of tbl.split(/<tr[\s>]/).slice(1)) {
      const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => strip(m[1]));
      const k = cells.findIndex((c) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(c));
      if (k < 0) continue;
      const sec = cells.slice(k + 1).find((c) => SECTOR_TR[c]) || '';
      out.set(cells[k], { t: cells[k], sector: SECTOR_TR[sec] || '' });
    }
    if (out.size >= 95 && out.size <= 110) { L(`Wikipedia: ${out.size} şirket`); return [...out.values()]; }
    L(`Wikipedia tablosu beklenmedik (${out.size})`);
  } catch (e) { L('Wikipedia hatası:', e.message); }
  // 2) Nasdaq'ın kendi listesi
  try {
    const j = await get('https://api.nasdaq.com/api/quote/list-type/nasdaq100', 'json', { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36' });
    const rows = j?.data?.data?.rows || [];
    if (rows.length >= 95) { L(`Nasdaq: ${rows.length} şirket`); return rows.map((r) => ({ t: r.symbol, sector: '' })); }
  } catch (e) { L('Nasdaq listesi hatası:', e.message); }
  L('Yedek liste kullanılıyor');
  return FALLBACK.map((t) => ({ t, sector: '' }));
}

/* ---------------- 2. Fiyatlar (CNBC, toplu) ---------------- */
const num = (s) => { const n = parseFloat(String(s ?? '').replace(/[,%+$]/g, '')); return Number.isFinite(n) ? n : null; };
function bigNum(s) { if (s == null) return null; const m = String(s).match(/([\d.,]+)\s*([KMBT])?/i); if (!m) return null; const n = parseFloat(m[1].replace(/,/g, '')); return n * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1); }
async function prices(tickers) {
  const out = {};
  for (let i = 0; i < tickers.length; i += 40) {
    const syms = tickers.slice(i, i + 40).map((t) => t.replace('.', '/'));
    try {
      const j = await get(`https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=${encodeURIComponent(syms.join('|'))}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1`);
      const list = j?.FormattedQuoteResult?.FormattedQuote || [];
      if (i === 0 && list[0]) L('CNBC alanları:', Object.keys(list[0]).join(','));
      for (const q of list) {
        const t = String(q.symbol).replace('/', '.');
        out[t] = { price: num(q.last), prev: num(q.previous_day_closing), chg: num(q.change_pct), mcap: bigNum(q.mktcapView), pe: num(q.pe), hi52: num(q.yrhiprice), lo52: num(q.yrloprice), divyld: num(q.dividendyield), time: q.last_time || null };
      }
    } catch (e) { L('CNBC hatası:', e.message); }
  }
  L(`Fiyat: ${Object.keys(out).length} hisse`);
  return out;
}

/* ---------------- 3. Finansallar (XBRL) ---------------- */
const TAGS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'Revenue', 'RegulatedAndUnregulatedOperatingRevenue', 'ElectricUtilityRevenue'],
  cogs: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfServices', 'CostOfSales'],
  gross: ['GrossProfit'],
  rnd: ['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'],
  sga: ['SellingGeneralAndAdministrativeExpense', 'GeneralAndAdministrativeExpense'],
  opinc: ['OperatingIncomeLoss', 'ProfitLossFromOperatingActivities'],
  interest: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'InterestPaidNet'],
  pretax: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments', 'ProfitLossBeforeTax'],
  tax: ['IncomeTaxExpenseBenefit', 'IncomeTaxExpenseContinuingOperations'],
  net: ['NetIncomeLoss', 'ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'],
  eps: ['EarningsPerShareDiluted', 'DilutedEarningsLossPerShare', 'EarningsPerShareBasic'],
  shDil: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'],
  da: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization', 'DepreciationAmortizationAndOther', 'Depreciation'],
  sbc: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'CashFlowsFromUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities', 'PaymentsToAcquireProductiveAssets'],
  acq: ['PaymentsToAcquireBusinessesNetOfCashAcquired', 'PaymentsToAcquireBusinessesGross'],
  buyback: ['PaymentsForRepurchaseOfCommonStock'],
  divPaid: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'],
  dps: ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'],
};
const NO_DERIVE = ['eps', 'dps', 'shDil']; // hisse başı ve ortalama adetler toplanamaz
const INSTANT = {
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'CashAndCashEquivalents'],
  stInv: ['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent'],
  recv: ['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent'],
  inv: ['InventoryNet'],
  curAssets: ['AssetsCurrent'],
  ppe: ['PropertyPlantAndEquipmentNet'],
  goodwill: ['Goodwill'],
  intang: ['IntangibleAssetsNetExcludingGoodwill', 'FiniteLivedIntangibleAssetsNet'],
  assets: ['Assets'],
  payables: ['AccountsPayableCurrent'],
  stDebt: ['DebtCurrent', 'LongTermDebtCurrent', 'ShortTermBorrowings'],
  curLiab: ['LiabilitiesCurrent'],
  debt: ['LongTermDebtNoncurrent', 'LongTermDebt', 'LongTermBorrowings'],
  liab: ['Liabilities'],
  retained: ['RetainedEarningsAccumulatedDeficit'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'Equity'],
};
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
function entries(facts, tags) {
  const all = [];
  for (const tx of ['us-gaap', 'ifrs-full']) for (const t of tags) {
    const units = facts[tx]?.[t]?.units; if (!units) continue;
    const u = units.USD || units['USD/shares'] || Object.values(units)[0];
    for (const e of u || []) all.push({ ...e, tag: t, unit: Object.keys(units).find((k) => units[k] === u) });
  }
  return all;
}
function durSeries(facts, tags, derive = true) {
  const by = new Map();
  for (const e of entries(facts, tags)) {
    if (!e.start || e.val == null) continue;
    const d = days(e.start, e.end); const kind = d > 340 && d < 390 ? 'Y' : d > 80 && d < 100 ? 'Q' : null; if (!kind) continue;
    const k = `${kind}|${e.end}`; const p = by.get(k);
    if (!p || e.filed > p.filed) by.set(k, { kind, start: e.start, end: e.end, val: e.val, filed: e.filed, fy: e.fy, fp: e.fp, unit: e.unit });
  }
  // Nakit akışı gibi kalemler çeyreklik değil yılbaşından bu yana (6 ay, 9 ay) bildirilir: farkından çeyrek çıkar
  const ytd = new Map();
  for (const e of entries(facts, tags)) { if (!e.start || e.val == null) continue; const k = `${e.start}|${e.end}`; const p = ytd.get(k); if (!p || e.filed > p.filed) ytd.set(k, e); }
  if (derive) for (const e of ytd.values()) {
    const d = days(e.start, e.end); if (d < 160 || d > 290) continue;
    if (by.has(`Q|${e.end}`)) continue;
    const prev = [...ytd.values()].filter((x) => x.start === e.start && days(x.end, e.end) > 80 && days(x.end, e.end) < 100)[0];
    if (prev) by.set(`Q|${e.end}`, { kind: 'Q', start: prev.end, end: e.end, val: e.val - prev.val, derived: true, unit: e.unit });
  }
  const Y = [...by.values()].filter((x) => x.kind === 'Y').sort((a, b) => a.end.localeCompare(b.end));
  const Q = [...by.values()].filter((x) => x.kind === 'Q').sort((a, b) => a.end.localeCompare(b.end));
  // Q4 = yıllık − üç çeyrek (çoğu şirket 4. çeyreği ayrı etiketlemiyor)
  if (derive) for (const y of Y) {
    if (Q.some((q) => q.end === y.end)) continue;
    const inYear = Q.filter((q) => q.start >= y.start && q.end < y.end);
    if (inYear.length === 3) Q.push({ kind: 'Q', start: inYear[2].end, end: y.end, val: y.val - inYear.reduce((s, q) => s + q.val, 0), derived: true, unit: y.unit });
  }
  Q.sort((a, b) => a.end.localeCompare(b.end));
  return { Y, Q };
}
function instSeries(facts, tags) {
  const by = new Map();
  for (const e of entries(facts, tags)) { if (e.start || e.val == null) continue; const p = by.get(e.end); if (!p || e.filed > p.filed) by.set(e.end, { end: e.end, val: e.val, filed: e.filed, unit: e.unit }); }
  return [...by.values()].sort((a, b) => a.end.localeCompare(b.end));
}
// Hisse bölünmesi: eski dönemlerin hisse sayısı ve hisse başı rakamları bugünkü adede çevrilir
const SPLITS = [2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 40];
function splitAdjust(rows) {
  for (let i = rows.length - 1; i > 0; i--) {
    const a = rows[i - 1].shDil, b = rows[i].shDil; if (!a || !b) continue;
    const r = b / a, up = SPLITS.find((s) => Math.abs(r / s - 1) < 0.12), down = SPLITS.find((s) => Math.abs(1 / r / s - 1) < 0.12);
    const f = up || (down ? 1 / down : 0); // bölünme ya da birleşme (ters bölünme)
    if (!f) continue;
    for (let j = 0; j < i; j++) { const x = rows[j]; if (x.shDil != null) x.shDil *= f; if (x.eps != null) x.eps /= f; if (x.dps != null) x.dps /= f; }
  }
}
// Avro vb. ile raporlayan şirketler (ASML, Ferrovial...) sitede dolar gösterildiği için bugünkü kurla çevrilir.
// Not: geçmiş yıllar da bugünkü kurla çevrilir; büyüme oranları yerel para birimindeki büyümeyi gösterir.
async function fxRates() {
  const out = {};
  try {
    const j = await get('https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=EUR%3D%7CGBP%3D%7CCNY%3D&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1');
    for (const q of j?.FormattedQuoteResult?.FormattedQuote || []) {
      const v = num(q.last); if (!v) continue;
      if (q.symbol === 'EUR=') out.EUR = v; else if (q.symbol === 'GBP=') out.GBP = v; else if (q.symbol === 'CNY=') out.CNY = 1 / v;   // CNY= yuan/dolar
    }
  } catch (e) { L('Kur hatası:', e.message); }
  L('Kurlar (1 birim = $):', JSON.stringify(out));
  return out;
}
const NON_MONEY = new Set(['end', 'fy', 'shDil', 'revGrowth']);
function toUSD(fin, rate) {
  if (!rate) return fin;                                  // kur yoksa olduğu gibi bırak (sitede para birimi yazar)
  const conv = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' && !NON_MONEY.has(k) ? v * rate : v]));
  return { ...fin, currency: 'USD', currency_orig: fin.currency, fx: rate, annual: fin.annual.map(conv), quarterly: fin.quarterly.map(conv), ttm: conv(fin.ttm), bs: conv(fin.bs) };
}
async function financials(cik) {
  const cf = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(cik)}.json`);
  const F = cf.facts || {};
  const dur = {}; for (const [k, tags] of Object.entries(TAGS)) dur[k] = durSeries(F, tags, !NO_DERIVE.includes(k));
  const inst = {}; for (const [k, tags] of Object.entries(INSTANT)) inst[k] = instSeries(F, tags);
  const sh2 = (F.dei?.EntityCommonStockSharesOutstanding?.units?.shares || []).slice().sort((a, b) => a.end.localeCompare(b.end));
  const currency = dur.revenue.Y.at(-1)?.unit || 'USD';
  const pick = (s, end) => s.find((x) => x.end === end)?.val ?? null;
  const pickI = (s, end) => { const c = s.filter((x) => Math.abs(days(x.end, end)) < 20); return c.length ? c.at(-1).val : null; };
  const row = (end, kind) => {
    const r = { end };
    for (const k of Object.keys(TAGS)) r[k] = pick(dur[k][kind], end);
    for (const k of Object.keys(INSTANT)) r[k] = pickI(inst[k], end);
    if (r.gross == null && r.revenue != null && r.cogs != null) r.gross = r.revenue - r.cogs;
    return r;
  };
  const annual = dur.revenue.Y.map((x) => x.end).slice(-10).map((end) => ({ fy: +end.slice(0, 4) - (end.slice(5, 7) < '04' ? 1 : 0), ...row(end, 'Y') }));
  const quarterly = dur.revenue.Q.map((x) => x.end).slice(-12).map((end) => row(end, 'Q'));
  splitAdjust(annual); splitAdjust(quarterly);
  const FLOW = Object.keys(TAGS).filter((k) => !['eps', 'dps', 'shDil'].includes(k)).concat(['eps', 'dps']);
  const last4 = quarterly.slice(-4);
  // Çeyrekler yıllık rapordan eskiyse (yabancı şirketler çeyreklik XBRL vermez) son 12 ay = son yıllık
  const qFresh = last4.length === 4 && (!annual.length || last4.at(-1).end >= annual.at(-1).end);
  const ttm = qFresh ? Object.fromEntries(FLOW.map((k) => [k, last4.every((q) => q[k] != null) ? last4.reduce((s, q) => s + q[k], 0) : null])) : { ...(annual.at(-1) || {}) };
  if (ttm.eps == null && annual.at(-1)?.eps != null && last4.at(-1)?.end === annual.at(-1).end) ttm.eps = annual.at(-1).eps;
  const prev4 = quarterly.slice(-8, -4);
  const revPrevTTM = qFresh && prev4.length === 4 && prev4.every((q) => q.revenue != null) ? prev4.reduce((s, q) => s + q.revenue, 0) : annual.at(-2)?.revenue;
  const bs = { end: inst.assets.at(-1)?.end }; for (const k of Object.keys(INSTANT)) bs[k] = inst[k].at(-1)?.val ?? null;
  return {
    currency, annual, quarterly, ttm: { ...ttm, end: (qFresh ? last4.at(-1) : annual.at(-1))?.end, revGrowth: ttm.revenue && revPrevTTM ? (ttm.revenue / revPrevTTM - 1) * 100 : null },
    bs, shares: sh2.at(-1)?.val ?? null,
  };
}

/* ---------------- 4. Açıklamalar ve yönetici işlemleri ---------------- */
const ITEMS = { '1.01': 'Önemli anlaşma', '1.02': 'Anlaşma feshi', '1.05': 'Siber güvenlik olayı', '2.01': 'Satın alma veya satış tamamlandı', '2.02': 'Finansal sonuçlar', '2.03': 'Yeni borçlanma', '2.05': 'Yeniden yapılanma', '2.06': 'Değer düşüklüğü', '3.01': 'Kotasyon bildirimi', '3.02': 'Hisse ihracı', '5.02': 'Yönetici değişikliği', '5.03': 'Esas sözleşme değişikliği', '5.07': 'Genel kurul oylaması', '7.01': 'Kamuya açıklama', '8.01': 'Diğer önemli olay', '9.01': 'Finansal tablolar ve ekler' };
const FORMS = { '8-K': 'Önemli olay', '10-K': 'Yıllık rapor', '10-Q': 'Çeyrek raporu', '20-F': 'Yıllık rapor (yabancı)', '6-K': 'Yabancı şirket açıklaması', 'DEF 14A': 'Genel kurul daveti', 'S-1': 'Halka arz başvurusu', 'SC 13D': '%5 üstü pay bildirimi', 'SC 13G': '%5 üstü pay bildirimi' };
function filingsOf(sub, cik) {
  const r = sub.filings?.recent; if (!r) return [];
  const out = [];
  for (let i = 0; i < r.form.length && out.length < 40; i++) {
    const f = r.form[i]; if (!FORMS[f]) continue;
    const items = (r.items?.[i] || '').split(',').map((x) => x.trim()).filter((x) => x && x !== '9.01');
    out.push({ form: f, date: r.filingDate[i], acc: r.accessionNumber[i], items, label: f === '8-K' && items.length ? items.map((x) => ITEMS[x] || x).join(', ') : FORMS[f], url: `https://www.sec.gov/Archives/edgar/data/${cik}/${acc0(r.accessionNumber[i])}/${r.primaryDocument[i]}` });
  }
  return out;
}
const tagVal = (xml, tag) => xml.match(new RegExp(`<${tag}>\\s*(?:<value>)?\\s*([^<]*)`))?.[1]?.trim();
async function insiders(sub, cik, cache) {
  const r = sub.filings?.recent; if (!r) return cache || [];
  const have = new Map((cache || []).map((x) => [x.acc, x]));
  const out = [];
  const cutoff = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10);
  let fetched = 0;
  for (let i = 0; i < r.form.length; i++) {
    if (r.form[i] !== '4' || r.filingDate[i] < cutoff) continue;
    const acc = r.accessionNumber[i];
    if (have.has(acc)) { out.push(have.get(acc)); continue; }
    if (fetched >= 25) continue;
    fetched++;
    try {
      const doc = r.primaryDocument[i].replace(/^xsl[^/]+\//, '');
      const xml = await get(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc0(acc)}/${doc}`, 'text');
      const owner = tagVal(xml, 'rptOwnerName'); const title = tagVal(xml, 'officerTitle') || (/<isDirector>\s*(1|true)/.test(xml) ? 'Yönetim kurulu üyesi' : '');
      const tx = [];
      for (const b of xml.split('<nonDerivativeTransaction>').slice(1)) {
        const code = tagVal(b, 'transactionCode'); if (code !== 'P' && code !== 'S') continue;
        const sh = num(tagVal(b, 'transactionShares')), px = num(tagVal(b, 'transactionPricePerShare'));
        tx.push({ code, sh, px, date: tagVal(b, 'transactionDate') });
      }
      const rec = { acc, date: r.filingDate[i], owner, title, plan: /10b5-1/i.test(xml), buy: tx.filter((t) => t.code === 'P').reduce((s, t) => s + (t.sh || 0) * (t.px || 0), 0), sell: tx.filter((t) => t.code === 'S').reduce((s, t) => s + (t.sh || 0) * (t.px || 0), 0), shBuy: tx.filter((t) => t.code === 'P').reduce((s, t) => s + (t.sh || 0), 0), shSell: tx.filter((t) => t.code === 'S').reduce((s, t) => s + (t.sh || 0), 0) };
      out.push(rec);
    } catch (e) { L(`form4 ${cik} ${acc}:`, e.message); }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------------- 5. Büyük fonlar (13F) ---------------- */
const FUNDS = [
  [1067983, 'Berkshire Hathaway', 'Warren Buffett'], [1649339, 'Scion Asset Management', 'Michael Burry'], [1336528, 'Pershing Square', 'Bill Ackman'],
  [1697748, 'ARK Investment Management', 'Cathie Wood'], [1350694, 'Bridgewater Associates', 'Ray Dalio'], [1037389, 'Renaissance Technologies', 'Jim Simons'],
  [1167483, 'Tiger Global', 'Chase Coleman'], [1135730, 'Coatue Management', 'Philippe Laffont'], [1029160, 'Soros Fund Management', 'George Soros'],
  [1040273, 'Third Point', 'Dan Loeb'], [1656456, 'Appaloosa', 'David Tepper'], [1536411, 'Duquesne Family Office', 'Stanley Druckenmiller'],
  [1061768, 'Baupost Group', 'Seth Klarman'], [1079114, 'Greenlight Capital', 'David Einhorn'], [1061165, 'Lone Pine Capital', 'Stephen Mandel'],
  [1103804, 'Viking Global', 'Andreas Halvorsen'], [921669, 'Icahn Enterprises', 'Carl Icahn'], [1112520, 'Akre Capital', 'Chuck Akre'],
  [1709323, 'Himalaya Capital', 'Li Lu'], [1166559, 'Gates Foundation Trust', 'Bill Gates'],
];
const norm = (s) => String(s || '').toUpperCase().replace(/&AMP;/g, '&').replace(/\b(INC|CORP|CORPORATION|CO|LTD|PLC|N\.?V|S\.?A|HOLDINGS?|GROUP|CLASS [A-C]|CL [A-C]|COM|THE|NEW|DEL|ADR|SPONSORED|ORD|SHS)\b\.?/g, ' ').replace(/[^A-Z0-9]/g, '');
async function infoTable(cik, acc) {
  const idx = await get(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc0(acc)}/index.json`);
  const files = idx.directory?.item || [];
  const xmlf = files.find((f) => /\.xml$/i.test(f.name) && !/primary_doc/i.test(f.name)) || files.find((f) => /infotable/i.test(f.name));
  if (!xmlf) throw new Error('infotable yok');
  const xml = await get(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc0(acc)}/${xmlf.name}`, 'text');
  const rows = new Map();
  for (const b of xml.split(/<(?:\w+:)?infoTable>/).slice(1)) {
    const g = (t) => b.match(new RegExp(`<(?:\\w+:)?${t}>([^<]*)<`))?.[1]?.trim();
    if (g('putCall')) continue;
    const cusip = g('cusip'); if (!cusip) continue;
    const p = rows.get(cusip) || { cusip, name: g('nameOfIssuer'), value: 0, shares: 0 };
    p.value += num(g('value')) || 0; p.shares += num(g('sshPrnamt')) || 0; rows.set(cusip, p);
  }
  return [...rows.values()];
}
async function funds(universe, prevFunds) {
  const byNorm = new Map(universe.map((u) => [norm(u.name), u.t]));
  const out = [];
  for (const [cik, name, person] of FUNDS) {
    try {
      const sub = await get(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`);
      const r = sub.filings.recent; const idx = [];
      for (let i = 0; i < r.form.length && idx.length < 2; i++) if (r.form[i] === '13F-HR') idx.push(i);
      if (!idx.length) { L(`13F yok: ${name}`); continue; }
      const accNow = r.accessionNumber[idx[0]];
      if (days(r.reportDate[idx[0]], today) > 200) { L(`13F eski (${r.reportDate[idx[0]]}), atlandı: ${name}`); continue; }
      const old = prevFunds?.find((f) => f.cik === cik);
      if (old && old.acc === accNow) { out.push(old); continue; }
      const now = await infoTable(cik, accNow);
      const prev = idx[1] != null ? await infoTable(cik, r.accessionNumber[idx[1]]).catch(() => []) : [];
      const pmap = new Map(prev.map((x) => [x.cusip, x]));
      const total = now.reduce((s, x) => s + x.value, 0);
      // değer birimi: 2023 öncesi bin $, sonrası $; küçük toplam bin $ demektir
      const mult = total < 5e7 && now.length > 3 ? 1000 : 1;
      const hold = now.map((x) => { const p = pmap.get(x.cusip); const t = byNorm.get(norm(x.name)); return { cusip: x.cusip, name: x.name, t: t || null, value: x.value * mult, shares: x.shares, prevShares: p?.shares ?? 0, chg: !p ? 'new' : x.shares > p.shares * 1.02 ? 'add' : x.shares < p.shares * 0.98 ? 'cut' : 'same' }; });
      // Aynı şirketin iki hisse sınıfı (GOOG/GOOGL) tek satırda
      for (let i = hold.length - 1; i >= 0; i--) { const h = hold[i]; if (!h.t) continue; const j = hold.findIndex((x) => x.t === h.t); if (j < i) { const a = hold[j]; a.value += h.value; a.shares += h.shares; a.prevShares += h.prevShares; a.chg = !a.prevShares ? 'new' : a.shares > a.prevShares * 1.02 ? 'add' : a.shares < a.prevShares * 0.98 ? 'cut' : 'same'; hold.splice(i, 1); } }
      for (const p of prev) if (!now.some((x) => x.cusip === p.cusip)) hold.push({ cusip: p.cusip, name: p.name, t: byNorm.get(norm(p.name)) || null, value: 0, shares: 0, prevShares: p.shares, chg: 'out' });
      hold.sort((a, b) => b.value - a.value);
      out.push({ cik, name, person, acc: accNow, filed: r.filingDate[idx[0]], period: r.reportDate[idx[0]], total: total * mult, n: now.length, holdings: hold.slice(0, 120) });
      L(`13F ${name}: ${now.length} pozisyon, ${r.reportDate[idx[0]]}`);
    } catch (e) { L(`13F hata ${name}:`, e.message); const old = prevFunds?.find((f) => f.cik === cik); if (old) out.push(old); }
  }
  return out;
}

/* ---------------- ana akış ---------------- */
async function main() {
  await fs.mkdir(CO, { recursive: true });
  const t0 = Date.now();
  const list = await nasdaq100();
  const tick = await get('https://www.sec.gov/files/company_tickers.json');
  const map = new Map(Object.values(tick).map((x) => [x.ticker.replace('-', '.'), x]));
  const seenCik = new Set();
  const uni = [];
  for (const x of list) { const s = map.get(x.t) || map.get(x.t.replace('.', '-')); if (!s) { L('SEC eşleşmesi yok:', x.t); continue; } if (seenCik.has(s.cik_str)) continue; seenCik.add(s.cik_str); uni.push({ t: x.t, cik: s.cik_str, name: prettyName(s.title), sector: x.sector }); }
  L(`Evren: ${uni.length} şirket`);
  const px = await prices(uni.map((u) => u.t));
  const fx = await fxRates();
  const prevUni = await readJSON(`${OUT}/universe.json`, { rows: [] });
  const rows = [];
  for (const u of uni) {
    const file = `${CO}/${u.t}.json`;
    const old = await readJSON(file, {});
    const c = { ...old, t: u.t, cik: u.cik, name: u.name, sector: u.sector || '' };
    try {
      const sub = await get(`https://data.sec.gov/submissions/CIK${pad(u.cik)}.json`);
      c.sic = sub.sicDescription || c.sic; if (!u.sector) c.sector = sectorOf(sub.sic, u.t); c.exchange = (sub.exchanges || [])[0]; c.website = sub.website || c.website; c.fye = sub.fiscalYearEnd;
      c.filings = filingsOf(sub, u.cik);
      c.insiders = await insiders(sub, u.cik, old.insiders);
      if (MODE === 'all' || !old.fin) { c.fin = await financials(u.cik); }
      if (c.fin && c.fin.currency && c.fin.currency !== 'USD') c.fin = toUSD(c.fin, fx[c.fin.currency]);
    } catch (e) { L(`${u.t}:`, e.message); }
    const p = px[u.t] || old.px || null; c.px = p;
    const f = c.fin; const sh = f?.shares; const mcap = p?.mcap || (p?.price && sh ? p.price * sh : null);
    const ttm = f?.ttm || {};
    const val = { mcap, pe: p?.pe > 0 ? p.pe : p?.price && ttm.eps > 0 ? p.price / ttm.eps : null, ps: mcap && ttm.revenue ? mcap / ttm.revenue : null, fcfYield: mcap && ttm.ocf != null ? ((ttm.ocf - (ttm.capex || 0)) / mcap) * 100 : null };
    c.m = metrics(f, mcap);
    if (c.m) { Object.assign(val, { pb: c.m.val.pb, evEbitda: c.m.val.evEbitda, evSales: c.m.val.evSales, ev: c.m.val.ev, divYield: c.m.val.divYield, buybackYield: c.m.val.buybackYield }); if (c.m.val.fcfYield != null) val.fcfYield = c.m.val.fcfYield; }
    c.val = val;
    c.updated = today;
    await writeJSON(file, c);
    const insBuy = (c.insiders || []).filter((x) => x.date >= new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10));
    rows.push({ t: u.t, name: u.name, sector: c.sector || c.sic || '', price: p?.price ?? null, chg: p?.chg ?? null, mcap, pe: val.pe, ps: val.ps, fcfYield: val.fcfYield, rev: ttm.revenue ?? null, revGrowth: ttm.revGrowth ?? null, netMargin: ttm.revenue && ttm.net != null ? (ttm.net / ttm.revenue) * 100 : null, grossMargin: ttm.revenue && ttm.gross != null ? (ttm.gross / ttm.revenue) * 100 : null, cur: f?.currency || 'USD', roe: c.m?.ttm.roe ?? null, roic: c.m?.ttm.roic ?? null, opMargin: c.m?.ttm.opM ?? null, debtEq: c.m?.ttm.debtEq ?? null, evEbitda: val.evEbitda ?? null, pb: val.pb ?? null, divYield: val.divYield ?? null, fscore: c.m?.fscore ? c.m.fscore.score : null, fscoreN: c.m?.fscore?.n ?? null, g3: c.m?.growth.revenue.y3 ?? null, lastFiling: c.filings?.[0]?.date || null, insiderNet90: insBuy.reduce((s, x) => s + x.buy - x.sell, 0) });
    L(`${u.t} tamam (${Math.round((Date.now() - t0) / 1000)} sn)`);
  }
  rows.sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
  await writeJSON(`${OUT}/universe.json`, { updated: today, index: 'Nasdaq 100', rows });
  const prevFunds = (await readJSON(`${OUT}/funds.json`, { funds: [] })).funds;
  const F = await funds(rows.map((r) => ({ t: r.t, name: r.name })), prevFunds);
  // hisse bazında büyük yatırımcılar
  const holders = {};
  for (const f of F) for (const h of f.holdings) if (h.t) (holders[h.t] ||= []).push({ fund: f.name, person: f.person, value: h.value, shares: h.shares, prevShares: h.prevShares, chg: h.chg, w: f.total ? (h.value / f.total) * 100 : null, period: f.period });
  await writeJSON(`${OUT}/funds.json`, { updated: today, funds: F, holders });
  L(`Bitti: ${rows.length} şirket, ${F.length} fon, ${Math.round((Date.now() - t0) / 1000)} sn, mod ${MODE}`);
}

main().catch((e) => { L('ÖLÜMCÜL:', e.stack || e.message); process.exitCode = 1; })
  .finally(async () => { try { await fs.mkdir(OUT, { recursive: true }); await fs.writeFile(`${OUT}/_log.txt`, log.join('\n')); } catch {} });
