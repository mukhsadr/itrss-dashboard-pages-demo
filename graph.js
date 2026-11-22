'use strict';
(()=>{
  const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
  const fmt=n=>Number(n||0).toLocaleString(), esc=s=>String(s||'');
  let cohorts=[], works=[], authors=[], selected=null, current=[], currentEdges=[], currentSource='mill';
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
    $('graphSelected').textContent=node?node.label+' · '+fmt(node.count)+(node.kind==='researcher'?' papers':' records'):'Click a node to highlight its direct relationships';
  }
  function draw(){
    const canvas=$('graphCanvas');canvas.replaceChildren();
    const source=$('graphSource').value;currentSource=source;
    if(source==='mill'&&!cohorts.length){setInfo('Waiting for grouped Mill metrics');return}
    if(source==='research'&&(!works.length||!authors.length)){
      current=[];currentEdges=[];$('graphKpis').replaceChildren();
      $('graphSelected').textContent='Original research files are not available on this public website.';
      setInfo('Import enriched_works.csv and authors.csv from your local research pipeline. No network is invented.');
      return;
    }
    const result=source==='mill'?buildMill():buildResearch();
    current=result.nodes;currentEdges=result.edges;
    $('graphKpis').replaceChildren();
    for(const [label,value] of result.stats){
      const item=document.createElement('div');item.className='graphKpi';
      const s=document.createElement('small');s.textContent=label;
      const strong=document.createElement('strong');strong.textContent=fmt(value);item.append(s,strong);$('graphKpis').append(item);
    }
    $('graphCaption').textContent=result.caption;
    const lookup=new Map(current.map(n=>[n.id,n]));
    const maxEdge=Math.max(1,...result.edges.map(e=>e.count));
    const paths=svg('g',{'class':'graphLinks'});
    for(const e of result.edges){
      const a=lookup.get(e.a),b=lookup.get(e.b);if(!a||!b)continue;
      const link=source==='mill'
        ? 'M'+a.x+','+a.y+' C'+((a.x+b.x)/2)+','+a.y+' '+((a.x+b.x)/2)+','+b.y+' '+b.x+','+b.y
        : 'M'+a.x+','+a.y+' L'+b.x+','+b.y;
      const p=svg('path',{d:link,stroke:source==='mill'?'#8aa4ce':'#6e98c9',
        'stroke-width':source==='mill'?(.6+6*Math.sqrt(e.count/maxEdge)):(.4+Math.min(3,e.count)),
        fill:'none',opacity:'.68','data-edge':e.a+'|||'+e.b});
      const tip=svg('title',{},fmt(e.count)+(source==='mill'?' source records':' shared publications'));p.append(tip);paths.append(p);
    }
    canvas.append(paths);
    const search=$('graphSearch').value.trim().toLowerCase();
    const nodeGroup=svg('g',{'class':'graphNodes'});
    for(const n of current){
      const circleSize=source==='mill'?Math.min(19,6+Math.sqrt(n.count)*.38):Math.min(19,5+Math.sqrt(n.count)*3);
      const group=svg('g',{'data-node':n.id,tabindex:0,role:'button','aria-label':n.label+', '+n.count});
      const c=svg('circle',{cx:n.x,cy:n.y,r:circleSize,fill:kindColor[n.kind]||'#a8beec',
        stroke:'#1a2a43','stroke-width':'2'});
      const label=svg('text',{x:n.x+(source==='mill'?circleSize+7:0),y:n.y+(source==='mill'?4:-circleSize-5),
        fill:'#dceafa','font-size':source==='mill'?'13':'11',
        'text-anchor':source==='mill'?'start':'middle'},n.label.length>35?n.label.slice(0,32)+'…':n.label);
      const tip=svg('title',{},n.label+' · '+fmt(n.count)+(source==='mill'?' records':' papers'));
      group.append(c,label,tip);
      group.addEventListener('click',()=>focus(n.id));
      group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focus(n.id)}});
      if(search&&!n.label.toLowerCase().includes(search))group.style.opacity='.22';
      nodeGroup.append(group);
    }
    canvas.append(nodeGroup);selected=null;focus(null);
    setInfo(source==='mill'
      ? 'Connections are aggregated counts, not individual people or coauthor relationships.'
      : 'Research links represent shared publications, based on locally supplied OpenAlex exports.');
  }
  async function load(){
    try{
      const resp=await fetch('data/callie.csv?graph='+Date.now(),{cache:'no-store'});
      if(!resp.ok)throw Error('HTTP '+resp.status);
      cohorts=parseCSV(await resp.text());
      if(!cohorts.some(r=>r.Count))throw Error('No grouped counts available');
    }catch(e){setInfo('Unable to read the published grouped metrics: '+e.message)}
    draw();
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
  $('graphImport').addEventListener('click',()=>{$('graphFiles').value='';$('graphFiles').click()});
  $('graphFiles').addEventListener('change',e=>readLocalFiles(e.target.files));
  $('graphReset').addEventListener('click',()=>{selected=null;$('graphSearch').value='';draw()});
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