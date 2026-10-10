const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const key = process.env.SERPAPI_KEY;
const cache = new Map();
let requestsThisRun = 0;
const allowedOrigins = new Set(['https://phillykbeautytown.com', 'https://www.phillykbeautytown.com']);
function send(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  const url = new URL(req.url, 'http://127.0.0.1:3000');
  if (url.pathname === '/health') return send(res, 200, {ok:true});
  if (req.method !== 'GET') return send(res, 405, {error:'Only GET requests are supported.'});
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }
  if (url.pathname !== '/api/search') return send(res, 404, {error:'Not found.'});
  if (!key) return send(res, 503, {error:'Search is not configured. Add SERPAPI_KEY in the hosting environment settings.'});
  const query = (url.searchParams.get('q') || '').trim();
  if (!query || query.length > 200) return send(res, 400, {error:'Enter an item name of 1–200 characters.'});
  const cached = cache.get(query.toLowerCase());
  if (cached && Date.now() - cached.time < 600000) return send(res, 200, cached.data);
  try {
    // A small per-process cap limits accidental usage; it resets on restart.
    if (requestsThisRun >= 25) return send(res, 429, {error:'Demo search limit reached. The owner can restart the service after checking the API allowance.'});
    requestsThisRun++;
    const api = new URL('https://serpapi.com/search.json');
    api.search = new URLSearchParams({engine:'google_shopping', q:query, api_key:key, gl:'us', hl:'en'}).toString();
    const response = await fetch(api, {signal:AbortSignal.timeout(25000)});
    const body = await response.json();
    if (!response.ok || body.error) {
      // Classify provider errors without returning private request details or keys.
      const detail = String(body.error || '').toLowerCase();
      let message = 'SerpApi could not complete this search (status ' + response.status + '). Try again later or check your SerpApi dashboard.';
      if (response.status === 401 || /invalid.*key|key.*invalid|unauthorized/.test(detail)) {
        message = 'SerpApi rejected the API key. Update SERPAPI_KEY in the hosting environment settings.';
      } else if (response.status === 429 || /run out|exceeded|quota|limit/.test(detail)) {
        message = 'SerpApi search allowance or rate limit reached. Check remaining searches in your dashboard; wait if it is a temporary rate limit.';
      } else if (/plan|subscription|permission|access/.test(detail) || response.status === 403) {
        message = 'SerpApi denied access. Check account verification and whether your plan supports this search in your dashboard.';
      } else if (/no results|hasn.t returned any results|empty/.test(detail)) {
        message = 'No shopping results were returned. Try a specific product brand and model.';
      }
      return send(res, 502, {error:message});
    }
    const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
    const results = (body.shopping_results || []).map(item => ({
      title:item.title || 'Product', store:item.source || 'Store not listed', price:item.price || 'Price not listed',
      numericPrice:(!item.installment && typeof item.extracted_price === 'number' && Number.isFinite(item.extracted_price) && item.extracted_price > 0 && /\$/.test(item.price || '')) ? item.extracted_price : null, originalPrice:typeof item.extracted_old_price === 'number' && Number.isFinite(item.extracted_old_price) && /\$/.test(item.old_price || '') ? item.extracted_old_price : null, delivery:item.delivery || '', image:safeUrl(item.thumbnail), link:safeUrl(item.product_link || item.link)
    }));
    const data = {results, searchedAt:new Date().toISOString()};
    cache.set(query.toLowerCase(), {time:Date.now(), data});
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    send(res, 200, data);
  } catch { send(res, 502, {error:'Search failed or timed out. Check your internet connection and try again.'}); }
});
server.on('error', () => { console.error('Could not start. Port 3000 may already be in use.'); });
server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('DealCheck server is running.'));



