'use strict';
/* MRI Circular Atlas integration. The ordinary four rings are an overview.
   Clicking a credited author replaces them with curved, source-linked research
   connections. Title/journal candidates NEVER imply verified collaboration.
   Verified author-paper edges are drawn only from matched OpenAlex IDs. */
(()=>{
  const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
  const CHART=$('paperChart'),LEGEND=$('paperLegend');
  const THEME_COLORS=['#58b9d7','#d2a7f6','#5db8ac','#d9a65f','#e68eac','#80aaea','#e5c06a','#9f9bef','#7bd1bd','#d788c8','#97bb70','#8b9aa8'];
  let atlas=null,author=null,mode='research',relation='science',maxLinks=110,selected=null,hovered=null,current=null,focusTheme=null;
  const text=v=>String(v??'').trim(),format=n=>Number(n||0).toLocaleString();
  const norm=s=>text(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const doi=s=>text(s).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,'').replace(/^doi:\s*/,'').replace(/[?#].*$/,'').trim();
  function create(tag,attrs={},content){
    const e=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));
    if(content!==undefined)e.textContent=content;
    return e;
  }
  function spot(angle,r){return{x:340+r*Math.cos(angle-Math.PI/2),y:340+r*Math.sin(angle-Math.PI/2)}}
  function groupArc(a,b,r){const p=spot(a,r),q=spot(b,r),large=b-a>Math.PI?1:0;
    return `M${p.x.toFixed(2)},${p.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${q.x.toFixed(2)},${q.y.toFixed(2)}`}
  function bundled(a,b,themeA,themeB,bundle=.87){
    // Reuse the original Atlas's five-anchor edge-bundling concept and
    // Catmull–Rom interpolation, scaled for the 680px publication SVG.
    const hub=117-46*bundle;
    const p=[spot(a,245),spot(a,180),spot(themeA,hub),spot(themeB,hub),spot(b,180),spot(b,245)];
    let d=`M${p[0].x.toFixed(2)} ${p[0].y.toFixed(2)}`;
    for(let i=0;i<p.length-1;i++){
      const p0=p[Math.max(0,i-1)],p1=p[i],p2=p[i+1],p3=p[Math.min(p.length-1,i+2)];
      const a1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6};
      const a2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};
      d+=` C${a1.x.toFixed(2)},${a1.y.toFixed(2)} ${a2.x.toFixed(2)},${a2.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }
    return d;
  }
  function safeLink(raw){try{const u=new URL(text(raw));return /^https?:$/.test(u.protocol)?u.href:null}catch{return null}}
  function buildResearch(){
    if(!atlas||!author)return null;
    const byDOI=new Map(),byTitle=new Map(),byID=new Map();
    for(const w of atlas.works){
      byID.set(w.id,w);
      const d=doi(w.doi);if(d&&!byDOI.has(d))byDOI.set(d,w.id);
      const t=norm(w.title);if(t&&!byTitle.has(t))byTitle.set(t,w.id);
    }
    const sourceIds=new Set();
    for(const p of author.papers){
      const row=p.row||{};
      const id=byDOI.get(doi(row.DOI||row['DOI / record link']))||byTitle.get(norm(row.Title));
      if(id!==undefined)sourceIds.add(id);
    }
    const candidates=atlas.links.filter(e=>{
      if(!sourceIds.has(e.s)&&!sourceIds.has(e.t))return false;
      if(relation==='science'&&!e.types.includes('title_terms'))return false;
      if(relation==='venue'&&!e.types.includes('venue'))return false;
      return true;
    }).sort((a,b)=>b.score-a.score||a.s-b.s||a.t-b.t);
    const keep=new Set(sourceIds),edges=[],limit=Math.min(maxLinks,candidates.length);
    for(const e of candidates){
      if(edges.length>=limit)break;
      if(keep.size>=72&&(!keep.has(e.s)||!keep.has(e.t)))continue;
      keep.add(e.s);keep.add(e.t);edges.push(e);
    }
    const nodes=[...keep].map(id=>byID.get(id)).filter(Boolean);
    // Match the supplied Atlas ordering: 12 provisional scientific themes.
    nodes.sort((a,b)=>atlas.themes.indexOf(a.theme)-atlas.themes.indexOf(b.theme)||b.year-a.year||a.title.localeCompare(b.title));
    const groups=[];
    const active=atlas.themes.filter(g=>nodes.some(n=>n.theme===g));
    const gap=.033,unit=(Math.PI*2-gap*active.length)/Math.max(1,nodes.length);
    let angle=0;
    for(const g of active){
      const members=nodes.filter(p=>p.theme===g),start=angle;
      for(const item of members){item.theta=angle+unit/2;angle+=unit}
      const end=angle;groups.push({name:g,start,end,angle:(start+end)/2,count:members.length,color:THEME_COLORS[atlas.themes.indexOf(g)%THEME_COLORS.length]});angle+=gap;
    }
    const groupIndex=new Map(groups.map(g=>[g.name,g]));
    return {kind:'research',nodes,groups,edges,byID:new Map(nodes.map(n=>[n.id,n])),groupIndex,
      rootCount:sourceIds.size,visibleLinks:edges.length,availableLinks:candidates.length};
  }
  function buildCoauthors(){
    if(!author)return null;
    const workMap=new Map(),coauthorMap=new Map();
    for(const p of author.papers){
      if(!p.verified||!p.workId)continue;
      workMap.set(p.workId,p);
      for(const a of p.authors){
        if(a.id===author.author.id)continue;
        if(!coauthorMap.has(a.id))coauthorMap.set(a.id,{id:a.id,name:a.name,workIds:new Set()});
        coauthorMap.get(a.id).workIds.add(p.workId);
      }
    }
    const peers=[...coauthorMap.values()].sort((a,b)=>b.workIds.size-a.workIds.size||a.name.localeCompare(b.name)).slice(0,16);
    const workIDs=new Set(peers.flatMap(a=>[...a.workIds]));
    const papers=[...workIDs].map(id=>workMap.get(id)).filter(Boolean);
    papers.sort((a,b)=>Number(a.row.Year)-Number(b.row.Year)||text(a.row.Title).localeCompare(text(b.row.Title)));
    const total=Math.max(1,peers.reduce((n,a)=>n+a.workIds.size,0));
    const gap=.034,span=Math.PI*2-gap*peers.length;let angle=0;
    const groups=peers.map((a,i)=>{
      const start=angle;angle+=(a.workIds.size/total)*span;
      const end=angle;angle+=gap;
      return {name:a.name,id:a.id,count:a.workIds.size,start,end,angle:(start+end)/2,color:THEME_COLORS[i%THEME_COLORS.length]};
    });
    const nodes=papers.map((p,i)=>({id:p.workId,title:text(p.row.Title),year:text(p.row.Year),theme:'Publication',url:p.row['DOI / record link']||'',theta:(i+.5)*Math.PI*2/Math.max(1,papers.length)}));
    const edges=[];
    for(const g of groups){
      for(const id of coauthorMap.get(g.id).workIds)if(workIDs.has(id))edges.push({s:g.id,t:id,types:['author'],score:1});
    }
    return {kind:'coauthor',nodes,groups,edges,byID:new Map(nodes.map(n=>[n.id,n])),rootCount:workMap.size,visibleLinks:edges.length,availableLinks:edges.length};
  }
  function showStatus(message){$('paperAuthorStatus').textContent=message}
  function showInspect(header,description,link,items=[]){
    const box=$('atlasInspect');box.replaceChildren();
    if(!header){box.hidden=true;return}
    box.hidden=false;
    const h=document.createElement('h3');h.textContent=header;box.append(h);
    const p=document.createElement('p');p.textContent=description;box.append(p);
    if(link){const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open publication source';box.append(a)}
    for(const item of items.slice(0,9)){
      const b=document.createElement('button');b.className='atlasRelated';b.type='button';b.textContent=item.title||item.name||'Related paper';
      b.addEventListener('click',()=>setSelected(item.id));box.append(b);
    }
  }
  function setSelected(id){
    selected=selected===id?null:id;focusTheme=null;paint();
    if(!selected){showInspect(null);return}
    const p=current?.byID.get(selected);
    if(!p){showInspect(null);return}
    const related=current.edges.filter(e=>e.s===selected||e.t===selected).map(e=>current.byID.get(e.s===selected?e.t:e.s)).filter(Boolean);
    const title=p.title||p.name,source=p.url||(p.doi?'https://doi.org/'+p.doi:'');
    showInspect(title,`${p.year||''} · ${p.theme||'Publication'} · ${related.length} displayed ${current.kind==='research'?'candidate research links':'authorship links'}.`,safeLink(source),related);
    showStatus(current.kind==='research'?'Selected paper: links show title-term/venue candidates, not verified collaboration.':'Selected OpenAlex publication: highlighted edges are recorded authorships.');
  }
  function selectGroup(group){
    if(current.kind==='coauthor'){
      const id=group.id;
      // Selecting a collaborator switches the focused researcher, with the
      // existing Back control always returning to the original four rings.
      window.dispatchEvent(new CustomEvent('dashboard:author-select',{detail:{id}}));return;
    }
    focusTheme=focusTheme===group.name?null:group.name;selected=null;paint();
    const ps=current.nodes.filter(x=>x.theme===group.name);
    showInspect(group.name,`${group.count} visible works · provisional title-derived scientific theme. Choose a paper point to inspect connected publications.`,null,ps);
  }
  function paint(){
    const svg=$('paperChart');
    for(const e of svg.querySelectorAll('[data-atlas-link]')){
      const a=e.getAttribute('data-s'),b=e.getAttribute('data-t');
      const active=!selected&&!focusTheme || selected&&(a===String(selected)||b===String(selected)) ||
        focusTheme&&current?.kind==='research'&&(current.byID.get(Number(a))?.theme===focusTheme||current.byID.get(Number(b))?.theme===focusTheme);
      e.setAttribute('opacity',active?(selected||focusTheme?'.78':'.19'):'.018');
      e.setAttribute('stroke-width',active&&(selected||focusTheme)?'2.5':'1.2');
    }
    for(const n of svg.querySelectorAll('[data-atlas-paper]')){
      const id=n.getAttribute('data-atlas-paper');
      const active=!selected&&!focusTheme || id===String(selected) ||
        selected&&current?.edges.some(e=>(String(e.s)===id&&String(e.t)===String(selected))||(String(e.t)===id&&String(e.s)===String(selected)))||
        focusTheme&&current?.byID.get(Number(id))?.theme===focusTheme;
      n.setAttribute('opacity',active?'1':'.18');
    }
    for(const g of svg.querySelectorAll('[data-atlas-group]')){
      g.setAttribute('opacity',!focusTheme||g.getAttribute('data-atlas-group')===focusTheme?'1':'.25');
    }
  }
  function drawLegend(){
    LEGEND.replaceChildren();
    const section=document.createElement('div');section.className='legendGroup atlasLegend';
    const hdr=document.createElement('div');hdr.className='legendTitle';
    hdr.textContent=current.kind==='coauthor'?'OPENALEX COAUTHORS · JOINT PAPERS':'SOURCE ATLAS · PROVISIONAL RESEARCH THEMES';section.append(hdr);
    for(const group of current.groups){
      const btn=document.createElement('button');btn.type='button';btn.className='legendRow';
      const sw=document.createElement('span');sw.className='swatch';sw.style.background=group.color;
      const name=document.createElement('span');name.className='name';name.textContent=group.name;
      const count=document.createElement('span');count.className='pct';count.textContent=current.kind==='coauthor'?group.count+' joint':String(group.count);
      btn.append(sw,name,count);btn.addEventListener('click',()=>selectGroup(group));section.append(btn);
    }
    LEGEND.append(section);
  }
  function draw(){
    if(!author)return;
    current=(mode==='coauthor'?buildCoauthors():buildResearch());
    const controls=$('atlasControls');controls.hidden=false;
    $('atlasModeResearch').classList.toggle('active',mode==='research');
    $('atlasModeCoauthors').classList.toggle('active',mode==='coauthor');
    const co=buildCoauthors(),hasCo=co&&co.edges.length>0;
    $('atlasModeCoauthors').disabled=!hasCo;
    $('atlasModeCoauthors').title=hasCo?'Show shared papers from OpenAlex author IDs':'No verified coauthor links in matched OpenAlex papers';
    $('atlasResearchOptions').hidden=mode!=='research';
    if(!current){showStatus('Research Atlas data not available.');return}
    const nodes=current.nodes,byID=current.byID;
    CHART.replaceChildren();
    const links=create('g',{class:'atlasLinks'}),arcs=create('g',{class:'atlasThemeArcs'}),dots=create('g',{class:'atlasPapers'}),labels=create('g',{class:'atlasLabels'});
    const groups=current.groups,groupIndex=new Map(groups.map(g=>[current.kind==='research'?g.name:g.id,g]));
    // Draw links behind all paper nodes, using the original edge-bundling geometry.
    for(const e of current.edges){
      const a=byID.get(e.s),b=byID.get(e.t);
      const ga=current.kind==='research'?groupIndex.get(a?.theme):groupIndex.get(e.s);
      const gb=current.kind==='research'?groupIndex.get(b?.theme):null;
      const thetaA=current.kind==='research'?a?.theta:ga?.angle;
      const thetaB=current.kind==='research'?b?.theta:b?.theta;
      if(thetaA===undefined||thetaB===undefined)continue;
      const path=create('path',{d:bundled(thetaA,thetaB,ga?.angle??thetaA,gb?.angle??thetaB),class:'atlasBundle',
        stroke:current.kind==='coauthor'?'#a1b9f4':e.types.includes('title_terms')?'#70a8dc':'#d0a7e5',
        'stroke-width':'1.2',fill:'none',opacity:'.19','data-atlas-link':'1','data-s':e.s,'data-t':e.t});
      path.append(create('title',{},current.kind==='research'
        ?e.types.includes('title_terms')?'Shared distinctive title terms · exploratory':'Same journal · exploratory'
        :'Listed OpenAlex author on publication'));
      links.append(path);
    }
    CHART.append(links);
    for(let i=0;i<groups.length;i++){
      const g=groups[i],path=create('path',{d:groupArc(g.start+.007,g.end-.007,306),stroke:g.color,'stroke-width':'13',
        fill:'none','stroke-linecap':'round',class:'atlasGroupArc',role:'button',tabindex:'0','data-atlas-group':g.name});
      const action=()=>selectGroup(g);
      path.addEventListener('click',action);
      path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action()}});
      path.append(create('title',{},g.name+' · '+g.count));arcs.append(path);
      const p=spot(g.angle,326),deg=g.angle*180/Math.PI-90,flip=deg>90&&deg<270;
      labels.append(create('text',{x:p.x,y:p.y,'text-anchor':'middle',
        transform:`rotate(${flip?deg+180:deg} ${p.x} ${p.y})`,class:'atlasGroupLabel'},
        (g.name.length>22?g.name.slice(0,20)+'…':g.name)));
    }
    CHART.append(arcs);
    for(let i=0;i<nodes.length;i++){
      const p=nodes[i],pos=spot(p.theta,245),themeGroup=groupIndex.get(p.theme),color=themeGroup?.color||'#87bafa';
      const dot=create('circle',{cx:pos.x,cy:pos.y,r:nodes.length>60?3.8:5.7,
        fill:current.kind==='coauthor'?'#8fd4dc':color,stroke:'#e9f3ff','stroke-width':'1',
        class:'atlasLeaf','data-atlas-paper':p.id,role:'button',tabindex:'0','aria-label':p.title});
      const action=()=>setSelected(p.id);
      dot.addEventListener('click',action);
      dot.addEventListener('mouseenter',()=>{hovered=p.id;selected===null&&paintHover(p.id)});
      dot.addEventListener('mouseleave',()=>{hovered=null;paint()});
      dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action()}});
      dot.append(create('title',{},`${p.year} · ${p.title}`));dots.append(dot);
    }
    CHART.append(dots);CHART.append(labels);
    const center=create('g',{class:'atlasCenterText'});
    center.append(create('text',{x:340,y:333,'text-anchor':'middle',class:'atlasCenterMetric'},String(nodes.length)+' papers'));
    center.append(create('text',{x:340,y:356,'text-anchor':'middle',class:'atlasCenterSub'},String(current.visibleLinks)+' displayed '+(current.kind==='coauthor'?'authorships':'candidate links')));
    CHART.append(center);drawLegend();paint();
    if(current.kind==='research'){
      showStatus(`Atlas: ${current.rootCount} credited papers · ${nodes.length} visible papers · ${current.visibleLinks} of ${current.availableLinks} candidate links · title/venue overlap is NOT proven collaboration.`);
    }else{
      showStatus(`${current.groups.length} verified coauthors · ${current.visibleLinks} author-to-paper links in ${nodes.length} matched papers.`);
    }
    showInspect(null);
  }
  function paintHover(id){
    for(const link of CHART.querySelectorAll('[data-atlas-link]')){
      link.setAttribute('opacity',link.getAttribute('data-s')===String(id)||link.getAttribute('data-t')===String(id)?'.85':'.015');
    }
  }
  function clear(){
    author=null;current=null;selected=null;hovered=null;focusTheme=null;
    $('atlasControls').hidden=true;$('atlasInspect').hidden=true;
  }
  window.addEventListener('dashboard:author-focused',event=>{
    author=event.detail;selected=null;hovered=null;focusTheme=null;
    if(!author)return;
    mode=author.neighbors?.length?'coauthor':'research';
    if(atlas||mode==='coauthor')draw();
    else showStatus('Loading original MRI Circular Atlas links…');
  });
  window.addEventListener('dashboard:author-cleared',clear);
  window.addEventListener('dashboard:paper-dataset-loaded',clear);
  $('atlasModeResearch').addEventListener('click',()=>{mode='research';selected=null;focusTheme=null;draw()});
  $('atlasModeCoauthors').addEventListener('click',()=>{mode='coauthor';selected=null;focusTheme=null;draw()});
  $('atlasRelation').addEventListener('change',e=>{relation=e.target.value;selected=null;draw()});
  $('atlasLinksLimit').addEventListener('change',e=>{maxLinks=Number(e.target.value)||110;selected=null;draw()});
  $('atlasClearNode').addEventListener('click',()=>{selected=null;focusTheme=null;paint();showInspect(null)});
  fetch('data/publication_atlas_public.json?atlas='+Date.now(),{cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('Atlas data HTTP '+r.status);return r.json()})
    .then(data=>{
      if(!data||!Array.isArray(data.works)||!Array.isArray(data.links)||data.works.length!==230)
        throw Error('Published research Atlas failed schema checks');
      atlas=data;if(author&&mode==='research')draw();
    }).catch(error=>{if(author)showStatus('Original MRI Atlas data unavailable: '+error.message)});
})();