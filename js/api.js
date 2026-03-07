import { PROXIES, CHART_PROXIES, YAHOO, YAHOO2, FINNHUB, FK, RSS2JSON } from './config.js';
import { fetchWithTimeout } from './utils.js';

export async function fetchYahoo(symbol) {
  const yahooUrls = [
    YAHOO + symbol + '?range=1d&interval=1m',
    YAHOO2 + symbol + '?range=1d&interval=1m',
  ];
  let data;
  for (const proxy of PROXIES) {
    for (const yurl of yahooUrls) {
      if (data?.chart?.result?.[0]) break;
      try {
        const res = await fetch(proxy + encodeURIComponent(yurl + '&_cb=' + Date.now() + '_' + Math.random().toString(36).slice(2)), {cache: 'no-store'});
        if (!res.ok) continue;
        const j = await res.json();
        if (j?.chart?.result?.[0]) { data = j; break; }
      } catch(e) {}
    }
    if (data?.chart?.result?.[0]) break;
  }
  if (!data?.chart?.result?.[0]) throw new Error('No data for ' + symbol);
  const meta = data.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  const prev = meta.previousClose || meta.chartPreviousClose;
  const change = price - prev;
  const pct = (change / prev) * 100;
  return { price, change, pct };
}

export async function fetchFinnhub(symbol) {
  const url = FINNHUB + '/quote?symbol=' + symbol + '&token=' + FK;
  const res = await fetch(url);
  const d = await res.json();
  if (!d || d.c == null) throw new Error('No Finnhub data for ' + symbol);
  const price = d.c !== 0 ? d.c : d.pc;
  return { price, change: d.d || 0, pct: d.dp || 0 };
}

// Finnhub fundamentals: direct API, no CORS proxy needed, much more reliable than Yahoo quoteSummary
export async function fetchFinnhubFundamentals(symbol) {
  try {
    const [mRes, pRes] = await Promise.all([
      fetchWithTimeout(FINNHUB + '/stock/metric?symbol=' + symbol + '&metric=all&token=' + FK, {}, 8000),
      fetchWithTimeout(FINNHUB + '/stock/profile2?symbol=' + symbol + '&token=' + FK, {}, 8000)
    ]);
    const mj = mRes.ok ? await mRes.json() : null;
    const pj = pRes.ok ? await pRes.json() : null;
    const m = mj?.metric || {};
    if (!Object.keys(m).length && !pj?.name) return null;

    const mktCapRaw = ((m.marketCapitalization || pj?.marketCapitalization) || null);
    const mktCap = mktCapRaw ? mktCapRaw * 1e6 : null;
    const sharesOut = pj?.shareOutstanding ? pj.shareOutstanding * 1e6 : null;

    return {
      _profile: pj,
      price: {
        marketCap: mktCap,
        sharesOutstanding: sharesOut,
        trailingPE: m.peTTM ?? null,
        priceToBook: m.pbAnnual ?? null,
        epsTrailingTwelveMonths: m.epsBasicExclExtraItemsTTM ?? m.epsNormalizedAnnual ?? null,
        beta: m.beta ?? null,
        averageDailyVolume3Month: m['10DayAverageTradingVolume'] != null ? m['10DayAverageTradingVolume'] * 1e6 : null,
      },
      summaryDetail: {
        fiftyTwoWeekHigh: m['52WeekHigh'] ?? null,
        fiftyTwoWeekLow: m['52WeekLow'] ?? null,
        trailingPE: m.peTTM ?? null,
        beta: m.beta ?? null,
        averageDailyVolume3Month: m['10DayAverageTradingVolume'] != null ? m['10DayAverageTradingVolume'] * 1e6 : null,
      },
      financialData: {
        grossMargins: m.grossMarginTTM != null ? m.grossMarginTTM / 100 : null,
        operatingMargins: m.operatingMarginTTM != null ? m.operatingMarginTTM / 100 : null,
        profitMargins: m.netProfitMarginTTM != null ? m.netProfitMarginTTM / 100 : null,
        returnOnEquity: m.roeTTM != null ? m.roeTTM / 100 : (m.roeRfy != null ? m.roeRfy / 100 : null),
        returnOnAssets: m.roaTTM != null ? m.roaTTM / 100 : (m.roaRfy != null ? m.roaRfy / 100 : null),
        debtToEquity: m['totalDebt/totalEquityAnnual'] != null ? m['totalDebt/totalEquityAnnual'] * 100 : null,
        currentRatio: m.currentRatioAnnual ?? null,
        freeCashflow: m.freeCashFlowTTM != null ? m.freeCashFlowTTM * 1e6 : (m.freeCashFlowAnnual != null ? m.freeCashFlowAnnual * 1e6 : null),
        totalRevenue: m.revenueTTM != null ? m.revenueTTM * 1e6 : null,
        dividendYield: m.dividendYieldIndicatedAnnual != null ? m.dividendYieldIndicatedAnnual / 100 : null,
        ebitdaPerShare: m.ebitdaPerShareTTM ?? null,
        // Total EBITDA: per-share × shares outstanding (Finnhub shareOutstanding is in millions)
        ebitda: m.ebitdaPerShareTTM != null && pj?.shareOutstanding != null
          ? m.ebitdaPerShareTTM * pj.shareOutstanding * 1e6 : null,
      },
      defaultKeyStatistics: {
        priceToSalesTrailing12Months: m.psTTM ?? null,
        enterpriseToEbitda: m['ev/ebitda'] ?? null,
      }
    };
  } catch(e) { return null; }
}

export async function fetchCrypto(id) {
  const cgUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=' + id + '&vs_currencies=usd&include_24hr_change=true';
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(cgUrl));
      if (!res.ok) continue;
      const data = await res.json();
      if (!data[id]) continue;
      const price = data[id].usd;
      const pct = data[id].usd_24h_change;
      return { price, change: price * (pct / 100), pct };
    } catch(e) {}
  }
  throw new Error('Crypto fetch failed for ' + id);
}

export async function fetchChartData(symbol, range, interval) {
  let data;
  for (const proxy of CHART_PROXIES) {
    for (const base of [YAHOO, YAHOO2]) {
      if (data?.chart?.result?.[0]) break;
      try {
        const res = await fetch(proxy + encodeURIComponent(base + symbol + '?range=' + range + '&interval=' + interval + '&_cb=' + Date.now() + '_' + Math.random().toString(36).slice(2)), {cache: 'no-store'});
        if (!res.ok) continue;
        const j = await res.json();
        if (j?.chart?.result?.[0]) { data = j; break; }
      } catch(e) {}
    }
    if (data?.chart?.result?.[0]) break;
  }
  if (!data?.chart?.result?.[0]) throw new Error('No chart data');
  const result = data.chart.result[0];
  const meta = result.meta;
  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      const d = new Date(timestamps[i] * 1000);
      let label;
      if (interval === '5m' || interval === '30m') label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      else if (interval === '1wk') label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      points.push({ x: label, y: closes[i] });
    }
  }
  let finalPoints = points;
  const livePrice = (interval === '5m' || interval === '30m') ? meta.regularMarketPrice : null;
  const prevClose = (interval === '5m' || interval === '30m') ? (meta.previousClose || meta.chartPreviousClose) : null;

  if (interval === '5m' || interval === '30m') {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayTimestamps = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (new Date(timestamps[i] * 1000) >= todayStart && closes[i] != null) {
        todayTimestamps.push(i);
      }
    }
    if (todayTimestamps.length > 5) {
      finalPoints = todayTimestamps.map(i => {
        const d = new Date(timestamps[i] * 1000);
        const label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return { x: label, y: closes[i] };
      });
    }
    if (livePrice && finalPoints.length > 0) {
      const nowLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      finalPoints = [...finalPoints, { x: nowLabel, y: livePrice }];
    }
  }

  return { points: finalPoints, livePrice, prevClose };
}

export async function fetchYahooV7Quote(symbol) {
  const yurls = [
    'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + symbol,
    'https://query2.finance.yahoo.com/v7/finance/quote?symbols=' + symbol,
  ];
  for (const proxy of PROXIES) {
    for (const yurl of yurls) {
      try {
        const res = await fetchWithTimeout(proxy + encodeURIComponent(yurl + '&_cb=' + Date.now()), { cache: 'no-store' }, 5000);
        if (!res.ok) continue;
        const j = await res.json();
        const result = j?.quoteResponse?.result?.[0];
        if (result) return result;
      } catch(e) {}
    }
  }
  return null;
}

export async function searchTickers(query) {
  const q = query.trim();
  if (!q) return [];
  const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=8&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query';
  for (const proxy of PROXIES) {
    try {
      const res = await fetchWithTimeout(proxy + encodeURIComponent(url), {}, 4000);
      if (!res.ok) continue;
      const j = await res.json();
      const quotes = j?.finance?.result?.[0]?.quotes || j?.quotes || [];
      if (!quotes.length) continue;
      return quotes
        .filter(r => r.symbol && (r.quoteType === 'EQUITY' || r.quoteType === 'ETF' || r.quoteType === 'INDEX' || r.quoteType === 'MUTUALFUND'))
        .slice(0, 7)
        .map(r => ({ symbol: r.symbol, name: r.longname || r.shortname || r.symbol, type: r.quoteType, exchange: r.exchange }));
    } catch(e) {}
  }
  return [];
}

export async function fetchFundamentals(symbol) {
  const modules = 'price,summaryDetail,financialData,defaultKeyStatistics';
  const apiUrls = [
    'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + symbol + '?modules=' + modules + '&formatted=false&_cb=',
    'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + symbol + '?modules=' + modules + '&formatted=false&_cb=',
    'https://query1.finance.yahoo.com/v11/finance/quoteSummary/' + symbol + '?modules=' + modules + '&formatted=false&_cb=',
    'https://query2.finance.yahoo.com/v11/finance/quoteSummary/' + symbol + '?modules=' + modules + '&formatted=false&_cb=',
  ];
  for (const proxy of PROXIES) {
    for (const base of apiUrls) {
      try {
        const res = await fetchWithTimeout(proxy + encodeURIComponent(base + Date.now()), { cache: 'no-store' }, 5000);
        if (!res.ok) continue;
        const j = await res.json();
        if (j?.quoteSummary?.result?.[0]) return j.quoteSummary.result[0];
      } catch(e) {}
    }
  }
  return null;
}

// ── SEC EDGAR Fundamentals ──
let _edgarCikCache = null;

async function getEdgarCik(ticker) {
  if (!_edgarCikCache) {
    try {
      const res = await fetchWithTimeout('https://data.sec.gov/files/company_tickers.json', {}, 20000);
      if (!res.ok) return null;
      _edgarCikCache = await res.json();
    } catch(e) { return null; }
  }
  const upper = ticker.toUpperCase();
  const entries = Object.values(_edgarCikCache);
  const exact = entries.find(e => e.ticker.toUpperCase() === upper);
  if (exact) return String(exact.cik_str).padStart(10, '0');
  // Dual-class share fallback: RUSHA→RUSH, RUSHB→RUSH, GOOGL→GOOG, BRK.A→BRK
  const variants = [upper.slice(0, -1), upper.replace(/\.[A-Z]$/, '')];
  for (const v of variants) {
    if (v && v !== upper) {
      const match = entries.find(e => e.ticker.toUpperCase() === v);
      if (match) return String(match.cik_str).padStart(10, '0');
    }
  }
  return null;
}

export async function fetchEdgarFundamentals(ticker) {
  try {
    const cik = await getEdgarCik(ticker);
    if (!cik) return null;

    // ── Per-concept API: fetch each concept individually (~10-50KB each) ──
    // This replaces the old companyfacts approach (5-30MB single file, frequent timeouts).
    // All 25 requests fire in parallel; browser queues them naturally (~6 at a time via HTTP/2).
    const base = 'https://data.sec.gov/api/xbrl/companyconcept/CIK' + cik + '/us-gaap/';
    const _sources = {};

    async function getConcept(tag) {
      try {
        const res = await fetchWithTimeout(base + tag + '.json', {}, 10000);
        return res.ok ? await res.json() : null;
      } catch(e) { return null; }
    }

    const [
      cRev1, cRev2, cRev3, cRev4, cRev5, cRev6,
      cOpInc, cGrossProfit, cNetInc, cEpsDil,
      cDa1, cDa2,
      cOpCF, cCapex1, cCapex2,
      cCash1, cCash2, cLtDebt1, cLtDebt2,
      cShares, cCurrentA, cCurrentL, cAssets, cEquity1, cEquity2, cLiab,
    ] = await Promise.all([
      getConcept('RevenueFromContractWithCustomerExcludingAssessedTax'),
      getConcept('RevenueFromContractWithCustomerIncludingAssessedTax'),
      getConcept('Revenues'),
      getConcept('SalesRevenueNet'),
      getConcept('NetRevenues'),
      getConcept('OperatingRevenue'),
      getConcept('OperatingIncomeLoss'),
      getConcept('GrossProfit'),
      getConcept('NetIncomeLoss'),
      getConcept('EarningsPerShareDiluted'),
      getConcept('DepreciationDepletionAndAmortization'),
      getConcept('DepreciationAndAmortization'),
      getConcept('NetCashProvidedByUsedInOperatingActivities'),
      getConcept('PaymentsToAcquirePropertyPlantAndEquipment'),
      getConcept('CapitalExpenditureContinuingOperations'),
      getConcept('CashAndCashEquivalentsAtCarryingValue'),
      getConcept('CashCashEquivalentsAndShortTermInvestments'),
      getConcept('LongTermDebt'),
      getConcept('LongTermDebtNoncurrent'),
      getConcept('CommonStockSharesOutstanding'),
      getConcept('AssetsCurrent'),
      getConcept('LiabilitiesCurrent'),
      getConcept('Assets'),
      getConcept('StockholdersEquity'),
      getConcept('StockholdersEquityAttributableToParent'),
      getConcept('Liabilities'),
    ]);

    const getUSD    = c => c?.units?.USD             || [];
    const getUSDps  = c => c?.units?.['USD/shares']  || [];
    const getSharesU = c => c?.units?.shares          || [];

    const filterPeriod  = es => es.filter(e => (e.form === '10-Q' || e.form === '10-K') && e.val != null && e.start);
    const filterInstant = es => es.filter(e => (e.form === '10-Q' || e.form === '10-K') && e.val != null);
    const pd = e => (new Date(e.end) - new Date(e.start)) / 86400000;

    function ttmFull(entries) {
      const f = filterPeriod(entries).sort((a, b) => {
        const d = new Date(b.end) - new Date(a.end);
        return d !== 0 ? d : pd(b) - pd(a);
      });
      if (!f.length) return null;
      const recentK = f.find(e => e.form === '10-K' && pd(e) > 340);
      const recentQ = f.find(e => e.form === '10-Q' && pd(e) > 60);
      if (!recentQ && !recentK) return null;
      if (!recentQ) return { val: recentK.val, entry: recentK, method: 'Annual' };
      if (!recentK) {
        const d = pd(recentQ);
        return { val: recentQ.val * (365 / d), entry: recentQ, method: 'Annualized from ' + (recentQ.fp || 'Q') };
      }
      if (new Date(recentK.end) >= new Date(recentQ.end)) return { val: recentK.val, entry: recentK, method: 'Annual' };
      const qDate = new Date(recentQ.end), qd = pd(recentQ);
      const priorQ = f.find(e => {
        if (e.form !== '10-Q') return false;
        const diff = (qDate - new Date(e.end)) / 86400000;
        return diff > 300 && diff < 420 && Math.abs(pd(e) - qd) < 30;
      });
      if (!priorQ) return { val: recentK.val, entry: recentK, method: 'Annual (prior-year Q unavailable)' };
      return { val: recentK.val + recentQ.val - priorQ.val, entry: recentK, method: 'TTM: ' + recentK.end.slice(0,4) + ' annual + ' + recentQ.fp + ' − prior yr' };
    }

    function mrFull(entries) {
      const f = filterInstant(entries).sort((a, b) => new Date(b.end) - new Date(a.end));
      return f[0] ? { val: f[0].val, entry: f[0], method: 'Most recent balance sheet' } : null;
    }

    function saveSrc(key, tag, r) {
      _sources[key] = { type: 'edgar', tag, form: r.entry.form, period: (r.entry.fp || 'FY') + ' ' + (r.entry.end?.slice(0, 4) || ''), end: r.entry.end, filed: r.entry.filed, accn: r.entry.accn, cik, method: r.method };
    }

    function extractP(key, pairs) {
      for (const [c, tag] of pairs) { const r = ttmFull(getUSD(c)); if (r?.val != null) { saveSrc(key, tag, r); return r.val; } }
      return null;
    }
    function extractI(key, pairs) {
      for (const [c, tag] of pairs) { const r = mrFull(getUSD(c)); if (r?.val != null) { saveSrc(key, tag, r); return r.val; } }
      return null;
    }
    function extractPPS(key, pairs) {
      for (const [c, tag] of pairs) { const r = ttmFull(getUSDps(c)); if (r?.val != null) { saveSrc(key, tag, r); return r.val; } }
      return null;
    }
    function extractISh(key, pairs) {
      for (const [c, tag] of pairs) { const r = mrFull(getSharesU(c)); if (r?.val != null) { saveSrc(key, tag, r); return r.val; } }
      return null;
    }

    // ── Income statement (TTM) ──
    const revenue        = extractP('revenue', [
      [cRev1, 'RevenueFromContractWithCustomerExcludingAssessedTax'],
      [cRev2, 'RevenueFromContractWithCustomerIncludingAssessedTax'],
      [cRev3, 'Revenues'],
      [cRev4, 'SalesRevenueNet'],
      [cRev5, 'NetRevenues'],
      [cRev6, 'OperatingRevenue'],
    ]);
    const grossProfit    = extractP('grossProfit',    [[cGrossProfit, 'GrossProfit']]);
    const operatingIncome = extractP('operatingIncome', [[cOpInc, 'OperatingIncomeLoss']]);
    const netIncome      = extractP('netIncome',      [[cNetInc, 'NetIncomeLoss']]);
    const epsDiluted     = extractPPS('epsDiluted',   [[cEpsDil, 'EarningsPerShareDiluted']]);
    const da             = extractP('da', [[cDa1, 'DepreciationDepletionAndAmortization'], [cDa2, 'DepreciationAndAmortization']]);

    // ── Cash flow (TTM) ──
    const operatingCF    = extractP('operatingCF', [[cOpCF, 'NetCashProvidedByUsedInOperatingActivities']]);
    const capexRaw       = extractP('capex', [[cCapex1, 'PaymentsToAcquirePropertyPlantAndEquipment'], [cCapex2, 'CapitalExpenditureContinuingOperations']]);
    const capex          = capexRaw != null ? Math.abs(capexRaw) : null;
    const freeCashFlow   = operatingCF != null && capex != null ? operatingCF - capex : null;

    // ── Balance sheet (most recent) ──
    const totalAssets        = extractI('totalAssets',        [[cAssets, 'Assets']]);
    const currentAssets      = extractI('currentAssets',      [[cCurrentA, 'AssetsCurrent']]);
    const currentLiabilities = extractI('currentLiabilities', [[cCurrentL, 'LiabilitiesCurrent']]);
    const totalLiabilities   = extractI('totalLiabilities',   [[cLiab, 'Liabilities']]);
    const equity             = extractI('equity',             [[cEquity1, 'StockholdersEquity'], [cEquity2, 'StockholdersEquityAttributableToParent']]);
    const cash               = extractI('cash',               [[cCash1, 'CashAndCashEquivalentsAtCarryingValue'], [cCash2, 'CashCashEquivalentsAndShortTermInvestments']]);
    const longTermDebt       = extractI('longTermDebt',       [[cLtDebt1, 'LongTermDebt'], [cLtDebt2, 'LongTermDebtNoncurrent']]);
    const sharesOut          = extractISh('sharesOut',        [[cShares, 'CommonStockSharesOutstanding']]);

    // Return null if we got nothing useful (e.g. company doesn't file XBRL)
    if (!revenue && !netIncome && !operatingCF && !totalAssets) return null;

    // ── Computed ──
    const grossMargin  = grossProfit != null && revenue     ? grossProfit / revenue     : null;
    const opMargin     = operatingIncome != null && revenue ? operatingIncome / revenue : null;
    const netMargin    = netIncome != null && revenue       ? netIncome / revenue       : null;
    const roe          = netIncome != null && equity && equity !== 0 ? netIncome / equity : null;
    const roa          = netIncome != null && totalAssets   ? netIncome / totalAssets   : null;
    const currentRatio = currentAssets != null && currentLiabilities ? currentAssets / currentLiabilities : null;
    const debtToEquity = longTermDebt != null && equity && equity > 0 ? longTermDebt / equity : null;
    const ebitda       = operatingIncome != null && da != null ? operatingIncome + da : operatingIncome;
    const netDebt      = cash != null ? (longTermDebt ?? 0) - cash : (longTermDebt != null ? longTermDebt : null);

    const cmp = (key, f) => { _sources[key] = { type: 'computed', formula: f }; };
    if (freeCashFlow != null) cmp('freeCashFlow', 'Operating Cash Flow − Capital Expenditures');
    if (grossMargin  != null) cmp('grossMargin',  'Gross Profit ÷ Revenue');
    if (opMargin     != null) cmp('opMargin',     'Operating Income ÷ Revenue');
    if (netMargin    != null) cmp('netMargin',    'Net Income ÷ Revenue');
    if (roe          != null) cmp('roe',          'Net Income ÷ Stockholders\' Equity');
    if (roa          != null) cmp('roa',          'Net Income ÷ Total Assets');
    if (currentRatio != null) cmp('currentRatio', 'Current Assets ÷ Current Liabilities');
    if (debtToEquity != null) cmp('debtToEquity', 'Long-Term Debt ÷ Stockholders\' Equity');
    if (ebitda       != null) cmp('ebitda',       'Operating Income + Depreciation & Amortization');

    let website = null;
    try {
      const subRes = await fetchWithTimeout('https://data.sec.gov/submissions/CIK' + cik + '.json', {}, 6000);
      if (subRes.ok) { const sub = await subRes.json(); website = sub.website || null; }
    } catch(e) {}

    return {
      _source: 'edgar', _sources, _cik: cik, website,
      revenue, grossProfit, operatingIncome, netIncome, epsDiluted, da, ebitda,
      operatingCF, freeCashFlow,
      totalAssets, currentAssets, currentLiabilities, totalLiabilities,
      equity, cash, longTermDebt, sharesOut, netDebt,
      grossMargin, opMargin, netMargin, roe, roa, currentRatio, debtToEquity,
    };
  } catch(e) {
    console.warn('EDGAR fetch failed:', e);
    return null;
  }
}

export async function fetchEqChartData(symbol, range, interval) {
  let data;
  for (const proxy of CHART_PROXIES) {
    for (const base of [YAHOO, YAHOO2]) {
      if (data?.chart?.result?.[0]) break;
      try {
        const res = await fetch(proxy + encodeURIComponent(base + symbol + '?range=' + range + '&interval=' + interval + '&_cb=' + Date.now() + '_' + Math.random().toString(36).slice(2)), { cache: 'no-store' });
        if (!res.ok) continue;
        const j = await res.json();
        if (j?.chart?.result?.[0]) { data = j; break; }
      } catch(e) {}
    }
    if (data?.chart?.result?.[0]) break;
  }
  if (!data?.chart?.result?.[0]) throw new Error('No chart data for ' + symbol);
  const result = data.chart.result[0];
  const meta = result.meta;
  const timestamps = result.timestamp || [];
  const quote = result.indicators.quote[0];
  const opens = quote.open || [], highs = quote.high || [], lows = quote.low || [], closes = quote.close || [], volumes = quote.volume || [];
  const isIntraday = interval === '5m' || interval === '30m';
  const is1D = interval === '5m';
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const linePoints = [], ohlcPoints = [], volumePoints = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i] * 1000;
    const d = new Date(ts);
    if (is1D && d < todayStart) continue;
    if (closes[i] == null) continue;
    let label;
    if (isIntraday) label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    else if (interval === '1wk') label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    else label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const prevClose2 = i > 0 ? closes[i - 1] : closes[i];
    linePoints.push({ x: ts, y: closes[i] });
    volumePoints.push({ x: ts, y: volumes[i] || 0, up: closes[i] >= prevClose2 });
    if (opens[i] != null && highs[i] != null && lows[i] != null) {
      ohlcPoints.push({ x: ts, o: opens[i], h: highs[i], l: lows[i], c: closes[i] });
    }
  }
  const livePrice = is1D ? meta.regularMarketPrice : null;
  const prevClose = is1D ? (meta.previousClose || meta.chartPreviousClose) : null;
  if (is1D && livePrice && linePoints.length > 0) {
    const nowTs = Date.now();
    linePoints.push({ x: nowTs, y: livePrice });
    volumePoints.push({ x: nowTs, y: 0, up: true });
  }
  return { linePoints, ohlcPoints, volumePoints, livePrice, prevClose, meta };
}
