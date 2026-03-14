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

const FINNHUB_API = 'https://finnhub.io/api/v1';
const FINNHUB_KEY = process.env.FINNHUB_KEY || 'd6jikipr01qkvh5q2pugd6jikipr01qkvh5q2pv0';

// Yahoo symbol → stooq symbol mapping
const STOOQ_MAP = {
  '^GSPC':     '^spx',
  '^DJI':      '^dji',
  '^IXIC':     '^ndq',
  '^VIX':      '^vix',
  '^IRX':      'irx.b',
  'GC=F':      'xauusd',
  'BZ=F':      'cl.f',
  '^TNX':      'tnx.b',
  '^TYX':      'tyx.b',
  'DX-Y.NYB':  'dx.f',
  'BTC-USD':   'btcusd',
  'ETH-USD':   'ethusd',
};

function toStooqSymbol(symbol) {
  if (STOOQ_MAP[symbol]) return STOOQ_MAP[symbol];
  // Plain US stock ticker (e.g. AAPL → aapl.us)
  if (/^[A-Z]{1,6}$/.test(symbol)) return symbol.toLowerCase() + '.us';
  // Share-class tickers with dot (e.g. BF.B → bf_b.us, BRK.A → brk_a.us)
  if (/^[A-Z]{1,5}\.[A-Z]$/.test(symbol)) return symbol.replace('.', '_').toLowerCase() + '.us';
  return null;
}

const STOOQ_RANGE_DAYS = { '1d': 3, '5d': 7, '1mo': 35, '3mo': 95, '6mo': 185, '1y': 370, '2y': 740, '5y': 1830 };

async function fetchStooqChart(symbol, range) {
  const stooqSym = toStooqSymbol(symbol);
  if (!stooqSym) return null;

  const isWeekly = range === '2y' || range === '5y';
  const endDate  = new Date();
  let startDate;
  if (range === 'ytd') {
    startDate = new Date(endDate.getFullYear(), 0, 1); // Jan 1 of current year
  } else {
    startDate = new Date(Date.now() - (STOOQ_RANGE_DAYS[range] || 370) * 86400000);
  }
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

// ── Yahoo Finance crumb management ───────────────────────────────────────────
// Yahoo v8/v10/v11 require a crumb + session cookie since mid-2024.
// We fetch them server-side once and reuse for all proxied Yahoo requests.
let _yahooCrumb = null;
let _yahooCookieStr = null;
let _yahooCrumbTs = 0;
const CRUMB_TTL = 55 * 60_000; // 55 minutes

async function refreshYahooCrumb() {
  try {
    const homeRes = await fetch('https://finance.yahoo.com/', {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    const rawCookies = typeof homeRes.headers.getSetCookie === 'function'
      ? homeRes.headers.getSetCookie() : [];
    _yahooCookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/finance/crumb', {
      headers: { 'User-Agent': BROWSER_UA, 'Cookie': _yahooCookieStr, 'Accept': '*/*' },
    });
    if (!crumbRes.ok) { console.error('[yahoo-crumb] HTTP', crumbRes.status); return null; }
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 40 || crumb.includes('<') || crumb.includes('{')) {
      console.error('[yahoo-crumb] invalid:', crumb.slice(0, 60)); return null;
    }
    _yahooCrumb = crumb; _yahooCrumbTs = Date.now();
    console.log('[yahoo-crumb] refreshed OK');
    return crumb;
  } catch (err) {
    console.error('[yahoo-crumb] failed:', err.message); return null;
  }
}

async function getYahooCrumb() {
  if (_yahooCrumb && Date.now() - _yahooCrumbTs < CRUMB_TTL) return _yahooCrumb;
  return refreshYahooCrumb();
}

// Warm up crumb on server start
refreshYahooCrumb();

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
    u.searchParams.delete('crumb'); // server adds its own crumb; don't pollute cache key
    return u.toString();
  } catch { return urlStr; }
}

app.get('/api/yahoo-crumb', async (req, res) => {
  const crumb = await getYahooCrumb();
  if (!crumb) return res.status(503).json({ error: 'Yahoo crumb unavailable' });
  res.json({ crumb });
});

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
    // For Yahoo Finance: inject crumb into the URL + session cookie into headers.
    // Use a cloned URL so the cache key (target.toString()) stays stable.
    let upstreamUrl = target.toString();
    const extraHeaders = {};
    if (target.hostname.includes('finance.yahoo.com')) {
      const crumb = await getYahooCrumb();
      if (crumb) {
        const u = new URL(upstreamUrl);
        u.searchParams.set('crumb', crumb);
        upstreamUrl = u.toString();
        if (_yahooCookieStr) extraHeaders['Cookie'] = _yahooCookieStr;
      }
    }

    const upstream = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json, text/html, application/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
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

// ── Rich helpers with source-tracking (used by expanded /api/fundamentals) ────
/** TTM returning { val, entry, method } so the client can show filing provenance. */
function ttmFull(entries) {
  const f = entries
    .filter(e => (e.form === '10-K' || e.form === '10-Q') && e.val != null && e.start)
    .sort((a, b) => (new Date(b.end) - new Date(a.end)) || (pd(b) - pd(a)));
  if (!f.length) return null;
  const recentK = f.find(e => e.form === '10-K' && pd(e) > 340);
  const recentQ = f.find(e => e.form === '10-Q' && pd(e) > 60);
  if (!recentQ && !recentK) return null;
  if (!recentQ) return { val: recentK.val, entry: recentK, method: 'Annual' };
  if (!recentK) return { val: recentQ.val * (365 / pd(recentQ)), entry: recentQ, method: 'Annualized from ' + (recentQ.fp || 'Q') };
  if (new Date(recentK.end) >= new Date(recentQ.end)) return { val: recentK.val, entry: recentK, method: 'Annual' };
  const qDate = new Date(recentQ.end), qd = pd(recentQ);
  const priorQ = f.find(e => {
    if (e.form !== '10-Q') return false;
    const diff = (qDate - new Date(e.end)) / 86400000;
    return diff > 300 && diff < 420 && Math.abs(pd(e) - qd) < 30;
  });
  if (!priorQ) return { val: recentK.val, entry: recentK, method: 'Annual (prior-year Q unavailable)' };
  return { val: recentK.val + recentQ.val - priorQ.val, entry: recentK, method: 'TTM: ' + recentK.end.slice(0, 4) + ' annual + ' + recentQ.fp + ' − prior yr' };
}

/** Most-recent balance-sheet value with provenance. */
function mrFull(entries) {
  const f = entries
    .filter(e => (e.form === '10-K' || e.form === '10-Q') && e.val != null)
    .sort((a, b) => new Date(b.end) - new Date(a.end));
  return f[0] ? { val: f[0].val, entry: f[0], method: 'Most recent balance sheet' } : null;
}

// ── Fundamentals cache (6-hour TTL — EDGAR filings rarely change intraday) ────
const _fundCache = new Map();

// ── /api/fundamentals/:ticker ─────────────────────────────────────────────────
// Full EDGAR XBRL fundamentals: 26 concepts, TTM income statement + cash flow,
// most-recent balance sheet, all computed ratios, filing provenance per metric.
// Results cached 6 hours server-side — no repeated 26-request SEC fan-outs.
app.get('/api/fundamentals/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  const hit = _fundCache.get(ticker);
  if (hit && Date.now() - hit.ts < 6 * 60 * 60_000) return res.json(hit.data);

  try {
    const cik = await getCik(ticker);
    if (!cik) return res.status(404).json({ error: `No SEC filing found for: ${ticker}` });

    // 26 concept requests in parallel (~10-50 KB each vs a 5-30 MB companyfacts blob)
    const [
      cRev1, cRev2, cRev3, cRev4, cRev5, cRev6,
      cOpInc, cGrossProfit, cNetInc, cEpsDil,
      cDa1, cDa2,
      cOpCF, cCapex1, cCapex2,
      cCash1, cCash2, cLtDebt1, cLtDebt2,
      cShares, cCurrentA, cCurrentL, cAssets, cEquity1, cEquity2, cLiab,
    ] = await Promise.all([
      getConcept(cik, 'RevenueFromContractWithCustomerExcludingAssessedTax'),
      getConcept(cik, 'RevenueFromContractWithCustomerIncludingAssessedTax'),
      getConcept(cik, 'Revenues'),
      getConcept(cik, 'SalesRevenueNet'),
      getConcept(cik, 'NetRevenues'),
      getConcept(cik, 'OperatingRevenue'),
      getConcept(cik, 'OperatingIncomeLoss'),
      getConcept(cik, 'GrossProfit'),
      getConcept(cik, 'NetIncomeLoss'),
      getConcept(cik, 'EarningsPerShareDiluted'),
      getConcept(cik, 'DepreciationDepletionAndAmortization'),
      getConcept(cik, 'DepreciationAndAmortization'),
      getConcept(cik, 'NetCashProvidedByUsedInOperatingActivities'),
      getConcept(cik, 'PaymentsToAcquirePropertyPlantAndEquipment'),
      getConcept(cik, 'CapitalExpenditureContinuingOperations'),
      getConcept(cik, 'CashAndCashEquivalentsAtCarryingValue'),
      getConcept(cik, 'CashCashEquivalentsAndShortTermInvestments'),
      getConcept(cik, 'LongTermDebt'),
      getConcept(cik, 'LongTermDebtNoncurrent'),
      getConcept(cik, 'CommonStockSharesOutstanding'),
      getConcept(cik, 'AssetsCurrent'),
      getConcept(cik, 'LiabilitiesCurrent'),
      getConcept(cik, 'Assets'),
      getConcept(cik, 'StockholdersEquity'),
      getConcept(cik, 'StockholdersEquityAttributableToParent'),
      getConcept(cik, 'Liabilities'),
    ]);

    const _sources = {};

    function saveSrc(key, tag, r) {
      _sources[key] = {
        type: 'edgar', tag, cik,
        form: r.entry.form,
        period: (r.entry.fp || 'FY') + ' ' + (r.entry.end?.slice(0, 4) || ''),
        end: r.entry.end, filed: r.entry.filed, accn: r.entry.accn,
        method: r.method,
      };
    }
    function saveCmp(key, formula) { _sources[key] = { type: 'computed', formula }; }

    function extractP(key, pairs) {
      for (const [c, tag] of pairs) {
        const r = ttmFull(usd(c));
        if (r?.val != null) { saveSrc(key, tag, r); return r.val; }
      }
      return null;
    }
    function extractI(key, pairs) {
      for (const [c, tag] of pairs) {
        const r = mrFull(usd(c));
        if (r?.val != null) { saveSrc(key, tag, r); return r.val; }
      }
      return null;
    }
    function extractPPS(key, pairs) {
      for (const [c, tag] of pairs) {
        const r = ttmFull(usdps(c));
        if (r?.val != null) { saveSrc(key, tag, r); return r.val; }
      }
      return null;
    }
    function extractISh(key, pairs) {
      for (const [c, tag] of pairs) {
        const r = mrFull(shares(c));
        if (r?.val != null) { saveSrc(key, tag, r); return r.val; }
      }
      return null;
    }

    // ── Income statement (TTM) ──
    const revenue         = extractP('revenue', [
      [cRev1, 'RevenueFromContractWithCustomerExcludingAssessedTax'],
      [cRev2, 'RevenueFromContractWithCustomerIncludingAssessedTax'],
      [cRev3, 'Revenues'], [cRev4, 'SalesRevenueNet'],
      [cRev5, 'NetRevenues'], [cRev6, 'OperatingRevenue'],
    ]);
    const grossProfit     = extractP('grossProfit',     [[cGrossProfit, 'GrossProfit']]);
    const operatingIncome = extractP('operatingIncome', [[cOpInc,       'OperatingIncomeLoss']]);
    const netIncome       = extractP('netIncome',       [[cNetInc,      'NetIncomeLoss']]);
    const epsDiluted      = extractPPS('epsDiluted',    [[cEpsDil,      'EarningsPerShareDiluted']]);
    const da              = extractP('da', [
      [cDa1, 'DepreciationDepletionAndAmortization'],
      [cDa2, 'DepreciationAndAmortization'],
    ]);

    // ── Cash flow (TTM) ──
    const operatingCF  = extractP('operatingCF', [[cOpCF, 'NetCashProvidedByUsedInOperatingActivities']]);
    const capexRaw     = extractP('capex', [
      [cCapex1, 'PaymentsToAcquirePropertyPlantAndEquipment'],
      [cCapex2, 'CapitalExpenditureContinuingOperations'],
    ]);
    const capex        = capexRaw != null ? Math.abs(capexRaw) : null;
    const freeCashFlow = operatingCF != null && capex != null ? operatingCF - capex : null;

    // ── Balance sheet (most recent filing) ──
    const totalAssets        = extractI('totalAssets',        [[cAssets,    'Assets']]);
    const currentAssets      = extractI('currentAssets',      [[cCurrentA,  'AssetsCurrent']]);
    const currentLiabilities = extractI('currentLiabilities', [[cCurrentL,  'LiabilitiesCurrent']]);
    const totalLiabilities   = extractI('totalLiabilities',   [[cLiab,      'Liabilities']]);
    const equity             = extractI('equity',             [[cEquity1, 'StockholdersEquity'], [cEquity2, 'StockholdersEquityAttributableToParent']]);
    const cash               = extractI('cash',               [[cCash1, 'CashAndCashEquivalentsAtCarryingValue'], [cCash2, 'CashCashEquivalentsAndShortTermInvestments']]);
    const longTermDebt       = extractI('longTermDebt',       [[cLtDebt1, 'LongTermDebt'], [cLtDebt2, 'LongTermDebtNoncurrent']]);
    const sharesOut          = extractISh('sharesOut',        [[cShares, 'CommonStockSharesOutstanding']]);

    if (!revenue && !netIncome && !operatingCF && !totalAssets) {
      return res.status(404).json({ error: `No XBRL data found for: ${ticker}` });
    }

    // ── Computed ratios ──
    const grossMargin  = grossProfit != null && revenue      ? grossProfit / revenue      : null;
    const opMargin     = operatingIncome != null && revenue  ? operatingIncome / revenue  : null;
    const netMargin    = netIncome != null && revenue        ? netIncome / revenue        : null;
    const roe          = netIncome != null && equity && equity !== 0 ? netIncome / equity : null;
    const roa          = netIncome != null && totalAssets    ? netIncome / totalAssets    : null;
    const currentRatio = currentAssets != null && currentLiabilities ? currentAssets / currentLiabilities : null;
    const debtToEquity = longTermDebt != null && equity && equity > 0 ? longTermDebt / equity : null;
    const ebitda       = operatingIncome != null && da != null ? operatingIncome + da : operatingIncome;
    const netDebt      = cash != null ? (longTermDebt ?? 0) - cash : (longTermDebt ?? null);

    if (freeCashFlow != null) saveCmp('freeCashFlow', 'Operating Cash Flow − Capital Expenditures');
    if (grossMargin  != null) saveCmp('grossMargin',  'Gross Profit ÷ Revenue');
    if (opMargin     != null) saveCmp('opMargin',     'Operating Income ÷ Revenue');
    if (netMargin    != null) saveCmp('netMargin',    'Net Income ÷ Revenue');
    if (roe          != null) saveCmp('roe',          "Net Income ÷ Stockholders' Equity");
    if (roa          != null) saveCmp('roa',          'Net Income ÷ Total Assets');
    if (currentRatio != null) saveCmp('currentRatio', 'Current Assets ÷ Current Liabilities');
    if (debtToEquity != null) saveCmp('debtToEquity', 'Long-Term Debt ÷ Stockholders\' Equity');
    if (ebitda       != null) saveCmp('ebitda',       'Operating Income + Depreciation & Amortization');

    // Company website from SEC submissions (best-effort, non-blocking)
    let website = null;
    try {
      const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_HEADERS, signal: AbortSignal.timeout(5000) });
      if (subRes.ok) { const sub = await subRes.json(); website = sub.website || null; }
    } catch(e) {}

    const result = {
      _source: 'edgar', _sources, _cik: cik, ticker, website,
      revenue, grossProfit, operatingIncome, netIncome, epsDiluted, da, ebitda,
      operatingCF, freeCashFlow,
      totalAssets, currentAssets, currentLiabilities, totalLiabilities,
      equity, cash, longTermDebt, sharesOut, netDebt,
      grossMargin, opMargin, netMargin, roe, roa, currentRatio, debtToEquity,
    };

    _fundCache.set(ticker, { data: result, ts: Date.now() });
    if (_fundCache.size > 500) {
      [..._fundCache.keys()].slice(0, 100).forEach(k => _fundCache.delete(k));
    }

    res.json(result);
  } catch (err) {
    console.error(`[fundamentals] ${ticker}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch fundamentals', detail: err.message });
  }
});

// ── /api/search ───────────────────────────────────────────────────────────────
// Ticker search: tries Yahoo v1 with crumb first, falls back to Finnhub.
// Server-side is better than client-side because the crumb + cookie are already held.
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  // Yahoo Finance search (server already has session crumb + cookie)
  try {
    const crumb = await getYahooCrumb();
    const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) +
      '&quotesCount=8&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query' +
      (crumb ? '&crumb=' + encodeURIComponent(crumb) : '');
    const r = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json',
        ...(crumb && _yahooCookieStr ? { Cookie: _yahooCookieStr } : {}),
      },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j = await r.json();
      const quotes = j?.finance?.result?.[0]?.quotes || j?.quotes || [];
      const results = quotes
        .filter(q => q.symbol && ['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND'].includes(q.quoteType))
        .slice(0, 7)
        .map(q => ({ symbol: q.symbol, name: q.longname || q.shortname || q.symbol, type: q.quoteType, exchange: q.exchange || '' }));
      if (results.length) return res.json(results);
    }
  } catch(e) {}

  // Fallback: Finnhub symbol search
  try {
    const r = await fetch(`${FINNHUB_API}/search?q=${encodeURIComponent(q)}&token=${FINNHUB_KEY}`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j = await r.json();
      const results = (j.result || [])
        .filter(r => r.symbol && (r.type === 'Common Stock' || r.type === 'ETP'))
        .slice(0, 7)
        .map(r => ({ symbol: r.displaySymbol || r.symbol, name: r.description || r.symbol, type: r.type === 'ETP' ? 'ETF' : 'EQUITY', exchange: '' }));
      if (results.length) return res.json(results);
    }
  } catch(e) {}

  res.json([]);
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

// ── Batch prices endpoint ─────────────────────────────────────────────────────
// Fetches all 12 overview card prices server-side in one shot.
// Primary: Finnhub (live, works from Railway). Fallback: stooq (EOD).
// Crypto fallback: Binance public REST (no auth, no datacenter blocks).
// Cached 30 s — client calls this ONCE per refresh instead of 44+ Yahoo fetches.

async function _fetchPriceFromFinnhub(symbol) {
  try {
    const r = await fetch(
      `${FINNHUB_API}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`,
      { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.c == null || d.c === 0) return null;
    return { price: d.c, change: d.d || 0, pct: d.dp || 0 };
  } catch(e) { return null; }
}

async function _fetchPriceFromStooq(yahooSymbol) {
  try {
    const result = await fetchStooqChart(yahooSymbol, '5d');
    if (!result?.livePrice) return null;
    const { livePrice, prevClose } = result;
    const change = prevClose ? livePrice - prevClose : 0;
    const pct = prevClose && prevClose !== 0 ? (change / prevClose) * 100 : 0;
    return { price: livePrice, change, pct };
  } catch(e) { return null; }
}

async function _fetchBinancePrice(binanceSymbol) {
  try {
    const r = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`,
      { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.lastPrice) return null;
    return {
      price: parseFloat(d.lastPrice),
      change: parseFloat(d.priceChange) || 0,
      pct: parseFloat(d.priceChangePercent) || 0,
    };
  } catch(e) { return null; }
}

// Sources tried in order per card key. Format: 'type:symbol'
const _PRICE_SOURCES = {
  spx:   ['finnhub:^GSPC',            'finnhub:SPY',             'stooq:^GSPC'],
  ndx:   ['finnhub:^IXIC',            'finnhub:QQQ',             'stooq:^IXIC'],
  dji:   ['finnhub:^DJI',             'finnhub:DIA',             'stooq:^DJI'],
  vix:   ['finnhub:^VIX',             'stooq:^VIX'],
  tny:   ['stooq:^TNX',               'finnhub:^TNX'],
  tbill: ['stooq:^IRX',               'finnhub:^IRX'],
  tny30: ['stooq:^TYX',               'finnhub:^TYX'],
  dxy:   ['stooq:DX-Y.NYB',           'finnhub:DX-Y.NYB',        'finnhub:UUP'],
  gold:  ['stooq:GC=F',               'finnhub:GC=F',            'finnhub:GLD'],
  oil:   ['stooq:BZ=F',               'finnhub:BZ=F',            'finnhub:USO'],
  btc:   ['finnhub:BINANCE:BTCUSDT',  'finnhub:COINBASE:BTC-USD','binance:BTCUSDT'],
  eth:   ['finnhub:BINANCE:ETHUSD',   'finnhub:COINBASE:ETH-USD', 'binance:ETHUSDT'],
};

async function _resolvePrice(source) {
  const colon = source.indexOf(':');
  const type  = source.slice(0, colon);
  const sym   = source.slice(colon + 1);
  if (type === 'finnhub') return _fetchPriceFromFinnhub(sym);
  if (type === 'stooq')   return _fetchPriceFromStooq(sym);
  if (type === 'binance') return _fetchBinancePrice(sym);
  return null;
}

const _pricesCache = { data: null, ts: 0 };
const _PRICES_TTL  = 30_000;

app.get('/api/prices', async (req, res) => {
  if (_pricesCache.data && Date.now() - _pricesCache.ts < _PRICES_TTL) {
    return res.json(_pricesCache.data);
  }
  const results = {};
  await Promise.allSettled(
    Object.entries(_PRICE_SOURCES).map(async ([key, sources]) => {
      for (const source of sources) {
        try {
          const p = await _resolvePrice(source);
          if (p?.price) { results[key] = p; return; }
        } catch(e) {}
      }
    })
  );
  _pricesCache.data = results;
  _pricesCache.ts   = Date.now();
  res.json(results);
});

app.listen(PORT, () => console.log(`Pocket Outlook running on port ${PORT}`));
