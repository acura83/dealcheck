// No real keys or paid calls are used by these tests.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHistoryHandler} = require('./trackpin.cjs');
const fs = require('node:fs');
const vm = require('node:vm');
const asin='B01NBKTPTS';
const fixture={asin,currency:'USD',title:'Example product',stats:{min_cents:1000,avg_cents:1500,history_days:40},price:{reference_cents:1600,current_cents:1200,observed_at:100},verdict:{stale:false,evidence:'moderate'}};

test('validates input and missing configuration without requests',async()=>{
  const history=createHistoryHandler({fetcher:()=>assert.fail('Unexpected request')});
  assert.equal((await history('../secret')).status,400);
  assert.equal((await history(asin)).status,503);
});
test('server key header, fixed host, request deduplication, caching, and nullable prices',async()=>{
  let count=0;
  const history=createHistoryHandler({key:'test-key',fetcher:async(url,options)=>{
    count++;assert.equal(new URL(url).origin,'https://trackpin.co');
    assert.equal(options.headers['x-api-key'],'test-key');
    assert.equal(new URL(url).searchParams.get('discover'),'0');
    return {ok:true,json:async()=>fixture};
  }});
  const [a,b]=await Promise.all([history(asin),history(asin)]);
  assert.deepEqual(a,b);assert.equal(count,1);
  assert.equal(a.data.lowestCents,1000);assert.equal(a.data.suspect,false);
  await history(asin);assert.equal(count,1);
  assert(!JSON.stringify(a).includes('test-key'));
  const missing=createHistoryHandler({key:'test',fetcher:async()=>({ok:true,json:async()=>({asin,currency:'USD'})})});
  assert.equal((await missing(asin)).data.lowestCents,null);
});
test('unmatched products, missing records, auth, quota, and timeouts fail safely',async()=>{
  for(const status of [404,401,403,429,500]){
    const history=createHistoryHandler({key:'test',fetcher:async()=>({ok:false,status})});
    assert((await history(asin)).data.error);
  }
  const mismatch=createHistoryHandler({key:'test',fetcher:async()=>({ok:true,json:async()=>({...fixture,asin:'B000000000'})})});
  assert.equal((await mismatch(asin)).status,502);
  const timeout=createHistoryHandler({key:'test',fetcher:async()=>{throw new Error('secret upstream details')}});
  assert(!JSON.stringify(await timeout(asin)).includes('secret upstream details'));
});
test('daily per-process guard resets next day',async()=>{
  let time=Date.UTC(2026,10,2);
  const history=createHistoryHandler({key:'test',now:()=>time,fetcher:async()=>({ok:false,status:404})});
  for(let i=0;i<90;i++)await history(asin);
  assert.equal((await history(asin)).status,429);
  time+=86400000;assert.equal((await history(asin)).status,404);
});
test('browser recognizes exact Amazon US links, not lookalike or unrelated URLs',()=>{
  const context={URL};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/history.js','utf8'),context);
  assert.equal(context.amazonAsin('https://www.amazon.com/name/dp/'+asin+'?tag=example'),asin);
  assert.equal(context.amazonAsin('https://amazon.com/gp/product/'+asin),asin);
  for(const url of ['https://amazon.com.evil.test/dp/'+asin,'https://amazon.co.uk/dp/'+asin,'https://google.com/search?q='+asin,'javascript:alert(1)','https://amzn.to/test'])assert.equal(context.amazonAsin(url),null);
});
