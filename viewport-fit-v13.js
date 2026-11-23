'use strict';
/* Size charts to the available viewport, not to a fixed image height.
   Recompute after switching sections, resizing, and changing presentation mode. */
(()=>{
  const $=id=>document.getElementById(id);
  const body=document.body;
  let frame=0;

  function fit(){
    frame=0;
    const h=Math.max(window.innerHeight||720,320);
    const nav=$('presentationToolbar');
    const topSafe=nav?Math.ceil(nav.getBoundingClientRect().bottom):0;
    const activePublications=body.classList.contains('presentation-papers');
    const chart=$('prSvg');
    const chartBox=chart?.closest('.prChart');
    if(activePublications&&chartBox){
      const chartTop=chartBox.getBoundingClientRect().top;
      // The title/header, selectors and evidence metrics must also remain on screen.
      const available=Math.max(220,Math.floor(h-Math.max(topSafe,chartTop)-12));
      document.documentElement.style.setProperty('--pr-fit-height',available+'px');
    }
    const pop=$('chart');
    const wrap=pop?.closest('.chartWrap');
    if(!activePublications&&wrap&&!body.classList.contains('presentation-graph')){
      const top=wrap.getBoundingClientRect().top;
      const freeHeight=Math.max(220,Math.floor(h-Math.max(top,topSafe)-15));
      const freeWidth=Math.max(240,Math.floor(window.innerWidth-32));
      document.documentElement.style.setProperty('--mill-fit-width',Math.min(freeHeight,freeWidth,880)+'px');
    }
    // Keep the four meaningful ring labels available without a duplicate legend.
    const names=activePublications?
      ['Facility: Foundry / Mill','Publication year','Publication type','Scientific research theme']:
      ['Department','Academic classification','Status','Advisor'];
    document.querySelectorAll('[data-ring-toggle]').forEach((b,i)=>{
      b.title='Toggle ring '+(i+1)+' · '+names[i];
      b.setAttribute('aria-label','Show or hide ring '+(i+1)+': '+names[i]);
    });
  }
  const schedule=()=>{
    if(frame)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(fit);
  };
  for(const id of ['presentationUsers','presentationPapers','presentationToggle','presentationDetails']){
    const btn=$(id);
    if(!btn)continue;
    btn.addEventListener('click',()=>{
      // Switching sections should always start with a fully visible overview.
      if(id==='presentationUsers'||id==='presentationPapers')window.scrollTo(0,0);
      schedule();
    });
  }
  window.addEventListener('resize',schedule);
  document.addEventListener('fullscreenchange',schedule);
  window.addEventListener('dashboard:paper-rendered',schedule);
  window.addEventListener('dashboard:source-data-loaded',schedule);
  window.addEventListener('dashboard:local-data-loaded',schedule);
  window.addEventListener('load',schedule);
  schedule();
})();
