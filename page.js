// PAGE CONTROLS: show the back-to-top button and keep it above the comparison panel.
const backTop=document.getElementById('back-top');

function updateBackTop(){backTop.hidden=window.scrollY<400;
  const panel=document.getElementById('comparison-panel');
  backTop.style.bottom=(panel.hidden ? 18 : panel.getBoundingClientRect().height+12)+'px';
}
window.addEventListener('scroll',updateBackTop,{passive:true});

window.addEventListener('resize',updateBackTop);

new ResizeObserver(updateBackTop).observe(document.getElementById('comparison-panel'));

backTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));

updateBackTop();
