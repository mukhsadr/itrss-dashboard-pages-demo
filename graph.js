'use strict';
(()=>{
  const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
  const fmt=n=>Number(n||0).toLocaleString(), esc=s=>String(s||'');
  let cohorts=[], works=[], authors=[], published=[], selected=null, current=[], currentEdges=[], currentSource='papers';
  let viewport={x:0,y:0,w:1080,h:690},drag=null;
  const kindColor={department:'#669eff',classification:'#40c6b5',status:'#f0b36c',researcher:'#72c7ff',paper:'#c6b5ed'};
  function parseCSV(text){
    const data=[];let col='',record=[],quote=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){if(quote&&text[i+1]==='"'){col+='"';i++}else quote=!quote}
      else if(ch===','&&!quote){record.push(col);col=''}
      else if((ch==='\n'||ch==='\r')&&!quote){
        if(ch==='\r'&&text[i+1]==='\n')i++;
        record.push(col);if(record.some(s=>s.trim()))data.push(record);record=[];col='';
      }else col+=ch;
    }
    record.push(col);if(record.some(s=>s.trim()))data.push(record);
    const hdr=(data.shift()||[]).map(s=>s.trim().replace(/^\ufeff/,''));
    return data.map(a=>Object.fromEntries(hdr.map((h,i)=>[h,(a[i]||'').trim()])));
  }
  function svg(tag,attrs={},text){
    const el=document.createElementNS(NS,tag);
    Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function weighted(items,key){
    const m=new Map();
    for(const row of items){const label=(row[key]||'Not specified').trim()||'Not specified';m.set(label,(m.get(label)||0)+Number(row.Count||1))}
    return m;
  }
  function buildMill(){
    const dept=weighted(cohorts,'Descr'),cls=weighted(cohorts,'Classficiation'),stat=weighted(cohorts,'Status');
    const defs=[['department','Descr',dept,170],['classification','Classficiation',cls,535],['status','Status',stat,890]];
    const nodes=[];
    for(const [kind,col,map,x] of defs){
      const items=[...map].sort((a,b)=>b[1]-a[1]);
      const height=610,step=height/(items.length+1);
      items.forEach(([label,count],i)=>nodes.push({id:kind+'|'+label,label,kind,count,x,y:35+(i+1)*step}));
    }
    const edgeTotals=new Map();
    for(const row of cohorts){
      const n=Number(row.Count||1),d='department|'+(row.Descr||'Not specified'),
        c='classification|'+(row.Classficiation||'Not specified'),
        s='status|'+(row.Status||'Not specified');
      for(const [a,b] of [[d,c],[c,s]])edgeTotals.set(a+'--'+b,(edgeTotals.get(a+'--'+b)||0)+n);
    }
    const edges=[...edgeTotals].map(([key,count])=>{const [a,b]=key.split('--');return {a,b,count}});
    const total=cohorts.reduce((s,r)=>s+Number(r.Count||1),0);
    return {nodes,edges,caption:'Real grouped source data · departments → classification → status',stats:[['Source records',total],['Grouped cohorts',cohorts.length],['Connections',edges.length]]};
  }
  function buildResearch(){
    const byId=new Map(works.map(w=>[w.record_id,w]).filter(([id])=>id));
    const authorPapers=new Map(),names=new Map(),paperAuthors=new Map();
    for(const a of authors){
      const pid=a.record_id,aid=a.author_id;
      if(!byId.has(pid)||!aid)continue;
      names.set(aid,a.author_name||aid);
      if(!authorPapers.has(aid))authorPapers.set(aid,new Set());
      authorPapers.get(aid).add(pid);
      if(!paperAuthors.has(pid))paperAuthors.set(pid,new Set());
      paperAuthors.get(pid).add(aid);
    }
    const max=Number($('graphLimit').value)||40;
    const search=$('graphSearch').value.trim().toLowerCase();
    const ranked=[...authorPapers].sort((a,b)=>b[1].size-a[1].size).slice(0,max);
    const ids=new Set(ranked.map(([id])=>id));
    const nodes=ranked.map(([id,p])=>({id,kind:'researcher',label:names.get(id),count:p.size}));
    const pairs=new Map();
    for(const aids of paperAuthors.values()){
      const kept=[...aids].filter(id=>ids.has(id)).sort();
      for(let i=0;i<kept.length;i++)for(let j=i+1;j<kept.length;j++){
        const key=kept[i]+'|||'+kept[j];pairs.set(key,(pairs.get(key)||0)+1);
      }
    }
    const edges=[...pairs].map(([key,count])=>{const [a,b]=key.split('|||');return {a,b,count}});
    // Deterministic radial layout: a researcher with more papers is nearer the center.
    nodes.forEach((node,i)=>{
      const angle=i*2.399963229728653;
      const r=58+300*Math.sqrt((i+1)/Math.max(1,nodes.length));
      node.x=530+Math.cos(angle)*r;node.y=340+Math.sin(angle)*r*.76;
    });
    const matching=search?nodes.filter(n=>n.label.toLowerCase().includes(search)):nodes;
    return {nodes,edges,caption:'Coauthorship extracted from local OpenAlex exports · no grant funding claims',stats:[['Researchers',nodes.length],['Source papers',byId.size],['Coauthor links',edges.length]],suggested:matching[0]?.id||null};
  }

  const STOP=new Set('the and for with from into using through onto on of in by an a to as at this that study studies investigation based new under over across toward via role effects effect analysis case development multi computational theoretical high properties research method methods system systems two three between their model models approach impact identification how which have been are will can'.split(' '));
  function namedAuthors(raw){
    return String(raw||'').split(/\s+(?:&|and)\s+|;/i)
      .map(a=>a.replace(/\bet al\.?\s*$/i,'').trim()).filter(Boolean);
  }
  function titleTokens(title){return new Set((String(title||'').toLowerCase().match(/[a-z]{4,}/g)||[]).filter(t=>!STOP.has(t)))}
  function publicPapers(){
    const search=$('graphSearch').value.trim().toLowerCase();
    const from=Number($('graphYearFrom').value)||1900, to=Number($('graphYearTo').value)||2100;
    const facility=$('graphFacility').value,limit=Number($('graphLimit').value)||60;
    return published.filter(p=>{
      const year=Number(p.Year)||0;
      if(year&&(year<from||year>to))return false;
      if(facility!=='all'&&p['Cluster acknowledged']!==facility)return false;
      return !search||[p.Title,p.Authors,p.Year,p.DOI,p.Venue].some(v=>String(v||'').toLowerCase().includes(search));
    }).sort((a,b)=>(Number(b.Year)||0)-(Number(a.Year)||0)||String(a.Title).localeCompare(String(b.Title))).slice(0,limit);
  }
  function paperURL(p){
    const candidate=String(p['DOI / record link']||'').trim()||('https://doi.org/'+String(p.DOI||'').trim());
    try{const url=new URL(candidate);return /^https?:$/.test(url.protocol)?url.href:null}catch{return null}
  }
  function buildPapers(){
    const data=publicPapers(),n=data.length,words=data.map(p=>titleTokens(p.Title)),df=new Map();
    for(const ts of words)for(const t of ts)df.set(t,(df.get(t)||0)+1);
    const idf=t=>1+Math.log((n+1)/((df.get(t)||0)+1));
    const norms=words.map(ts=>Math.sqrt([...ts].reduce((sum,t)=>sum+idf(t)*idf(t),0))||1);
    const threshold=Number($('graphStrength').value)||.10;
    const candidates=[];
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      let dot=0;
      for(const t of words[i])if(words[j].has(t))dot+=idf(t)*idf(t);
      const score=dot/(norms[i]*norms[j]);
      const sharedAuthor=namedAuthors(data[i].Authors).some(a=>namedAuthors(data[j].Authors).some(b=>a.toLowerCase()===b.toLowerCase()));
      if(score>=threshold||sharedAuthor)candidates.push({a:'p:'+published.indexOf(data[i]),b:'p:'+published.indexOf(data[j]),count:Math.max(score,sharedAuthor?.48:0),relation:sharedAuthor?'Same listed author':'Shared title terms'});
    }
    candidates.sort((a,b)=>b.count-a.count);
    const degree=new Map(),edges=[];
    for(const e of candidates){
      if((degree.get(e.a)||0)>=5||(degree.get(e.b)||0)>=5)continue;
      degree.set(e.a,(degree.get(e.a)||0)+1);degree.set(e.b,(degree.get(e.b)||0)+1);edges.push(e);
    }
    const nodes=data.map((p,i)=>({id:'p:'+published.indexOf(p),label:p.Title||'Untitled publication',kind:'paper',count:1,
      year:p.Year,cluster:p['Cluster acknowledged'],authors:p.Authors,url:paperURL(p),note:'Public bibliographic record',
      color:({'Foundry':'#45d6c2','Mill':'#7caaff','Foundry + Mill':'#c3a0f5'}[p['Cluster acknowledged']]||'#a8beec')}));
    return {nodes,edges,caption:'Publication similarity · shared title terms and explicitly listed authors (not citations)',
      stats:[['Visible papers',nodes.length],['Related links',edges.length],['Bibliography',published.length]]};
  }
  function buildEntities(){
    const full=works.length&&authors.length,limit=Number($('graphLimit').value)||60;
    const p=full?works.filter(w=>{
      const q=$('graphSearch').value.toLowerCase(),year=Number(w.year)||0,from=Number($('graphYearFrom').value)||1900,to=Number($('graphYearTo').value)||2100;
      return (!q||[w.title,w.doi,w.venue,w.grant_ids].some(v=>String(v||'').toLowerCase().includes(q)))&&(!year||(year>=from&&year<=to))&&($('graphFacility').value==='all'||w.cluster===$('graphFacility').value);
    }).slice(0,Math.max(5,Math.floor(limit*.55))):publicPapers().slice(0,Math.max(5,Math.floor(limit*.55)));
    const nodes=[],edges=[],map=new Map(),authorIndex=new Map();
    if(full){
      for(const a of authors){const id=String(a.record_id||'');if(!authorIndex.has(id))authorIndex.set(id,[]);authorIndex.get(id).push(a)}
    }
    for(let i=0;i<p.length;i++){
      const w=p[i],id=full?'work:'+String(w.record_id):'p:'+published.indexOf(w);
      if(full&&!w.record_id)continue;
      const paper={id,label:full?w.title:w.Title,kind:'paper',count:1,year:full?w.year:w.Year,
        authors:full?'See linked researcher nodes':w.Authors,url:full?(w.source_url||''):paperURL(w),
        cluster:full?w.cluster:w['Cluster acknowledged'],color:'#92baf4',grant_ids:full?w.grant_ids:''};
      nodes.push(paper);
      const authorsFor=full?authorIndex.get(String(w.record_id))||[]:namedAuthors(w.Authors).map(a=>({author_id:a.toLowerCase(),author_name:a}));
      for(const a of authorsFor){
        const key=String(a.author_id||'');if(!key)continue;
        const aid='a:'+key, label=String(a.author_name||key);
        if(!map.has(aid))map.set(aid,{id:aid,kind:'researcher',label,count:0,color:'#61cfe4'});
        map.get(aid).count++;edges.push({a:aid,b:id,count:1,relation:'Authored'});
      }
    }
    const allowed=new Set([...map.values()].sort((a,b)=>b.count-a.count).slice(0,Math.max(2,limit-nodes.length)).map(n=>n.id));
    nodes.push(...[...map.values()].filter(a=>allowed.has(a.id)));
    const allEdges=edges.filter(e=>allowed.has(e.a));
    if(full&&$('graphGrants').checked){
      const seen=new Map();
      for(const paper of nodes.filter(n=>n.kind==='paper')){
        for(const grant of String(paper.grant_ids||'').split(';').map(x=>x.trim()).filter(Boolean)){
          if(!seen.has(grant)&&seen.size<12){const node={id:'g:'+grant,label:grant,kind:'grant',count:0,color:'#f2bd68',note:'Unverified metadata grant mention'};seen.set(grant,node);nodes.push(node)}
          if(seen.has(grant)){seen.get(grant).count++;allEdges.push({a:paper.id,b:seen.get(grant).id,count:1,relation:'Unverified grant reference'})}
        }
      }
    }
    return {nodes,edges:allEdges,caption:full?'OpenAlex author/paper graph · grant links are unverified metadata candidates':'Public bibliographic names only · “et al.” omits coauthors',
      stats:[['Researchers',allowed.size],['Paper nodes',p.length],['Links',allEdges.length]]};
  }
  function forceLayout(nodes,edges){
    if(!nodes.length)return;
    for(let i=0;i<nodes.length;i++){
      const theta=i*2.3999632297,r=90+250*Math.sqrt((i+1)/nodes.length);
      nodes[i].x=540+Math.cos(theta)*r;nodes[i].y=340+Math.sin(theta)*r*.74;
    }
    const byId=new Map(nodes.map(n=>[n.id,n]));
    for(let t=0;t<90;t++){
      const v=new Map(nodes.map(n=>[n.id,{x:0,y:0}]));
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,dist=Math.max(12,Math.hypot(dx,dy)),f=780/(dist*dist);
        v.get(a.id).x+=dx*f;v.get(a.id).y+=dy*f;v.get(b.id).x-=dx*f;v.get(b.id).y-=dy*f;
      }
      for(const e of edges){
        const a=byId.get(e.a),b=byId.get(e.b);if(!a||!b)continue;
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-118)*.016;
        v.get(a.id).x+=dx/d*f;v.get(a.id).y+=dy/d*f;
        v.get(b.id).x-=dx/d*f;v.get(b.id).y-=dy/d*f;
      }
      for(const n of nodes){
        const d=v.get(n.id);n.x=Math.max(50,Math.min(1030,n.x+Math.max(-18,Math.min(18,d.x+(540-n.x)*.003))));
        n.y=Math.max(50,Math.min(640,n.y+Math.max(-18,Math.min(18,d.y+(340-n.y)*.003))));
      }
    }
  }
  function graphDetail(node){
    const box=$('graphDetail');if(!box)return;box.replaceChildren();
    const h=document.createElement('h3');h.textContent=node?node.label:'Explore the network';box.append(h);
    const p=document.createElement('p');p.textContent=node?(node.note||'')+' '+[node.year,node.cluster,node.authors].filter(Boolean).join(' · '):
      'Select a paper or researcher to highlight connected nodes. Drag to pan, scroll to zoom.';box.append(p);
    if(node?.url){try{const u=new URL(node.url);if(/^https?:$/.test(u.protocol)){
      const link=document.createElement('a');link.href=u.href;link.rel='noopener noreferrer';link.target='_blank';link.textContent='Open publication';box.append(link)
    }}catch{}}
    if(node){
      const hits=currentEdges.filter(e=>e.a===node.id||e.b===node.id).slice(0,10);
      const label=document.createElement('h4');label.textContent=hits.length+' connections';box.append(label);
      for(const e of hits){const other=current.find(n=>n.id===(e.a===node.id?e.b:e.a));if(!other)continue;
        const button=document.createElement('button');button.className='graphRelatedItem';button.type='button';button.textContent=other.label;button.onclick=()=>focus(other.id);box.append(button);
      }
    }
  }
  function setInfo(text){$('graphInfo').textContent=text}
  function focus(id){
    selected=selected===id?null:id;
    const neighbors=new Set([selected]);
    for(const e of currentEdges)if(e.a===selected)neighbors.add(e.b);else if(e.b===selected)neighbors.add(e.a);
    document.querySelectorAll('#graphCanvas [data-node]').forEach(el=>{
      const v=el.getAttribute('data-node');el.style.opacity=selected&&!neighbors.has(v)?'.15':'1';
      el.classList.toggle('selected',!!selected&&v===selected);
    });
    document.querySelectorAll('#graphCanvas [data-edge]').forEach(el=>{
      const v=el.getAttribute('data-edge');el.style.opacity=selected&&!v.split('|||').includes(selected)?'.06':'.68';
    });
    const node=current.find(x=>x.id===selected);
    $('graphSelected').textContent=node?node.label+' · '+fmt(node.count)+(node.kind==='researcher'?' papers':' connected records'):'Select a node to highlight related publications';
    graphDetail(node||null);
  }

  function draw(){
    const canvas=$('graphCanvas'),source=$('graphSource').value;currentSource=source;
    canvas.replaceChildren();$('graphKpis').replaceChildren();
    if(source==='papers'&&!published.length){setInfo('Waiting for public publication bibliography');return}
    if(source==='research'&&(!works.length||!authors.length)){
      current=[];currentEdges=[];$('graphSelected').textContent='OpenAlex CSVs are required for real coauthorship communities.';
      graphDetail(null);setInfo('The Streamlit archive contains source code only. Select both enriched_works.csv and authors.csv to see the original research network.');return;
    }
    const result=source==='mill'?buildMill():source==='papers'?buildPapers():source==='entities'?buildEntities():buildResearch();
    current=result.nodes;currentEdges=result.edges;
    if(source==='papers'||source==='entities')forceLayout(current,currentEdges);
    for(const [label,value] of result.stats){
      const item=document.createElement('div');item.className='graphKpi';
      const small=document.createElement('small');small.textContent=label;
      const strong=document.createElement('strong');strong.textContent=fmt(value);
      item.append(small,strong);$('graphKpis').append(item);
    }
    $('graphCaption').textContent=result.caption;
    const lookup=new Map(current.map(n=>[n.id,n])),maxEdge=Math.max(1,...currentEdges.map(e=>e.count));
    const paths=svg('g',{'class':'graphLinks'});
    for(const e of currentEdges){
      const a=lookup.get(e.a),b=lookup.get(e.b);if(!a||!b)continue;
      const route=source==='mill'?
        'M'+a.x+','+a.y+' C'+((a.x+b.x)/2)+','+a.y+' '+((a.x+b.x)/2)+','+b.y+' '+b.x+','+b.y:
        'M'+a.x+','+a.y+' L'+b.x+','+b.y;
      const line=svg('path',{d:route,stroke:e.relation==='Unverified grant reference'?'#ebabc9':'#8bafdd',
        'stroke-width':source==='mill'?.7+5*Math.sqrt(e.count/maxEdge):.7+3*Math.sqrt(e.count/maxEdge),
        fill:'none',opacity:'.62','data-edge':e.a+'|||'+e.b});
      line.append(svg('title',{},e.relation||'Related records'));paths.append(line);
    }
    canvas.append(paths);
    const group=svg('g',{'class':'graphNodes'});
    for(let i=0;i<current.length;i++){
      const n=current[i],r=source==='mill'?Math.min(19,6+Math.sqrt(n.count)*.38):Math.min(18,7+Math.sqrt(n.count||1)*2);
      const circle=svg('g',{'data-node':n.id,tabindex:0,role:'button','aria-label':n.label});
      circle.append(svg('circle',{cx:n.x,cy:n.y,r,fill:n.color||kindColor[n.kind]||'#a8beec',stroke:'#172c46','stroke-width':2}));
      if(source==='mill'||i<25||n.kind==='grant'){
        const right=source==='mill'&&n.kind==='status';
        circle.append(svg('text',{x:source==='mill'?(right?n.x-r-6:n.x+r+6):n.x,
          y:source==='mill'?n.y+4:n.y-r-6,fill:'#e3edfa','font-size':source==='mill'?13:10,
          'text-anchor':source==='mill'?(right?'end':'start'):'middle'},
          String(n.label).length>34?String(n.label).slice(0,31)+'…':n.label));
      }
      circle.append(svg('title',{},n.label+(n.year?' · '+n.year:'')+(n.cluster?' · '+n.cluster:'')));
      circle.addEventListener('click',()=>focus(n.id));
      circle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focus(n.id)}});
      group.append(circle);
    }
    canvas.append(group);selected=null;focus(null);
    setInfo(source==='papers'?'Publication relationships use shared title terms and explicitly listed authors only; they do NOT establish citations.':
      source==='entities'?(works.length?'OpenAlex research graph; candidate grant references are NOT verified funding.':
        'Bibliography lists lead authors incompletely for “et al.” entries. Import OpenAlex CSVs for the full research graph.'):
      source==='research'?'Community graph uses author IDs and co-publication relations from imported OpenAlex metadata.':
      'Connections represent source cohort counts, not individual user relationships.');
    fitGraph();
  }
  function fitGraph(){viewport={x:0,y:0,w:1080,h:690};applyGraphView()}
  function applyGraphView(){const canvas=$('graphCanvas');canvas.setAttribute('viewBox',[viewport.x,viewport.y,viewport.w,viewport.h].join(' '))}
  function zoomGraph(scale,px=.5,py=.5){
    const nw=Math.max(270,Math.min(2160,viewport.w*scale)),nh=nw*690/1080;
    viewport.x+=viewport.w*px-nw*px;viewport.y+=viewport.h*py-nh*py;
    viewport.w=nw;viewport.h=nh;applyGraphView();
  }
  async function load(){
    try{
      const [users,publication]=await Promise.all([
        fetch('data/callie.csv?graph='+Date.now(),{cache:'no-store'}),
        fetch('data/publications.json?graph='+Date.now(),{cache:'no-store'})]);
      if(users.ok)cohorts=parseCSV(await users.text());
      if(publication.ok){
        const data=await publication.json();
        published=(data.rows||[]).filter(r=>!/^(yes|true|1|y)$/i.test(String(r['Counted as duplicate']||'').trim()));
      }
      const years=[...new Set(published.map(r=>Number(r.Year)).filter(Boolean))].sort((a,b)=>a-b);
      for(const id of ['graphYearFrom','graphYearTo']){
        const sel=$(id);sel.replaceChildren();
        const all=document.createElement('option');all.value='';all.textContent=id==='graphYearFrom'?'From any year':'Through any year';sel.append(all);
        for(const yr of years){const op=document.createElement('option');op.value=String(yr);op.textContent=String(yr);sel.append(op)}
      }
      draw();
    }catch(err){setInfo('Research graph data could not be loaded: '+err.message)}
  }
  function readLocalFiles(files){
    const selected=[...files];const work=selected.find(f=>/enriched_works\.csv$/i.test(f.name));
    const author=selected.find(f=>/authors\.csv$/i.test(f.name));
    if(!work||!author){setInfo('Select both enriched_works.csv and authors.csv');return}
    Promise.all([work.text(),author.text()]).then(([w,a])=>{
      works=parseCSV(w);authors=parseCSV(a);
      if(!works.length||!authors.length)throw Error('Missing source records');
      $('graphSource').value='research';draw();
      window.dispatchEvent(new CustomEvent('dashboard:graph-loaded',{detail:{works:works.length,authors:authors.length}}));
    }).catch(e=>setInfo('Unable to load original network: '+e.message));
  }
  $('graphSource').addEventListener('change',()=>{selected=null;draw()});
  $('graphSearch').addEventListener('input',draw);
  $('graphLimit').addEventListener('change',draw);
  for(const id of ['graphYearFrom','graphYearTo','graphFacility','graphStrength','graphGrants'])$(id).addEventListener('change',draw);
  $('graphFit').addEventListener('click',fitGraph);
  $('graphZoomIn').addEventListener('click',()=>zoomGraph(.8));
  $('graphZoomOut').addEventListener('click',()=>zoomGraph(1.25));
  const canvas=$('graphCanvas');
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomGraph(e.deltaY>0?1.12:.89,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-node]'))return;drag={x:e.clientX,y:e.clientY,ox:viewport.x,oy:viewport.y};try{canvas.setPointerCapture(e.pointerId)}catch{}});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const r=canvas.getBoundingClientRect();viewport.x=drag.ox-(e.clientX-drag.x)*viewport.w/r.width;viewport.y=drag.oy-(e.clientY-drag.y)*viewport.h/r.height;applyGraphView()});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null});
  $('graphImport').addEventListener('click',()=>{$('graphFiles').value='';$('graphFiles').click()});
  $('graphFiles').addEventListener('change',e=>readLocalFiles(e.target.files));
  $('graphReset').addEventListener('click',()=>{selected=null;$('graphSearch').value='';$('graphYearFrom').value='';$('graphYearTo').value='';$('graphFacility').value='all';draw()});
  window.addEventListener('dashboard:load-users',event=>{
    // The graph is always grounded in a copy of the Mill user dataset shown in this browser.
    cohorts=parseCSV(event.detail.text);if(cohorts.some(x=>x.Count))draw();
  });
  window.addEventListener('dashboard:source-data-loaded',event=>{
    if(event.detail.kind==='users'&&currentSource==='mill')load();
  });
  window.addEventListener('dashboard:load-graph',event=>readLocalFiles(event.detail.files));
  load();
})();