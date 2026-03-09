import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// SEC requires a descriptive User-Agent for automated requests
const SEC_UA = process.env.SEC_UA || 'pocket-outlook/1.0 (contact@example.com)';
const EDGAR_HEADERS = { 'User-Agent': SEC_UA, 'Accept': 'application/json' };

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

// Yahoo symbol → stooq symbol mapping
const STOOQ_MAP = {
  '^GSPC':     '^spx',
  '^DJI':      '^dji',
  '^IXIC':     '^ndq',
  'GC=F':      'xauusd',
  'BZ=F':      'cl.f',
  '^TNX':      'tnx.b',
  '^TYX':      'tyx.b',
  'DX-Y.NYB':  'dx.f',
};

function toStooqSymbol(symbol) {
  if (STOOQ_MAP[symbol]) return STOOQ_MAP[symbol];
  if (/^[A-Z]{1,6}$/.test(symbol)) return symbol.toLowerCase() + '.us';
  return null;
}

const STOOQ_RANGE_DAYS = { '1d': 3, '5d': 7, '1mo': 35, '3mo': 95, '6mo': 185, '1y': 370, '2y': 740, '5y': 1830 };

async function fetchStooqChart(symbol, range) {
  const stooqSym = toStooqSymbol(symbol);
  if (!stooqSym) return null;

  const isWeekly = range === '2y' || range === '5y';
  const endDate  = new Date();
  const startDate = new Date(Date.now() - (STOOQ_RANGE_DAYS[range] || 370) * 86400000);
  const d1 = startDate.toISOString().slice(0, 10).replace(/-/g, '');
  const d2 = endDate.toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=${isWeekly ? 'w' : 'd'}&d1=${d1}&d2=${d2}`;

  const r = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return null;

  const text = await r.text();
  if (!text || text.trim().toLowerCase().startsWith('no data')) return null;

  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;

  const hdr   = lines[0].split(',').map(h => h.trim().toLowerCase());
  const iDate  = hdr.indexOf('date');
  const iOpen  = hdr.indexOf('open');
  const iHigh  = hdr.indexOf('high');
  const iLow   = hdr.indexOf('low');
  const iClose = hdr.indexOf('close');
  const iVol   = hdr.indexOf('volume');
  if (iDate === -1 || iClose === -1) return null;

  const linePoints = [], ohlcPoints = [], volumePoints = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const dateStr = cols[iDate]?.trim();
    const close   = parseFloat(cols[iClose]);
    if (!dateStr || isNaN(close)) continue;

    const ts   = new Date(dateStr + 'T16:00:00Z').getTime(); // market close approx
    const prev = linePoints.length > 0 ? linePoints[linePoints.length - 1].y : close;
    const vol  = iVol >= 0 ? Math.round(parseFloat(cols[iVol] || '0')) : 0;
    const open = parseFloat(cols[iOpen]);
    const high = parseFloat(cols[iHigh]);
    const low  = parseFloat(cols[iLow]);

    linePoints.push({ x: ts, y: close });
    volumePoints.push({ x: ts, y: vol, up: close >= prev });
    if (!isNaN(open) && !isNaN(high) && !isNaN(low)) {
      ohlcPoints.push({ x: ts, o: open, h: high, l: low, c: close });
    }
  }

  if (linePoints.length === 0) return null;

  const livePrice = linePoints[linePoints.length - 1].y;
  const prevClose = linePoints.length > 1 ? linePoints[linePoints.length - 2].y : livePrice;
  return { linePoints, ohlcPoints, volumePoints, livePrice, prevClose, meta: { symbol } };
}

// ── Serve frontend ──────────────────────────────────────────────────────────
app.use(express.static(__dirname));

// ── Generic proxy with caching ───────────────────────────────────────────────
// Replaces browser-side CORS proxies (corsproxy.io, allorigins.win) with a
// fast, cached, server-side fetch.  Only whitelisted hosts are allowed.

const ALLOWED_PROXY_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'api.coingecko.com',
  'rss.nytimes.com',
  'www.marketwatch.com',
  'feeds.content.dowjones.io',
  'feeds.feedburner.com',
  'finnhub.io',
]);

// TTL in ms keyed on hostname fragment
const PROXY_TTL = [
  ['finance.yahoo.com', 30_000],   // live prices — 30 s
  ['coingecko.com',     60_000],   // crypto     — 1 min
  ['finnhub.io',        30_000],   // live prices — 30 s
];
const PROXY_TTL_DEFAULT = 5 * 60_000; // news/RSS  — 5 min

const _proxyCache = new Map();

function proxyTtl(hostname) {
  for (const [fragment, ttl] of PROXY_TTL) {
    if (hostname.includes(fragment)) return ttl;
  }
  return PROXY_TTL_DEFAULT;
}

// Strip cache-busting params that were only needed for third-party CORS proxies
function normalizeProxyUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    u.searchParams.delete('_cb');
    return u.toString();
  } catch { return urlStr; }
}

app.get('/api/proxy', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).json({ error: 'url param required' });

  let target;
  try { target = new URL(normalizeProxyUrl(raw)); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  if (!ALLOWED_PROXY_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: `Host not allowed: ${target.hostname}` });
  }

  const cacheKey = target.toString(); // normalized (no _cb)
  const ttl = proxyTtl(target.hostname);
  const cached = _proxyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) {
    res.set('Content-Type', cached.contentType);
    return res.send(cached.body);
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/html, application/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream error', status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const body = await upstream.text(); // works for both JSON and XML

    _proxyCache.set(cacheKey, { body, contentType, ts: Date.now() });
    // Evict oldest entries when cache gets large
    if (_proxyCache.size > 800) {
      const oldest = [..._proxyCache.keys()].slice(0, 200);
      oldest.forEach(k => _proxyCache.delete(k));
    }

    res.set('Content-Type', contentType);
    res.send(body);
  } catch (err) {
    console.error('[proxy]', target.hostname, err.message);
    res.status(502).json({ error: 'Proxy fetch failed', detail: err.message });
  }
});

// ── CIK cache (populated once, refreshed weekly) ────────────────────────────
let _cikMap = null;
let _cikTs  = 0;
const CIK_TTL = 7 * 24 * 60 * 60 * 1000;

async function getCik(ticker) {
  if (!_cikMap || Date.now() - _cikTs > CIK_TTL) {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: EDGAR_HEADERS });
    if (!res.ok) throw new Error('Failed to load SEC ticker map');
    const full = await res.json();
    _cikMap = {};
    for (const e of Object.values(full)) {
      _cikMap[e.ticker.toUpperCase()] = String(e.cik_str).padStart(10, '0');
    }
    _cikTs = Date.now();
  }
  const upper = ticker.toUpperCase();
  if (_cikMap[upper]) return _cikMap[upper];
  // Fallbacks for dual-class shares (e.g. BRK.A → BRK, GOOGL → GOOG)
  for (const alt of [upper.replace(/\.[A-Z]$/, ''), upper.slice(0, -1)]) {
    if (alt && alt !== upper && _cikMap[alt]) return _cikMap[alt];
  }
  return null;
}

// ── Per-concept fetcher ──────────────────────────────────────────────────────
async function getConcept(cik, tag) {
  try {
    const res = await fetch(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`,
      { headers: EDGAR_HEADERS }
    );
    return res.ok ? res.json() : null;
  } catch { return null; }
}

// ── Value extractors ─────────────────────────────────────────────────────────
const usd    = c => c?.units?.USD            ?? [];
const usdps  = c => c?.units?.['USD/shares'] ?? [];
const shares = c => c?.units?.shares         ?? [];
const pd     = e => (new Date(e.end) - new Date(e.start)) / 86400000;

/** Trailing-twelve-months for flow metrics (income statement, cash flow). */
function ttm(entries) {
  const f = entries
    .filter(e => (e.form === '10-K' || e.form === '10-Q') && e.val != null && e.start)
    .sort((a, b) => (new Date(b.end) - new Date(a.end)) || (pd(b) - pd(a)));
  if (!f.length) return null;

  const annualK = f.find(e => e.form === '10-K' && pd(e) > 340);
  const recentQ = f.find(e => e.form === '10-Q' && pd(e) > 60);
  if (!recentQ && !annualK) return null;
  if (!recentQ) return annualK.val;
  if (!annualK) return recentQ.val * (365 / pd(recentQ));
  if (new Date(annualK.end) >= new Date(recentQ.end)) return annualK.val;

  const priorQ = f.find(e => {
    if (e.form !== '10-Q') return false;
    const diff = (new Date(recentQ.end) - new Date(e.end)) / 86400000;
    return diff > 300 && diff < 420 && Math.abs(pd(e) - pd(recentQ)) < 30;
  });
  return priorQ
    ? annualK.val + recentQ.val - priorQ.val
    : annualK.val;
}

/** Most-recent value for balance-sheet (point-in-time) metrics. */
function latest(entries) {
  const f = entries
    .filter(e => (e.form === '10-K' || e.form === '10-Q') && e.val != null)
    .sort((a, b) => new Date(b.end) - new Date(a.end));
  return f[0]?.val ?? null;
}

/** Try each concept in order, return first non-null. */
function firstOf(concepts, extractor) {
  for (const c of concepts) {
    const v = extractor(c);
    if (v != null) return v;
  }
  return null;
}

// ── /api/fundamentals/:ticker ────────────────────────────────────────────────
app.get('/api/fundamentals/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const cik = await getCik(ticker);
    if (!cik) {
      return res.status(404).json({ error: `No SEC filing found for: ${ticker}` });
    }

    // Fire all concept requests in parallel (~14 small files vs one 5–30 MB blob)
    const [
      cRev1, cRev2, cRev3, cRev4, cRev5, cRev6,
      cNetInc,
      cEpsDil,
      cOpCF,
      cCapex1, cCapex2,
      cShares,
      cEquity1, cEquity2,
    ] = await Promise.all([
      getConcept(cik, 'RevenueFromContractWithCustomerExcludingAssessedTax'),
      getConcept(cik, 'RevenueFromContractWithCustomerIncludingAssessedTax'),
      getConcept(cik, 'Revenues'),
      getConcept(cik, 'SalesRevenueNet'),
      getConcept(cik, 'NetRevenues'),
      getConcept(cik, 'OperatingRevenue'),
      getConcept(cik, 'NetIncomeLoss'),
      getConcept(cik, 'EarningsPerShareDiluted'),
      getConcept(cik, 'NetCashProvidedByUsedInOperatingActivities'),
      getConcept(cik, 'PaymentsToAcquirePropertyPlantAndEquipment'),
      getConcept(cik, 'CapitalExpenditureContinuingOperations'),
      getConcept(cik, 'CommonStockSharesOutstanding'),
      getConcept(cik, 'StockholdersEquity'),
      getConcept(cik, 'StockholdersEquityAttributableToParent'),
    ]);

    // ── Flow metrics (TTM) ──
    const revenue = firstOf(
      [cRev1, cRev2, cRev3, cRev4, cRev5, cRev6],
      c => ttm(usd(c))
    );
    const netIncome          = ttm(usd(cNetInc));
    const eps                = ttm(usdps(cEpsDil));
    const operatingCashFlow  = ttm(usd(cOpCF));
    const capexRaw           = firstOf([cCapex1, cCapex2], c => ttm(usd(c)));
    const capex              = capexRaw != null ? Math.abs(capexRaw) : null;
    const freeCashFlow       = operatingCashFlow != null && capex != null
      ? operatingCashFlow - capex : null;

    // ── Balance-sheet metrics (most recent) ──
    const sharesOutstanding  = latest(shares(cShares));
    const bookValue          = firstOf([cEquity1, cEquity2], c => latest(usd(c)));
    const bookValuePerShare  = bookValue != null && sharesOutstanding
      ? bookValue / sharesOutstanding : null;

    if (!revenue && !netIncome && !operatingCashFlow) {
      return res.status(404).json({ error: `No XBRL data found for: ${ticker}` });
    }

    res.json({
      ticker,
      cik,
      metrics: {
        eps,
        revenue,
        netIncome,
        bookValue,
        bookValuePerShare,
        sharesOutstanding,
        operatingCashFlow,
        freeCashFlow,
      },
    });
  } catch (err) {
    console.error(`[fundamentals] ${ticker}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch fundamentals', detail: err.message });
  }
});

// ── /api/eq-chart/:symbol ─────────────────────────────────────────────────────
// Server-side chart data via stooq.com — free, no auth, no datacenter blocking.
// Covers all US stocks + major indices (SPX, DJI, etc.) + Gold.
// Does NOT have intraday data — the frontend falls back to Yahoo/corsproxy for 1d.

app.get('/api/eq-chart/:symbol', async (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
  const range  = req.query.range || '1y';

  const cacheKey = `stooq:${symbol}:${range}`;
  const ttl = 15 * 60_000; // 15 min — stooq data is end-of-day
  const hit = _proxyCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < ttl) return res.json(hit.body);

  try {
    const result = await fetchStooqChart(symbol, range);
    if (!result) return res.status(404).json({ error: `No chart data for ${symbol}` });
    _proxyCache.set(cacheKey, { body: result, ts: Date.now() });
    res.json(result);
  } catch (err) {
    console.error('[eq-chart]', symbol, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Pocket Outlook running on port ${PORT}`));
