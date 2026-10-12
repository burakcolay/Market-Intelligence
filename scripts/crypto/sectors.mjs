// Kripto sektörleri: CoinGecko kategori verisi → data/crypto/sectors.json (+ günlük geçmiş).
// GitHub Actions her gün çalıştırır (.github/workflows/crypto.yml). Anahtar gerekmez.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = 'data/crypto';
const API = 'https://api.coingecko.com/api/v3';
// id → Türkçe ad. Kategoriler örtüşür (BTC hem "Layer 1" hem başka listelerde olabilir); toplamları toplanmaz.
const SECTORS = [
  ['layer-1', 'Layer 1', 'Ana zincirler (BTC, ETH, SOL…)'],
  ['layer-2', 'Layer 2', 'Ethereum üstü ölçekleme ağları'],
  ['decentralized-finance-defi', 'DeFi', 'Merkeziyetsiz borç, borsa, türev'],
  ['artificial-intelligence', 'Yapay zekâ', 'AI ajanları, hesaplama, veri'],
  ['meme-token', 'Meme', 'Topluluk ve spekülasyon coinleri'],
  ['real-world-assets-rwa', 'RWA', 'Tokenize tahvil, emtia, gayrimenkul'],
  ['exchange-based-tokens', 'Borsa tokenları', 'BNB, OKB gibi borsa coinleri'],
  ['depin', 'DePIN', 'Merkeziyetsiz fiziksel altyapı'],
  ['gaming', 'Oyun', 'Oyun ve metaverse tokenları'],
  ['stablecoins', 'Stabilcoinler', 'Payın artması: para kenara çekiliyor'],
];

async function get(path) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(API + path, { headers: { accept: 'application/json', 'user-agent': 'MarketIntelligence/1.0' } });
    if (r.ok) return r.json();
    console.warn(`${path} → ${r.status}, tekrar deneniyor`);
    await new Promise((s) => setTimeout(s, 15000 * (i + 1)));
  }
  throw new Error(`${path} alınamadı`);
}
const readJSON = async (p, d) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return d; } };
const pct = (a, b) => (a && b ? +(((a / b) - 1) * 100).toFixed(2) : null);

const today = new Date().toISOString().slice(0, 10);
const cats = await get('/coins/categories');
const glob = await get('/global');
const total = glob?.data?.total_market_cap?.usd ?? null;
const byId = new Map(cats.map((c) => [c.id, c]));
const missing = SECTORS.filter(([id]) => !byId.has(id)).map(([id]) => id);
if (missing.length) console.warn('Bulunamayan kategoriler:', missing.join(', '), '\nMevcut örnekler:', cats.slice(0, 60).map((c) => c.id).join(', '));

// en büyük 3 coinin sembolleri
const ids = [...new Set(SECTORS.flatMap(([id]) => byId.get(id)?.top_3_coins_id || []))];
const sym = {};
if (ids.length) for (const m of await get(`/coins/markets?vs_currency=usd&ids=${ids.join(',')}&per_page=250`)) sym[m.id] = m.symbol.toUpperCase();

const hist = await readJSON(`${OUT}/sector_history.json`, {});
hist[today] = Object.fromEntries(SECTORS.filter(([id]) => byId.has(id)).map(([id]) => [id, byId.get(id).market_cap]));
hist[today]._total = total;
const days = Object.keys(hist).sort();
for (const d of days.slice(0, Math.max(0, days.length - 400))) delete hist[d];
const ago = (n) => { // n gün önceye en yakın (önceki) kayıt
  const t = new Date(Date.parse(today) - n * 864e5).toISOString().slice(0, 10);
  const d = Object.keys(hist).sort().filter((x) => x <= t).pop();
  return d ? hist[d] : null;
};
const w = ago(7), m = ago(30);

const items = SECTORS.filter(([id]) => byId.has(id)).map(([id, name, desc]) => {
  const c = byId.get(id);
  return {
    id, name, desc,
    mcap: c.market_cap, share: total ? +((c.market_cap / total) * 100).toFixed(2) : null,
    d1: c.market_cap_change_24h != null ? +c.market_cap_change_24h.toFixed(2) : null,
    w1: pct(c.market_cap, w?.[id]), m1: pct(c.market_cap, m?.[id]),
    share_w1: w?.[id] && w._total && total ? +(((c.market_cap / total) - (w[id] / w._total)) * 100).toFixed(2) : null,
    // sarılı/stake edilmiş kopyalar (wstETH gibi) aynı varlığı iki kez gösterir, atlanır
    top3: (c.top_3_coins_id || []).filter((x) => !/wrapped|staked|bridged/.test(x)).map((x) => sym[x] || x),
    // kategoriye yeni büyük bir token eklenince/çıkınca değişim fiyat hareketi değildir: işaretle
    odd: c.market_cap_change_24h != null && Math.abs(c.market_cap_change_24h) > 25,
    vol: c.volume_24h,
  };
});

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/sectors.json`, JSON.stringify({ updated: new Date().toISOString(), total_mcap: total, history_days: Object.keys(hist).length, items }));
await writeFile(`${OUT}/sector_history.json`, JSON.stringify(hist));
console.log(items.map((i) => `${i.name}: ${i.d1}% (${i.top3.join('/')})`).join('\n'));
if (items.length < 6) { console.error('Çok az kategori bulundu'); process.exit(1); }
