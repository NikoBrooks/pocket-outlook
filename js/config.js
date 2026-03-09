export const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
export const FK = 'd6jikipr01qkvh5q2pugd6jikipr01qkvh5q2pv0';
export const FINNHUB = 'https://finnhub.io/api/v1';

// Our server proxy first (fast, cached); corsproxy.io as browser-side fallback
// for Yahoo Finance which blocks Railway datacenter IPs.
export const PROXIES = [
  '/api/proxy?url=',
  'https://corsproxy.io/?url=',
];

export const CHART_PROXIES = [
  '/api/proxy?url=',
  'https://corsproxy.io/?url=',
];

export const PROXY = PROXIES[0];

export const YAHOO  = 'https://query1.finance.yahoo.com/v8/finance/chart/';
export const YAHOO2 = 'https://query2.finance.yahoo.com/v8/finance/chart/';
