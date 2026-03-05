export const DEFINITIONS = {
  "S&P 500": {
    title: "S&P 500",
    body: "The Standard & Poor's 500 — a stock market index tracking the 500 largest publicly traded U.S. companies by market cap. Widely considered the best single gauge of large-cap U.S. equities and a proxy for the overall market.",
    formula: null,
    tip: "Buffett famously recommends most investors simply buy a low-cost S&P 500 index fund and hold it forever."
  },
  "NASDAQ": {
    title: "NASDAQ Composite",
    body: "An index of over 3,000 stocks listed on the NASDAQ exchange, heavily weighted toward technology and growth companies. More volatile than the S&P 500 due to its tech concentration.",
    formula: null,
    tip: "When the NASDAQ significantly diverges from the S&P 500, it often signals a rotation between growth and value stocks."
  },
  "Dow Jones": {
    title: "Dow Jones Industrial Average",
    body: "One of the oldest stock indices — tracks 30 large, blue-chip U.S. companies. Price-weighted (higher-priced stocks have more influence), which makes it less representative than market-cap-weighted indices like the S&P 500.",
    formula: null,
    tip: "Value investors often pay less attention to the Dow than the S&P 500 due to its small sample size and price-weighting methodology."
  },
  "VIX": {
    title: "VIX — CBOE Volatility Index",
    body: "Measures the market's expectation of 30-day volatility, derived from S&P 500 options prices. Often called the Fear Index. Spikes during market stress and falls during calm periods.",
    formula: "Derived from weighted S&P 500 option prices across strikes",
    tip: "Warren Buffett's paraphrase: Be greedy when others are fearful. A high VIX often marks buying opportunities for long-term value investors."
  },
  "3-Mo T-Bill": {
    title: "3-Month Treasury Bill",
    body: "Short-term U.S. government debt maturing in 90 days. Considered the closest thing to a risk-free rate of return. Used as the baseline in many valuation models including CAPM.",
    formula: "Risk-Free Rate — the floor below which no rational investor should accept returns",
    tip: "When T-Bill yields are high, the hurdle rate for stocks rises. A stock must offer returns meaningfully above the T-Bill rate to justify the added risk."
  },
  "10-Yr Treasury": {
    title: "10-Year Treasury Yield",
    body: "The annualized return on U.S. government bonds maturing in 10 years. The most watched interest rate in the world — influences mortgage rates, corporate borrowing costs, and stock valuations.",
    formula: "Often used as the discount rate in DCF valuation models",
    tip: "Rising 10-year yields compress equity valuations, especially for growth stocks with earnings far in the future. Value stocks tend to be more resilient."
  },
  "30-Yr Treasury": {
    title: "30-Year Treasury Yield",
    body: "The yield on 30-year U.S. government bonds. Reflects long-term inflation expectations and growth outlook. A key benchmark for mortgage rates and long-duration asset pricing.",
    formula: null,
    tip: "The spread between 30-year and 2-year yields is a classic recession predictor — inversion has preceded every U.S. recession since 1955."
  },
  "USD Index": {
    title: "U.S. Dollar Index (DXY)",
    body: "Measures the value of the U.S. dollar against a basket of six major currencies (EUR, JPY, GBP, CAD, SEK, CHF). A rising DXY generally pressures commodities, emerging markets, and multinational earnings.",
    formula: "Geometric weighted average: EUR 57.6%, JPY 13.6%, GBP 11.9%, others",
    tip: "For value investors with international exposure, a strong dollar erodes the USD value of foreign earnings — worth factoring into cross-border valuations."
  },
  "CPI": {
    title: "Consumer Price Index (CPI)",
    body: "Measures the average change in prices paid by consumers for goods and services. The primary gauge of inflation in the U.S., published monthly by the Bureau of Labor Statistics.",
    formula: "CPI = (Cost of basket in current period / Cost of basket in base period) x 100",
    tip: "High inflation erodes the real value of fixed cash flows. Value investors prefer businesses with pricing power — the ability to raise prices without losing customers."
  },
  "Fed Funds Rate": {
    title: "Federal Funds Rate",
    body: "The interest rate at which banks lend reserve balances to other banks overnight. Set by the Federal Reserve FOMC. The most influential interest rate in the world — it cascades through all other borrowing costs.",
    formula: null,
    tip: "Low rates make stocks relatively more attractive (TINA — There Is No Alternative). High rates raise the discount rate, compressing valuations across all asset classes."
  },
  "FOMC": {
    title: "Federal Open Market Committee",
    body: "The 12-member committee within the Federal Reserve that sets U.S. monetary policy. Meets 8 times per year to decide whether to raise, lower, or hold the Federal Funds Rate.",
    formula: null,
    tip: "FOMC meeting dates are key calendar events — markets often move significantly on rate decisions and the language in the Fed statement (the dot plot)."
  },
  "Gold Futures": {
    title: "Gold Futures",
    body: "Contracts to buy or sell gold at a predetermined price at a future date. Used by investors as a hedge against inflation, currency debasement, and systemic risk. Gold has no yield but historically preserves purchasing power.",
    formula: null,
    tip: "Buffett famously avoids gold. But many value investors like Lyn Alden hold it as macro insurance against currency debasement scenarios."
  },
  "Brent Crude": {
    title: "Brent Crude Oil",
    body: "The international benchmark for oil prices, sourced from the North Sea. Used to price roughly two-thirds of global oil supplies. A key input into inflation, transportation costs, and energy sector valuations.",
    formula: null,
    tip: "Energy companies are classic value territory — cyclical, capital-intensive, often trading below intrinsic value at cycle lows."
  },
  "Bitcoin": {
    title: "Bitcoin (BTC)",
    body: "The first and largest cryptocurrency by market cap. A decentralized digital asset with a fixed supply of 21 million coins. Increasingly held by institutions as digital gold — a store of value outside the traditional financial system.",
    formula: null,
    tip: "Traditional value investors are divided on Bitcoin. Some like Lyn Alden see it as legitimate macro insurance. Others like Buffett and Munger view it as purely speculative."
  },
  "Ethereum": {
    title: "Ethereum (ETH)",
    body: "The second-largest cryptocurrency — a programmable blockchain platform that enables smart contracts and decentralized applications. ETH is used to pay for computation on the network (gas fees).",
    formula: null,
    tip: "Unlike Bitcoin's fixed supply, Ethereum's issuance model has shifted post-merge. It can be analyzed more like a tech platform — fee revenue and protocol metrics are emerging as valuation tools."
  }
};

const TERM_LOCATIONS = {
  'S&P 500':       { card: 'S&P 500 card',         chart: 'Chart 1 — SPX tab' },
  'NASDAQ':        { card: 'NASDAQ card',           chart: 'Chart 1 — NDX tab' },
  'Dow Jones':     { card: 'Dow Jones card',        chart: 'Chart 1 — DOW tab' },
  'VIX':           { card: 'VIX card',              chart: 'Chart 1 — VIX tab' },
  '3-Mo T-Bill':   { card: 'Rates & Macro section', chart: 'Chart 2 — 3-MO tab' },
  '10-Yr Treasury':{ card: 'Rates & Macro section', chart: 'Chart 2 — 10-YR tab' },
  '30-Yr Treasury':{ card: 'Rates & Macro section', chart: 'Chart 2 — 30-YR tab' },
  'USD Index':     { card: 'Rates & Macro section', chart: 'Chart 2 — DXY tab' },
  'CPI':           { card: 'CPI card',              chart: null },
  'Fed Funds Rate':{ card: 'Fed Funds Rate card',   chart: null },
  'FOMC':          { card: 'Next FOMC Meeting card',chart: null },
  'Gold Futures':  { card: 'Commodities section',   chart: 'Chart 3 — GOLD tab' },
  'Brent Crude':   { card: 'Commodities section',   chart: 'Chart 3 — OIL tab' },
  'Bitcoin':       { card: 'Digital Assets section',chart: 'Chart 3 — BTC tab' },
  'Ethereum':      { card: 'Digital Assets section',chart: 'Chart 3 — ETH tab' },
};

let dictRendered = false;

export function renderDictionary() {
  if (dictRendered) return;
  dictRendered = true;
  const list = document.getElementById('dictList');
  list.innerHTML = '';
  Object.keys(DEFINITIONS).forEach(function(key) {
    const def = DEFINITIONS[key];
    const loc = TERM_LOCATIONS[key] || {};
    const item = document.createElement('div');
    item.className = 'dict-item';
    item.dataset.key = key;
    item.dataset.search = (def.title + ' ' + def.body).toLowerCase();

    const header = document.createElement('div');
    header.className = 'dict-item-header';
    const term = document.createElement('span');
    term.className = 'dict-item-term';
    term.textContent = def.title;
    header.appendChild(term);
    if (loc.card) {
      const tag = document.createElement('span');
      tag.className = 'dict-item-tag';
      tag.textContent = loc.card;
      header.appendChild(tag);
    }
    item.appendChild(header);

    const body = document.createElement('div');
    body.className = 'dict-item-body';
    body.textContent = def.body;
    item.appendChild(body);

    if (def.formula) {
      const form = document.createElement('div');
      form.className = 'dict-item-formula';
      form.textContent = def.formula;
      item.appendChild(form);
    }

    if (loc.chart) {
      const chartLoc = document.createElement('div');
      chartLoc.className = 'dict-item-chartloc';
      chartLoc.textContent = '■ ' + loc.chart;
      item.appendChild(chartLoc);
    }

    if (def.tip) {
      const expandBtn = document.createElement('div');
      expandBtn.className = 'dict-item-expand';
      expandBtn.textContent = '\u25B8 Value Investor Take';
      item.appendChild(expandBtn);
      const tipEl = document.createElement('div');
      tipEl.className = 'dict-item-tip';
      const tipLabel = document.createElement('span');
      tipLabel.className = 'dict-item-tip-label';
      tipLabel.textContent = 'Value Investor Take';
      tipEl.appendChild(tipLabel);
      tipEl.appendChild(document.createTextNode(def.tip));
      item.appendChild(tipEl);
    }

    item.addEventListener('click', function() { item.classList.toggle('expanded'); });
    list.appendChild(item);
  });
}

export function filterDictionary(query) {
  renderDictionary();
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.dict-item').forEach(item => {
    item.style.display = (!q || item.dataset.search.includes(q)) ? '' : 'none';
  });
}

export function toggleDictionary(key) {
  const panel = document.getElementById('dictPanel');
  const overlay = document.getElementById('dictOverlay');
  const isOpen = panel.classList.contains('open');
  if (isOpen && !key) {
    panel.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    panel.classList.add('open');
    overlay.classList.add('open');
    renderDictionary();
    if (key) {
      setTimeout(() => {
        const el = document.querySelector('[data-key="' + key + '"]');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('expanded'); }
      }, 320);
    }
  }
}

export function openDictionary(key) { toggleDictionary(key); }
