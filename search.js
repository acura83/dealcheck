// SEARCH: price parsing, matching, sorting, recent searches, and result cards.
// The private API key is used by server.cjs, never by this browser file.
// Match words against titles, deduplicate offers, and sort known prices first.
function getUnitQuantity(title, unit) {
  const text = title.toLowerCase();

  // Avoid guessing multipack totals, dimensions, ranges, or multiple listed sizes.
  const pack = /\b(?:pack\s+of\s+\d+|\d+\s*[- ]?pack|\d+\s*[x×]\s*\d)/;

  const measures = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(fl\.?\s*oz\.?|fluid\s+ounces?|ounces?|oz\.?|millilit(?:er|re)s?|ml|grams?|kg|g)\b/g)];

  if (unit === 'item') {
    if (measures.length) return null;

    const counts = [...text.matchAll(/\b(?:pack\s+of\s+(\d+)|(\d+)\s*[- ]?(?:pack|count|ct|pieces?))\b/g)];

    if (counts.length !== 1) return null;

    return Number(counts[0][1] || counts[0][2]) || null;

  }
  if (pack.test(text) || measures.length !== 1 || /\d\s*[-–]\s*\d/.test(text)) return null;

  const amount = Number(measures[0][1]);

  const raw = measures[0][2].replace(/[.\s]/g,'');

  let foundUnit = /^(fl|fluid)/.test(raw) ? 'floz' : /^(oz|ounce)/.test(raw) ? 'oz' : /^(ml|millilit)/.test(raw) ? 'ml' : 'g';

  const quantity = raw === 'kg' ? amount * 1000 : amount;

  return foundUnit === unit && quantity > 0 ? quantity : null;

}
function readListedPrice(item) {
  // Accept a numeric provider price or one explicit USD price, never a range/payment.
  if (Number.isFinite(item.numericPrice) && item.numericPrice >= 0) return item.numericPrice;

  const match = String(item.price || '').trim().match(/^(?:US\s*)?\$\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)$/);

  return match ? Number(match[1].replace(/,/g, '')) : null;

}
function filterExtremePrices(offers, enabled) {
  const prices=offers.map(readListedPrice).filter(price => Number.isFinite(price) && price > 0).sort((a,b)=>a-b);

  if (!enabled || prices.length < 5) return {offers, hidden:0, median:null};

  const middle=Math.floor(prices.length/2);

  const median=prices.length % 2 ? prices[middle] : (prices[middle-1]+prices[middle])/2;

  const kept=offers.filter(item => {
    const price=readListedPrice(item);
    return price === null || (price >= median/5 && price <= median*5);
  });

  return {offers:kept, hidden:offers.length-kept.length, median};

}
// Match complete retailer names, including domain names and marketplace labels.
function isMajorRetailer(store) {
  const name=String(store || '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  return /\b(walmart|target|amazon|home depot|homedepot|lowes|staples|office depot|officedepot|officemax|office max|best buy|bestbuy|costco|sams club|walgreens|cvs|kroger|macys|kohls|sephora|ulta|dicks sporting goods|bjs)\b/.test(name);
}
function rankOffers(offers, query, strict, sortMode = 'price', unit = 'oz') {
  const normalize = text => String(text || '').toLowerCase().replace(/ounces?/g,'oz').replace(/millilit(?:er|re)s?/g,'ml').replace(/grams?/g,'g').replace(/(\d)(oz|ml|g)\b/g,'$1 $2');
  const words = text => (normalize(text).match(/[a-z0-9]+(?:\.[0-9]+)?/g) || []).map(word => word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0,-1) : word);
  const terms = [...new Set(words(query).filter(word => !['the','a','an','for','with','and','of','buy'].includes(word)))];
  const matches = (title, term) => words(title).includes(term);
  const seen = new Set();
  return offers.map(item => {
    const quantity = getUnitQuantity(item.title, unit);
    const numericPrice = readListedPrice(item);
    const matchedTerms = terms.filter(term => matches(item.title,term));
    const relevance = matchedTerms.reduce((score, term) => score + (/\d/.test(term) ? 3 : 1), 0);
    const fullMatch = terms.length > 0 && matchedTerms.length === terms.length;
    return {...item, relevance, fullMatch, matchedCount:matchedTerms.length, termCount:terms.length, numericPrice, unitQuantity:quantity, unitPrice:quantity && Number.isFinite(numericPrice) ? numericPrice / quantity : null};
  }).filter(item => {
    if (strict && !terms.every(term => matches(item.title,term))) return false;
    const identity = [item.title, item.store, item.price, item.link].join('|');
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  }).sort((a,b) => {
    if (sortMode === 'majorprice' && isMajorRetailer(a.store) !== isMajorRetailer(b.store)) return Number(isMajorRetailer(b.store))-Number(isMajorRetailer(a.store));
    if (['relevance','matchprice'].includes(sortMode) && a.fullMatch !== b.fullMatch) return Number(b.fullMatch)-Number(a.fullMatch);
    if (sortMode === 'relevance' && a.relevance !== b.relevance) return b.relevance-a.relevance;
    const valueA = sortMode === 'unit' ? a.unitPrice : a.numericPrice;
    const priceA = Number.isFinite(valueA) ? valueA : Infinity;
    const valueB = sortMode === 'unit' ? b.unitPrice : b.numericPrice;
    const priceB = Number.isFinite(valueB) ? valueB : Infinity;
    if (priceA === Infinity || priceB === Infinity) return priceA === priceB ? 0 : priceA === Infinity ? 1 : -1;
    return sortMode === 'price-desc' ? priceB-priceA : priceA-priceB;
  });
}
// The browser asks our server; the private API key stays on the server.
const searchInput = document.getElementById('page-search');
const searchMessage = document.getElementById('search-message');
const shoppingResults = document.getElementById('shopping-results');
let lastSearch = null;
let recentSearches=[];
try {
  const saved=JSON.parse(localStorage.getItem('dealcheck-recent-searches') || '[]');
  if(Array.isArray(saved)) recentSearches=saved.filter(q=>typeof q==='string' && q.length<=200).slice(0,6);
} catch {}
function renderRecentSearches(){
  const container=document.getElementById('recent-search-chips');container.replaceChildren();
  document.getElementById('recent-searches').hidden=!recentSearches.length;
  const suggestions=document.getElementById('search-suggestions');suggestions.replaceChildren();
  for(const query of recentSearches){
    const chip=document.createElement('button');chip.type='button';chip.className='search-chip';chip.textContent=query;
    chip.addEventListener('click',()=>{
      if(document.querySelector('#search-form button[type="submit"]').disabled)return;
      searchInput.value=query;document.getElementById('search-form').requestSubmit();
    });container.append(chip);
    const option=document.createElement('option');option.value=query;suggestions.append(option);
  }
  if(!recentSearches.length){
    for(const query of ['Got2b Glued Spray 2 oz','CeraVe moisturizing cream','AA batteries 24 pack']){
      const option=document.createElement('option');option.value=query;suggestions.append(option);
    }
  }
}
function saveRecentSearch(query){
  recentSearches=[query,...recentSearches.filter(q=>q.toLowerCase()!==query.toLowerCase())].slice(0,6);
  try{localStorage.setItem('dealcheck-recent-searches',JSON.stringify(recentSearches));}catch{}
  renderRecentSearches();
}
document.getElementById('clear-history').addEventListener('click',()=>{
  recentSearches=[];try{localStorage.removeItem('dealcheck-recent-searches');}catch{}renderRecentSearches();
});
document.addEventListener('keydown',event=>{
  if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable]')){
    event.preventDefault();searchInput.focus();
  }
});
renderRecentSearches();
function renderSearchResults(data, query) {
  shoppingResults.replaceChildren();
  const sortMode = document.getElementById('search-sort').value;
  const searchUnit = document.getElementById('search-unit').value;
  const majorOnly = false;
  const offers = majorOnly ? data.results.filter(item => isMajorRetailer(item.store)) : data.results;
  const sorted = rankOffers(offers, query, document.getElementById('match-terms').checked, sortMode, searchUnit);
  const filtered = filterExtremePrices(sorted, true);
  const ranked = filtered.offers;
  document.getElementById('offer-count').textContent = '(' + ranked.length + ' matching offers)';
  searchMessage.textContent = '';
  const list = document.createElement('ol');
  ranked.forEach((item, index) => {
    const card = document.createElement('li');
    card.hidden = index >= 12;
    card.style.cssText = 'padding:16px;margin:12px 0;border:1px solid #ddd;border-radius:8px;';
    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image; img.alt = item.title; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.style.cssText = 'width:80px;height:80px;object-fit:contain;';
      img.addEventListener('error', () => img.remove()); card.append(img);
    }
    const title = document.createElement('p'); title.textContent = item.title;
    const info = document.createElement('p'); info.textContent = item.price + ' — ' + item.store;
    card.append(title, info);
    if (sortMode === 'majorprice') {
      const retailerLabel=document.createElement('p');
      retailerLabel.className='hint';
      retailerLabel.textContent=isMajorRetailer(item.store) ? 'Major retailer' : 'Other store';
      card.append(retailerLabel);
    }
    const matchInfo = document.createElement('p');
    matchInfo.className = 'hint';
    matchInfo.textContent = item.fullMatch ? 'All search terms found in title' : item.matchedCount + ' of ' + item.termCount + ' search terms found in title';
    card.append(matchInfo);
    const markdown = offerCosts(item, null).savings;
    if (markdown !== null && markdown > 0) {
      const saving = document.createElement('p');
      saving.textContent = 'Save ' + cash(markdown) + ' vs. original price';
      saving.style.cssText = 'color:#187c69;font-weight:600;';
      card.append(saving);
    }
    const chooseLabel = document.createElement('label');
    chooseLabel.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const choose = document.createElement('input');
    choose.type = 'checkbox'; choose.style.width = 'auto';
    const offerKey = makeOfferKey(item);
    choose.dataset.offerKey = offerKey;
    choose.checked = selectedOffers.has(offerKey);
    choose.addEventListener('change', () => {
      if (choose.checked) selectedOffers.set(offerKey, {item, });
      else selectedOffers.delete(offerKey);
      renderSelectedOffers();
    });
    chooseLabel.append(choose, document.createTextNode('Compare this item'));
    card.append(chooseLabel);
    if (sortMode === 'unit') {
      const unitInfo = document.createElement('p');
      unitInfo.textContent = Number.isFinite(item.unitPrice) ? '$' + item.unitPrice.toFixed(4) + ' per ' + searchUnit + ' · Size read from title: ' + item.unitQuantity + ' ' + searchUnit : 'Unit price unavailable: size or price needs verification.';
      card.append(unitInfo);
    }
    if (['price','unit'].includes(sortMode) && index === 0 && Number.isFinite(sortMode === 'unit' ? item.unitPrice : item.numericPrice)) {
      const badge = document.createElement('strong');
      badge.textContent = sortMode === 'unit' ? 'Lowest known unit price in these results' : 'Lowest listed price in these results';
      badge.style.color = '#187c69';
      card.prepend(badge);
    }
    if (item.link) { const link = document.createElement('a'); link.href = item.link; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View offer'; card.append(link); }
    addHistoryControl(card, item);
    list.append(card);
  });
  shoppingResults.append(list);
  if (ranked.length > 12) {
    let visible = 12;
    const more = document.createElement('button');
    more.type = 'button'; more.textContent = 'Show more offers (' + (ranked.length-visible) + ' remaining)';
    more.addEventListener('click', () => {
      visible += 12;
      Array.from(list.children).forEach((card,index) => card.hidden = index >= visible);
      if (visible >= ranked.length) more.remove();
      else more.textContent = 'Show more offers (' + (ranked.length-visible) + ' remaining)';
    });
    shoppingResults.append(more);
  }

}
['search-sort','search-unit','match-terms'].forEach(id => document.getElementById(id).addEventListener('change', () => {
  if (lastSearch) renderSearchResults(lastSearch.data, lastSearch.query);
}));
document.getElementById('search-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (typeof selectedOffers === 'undefined' || typeof renderSelectedOffers !== 'function') {
    searchMessage.textContent = 'Comparison code did not load. Upload comparison.js and refresh the page.';
    return;
  }
  const query = searchInput.value.trim();
  if (!query) { searchMessage.textContent = 'Enter an item name.'; return; }
  lastSearch = null;
  document.getElementById('offer-count').textContent = '';
  // Each submitted search starts a fresh comparison.
  selectedOffers.clear();
  syncSelectionBoxes();
  renderSelectedOffers();
  if (location.protocol === 'file:') { searchMessage.textContent = 'Start the local server and open http://127.0.0.1:3000 to search.'; return; }
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  searchMessage.textContent = 'Searching shopping offers…';
  shoppingResults.replaceChildren();
  try {
    const response = await fetch('/api/search?q=' + encodeURIComponent(query));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed.');
    saveRecentSearch(query);
    lastSearch = {data, query};
    renderSearchResults(data, query);
  } catch (error) { shoppingResults.replaceChildren();searchMessage.textContent = error.message; }
  finally { button.disabled = false;button.textContent='Find deals';shoppingResults.setAttribute('aria-busy','false'); }
});
