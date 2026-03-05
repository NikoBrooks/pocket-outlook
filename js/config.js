export const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
export const FK = 'd6jikipr01qkvh5q2pugd6jikipr01qkvh5q2pv0';
export const FINNHUB = 'https://finnhub.io/api/v1';

// Multiple proxies tried in order
export const PROXIES = [
  'https://corsproxy.io/?url=',       // no caching, best for live data
  'https://api.allorigins.win/raw?url=',
  'https://thingproxy.freeboard.io/fetch/',
];

// Chart data needs fresh prices — always skip cached proxies
export const CHART_PROXIES = [
  'https://corsproxy.io/?url=',       // no cache
  'https://corsproxy.io/?url=',       // retry same
  'https://api.allorigins.win/raw?url=',
];

export const PROXY = PROXIES[0];

export const YAHOO  = 'https://query1.finance.yahoo.com/v8/finance/chart/';
export const YAHOO2 = 'https://query2.finance.yahoo.com/v8/finance/chart/';
