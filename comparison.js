// COMPARISON: selected products, displayed prices, store links, and the bottom panel.
// Money is converted to cents for display calculations.
const selectedOffers = new Map();

function makeOfferKey(item) { return [item.title,item.store,item.price,item.link].join('|');
}
function offerCosts(item) {
  const listedPrice = readListedPrice(item);

  const price = listedPrice !== null ? Math.round(listedPrice * 100) : null;

  const original = Number.isFinite(item.originalPrice) ? Math.round(item.originalPrice*100) : null;

  return {price, savings:price !== null && original !== null && original >= price ? original-price : null,
    total:price};

}
const cash = cents => cents === null ? 'Unknown' : '$'+(cents/100).toFixed(2);

function renderSelectedOffers() {
  const box = document.getElementById('selected-offers');

  const panel=document.getElementById('comparison-panel');

  panel.hidden=selectedOffers.size===0;

  document.getElementById('selected-count').textContent=selectedOffers.size;

  document.querySelectorAll('input[data-offer-key]').forEach(input=>input.closest('li').classList.toggle('offer-selected',input.checked));

  document.body.style.paddingBottom=panel.hidden ? '' : (panel.getBoundingClientRect().height+20)+'px';

  box.replaceChildren();

  if (!selectedOffers.size) {
    const empty = document.createElement('p');
    empty.className='hint';
    empty.textContent='No items selected. Check “Compare this item” in the shopping results.';
    box.append(empty);

  }
  selectedOffers.forEach((entry,key) => {
    const card=document.createElement('article');card.style.cssText='border:1px solid #e2e8ef;border-radius:12px;padding:18px;margin-bottom:14px;';
    const heading=document.createElement('h3');heading.textContent=entry.item.title;heading.title=entry.item.title;heading.style.margin='0 0 8px';
    const store=document.createElement('p');store.textContent=entry.item.store;store.className='hint';card.append(heading,store);
    const costs=offerCosts(entry.item);
    if (costs.savings !== null && costs.savings > 0) {
      const saving=document.createElement('p');saving.textContent='Save '+cash(costs.savings)+' versus the listed original price';
      saving.style.cssText='color:#187c69;font-weight:600;';card.append(saving);
    }
    const line=text=>{const p=document.createElement('p');p.textContent=text;card.append(p);};
    const price=document.createElement('strong');price.className='comparison-price';price.textContent=cash(costs.price);price.title='Listed total, excluding shipping and tax';card.append(price);

    const actions=document.createElement('div');actions.className='comparison-actions';
    let buyingUrl;
    try {
      const url=new URL(entry.item.link);
      if (url.protocol==='https:') buyingUrl=url.href;
    } catch {}
    if (buyingUrl) {
      const buyingLink=document.createElement('a');
      buyingLink.href=buyingUrl;buyingLink.target='_blank';buyingLink.rel='noopener noreferrer';
      buyingLink.textContent='View store';buyingLink.title='View original buying site';
      buyingLink.style.cssText='display:block;margin-top:12px;font-weight:600;';
      actions.append(buyingLink);
    } else {
      line('Buying site link unavailable for this offer.');
    }
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.style.marginTop='12px';
    remove.addEventListener('click',()=>{selectedOffers.delete(key);syncSelectionBoxes();renderSelectedOffers();});actions.append(remove);card.append(actions);box.append(card);
  });

  const totals=[...selectedOffers.values()].map(entry=>offerCosts(entry.item).total);

  const known=totals.filter(total=>total!==null);

  const status=document.getElementById('selection-status');

  status.textContent=selectedOffers.size+' item'+(selectedOffers.size===1?'':'s')+' selected.';

  if (known.length && selectedOffers.size>1) status.textContent+=' Lowest: '+cash(Math.min(...known))+'.'+(known.length<totals.length?' Some totals remain unknown.':'');

}
function syncSelectionBoxes() {
  document.querySelectorAll('input[data-offer-key]').forEach(input=>input.checked=selectedOffers.has(input.dataset.offerKey));

}
document.getElementById('clear-selection').addEventListener('click',()=>{selectedOffers.clear();syncSelectionBoxes();renderSelectedOffers();});

renderSelectedOffers();

new ResizeObserver(() => {
  const panel=document.getElementById('comparison-panel');
  document.body.style.paddingBottom=panel.hidden ? '' : (panel.getBoundingClientRect().height+20)+'px';
}).observe(document.getElementById('comparison-panel'));
