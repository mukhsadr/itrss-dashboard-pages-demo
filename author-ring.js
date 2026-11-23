'use strict';
/* Publication authorship explorer: evidence-led fourth ring.
 * Default: credited-name frequency from the PUBLIC bibliography.
 * OpenAlex joins (when supplied): exact author IDs & shared publication IDs.
 * A single "et al." credit does NOT establish a coauthor relationship.
 */
(()=>{
  const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
  const MAX_VISIBLE=16;
  let state=null, network=null, focus=null, anchor='', anchorManuallySet=false, other=false;
  let namedStats=new Map(), matchingRows=0, sourceLabel='Listed authors only';
  const palettes=['#c3a0f5','#9677de','#d4b4fd','#855dca','#deacfa','#a78af2','#b8b6ff','#8c73bb'];
  function svg(tag,props={}){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(props))e.setAttribute(k,String(v));return e}
  function point(r,a){return [340+r*Math.cos(a),340+r*Math.sin(a)]}
  function arc(ri,ro,a,b){b=Math.min(b,a+Math.PI*2-.000001);const a1=point(ro,a),a2=point(ro,b),b2=point(ri,b),b1=point(ri,a),big=b-a>Math.PI?1:0;
    return 'M'+a1.join(' ')+' A'+ro+' '+ro+' 0 '+big+' 1 '+a2.join(' ')+' L'+b2.join(' ')+' A'+ri+' '+ri+' 0 '+big+' 0 '+b1.join(' ')+' Z'}
  function norm(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function normTitle(s){return norm(s).replace(/\s+/g,' ')}
  function normDOI(s){return String(s||'').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,'').replace(/^doi:\s*/,'').replace(/[?#].*$/,'').trim()}
  function listed(raw){return String(raw||'').split(/\s+(?:&|and)\s+|;/i).map(s=>s.replace(/\bet\s+al\.?\s*$/i,'').trim()).filter(Boolean)}
  function sortCount(a,b){return b.count-a.count||a.name.localeCompare(b.name)}
  function doiFor(r){return normDOI(r.DOI||r['DOI / record link']||'')}
  function paperLink(r){
    const raw=String(r['DOI / record link']||'').trim()||(r.DOI?'https://doi.org/'+r.DOI:'');
    try{const u=new URL(raw);return /^https?:$/.test(u.protocol)?u.href:null}catch{return null}
  }
  function networkIndex(){
    const doi=new Map(),title=new Map(),authByWork=new Map(),names=new Map(),idByName=new Map();
    if(!network)return {doi,title,authByWork,names,idByName};
    for(const w of network.works){
      const key=String(w.record_id||'');if(!key)continue;
      const dk=normDOI(w.doi||w.source_url),tk=normTitle(w.title);
      if(dk&&!doi.has(dk))doi.set(dk,key);
      if(tk&&!title.has(tk))title.set(tk,key);
    }
    for(const a of network.authors){
      const pid=String(a.record_id||''),id=String(a.author_id||'');
      if(!pid||!id)continue;
      if(!authByWork.has(pid))authByWork.set(pid,new Map());
      authByWork.get(pid).set(id,String(a.author_name||id));
      names.set(id,String(a.author_name||id));
    }
    for(const [id,name] of names){
      const k=norm(name);if(!idByName.has(k))idByName.set(k,id);
      else idByName.set(k,null); // Do not merge ambiguous identical names.
    }
    return {doi,title,authByWork,names,idByName};
  }
  function authorsForRows(rows){
    const index=networkIndex(),papers=[],stats=new Map();
    let matched=0;
    for(const row of rows){
      const key=index.doi.get(doiFor(row))||index.title.get(normTitle(row.Title));
      const full=!!(key&&index.authByWork.has(key)&&index.authByWork.get(key).size);
      if(full)matched++;
      const authorList=full?[...index.authByWork.get(key)].map(([id,name])=>({id:'o:'+id,name,verified:true})):
        listed(row.Authors).map(name=>{
          const known=index.idByName.get(norm(name));
          return {id:known?'o:'+known:'b:'+norm(name),name,verified:false};
        });
      const unique=[...new Map(authorList.map(a=>[a.id,a])).values()];
      const paper={row,workId:full?key:null,authors:unique,verified:full};
      papers.push(paper);
      for(const author of unique){
        if(!stats.has(author.id))stats.set(author.id,{id:author.id,name:author.name,count:0,papers:[],verifiedWorks:0});
        const st=stats.get(author.id);st.count++;st.papers.push(paper);if(full)st.verifiedWorks++;
      }
    }
    return {stats,papers,matched};
  }
  function coauthors(author,stats){
    const result=new Map(),seen=new Set();
    if(!author)return [];
    for(const p of author.papers){
      // Only record true coauthorship on a matched OpenAlex work with stable IDs.
      if(!p.verified||!p.workId||seen.has(p.workId))continue;
      seen.add(p.workId);
      for(const other of p.authors){
        if(other.id===author.id)continue;
        if(!result.has(other.id))result.set(other.id,{id:other.id,name:other.name,count:0});
        result.get(other.id).count++;
      }
    }
    return [...result.values()].sort(sortCount);
  }
  function options(stats){
    const sel=$('paperAuthorAnchor'),old=anchor;
    sel.replaceChildren();
    const all=document.createElement('option');all.value='';all.textContent='All credited authors';sel.append(all);
    const ranked=[...stats.values()].sort(sortCount);
    for(const author of ranked){
      const option=document.createElement('option');option.value=author.id;
      option.textContent=author.name+' · '+author.count+' papers';
      sel.append(option);
    }
    if(!anchorManuallySet&&network&&!anchor){
      const match=ranked.find(a=>/\byamilov\b/i.test(a.name));
      if(match)anchor=match.id;
    }
    if(!stats.has(anchor))anchor='';
    sel.value=anchor;
    $('paperAuthorAnchorNote').textContent=network
      ?matchingRows+' of '+state.rows.length+' visible publications matched to OpenAlex; coauthor links use matching IDs only.'
      :'Public bibliography lists only some authors; full coauthor rankings require research_graph_public.json.';
  }
  function makeSlice(chart,ri,ro,a,b,color,label,title,action){
    if(b<=a)return;
    const path=svg('path',{d:arc(ri,ro,a,b),fill:color,class:'arc authorArc',role:'button',tabindex:'0',
      'aria-label':label});
    path.append(svg('title'));path.children[path.children.length-1].textContent=title;
    path.addEventListener('click',action);
    path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action()}});
    chart.append(path);
  }
  function legend(items,title,clicker){
    const box=document.createElement('div');box.className='legendGroup authorLegendGroup';
    const heading=document.createElement('div');heading.className='legendTitle';heading.textContent=title;box.append(heading);
    for(let i=0;i<items.length;i++){
      const a=items[i],row=document.createElement('button');row.className='legendRow authorLegendRow';
      const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=palettes[i%palettes.length];
      const name=document.createElement('span');name.className='name';name.textContent=a.name;name.title=a.name;
      const value=document.createElement('span');value.className='pct';value.textContent=String(a.count);
      row.append(swatch,name,value);row.onclick=()=>clicker(a);box.append(row);
    }
    $('paperLegend').append(box);
  }
  function wheel(items,inner,outer,chart,onClick){
    const total=items.reduce((s,x)=>s+x.count,0);
    let angle=-Math.PI/2;
    for(let i=0;i<items.length;i++){
      const a=items[i],sweep=total?a.count/total*Math.PI*2:0,next=angle+sweep;
      makeSlice(chart,inner,outer,angle,next,palettes[i%palettes.length],
        a.name+' · '+a.count,a.name+' · '+a.count+' '+(focus?'shared papers':'credited papers'),()=>onClick(a));
      angle=next;
    }
  }
  function ringData(stats){
    const ranked=[...stats.values()].sort(sortCount);
    const root=stats.get(anchor);
    if(!root)return ranked;
    return coauthors(root,stats);
  }
  function renderOuter(){
    if(!state||focus)return;
    const data=authorsForRows(state.rows);
    namedStats=data.stats;matchingRows=data.matched;
    options(namedStats);
    const ranking=ringData(namedStats);
    const visible=ranking.slice(0,MAX_VISIBLE);
    const rest=ranking.slice(MAX_VISIBLE);
    const segments=[...visible];
    if(rest.length)segments.push({id:'__other__',name:'Other authors ('+rest.length+')',count:rest.reduce((s,a)=>s+a.count,0)});
    wheel(segments,294,323,$('paperChart'),a=>{
      if(a.id==='__other__'){other=true;showOther(rest);return}
      showAuthor(a.id);
    });
    legend(segments,'RING 4 · '+(anchor?'Collaborators · shared papers':'Authors · credited papers')+' ↓ clockwise',
      a=>a.id==='__other__'?showOther(rest):showAuthor(a.id));
    $('paperAuthorStatus').textContent=anchor
      ?(ranking.length?'Collaborators of '+namedStats.get(anchor).name+' · ranked by shared papers':
        'No verified collaborators for '+namedStats.get(anchor).name+' in the matched OpenAlex publications')
      :'Author credits ranked clockwise, high to low · '+namedStats.size+' unique names';
  }
  function addRecordList(papers){
    const list=$('paperRecords');list.replaceChildren();
    const seen=new Set(),ordered=[];
    for(const p of papers){
      const key=p.workId||String(p.row.Title||'')+'|'+String(p.row.Year||'');
      if(seen.has(key))continue;seen.add(key);ordered.push(p.row);
    }
    ordered.sort((a,b)=>Number(b.Year||0)-Number(a.Year||0));
    $('paperRecordCount').textContent=ordered.length+' source publications involving selected author';
    for(const p of ordered.slice(0,35)){
      const card=document.createElement('div');card.className='paperRecord';
      const title=document.createElement('div');title.className='paperTitle';
      const url=paperLink(p);
      if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=p.Title;title.append(link)}
      else title.textContent=p.Title||'Untitled publication';
      const meta=document.createElement('div');meta.className='paperMeta';
      meta.textContent=[p.Year,p['Cluster acknowledged'],p.Authors,p.Venue].filter(Boolean).join(' · ');
      card.append(title,meta);list.append(card);
    }
    if(ordered.length>35){
      const msg=document.createElement('p');msg.textContent='Showing the first 35 source publications.';list.append(msg);
    }
  }
  function showOther(remaining){
    focus='__other__';other=true;
    const section=$('papersSection');section.classList.add('author-exploring');
    const chart=$('paperChart');chart.replaceChildren();$('paperLegend').replaceChildren();
    $('paperAuthorBack').hidden=false;$('paperAuthorFocusName').textContent='More authors';
    $('paperAuthorFocusCount').textContent=remaining.length+' credited names';
    $('paperAuthorStatus').textContent='Select any author to explore their papers and verified collaborators.';
    const chooser=$('paperAuthorChooser'),sel=$('paperAuthorQuickSelect');sel.replaceChildren();
    for(const a of remaining){const op=document.createElement('option');op.value=a.id;op.textContent=a.name+' · '+a.count+' credited papers';sel.append(op)}
    chooser.hidden=false;
    // A second outer ring makes the full ranked list reachable without a dense 146-slice donut.
    const items=remaining.slice(0,MAX_VISIBLE),more=remaining.slice(MAX_VISIBLE);
    const set=[...items];if(more.length)set.push({id:'__othermore__',name:'Next '+more.length+' authors',count:more.reduce((s,a)=>s+a.count,0)});
    wheel(set,170,305,chart,a=>a.id==='__othermore__'?showOther(more):showAuthor(a.id));
    legend(set,'OTHER AUTHORS · ranked clockwise',a=>a.id==='__othermore__'?showOther(more):showAuthor(a.id));
  }
  function showAuthor(id){
    if(!state)return;
    const data=authorsForRows(state.rows);
    namedStats=data.stats;matchingRows=data.matched;
    const author=namedStats.get(id);
    if(!author)return;
    focus=id;other=false;
    const chart=$('paperChart');chart.replaceChildren();$('paperLegend').replaceChildren();
    $('papersSection').classList.add('author-exploring');
    $('paperAuthorBack').hidden=false;
    $('paperAuthorFocusName').textContent=author.name;
    $('paperAuthorFocusCount').textContent=author.count+' credited '+(author.count===1?'paper':'papers');
    $('paperAuthorChooser').hidden=true;
    const neighbors=coauthors(author,namedStats);
    if(neighbors.length){
      const top=neighbors.slice(0,MAX_VISIBLE),rest=neighbors.slice(MAX_VISIBLE);
      const slices=[...top];
      if(rest.length)slices.push({id:'__other__',name:'Other coauthors ('+rest.length+')',count:rest.reduce((s,n)=>s+n.count,0)});
      wheel(slices,170,305,chart,n=>n.id==='__other__'?showOther(rest):showAuthor(n.id));
      legend(slices,'CONNECTED COAUTHORS · joint papers ↓ clockwise',
        n=>n.id==='__other__'?showOther(rest):showAuthor(n.id));
      $('paperAuthorStatus').textContent=neighbors.length+' verified coauthors in '+author.verifiedWorks+' matched papers · priority is shared work count';
    }else{
      const years=new Map();
      for(const p of author.papers){
        const y=String(p.row.Year||'Not specified');years.set(y,(years.get(y)||0)+1);
      }
      const items=[...years].map(([name,count])=>({id:'year:'+name,name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
      wheel(items,170,305,chart,()=>{});
      legend(items,'PUBLICATION YEARS · no verified coauthors',()=>{});
      $('paperAuthorStatus').textContent='Only listed-author credits available here. Verified coauthor relationships require matching OpenAlex records.';
    }
    addRecordList(author.papers);
  }
  function reset(){
    focus=null;other=false;$('papersSection').classList.remove('author-exploring');
    $('paperAuthorBack').hidden=true;$('paperAuthorChooser').hidden=true;
    $('paperAuthorStatus').textContent='';
    $('paperAuthorFocusName').textContent='';
    $('paperAuthorFocusCount').textContent='';
    window.dispatchEvent(new Event('dashboard:paper-rerender'));
  }
  window.addEventListener('dashboard:paper-dataset-loaded',()=>{
    focus=null;other=false;anchor='';anchorManuallySet=false;
    $('papersSection').classList.remove('author-exploring');$('paperAuthorBack').hidden=true;$('paperAuthorChooser').hidden=true;
  });
  window.addEventListener('dashboard:paper-rendered',event=>{
    state=event.detail;if(!state||!state.rows)return;
    const data=authorsForRows(state.rows);namedStats=data.stats;matchingRows=data.matched;
    if(focus){
      if(focus==='__other__'){reset();return}
      showAuthor(focus);
    }else renderOuter();
  });
  window.addEventListener('dashboard:research-data-loaded',event=>{
    const d=event.detail;if(!d||!Array.isArray(d.works)||!Array.isArray(d.authors))return;
    network={works:d.works,authors:d.authors};
    if(state)window.dispatchEvent(new Event('dashboard:paper-rerender'));
  });
  $('paperAuthorAnchor').addEventListener('change',e=>{
    anchor=e.target.value;anchorManuallySet=true;
    if(state)window.dispatchEvent(new Event('dashboard:paper-rerender'));
  });
  $('paperAuthorBack').addEventListener('click',reset);
  $('paperAuthorQuickGo').addEventListener('click',()=>{
    const id=$('paperAuthorQuickSelect').value;
    if(id)showAuthor(id);
  });
})();
