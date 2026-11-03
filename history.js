// Amazon history is loaded only when requested, to conserve the free API allowance.
function amazonAsin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/^(?:www\.|smile\.|m\.)?amazon\.com$/i.test(url.hostname)) return null;
    return url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:\/|$)/i)?.[1].toUpperCase() || null;
  } catch {return null;}
}

function addHistoryControl(card, item) {
  const detectedAsin = amazonAsin(item.link);
  if (!detectedAsin && !/\bamazon\b/i.test(item.store || '')) return;
  const section = document.createElement('div'); section.className='history-section';
  const button = document.createElement('button'); button.type='button'; button.textContent='Check Amazon price history';
  const content = document.createElement('div'); content.setAttribute('aria-live','polite');
  section.append(button,content); card.append(section);

  async function load(asin) {
    button.disabled=true;content.textContent='Loading recorded Amazon prices…';
    try {
      if (location.protocol === 'file:') throw new Error('Open the hosted site or local server to check history.');
      const response = await fetch('/api/history?asin='+encodeURIComponent(asin));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'History unavailable.');
      content.replaceChildren();
      const line = (text, className='') => {const p=document.createElement('p');p.textContent=text;p.className=className;content.append(p);};
      const money = cents => Number.isSafeInteger(cents) && cents >= 0 ? '$'+(cents/100).toFixed(2) : 'Unavailable';
      line(data.title || 'Amazon product '+asin);
      line('Recorded lowest: '+money(data.lowestCents));
      line('Historical average: '+money(data.averageCents));
      line('TrackPin normal price: '+money(data.normalCents));
      line('Last recorded price: '+money(data.recordedCents));
      line('History span: '+(data.historyDays === null ? 'unknown' : data.historyDays+' days')+
        ' · Price last observed: '+(data.observedAt ? new Date(data.observedAt).toLocaleString() : 'unknown'));
      if (data.stale || data.suspect || ['thin','none'].includes(data.evidence)) {
        line('Limited or stale evidence; this history cannot reliably rate the current offer.','hint');
      }
      line('Source: TrackPin · Amazon US observations, not a live checkout quote. Verify the model, size, seller, and condition. History does not change result sorting.','hint');
      const link=document.createElement('a');link.href='https://www.amazon.com/dp/'+asin;
      link.target='_blank';link.rel='noopener noreferrer';link.textContent='Verify this Amazon product';content.append(link);
      button.textContent='Refresh history';
    } catch(error) {content.textContent=error.message;}
    finally {button.disabled=false;}
  }
  let manualForm;
  button.addEventListener('click',()=>{
    if (detectedAsin) {load(detectedAsin);return;}
    if (manualForm) return;
    manualForm=document.createElement('form');
    const label=document.createElement('label');label.textContent='Paste the exact Amazon.com product URL';
    const input=document.createElement('input');input.type='url';input.required=true;input.placeholder='https://www.amazon.com/dp/…';label.append(input);
    const submit=document.createElement('button');submit.type='submit';submit.textContent='Load history';
    const note=document.createElement('p');note.className='hint';note.textContent='This shopping result does not include an Amazon product ID. Open the offer and copy the matching product URL; short links are not supported.';
    manualForm.append(label,submit,note);section.append(manualForm);
    manualForm.addEventListener('submit',async event=>{
      event.preventDefault();const asin=amazonAsin(input.value.trim());
      if (!asin) {content.textContent='Use a full Amazon.com product URL containing /dp/ or /gp/product/.';return;}
      submit.disabled=true;try {await load(asin);} finally {submit.disabled=false;}
    });input.focus();
  });
}
