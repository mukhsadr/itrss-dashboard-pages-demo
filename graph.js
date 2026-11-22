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


  // Original Streamlit model: source-record IDs -> coauthor graph -> focus,
  // year/facility/search filters -> weighted coauthor edges -> two network views.
  // communityGroups comes from NetworkX greedy_modularity_communities at export.
  let communityGroups={},originalLayout={};
  const ORIGINAL_PALETTE=['#45d6c2','#e9a65b','#8b9cff','#ff7caa','#80c6ff','#b4e66e','#df99f9','#ffc96c','#61b0ad','#ff9184','#91a5fa','#b8d8eb'];
  const originalGrant=s=>{
    const txt=String(s||'').toUpperCase().replace(/[–—]/g,'-')
      .replace(/\b(NSF|GRANT|AWARD|MRI|DMREF)\b/g,'').replace(/\s+/g,' ').trim();
    if(/\b(?:OAC|ACI)-?1919789\b/.test(txt)||txt==='1919789')return 'OAC-1919789';
    return txt.replace(/\b(OAC|ACI|DMR|CHE)\s*-?\s*(\d{7})\b/g,'$1-$2');
  };
  function coreGraph(mode){
    const byWork=new Map(works.filter(w=>w.record_id).map(w=>[String(w.record_id),w]));
    const atp=new Map(),pta=new Map(),names=new Map(),candidate=new Map();
    for(const row of authors){
      const aid=String(row.author_id||'').trim(),pid=String(row.record_id||'').trim();
      if(!aid||!byWork.has(pid))continue;
      names.set(aid,String(row.author_name||aid));
      if(!atp.has(aid))atp.set(aid,new Set());
      if(!pta.has(pid))pta.set(pid,new Set());
      atp.get(aid).add(pid);pta.get(pid).add(aid);
    }
    for(const [pid,w] of byWork){
      const grants=new Set(String(w.grant_ids||'').split(';').map(originalGrant).filter(Boolean));
      candidate.set(pid,grants);
    }
    const globalLinks=new Map();
    for(const members of pta.values()){
      const ids=[...members].sort();
      for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
        const k=ids[i]+'|||'+ids[j];globalLinks.set(k,(globalLinks.get(k)||0)+1);
      }
    }
    const q=$('graphSearch').value.trim().toLowerCase(),
      from=Number($('graphYearFrom').value)||1900,to=Number($('graphYearTo').value)||2100,
      facility=$('graphFacility').value,
      minShared=Number($('graphMinShared').value)||1,
      topN=Number($('graphLimit').value)||120;
    let valid=new Set();
    for(const [pid,w] of byWork){
      const year=Number(w.year)||0;
      if(!year||year<from||year>to)continue;
      if(facility!=='all'&&w.cluster!==facility)continue;
      valid.add(pid);
    }
    if(q){
      const matched=new Set();
      for(const pid of valid){
        const w=byWork.get(pid);
        const attrs=[w.title,w.doi,w.venue,w.grant_ids];
        if(attrs.some(v=>String(v||'').toLowerCase().includes(q)))matched.add(pid);
      }
      for(const [aid,name] of names)if(name.toLowerCase().includes(q))
        for(const pid of atp.get(aid)||[])if(valid.has(pid))matched.add(pid);
      valid=matched;
    }
    const focus=$('graphFocus').value;
    if(focus&&atp.has(focus)){
      const direct=new Set([focus]);
      for(const [pair,count] of globalLinks)if(count>=minShared){
        const [a,b]=pair.split('|||');
        if(a===focus)direct.add(b);
        if(b===focus)direct.add(a);
      }
      valid=new Set([...valid].filter(pid=>[...(pta.get(pid)||[])].some(aid=>direct.has(aid))));
    }
    const paperCounts=new Map();
    for(const pid of valid)for(const aid of pta.get(pid)||[])
      paperCounts.set(aid,(paperCounts.get(aid)||0)+1);
    if(focus&&atp.has(focus))
      paperCounts.set(focus,[...atp.get(focus)].filter(pid=>valid.has(pid)).length);
    const ranked=[...paperCounts].sort((a,b)=>b[1]-a[1]||
      String(names.get(a[0])||a[0]).localeCompare(String(names.get(b[0])||b[0]))).slice(0,topN);
    const keep=new Set(ranked.map(([aid])=>aid));
    const selected=new Set([...valid].filter(pid=>[...(pta.get(pid)||[])].some(aid=>keep.has(aid))));
    const pairWeights=new Map();
    for(const pid of selected){
      const members=[...(pta.get(pid)||[])].filter(aid=>keep.has(aid)).sort();
      for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
        const pair=members[i]+'|||'+members[j];pairWeights.set(pair,(pairWeights.get(pair)||0)+1);
      }
    }
    const coauthorEdges=[...pairWeights].filter(([,n])=>n>=minShared)
      .map(([k,n])=>{const [a,b]=k.split('|||');return {a:'a:'+a,b:'a:'+b,count:n,relation:'coauthored'}});
    const candidateAwards=new Set([...selected].flatMap(pid=>[...(candidate.get(pid)||[])]));
    const nodes=ranked.map(([aid,count])=>{
      const group=Number(communityGroups[aid]??-1);
      return {id:'a:'+aid,author_id:aid,label:names.get(aid)||aid,kind:'researcher',count,
        color:mode==='research'&&group>=0?ORIGINAL_PALETTE[group%ORIGINAL_PALETTE.length]:'#63c7eb',
        community:group>=0?group+1:null,
        url:/^https?:\/\//.test(aid)?aid:null,
        workIDs:[...atp.get(aid)].filter(pid=>valid.has(pid))};
    });
    const stats=[['Publications',valid.size],['Researchers',keep.size],
      ['Coauthor links',coauthorEdges.length],['Candidate awards',candidateAwards.size]];
    if(mode==='research')return {nodes,edges:coauthorEdges,stats,
      caption:'Original author–author coauthorship network · colors are NetworkX communities',
      accurateCommunities:Object.keys(communityGroups).length>0};
    const paperLimit=Number($('graphPaperLimit').value)||110;
    const grantLimit=Number($('graphGrantLimit').value)||20;
    const ordered=[...selected].sort((a,b)=>{
      const wa=byWork.get(a),wb=byWork.get(b),
        countA=[...(pta.get(a)||[])].filter(id=>keep.has(id)).length,
        countB=[...(pta.get(b)||[])].filter(id=>keep.has(id)).length;
      return countB-countA||
        (Number(wb.citation_count)||0)-(Number(wa.citation_count)||0)||a.localeCompare(b);
    }).slice(0,paperLimit);
    const edges=[];
    for(const pid of ordered){
      const w=byWork.get(pid);
      nodes.push({id:'p:'+pid,label:String(w.title||pid),kind:'paper',count:1,year:w.year,
        cluster:w.cluster,doi:w.doi,authors:[...(pta.get(pid)||[])].map(id=>names.get(id)||id).join(', '),
        url:w.source_url||((w.doi||'')?'https://doi.org/'+w.doi:null),record_id:pid,color:'#b2bcd1',
        grant_ids:w.grant_ids||''});
      for(const aid of pta.get(pid)||[])if(keep.has(aid))
        edges.push({a:'a:'+aid,b:'p:'+pid,count:1,relation:'authored'});
    }
    if($('graphGrants').checked){
      const gc=new Map();
      for(const pid of ordered)for(const g of candidate.get(pid)||[])
        gc.set(g,(gc.get(g)||0)+1);
      const grants=[...gc].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,grantLimit);
      const allow=new Set(grants.map(([g])=>g));
      for(const [grant,count] of grants){
        nodes.push({id:'g:'+grant,label:grant,kind:'grant',count,color:'#f2bd68',
          note:'Candidate funding reference extracted from metadata. Not independently verified.'});
      }
      for(const pid of ordered)for(const g of candidate.get(pid)||[])if(allow.has(g))
        edges.push({a:'g:'+g,b:'p:'+pid,count:1,relation:'Unverified grant reference'});
    }
    return {nodes,edges,stats,caption:'Original researcher → publication → grant-candidate relationships',
      accurateCommunities:true};
  }
  function buildResearch(){return coreGraph('research')}
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
  function buildEntities(){return coreGraph('entities')}
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
  function applyOriginalLayout(nodes){
    const unchanged=$('graphSource').value==='research'
      &&!$('graphSearch').value.trim()&&!$('graphFocus').value
      &&!$('graphYearFrom').value&&!$('graphYearTo').value
      &&$('graphFacility').value==='all'
      &&Number($('graphMinShared').value||1)===1
      &&Number($('graphLimit').value||120)===120;
    if(!unchanged||!nodes.length||!nodes.every(n=>Array.isArray(originalLayout[n.id])))return false;
    const p=nodes.map(n=>originalLayout[n.id]);
    const minX=Math.min(...p.map(v=>v[0])),maxX=Math.max(...p.map(v=>v[0]));
    const minY=Math.min(...p.map(v=>v[1])),maxY=Math.max(...p.map(v=>v[1]));
    const spanX=Math.max(0.001,maxX-minX),spanY=Math.max(0.001,maxY-minY);
    const scale=Math.min(880/spanX,555/spanY);
    const midX=(minX+maxX)/2,midY=(minY+maxY)/2;
    nodes.forEach((n,i)=>{
      n.x=540+(p[i][0]-midX)*scale;
      n.y=340-(p[i][1]-midY)*scale;
    });
    return true;
  }
  function graphDetail(node){
    const box=$('graphDetail');if(!box)return;box.replaceChildren();
    const h=document.createElement('h3');h.textContent=node?node.label:'Explore the network';box.append(h);
    const p=document.createElement('p');p.textContent=node?(node.note||'')+' '+[node.year,node.cluster,node.authors].filter(Boolean).join(' · '):
      'Select a paper or researcher to highlight connected nodes. Drag to pan, scroll to zoom.';box.append(p);
    if(node?.url){try{const u=new URL(node.url);if(/^https?:$/.test(u.protocol)){
      const link=document.createElement('a');link.href=u.href;link.rel='noopener noreferrer';link.target='_blank';
      link.textContent=node.kind==='researcher'?'Open researcher in OpenAlex':'Open publication source';box.append(link)
    }}catch{}}
    if(node?.kind==='researcher'&&Array.isArray(node.workIDs)){
      const worksByID=new Map(works.map(w=>[String(w.record_id),w]));
      const ids=node.workIDs.filter(id=>worksByID.has(id))
        .sort((a,b)=>(Number(worksByID.get(b).year)||0)-(Number(worksByID.get(a).year)||0));
      const hdr=document.createElement('h4');hdr.textContent=ids.length+' papers in filtered corpus';box.append(hdr);
      for(const pid of ids.slice(0,12)){
        const w=worksByID.get(pid),item=document.createElement('div');item.className='graphRelatedItem';
        const url=String(w.source_url||'').trim()||(w.doi?'https://doi.org/'+w.doi:'');
        if(url){try{const u=new URL(url);if(/^https?:$/.test(u.protocol)){
          const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';
          a.textContent=String(w.title||pid)+' ('+String(w.year||'')+')';item.append(a);
        }else item.textContent=w.title}catch{item.textContent=w.title}}
        else item.textContent=w.title;
        box.append(item);
      }
      const coauthorIDs=new Set(ids.flatMap(pid=>authors.filter(a=>String(a.record_id)===pid).map(a=>String(a.author_id))));
      coauthorIDs.delete(node.author_id);
      const co=document.createElement('p');co.textContent=coauthorIDs.size+' coauthors in filtered publications';box.append(co);
    }
    if(node?.kind==='grant'){
      const warn=document.createElement('p');warn.textContent='Candidate grant reference from extracted metadata, not confirmed award support.';box.append(warn);
    }
    if(node){
      const hits=currentEdges.filter(e=>e.a===node.id||e.b===node.id).slice(0,10);
      const label=document.createElement('h4');label.textContent=hits.length+' connections';box.append(label);
      for(const e of hits){const other=current.find(n=>n.id===(e.a===node.id?e.b:e.a));if(!other)continue;
        const button=document.createElement('button');button.className='graphRelatedItem';button.type='button';button.textContent=other.label;button.onclick=()=>focus(other.id);box.append(button);
      }
    }
  }

  function populateResearchFocus(){
    const select=$('graphFocus'),previous=select.value;
    select.replaceChildren();
    const base=document.createElement('option');base.value='';base.textContent='All researchers';select.append(base);
    if(!works.length||!authors.length)return;
    const valid=new Set(works.map(w=>String(w.record_id||'')));
    const counts=new Map(),labels=new Map();
    for(const row of authors){
      const id=String(row.author_id||''),pid=String(row.record_id||'');
      if(!id||!valid.has(pid))continue;
      if(!counts.has(id))counts.set(id,new Set());
      counts.get(id).add(pid);labels.set(id,String(row.author_name||id));
    }
    const ranked=[...counts].sort((a,b)=>b[1].size-a[1].size||
      (labels.get(a[0])||a[0]).localeCompare(labels.get(b[0])||b[0]));
    for(const [id,papers] of ranked){
      const option=document.createElement('option');option.value=id;
      option.textContent=(labels.get(id)||id)+' · '+papers.size+' papers';
      select.append(option);
    }
    select.value=counts.has(previous)?previous:'';
  }
  function setResearchPayload(data){
    if(!data||!Array.isArray(data.works)||!Array.isArray(data.authors))
      throw Error('Expected works and authors arrays');
    const validWorks=data.works.every(w=>w&&typeof w.record_id==='string'&&typeof w.title==='string');
    const validAuthors=data.authors.every(a=>a&&typeof a.record_id==='string'&&typeof a.author_id==='string');
    if(!validWorks||!validAuthors||!data.works.length||!data.authors.length)
      throw Error('Missing OpenAlex record_id, author_id, or publication metadata');
    works=data.works;
    authors=data.authors;
    communityGroups=(data.communities&&typeof data.communities==='object'&&!Array.isArray(data.communities))?data.communities:{};
    originalLayout=(data.default_author_layout&&typeof data.default_author_layout==='object')?data.default_author_layout:{};
    populateResearchFocus();
    const from=$('graphYearFrom'),to=$('graphYearTo');
    const years=[...new Set(works.map(w=>Number(w.year)).filter(Boolean))].sort((a,b)=>a-b);
    for(const [sel,label] of [[from,'From any year'],[to,'Through any year']]){
      sel.replaceChildren();
      const initial=document.createElement('option');initial.value='';initial.textContent=label;sel.append(initial);
      for(const year of years){const item=document.createElement('option');item.value=String(year);item.textContent=String(year);sel.append(item)}
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
    const needsResearch=(source==='research'||source==='entities')&&(!works.length||!authors.length);
    $('graphEmpty').style.display=needsResearch?'flex':'none';
    if(needsResearch){
      current=[];currentEdges=[];
      $('graphCaption').textContent='Original OpenAlex research network · input required';
      $('graphSelected').textContent='Choose research_graph_public.json from your laptop';
      graphDetail(null);
      setInfo('This original coauthorship canvas needs the exported OpenAlex works and author IDs, not invented similarity links.');return;
    }
    const result=source==='mill'?buildMill():source==='papers'?buildPapers():source==='entities'?buildEntities():buildResearch();
    current=result.nodes;currentEdges=result.edges;
    if(source==='papers'||source==='entities'||(source==='research'&&!applyOriginalLayout(current)))forceLayout(current,currentEdges);
    $('graphGrants').disabled=!(source==='entities'&&works.length&&authors.length);
    $('graphPaperLimit').disabled=source!=='entities';
    $('graphGrantLimit').disabled=source!=='entities';
    $('graphFocus').disabled=(source==='papers'||source==='mill');
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
    setInfo(source==='research'&&!Object.keys(communityGroups).length?
      'The selected JSON lacks original NetworkX community assignments. Rerun the updated public exporter for accurate community colors.':
      source==='papers'?'Publication relationships use shared title terms and explicitly listed authors only; they do NOT establish citations.':
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
      // Optional reviewed public OpenAlex export, used on every device when present.
      try{
        const extra=await fetch('data/research_graph_public.json?graph='+Date.now(),{cache:'no-store'});
        if(extra.ok){
          const data=await extra.json();
          if(Array.isArray(data.works)&&Array.isArray(data.authors)){
            setResearchPayload(data);
          }
        }
      }catch(error){/* The optional public OpenAlex dataset has not been deployed. */}
      const years=[...new Set(published.map(r=>Number(r.Year)).filter(Boolean))].sort((a,b)=>a-b);
      for(const id of ['graphYearFrom','graphYearTo']){
        const sel=$(id);sel.replaceChildren();
        const all=document.createElement('option');all.value='';all.textContent=id==='graphYearFrom'?'From any year':'Through any year';sel.append(all);
        for(const yr of years){const op=document.createElement('option');op.value=String(yr);op.textContent=String(yr);sel.append(op)}
      }
      draw();
    }catch(err){setInfo('Research graph data could not be loaded: '+err.message)}
  }

  async function readLocalFiles(files){
    const selected=[...files];
    const jsonFile=selected.find(f=>/\.json$/i.test(f.name));
    if(jsonFile){
      try{
        if(jsonFile.size>30*1024*1024)throw Error('Research JSON exceeds 30 MB');
        const data=JSON.parse(await jsonFile.text());
        setResearchPayload(data);
        $('graphSource').value='research';
        $('graphSearch').value='';
        draw();
        window.dispatchEvent(new CustomEvent('dashboard:graph-loaded',{
          detail:{works:works.length,authors:authors.length,name:jsonFile.name}
        }));
      }catch(error){setInfo('Could not read research JSON: '+error.message)}
      return;
    }
    const work=selected.find(f=>/enriched_works\.csv$/i.test(f.name));
    const author=selected.find(f=>/authors\.csv$/i.test(f.name));
    if(!work||!author){
      setInfo('Choose research_graph_public.json, or both enriched_works.csv and authors.csv.');return;
    }
    try{
      const raw=await Promise.all([work.text(),author.text()]);
      const ww=parseCSV(raw[0]),aa=parseCSV(raw[1]);
      setResearchPayload({works:ww,authors:aa,communities:{}});
      $('graphSource').value='research';draw();
      window.dispatchEvent(new CustomEvent('dashboard:graph-loaded',{
        detail:{works:works.length,authors:authors.length,name:'Original CSV files'}
      }));
    }catch(error){setInfo('Could not read OpenAlex CSVs: '+error.message)}
  }
  $('graphSource').addEventListener('change',()=>{selected=null;draw()});
  $('graphSearch').addEventListener('input',draw);
  $('graphLimit').addEventListener('change',draw);
  for(const id of ['graphFocus','graphPaperLimit','graphGrantLimit'])$(id).addEventListener('change',draw);
  for(const id of ['graphYearFrom','graphYearTo','graphFacility','graphStrength','graphMinShared','graphGrants'])$(id).addEventListener('change',draw);
  $('graphFit').addEventListener('click',fitGraph);
  $('graphZoomIn').addEventListener('click',()=>zoomGraph(.8));
  $('graphZoomOut').addEventListener('click',()=>zoomGraph(1.25));
  const canvas=$('graphCanvas');
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomGraph(e.deltaY>0?1.12:.89,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-node]'))return;drag={x:e.clientX,y:e.clientY,ox:viewport.x,oy:viewport.y};try{canvas.setPointerCapture(e.pointerId)}catch{}});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const r=canvas.getBoundingClientRect();viewport.x=drag.ox-(e.clientX-drag.x)*viewport.w/r.width;viewport.y=drag.oy-(e.clientY-drag.y)*viewport.h/r.height;applyGraphView()});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drag=null});
  $('graphImport').addEventListener('click',()=>{$('graphFiles').value='';$('graphFiles').click()});
  $('graphEmptyImport').addEventListener('click',()=>{$('graphImport').click()});
  $('graphFiles').addEventListener('change',e=>readLocalFiles(e.target.files));
  $('graphReset').addEventListener('click',()=>{selected=null;$('graphSearch').value='';$('graphFocus').value='';$('graphYearFrom').value='';$('graphYearTo').value='';$('graphFacility').value='all';draw()});
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