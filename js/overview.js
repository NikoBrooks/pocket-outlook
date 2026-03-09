import { fetchYahoo, fetchFinnhub, fetchCrypto } from './api.js';
import { fmt, fmtLarge, setCard, timeAgo } from './utils.js';
import { RSS2JSON } from './config.js';

// ── Greeting ──
export function setGreeting() {
  const hour = new Date().getHours();
  const m = ["Let's FUCK!", "I'm jacked to the TITS!", "Be first, be smarter, or cheat."];
  const a = ["We have to act now!", "Summer 2013 Cape Cod is calling...", "I work, my wife shops."];
  const e = ["Where's the bag?", "Anyone got an adderall?", "God, I miss quaaludes."];
  const n = ["\u00c7a va sans dire.", "Party like it's 2008.", "Seeking alpha I see..."];
  let pool;
  if (hour >= 5 && hour < 12) pool = m;
  else if (hour >= 12 && hour < 17) pool = a;
  else if (hour >= 17 && hour < 21) pool = e;
  else pool = n;
  const el = document.getElementById('greeting-text');
  if (el) el.textContent = pool[Math.floor(Math.random() * pool.length)];
}

// ── VIX Label ──
export function setVixLabel(val) {
  const el = document.getElementById('vix-label');
  if (!el) return;
  if (val < 15)      { el.textContent = '● Low Volatility';   el.style.color = 'var(--green)'; }
  else if (val < 20) { el.textContent = '● Moderate';          el.style.color = '#f0c040'; }
  else if (val < 30) { el.textContent = '● Elevated Stress';   el.style.color = '#ff9040'; }
  else               { el.textContent = '● Extreme Fear';      el.style.color = 'var(--red)'; }
}

// ── Fed Data ──
export function loadFedData() {
  document.getElementById('card-fedrate').className = 'card neutral';
  document.getElementById('fedrate-price').textContent = '4.25% – 4.50%';
  document.getElementById('fedrate-change').textContent = 'Held — Jan 29, 2025';
  document.getElementById('fedrate-sub').textContent = 'Federal Reserve';
  const fomcDates = [new Date('2026-03-18'),new Date('2026-05-06'),new Date('2026-06-17'),new Date('2026-07-29'),new Date('2026-09-16'),new Date('2026-10-28'),new Date('2026-12-09'),new Date('2027-01-27'),new Date('2027-03-17'),new Date('2027-05-05')];
  const now = new Date();
  const next = fomcDates.find(d => d > now);
  if (next) {
    const diff = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
    document.getElementById('fedmeeting-price').textContent = next.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('fedmeeting-sub').textContent = diff + ' days away';
    document.getElementById('card-fedmeeting').className = 'card neutral';
  }
}

// ── Status ──
let successCount = 0, totalFetches = 0;
function updateStatus() {
  const el = document.getElementById('fetch-status');
  if (el) el.textContent = successCount + '/' + totalFetches + ' sources loaded';
}

// ── Fetch All Market Data ──
export async function fetchAll() {
  const btn = document.getElementById('refresh-btn');
  if (btn) {
    btn.classList.add('spinning');
    const frames = ['◐','◓','◑','◒'];
    let fi = 0;
    btn._spinner = setInterval(() => { btn.textContent = frames[fi++ % 4]; }, 150);
  }
  successCount = 0; totalFetches = 13; updateStatus();

  function ok(id, d, suffix, dec) { setCard(id, d.price, d.change, d.pct, suffix || '', dec || 2); successCount++; updateStatus(); }
  function fail(id) { const el = document.getElementById(id+'-price'); if(el) el.innerHTML = '<span class="error-text">unavailable</span>'; }

  const tasks = [
    fetchYahoo('%5EGSPC').then(d=>ok('spx',d)).catch(()=>fetchFinnhub('SPY').then(d=>ok('spx',d)).catch(()=>fail('spx'))),
    fetchYahoo('%5EIXIC').then(d=>ok('ndx',d)).catch(()=>fetchFinnhub('QQQ').then(d=>ok('ndx',d)).catch(()=>fail('ndx'))),
    fetchYahoo('%5EDJI').then(d=>ok('dji',d)).catch(()=>fetchFinnhub('DIA').then(d=>ok('dji',d)).catch(()=>fail('dji'))),
    fetchYahoo('%5EVIX')
      .catch(() => fetchFinnhub('^VIX'))
      .then(d=>{
        const card=document.getElementById('card-vix'),priceEl=document.getElementById('vix-price'),changeEl=document.getElementById('vix-change');
        const up=d.change>=0; card.className='card '+(up?'down':'up');
        priceEl.textContent=fmt(d.price); changeEl.className='change '+(up?'down':'up');
        changeEl.textContent=(up?'+':'')+fmt(d.change)+' ('+(up?'+':'')+fmt(d.pct)+'%)';
        setVixLabel(d.price); successCount++; updateStatus();
      }).catch(()=>fail('vix')),
    fetchYahoo('%5ETNX').then(d=>ok('tny',d,'%',3)).catch(()=>fetchFinnhub('IEF').then(d=>ok('tny',d)).catch(()=>fail('tny'))),
    fetchYahoo('%5EIRX').then(d=>ok('tbill',d,'%',3)).catch(()=>fetchFinnhub('SHV').then(d=>ok('tbill',d)).catch(()=>fail('tbill'))),
    fetchYahoo('%5ETYX').then(d=>ok('tny30',d,'%',3)).catch(()=>fetchFinnhub('TLT').then(d=>ok('tny30',d)).catch(()=>fail('tny30'))),
    fetchYahoo('DX-Y.NYB').then(d=>ok('dxy',d)).catch(()=>fetchFinnhub('UUP').then(d=>ok('dxy',d)).catch(()=>fail('dxy'))),
    fetchYahoo('GC%3DF').then(d=>ok('gold',d)).catch(()=>fetchFinnhub('GLD').then(d=>ok('gold',d)).catch(()=>fail('gold'))),
    fetchYahoo('BZ%3DF').then(d=>ok('oil',d)).catch(()=>fetchFinnhub('USO').then(d=>ok('oil',d)).catch(()=>fail('oil'))),
    fetchCrypto('bitcoin').then(d=>ok('btc',d)).catch(()=>fail('btc')),
  ];
  fetchCrypto('ethereum').then(d=>{ok('eth',d); successCount++; updateStatus();}).catch(()=>fail('eth'));

  document.getElementById('card-cpi').className = 'card neutral';
  document.getElementById('cpi-price').textContent = '2.9%';
  document.getElementById('cpi-change').className = 'change neutral';
  document.getElementById('cpi-change').textContent = 'Monthly BLS Release';
  document.getElementById('cpi-date').textContent = 'Jan 2025 — Next release Mar 12, 2025';

  await Promise.allSettled(tasks);
  const now = new Date();
  const el = document.getElementById('last-updated');
  if (el) el.textContent = 'Updated ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (btn) { clearInterval(btn._spinner); btn.textContent = '↻ Refresh'; btn.classList.remove('spinning'); }
}

// ── News / RSS ──
const RSS_FEEDS = {
  nyt: { urls: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
  ], elId: 'news-nyt', timeId: 'nyt-time' },
  mw: { urls: [
    'https://www.marketwatch.com/rss/topstories',
    'https://www.marketwatch.com/rss/marketpulse',
    'https://feeds.content.dowjones.io/public/rss/mw_topstories',
  ], elId: 'news-mw', timeId: 'mw-time' },
  bbg: { urls: [
    'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml',
    'https://feeds.feedburner.com/zerohedge/feed',
    'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
  ], elId: 'news-bbg', timeId: 'bbg-time' }
};

// ── Sentiment Analysis ──
const BULLISH_WORDS = ['surge','rally','soar','gain','rise','jump','climb','record','high','bull','boom','growth','strong','profit','beat','exceed','upgrade','positive','optimism','recovery','rebound'];
const BEARISH_WORDS = ['crash','fall','drop','plunge','decline','loss','slump','bear','recession','weak','miss','downgrade','fear','risk','concern','warning','cut','layoff','tariff','inflation','deficit','debt'];

function analyzeSentiment(headlines) {
  let score = 0;
  for (const h of headlines) {
    const lower = h.toLowerCase();
    for (const w of BULLISH_WORDS) if (lower.includes(w)) score++;
    for (const w of BEARISH_WORDS) if (lower.includes(w)) score--;
  }
  const n = headlines.length || 1;
  const norm = Math.max(-1, Math.min(1, score / n));
  return norm;
}

function setSentiment(key, headlines) {
  const score = analyzeSentiment(headlines);
  const tagEl = document.getElementById(key + '-sentiment-tag');
  const scoreEl = document.getElementById(key + '-sentiment-score');
  const fillEl = document.getElementById(key + '-sentiment-fill');
  if (!tagEl || !fillEl) return;

  const pct = Math.abs(score) * 48;
  const isBull = score >= 0.1;
  const isBear = score <= -0.1;

  if (isBull) {
    tagEl.textContent = '▲ Bullish';
    tagEl.style.color = 'var(--green)';
    fillEl.style.background = 'var(--green)';
    fillEl.style.left = '50%';
    fillEl.style.width = pct + '%';
  } else if (isBear) {
    tagEl.textContent = '▼ Bearish';
    tagEl.style.color = 'var(--red)';
    fillEl.style.background = 'var(--red)';
    fillEl.style.left = (50 - pct) + '%';
    fillEl.style.width = pct + '%';
  } else {
    tagEl.textContent = '● Neutral';
    tagEl.style.color = 'var(--muted)';
    fillEl.style.background = 'var(--muted)';
    fillEl.style.left = '48%';
    fillEl.style.width = '4%';
  }
  scoreEl.textContent = (score >= 0 ? '+' : '') + (score * 100).toFixed(0) + ' sentiment';
}

async function fetchRSS(key) {
  const feed = RSS_FEEDS[key];
  const listEl = document.getElementById(feed.elId);
  const timeEl = document.getElementById(feed.timeId);

  function dec(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }

  function parseXML(txt) {
    const xml = new DOMParser().parseFromString(txt, 'text/xml');
    const nodes = Array.from(xml.querySelectorAll('item'));
    if (!nodes.length) throw new Error('no items');
    return nodes.map(n => {
      const raw = n.querySelector('link');
      const link = raw ? (raw.textContent || raw.nextSibling?.nodeValue || '#') : '#';
      return {
        title: n.querySelector('title')?.textContent || '',
        link: link.trim() || '#',
        pubDate: n.querySelector('pubDate')?.textContent || ''
      };
    });
  }

  function render(items) {
    if (!items || !items.length) throw new Error('empty');
    listEl.innerHTML = '';
    let count = 0;
    for (const item of items) {
      if (count >= 6) break;
      const title = dec((item.title || '').trim());
      if (!title || title.length < 8) continue;
      const a = document.createElement('a');
      a.className = 'news-item';
      a.href = item.link || '#';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const headline = document.createElement('div');
      headline.className = 'news-headline';
      headline.textContent = title;
      const meta = document.createElement('div');
      meta.className = 'news-meta';
      meta.textContent = timeAgo(item.pubDate || item.published || '');
      a.appendChild(headline);
      a.appendChild(meta);
      listEl.appendChild(a);
      count++;
    }
    if (count === 0) throw new Error('no valid items');
    timeEl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setSentiment(key, items.map(i => i.title || '').filter(Boolean));
  }

  for (const rssUrl of feed.urls) {
    try {
      const r = await fetch(RSS2JSON + encodeURIComponent(rssUrl) + '&count=10');
      const d = await r.json();
      if (d.status === 'ok' && d.items && d.items.length) { render(d.items); return; }
    } catch(e) {}

    try {
      const r = await fetch('/api/proxy?url=' + encodeURIComponent(rssUrl));
      const txt = await r.text();
      render(parseXML(txt)); return;
    } catch(e) {}
  }

  listEl.innerHTML = '<div class="news-loading">Headlines unavailable — will retry</div>';
  timeEl.textContent = '—';
}

export function loadAllNews() {
  fetchRSS('nyt');
  setTimeout(() => fetchRSS('mw'), 800);
  setTimeout(() => fetchRSS('bbg'), 1600);
}

// ── Clock ──
export function updateClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
}
