// Server-only integration. Never send the TrackPin key to the browser.
function createHistoryHandler({key, fetcher = fetch, now = Date.now}) {
  const cache = new Map();
  const pending = new Map();
  let day = '', calls = 0;
  const cents = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const timestamp = value => Number.isSafeInteger(value) && value > 0 && value <= now() ? value : null;

  return async function history(asin) {
    if (!/^[A-Z0-9]{10}$/.test(asin)) return {status:400, data:{error:'Enter a valid Amazon product ID (ASIN).'}};
    if (!key) return {status:503, data:{error:'Price history is not configured. Add TRACKPIN_API_KEY on Render.'}};
    const saved = cache.get(asin);
    if (saved && now() - saved.time < 3600000) return saved.result;
    if (pending.has(asin)) return pending.get(asin);
    const today = new Date(now()).toISOString().slice(0,10);
    if (day !== today) {day=today; calls=0;}
    // A per-process guard, not a persistent account-wide quota. Provider limits still apply.
    if (calls >= 90) return {status:429, data:{error:'Daily history request limit reached. Try again tomorrow.'}};
    calls++;
    const request = (async () => {
      try {
        const response = await fetcher('https://trackpin.co/api/v1/product/'+asin+'?history=0&discover=0', {
          headers:{'x-api-key':key}, signal:AbortSignal.timeout(15000)
        });
        if (!response.ok) {
          const error = response.status === 404 ? 'No recorded history for this Amazon product.'
            : response.status === 429 ? 'TrackPin allowance reached. Try again later.'
            : [401,403].includes(response.status) ? 'TrackPin rejected access. Check the key and account on Render.'
            : 'Price history is temporarily unavailable.';
          return {status:response.status === 404 ? 404 : 502, data:{error}};
        }
        const body = await response.json();
        if (body.asin !== asin || body.currency !== 'USD') return {status:502, data:{error:'History could not be verified for this product.'}};
        const result = {status:200, data:{
          asin, title:typeof body.title === 'string' ? body.title.slice(0,500) : '',
          currency:'USD', lowestCents:cents(body.stats?.min_cents),
          averageCents:cents(body.stats?.avg_cents), normalCents:cents(body.price?.reference_cents),
          recordedCents:cents(body.price?.current_cents), observedAt:timestamp(body.price?.observed_at),
          historyDays:Number.isSafeInteger(body.stats?.history_days) && body.stats.history_days >= 0 ? body.stats.history_days : null,
          stale:body.verdict?.stale !== false, suspect:body.verdict?.suspect === true,
          evidence:['strong','moderate','thin','none'].includes(body.verdict?.evidence) ? body.verdict.evidence : 'none',
          retrievedAt:now()
        }};
        cache.set(asin,{time:now(),result});
        if (cache.size>200) cache.delete(cache.keys().next().value);
        return result;
      } catch {return {status:502,data:{error:'Price history could not load. Please try again.'}};}
    })();
    pending.set(asin,request);
    try {return await request;} finally {pending.delete(asin);}
  };
}
module.exports = {createHistoryHandler};
