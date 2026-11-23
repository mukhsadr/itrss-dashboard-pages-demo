'use strict';
/* Single publication visualization: radial categorical rings + bundled paper links.
   Source: existing public bibliography and provenance-labeled research atlas.
   No simulated coauthor links. Local OpenAlex JSONL enables full authorship. */
(()=>{
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const wrap=document.querySelector('#papersSection .paperWrap');
if(!wrap)return;
const stage=document.createElement('div');stage.id='prStage';stage.className='prStage';
stage.innerHTML='<div class="prControls"><label>Find a paper, author, DOI<input id="prSearch" type="search" placeholder="Yamilov, seismic, tomography..."></label><label>Show relationships<select id="prRelation"><option value="title_terms">Related scientific concepts</option><option value="all">Concepts and journals</option><option value="venue">Same journal</option><option value="author">Verified shared authors (OpenAlex)</option></select></label><label>Curves<select id="prLimit"><option value="120" selected>120 focused</option><option value="260">260 balanced</option><option value="500">500 detailed</option></select></label><label>Clockwise<select id="prSort"><option value="strength" selected>Most connected first</option><option value="year">Year (oldest first)</option></select></label><button type="button" id="prMetadata">Load full author metadata</button><input type="file" accept=".jsonl,.json" id="prMetadataFile" hidden><button type="button" id="prReset">Reset</button></div><div id="prStats" class="prStats"></div><div class="prLinkLegend" aria-label="Research link strength legend"><span><i class="prKey strong"></i>Higher title overlap</span><span><i class="prKey medium"></i>Moderate</span><span><i class="prKey light"></i>Lower</span><span><i class="prKey author"></i>Shared OpenAlex author</span><small>Relative text similarity—not citation impact or proven computing use</small></div><div class="prLayout"><div class="prChart"><svg id="prSvg" viewBox="0 0 1000 1000" role="img" aria-label="Circular research publications grouped by scientific theme with edge-bundled connections"></svg><div class="prChartCaption" id="prCaption">Loading source publications…</div></div><aside id="prDetails" class="prDetails"><h3>Select a publication</h3><p>Click a publication or colored group to inspect source relationships.</p></aside></div><div class="prRingKey"><span><b>1</b> Resource</span><span><b>2</b> Year</span><span><b>3</b> Output type</span><span><b>4</b> Research theme</span><small>Use top Rings 1–4 controls to hide or show each band.</small></div>';
wrap.insertAdjacentElement('afterend',stage);
const SVG=$('prSvg'), color=['#75b9e9','#53d0b6','#e9ab6b','#c397e9','#e18fb4','#7fbbe3','#dfc575','#aaa1e5','#8fcead','#d799b1','#b9c38b','#9faec7'];
const RINGCOL=[['#509de3','#42bea8','#bc8ae0'],['#70cbd0','#38a1b4','#91d8cc','#26818c','#a5ddd5','#55bdd0','#328ba0','#71becb'],['#daa45f','#e9c48b','#bd8d55','#ffd7a8','#bd7557','#d8b47c']];
const el=(name,attrs={},value)=>{const o=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>o.setAttribute(k,String(v)));if(value!=null)o.textContent=value;return o};
const tx=(tag,s,parent,cl)=>{const e=document.createElement(tag);if(s!=null)e.textContent=s;if(cl)e.className=cl;parent.append(e);return e};
const clean=s=>String(s||'').trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//,'');
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const C=500,TWO=Math.PI*2,point=(r,a)=>[C+r*Math.cos(a),C+r*Math.sin(a)];
const ra=(r1,r2,a,b)=>{const a1=point(r2,a),a2=point(r2,b),b2=point(r1,b),b1=point(r1,a);return 'M'+a1+' A'+r2+' '+r2+' 0 '+(b-a>Math.PI?1:0)+' 1 '+a2+' L'+b2+' A'+r1+' '+r1+' 0 '+(b-a>Math.PI?1:0)+' 0 '+b1+' Z'};
function curve(pts){let x='M'+pts[0].join(' ');for(let i=0;i<pts.length-1;i++){const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],d=pts[Math.min(pts.length-1,i+2)];x+=' C'+(b[0]+(c[0]-a[0])*.18)+' '+(b[1]+(c[1]-a[1])*.18)+','+(c[0]-(d[0]-b[0])*.18)+' '+(c[1]-(d[1]-b[1])*.18)+','+c.join(' ')}return x}
let atlas=null,pilot=null,sourceRows=[],metadata=new Map(),allPapers=[],papers=[],displayEdges=[],selected=null,focusTheme='',mode='title_terms',rankedPapers=[],rankScores=new Map();
function facility(w){const s=w.resource||'';return s.includes('Foundry')&&s.includes('Mill')?'Both':s.includes('Mill')?'Mill':'Foundry'}
function field(w,i){return i===0?facility(w):i===1?String(w.year):i===2?w.type||'Other':w.theme}
function bandColor(w,i){const label=field(w,i);if(i===3)return color[Math.max(0,atlas.themes.indexOf(w.theme))%color.length];if(i===0)return RINGCOL[0][label==='Mill'?1:label==='Both'?2:0];if(i===1)return RINGCOL[1][Math.max(0,w.year-2019)%RINGCOL[1].length];let k=0;for(const ch of label)k=(k*31+ch.charCodeAt(0))|0;return RINGCOL[2][Math.abs(k)%RINGCOL[2].length]}
function supporting(w){return pilot?.articles?.find(x=>clean(x.doi)===clean(w.doi)&&w.doi)||pilot?.datasets?.find(x=>String(w.url).toLowerCase().includes(x.match.toLowerCase()))||null}
function authorNames(w){const a=metadata.get(clean(w.doi))?.authors||[];return a.length?a.map(x=>x.name).filter(Boolean):[w.authorsListed||'Not yet enriched']}
function relationKind(link){return link.types.includes('author')?'Verified authorship':link.types.includes('title_terms')?'Title-term overlap':'Shared journal venue'}
function strengthTier(link){return link.types.includes('author')?'author':link.tier||'light'}
function strengthText(link){if(link.types.includes('author'))return 'Shared OpenAlex author';if(link.types.includes('venue')&&!link.types.includes('title_terms'))return 'Same journal (not strength-ranked)';return (link.tier==='high'?'Higher':link.tier==='medium'?'Moderate':'Lower')+' title overlap · similarity '+Number(link.score||0).toFixed(1)}
function showDetail(w){
 selected=w?.id??null;const box=$('prDetails');box.replaceChildren();
 if(!w){tx('h3','Most connected research papers',box);tx('p','Clockwise order begins with the strongest connected papers within each research theme. Click a title to highlight its links.',box);const list=tx('ol',null,box,'prRankedList');for(const item of rankedPapers.slice(0,8)){const li=tx('li',null,list),b=tx('button',item.w.title,li);b.onclick=()=>showDetail(item.w);tx('small',item.count+' displayed connections · '+item.w.theme,li)}tx('p','Rankings come from the selected title/journal overlap network—not citation impact, usage, or verified research importance.',box,'prHint');return}
 tx('h3',w.title,box);tx('span',w.theme,box,'prChip');tx('span',w.year+' · '+facility(w),box,'prChip');
 tx('p','Authors: '+authorNames(w).join('; '),box);tx('p','Venue: '+(w.venue||'Not supplied'),box);
 if(w.url){let a=tx('a','Open original publication',box);a.href=w.url;a.target='_blank';a.rel='noopener noreferrer'}
 const support=supporting(w);
 if(support){tx('h4','Computing-evidence review',box);tx('span',support.status.replaceAll('_',' '),box,'prChip');if(support.facility)tx('p','Verified named resource: '+support.facility,box);tx('p',support.note,box);if(support.url){let a=tx('a','Open evidence source',box);a.href=support.url;a.target='_blank';a.rel='noopener noreferrer'}}
 else tx('p','No full-text computing acknowledgement reviewed for this publication yet.',box,'prHint');
 const links=displayEdges.filter(x=>x.s===w.id||x.t===w.id);tx('h4','Related works ('+links.length+')',box);const ul=tx('ul',null,box);
 for(const e of links.slice(0,10)){const other=papers.find(p=>p.id===(e.s===w.id?e.t:e.s));if(!other)continue;const li=tx('li',null,ul);const b=tx('button',other.title,li);b.onclick=()=>showDetail(other);const detail=strengthText(e)+(Array.isArray(e.words)&&e.words.length?' · Shared terms: '+e.words.slice(0,4).join(', '):'');tx('small',detail,li,'prRelationExplain')}
 mark();
}
function showConnection(link,a,b){
 selected=null;const box=$('prDetails');box.replaceChildren();
 tx('h3','Why these papers connect',box);
 tx('span',relationKind(link),box,'prChip');
 tx('span',strengthText(link),box,'prChip');
 if(Array.isArray(link.words)&&link.words.length)tx('p','Shared distinctive title terms: '+link.words.slice(0,8).join(', '),box);
 tx('p','This relationship comes from '+(link.types.includes('author')?'matching OpenAlex author identities. It is not evidence that both papers used the same computing resource.':link.types.includes('title_terms')?'similar wording in publication titles; the overlap score is relative and exploratory.':'a common journal; it does not establish a scientific dependency.'),box,'prHint');
 for(const [i,w]of [a,b].entries()){
  tx('h4',(i===0?'Publication A':'Publication B'),box);
  const button=tx('button',w.title,box,'prConnectedPaper');button.onclick=()=>showDetail(w);
  tx('p',w.year+' · '+w.theme,box);
  if(w.url){const src=tx('a','Open publication source',box);src.href=w.url;src.target='_blank';src.rel='noopener noreferrer'}
 }
 for(const path of SVG.querySelectorAll('.prCurve')){
  const hit=Number(path.dataset.s)===link.s&&Number(path.dataset.t)===link.t;
  path.classList.toggle('focus',hit);path.classList.toggle('fade',!hit);
 }
 for(const x of SVG.querySelectorAll('.prLeaf')){
  const id=Number(x.dataset.id),active=id===a.id||id===b.id;
  x.classList.toggle('focus',active);x.classList.toggle('fade',!active);
 }
}
function mark(){
 const near=new Set([selected]);displayEdges.forEach(x=>{if(x.s===selected)near.add(x.t);if(x.t===selected)near.add(x.s)});
 SVG.querySelectorAll('.prCurve').forEach(x=>{const hit=Number(x.dataset.s)===selected||Number(x.dataset.t)===selected;x.classList.toggle('focus',selected!=null&&hit);x.classList.toggle('fade',selected!=null&&!hit)});
 SVG.querySelectorAll('.prLeaf').forEach(x=>{const id=Number(x.dataset.id);x.classList.toggle('focus',id===selected);x.classList.toggle('fade',selected!=null&&!near.has(id))});
}
function go(){
 if(!atlas||!sourceRows.length)return;
 const idDOI=new Set(sourceRows.map(r=>clean(r.DOI)).filter(Boolean)),idTitles=new Set(sourceRows.map(r=>norm(r.Title)));
 allPapers=atlas.works.filter(w=>idDOI.has(clean(w.doi))||idTitles.has(norm(w.title)));
 const search=$('prSearch').value.toLowerCase().trim();
 papers=allPapers.filter(w=>(!focusTheme||w.theme===focusTheme)&&(!search||[w.title,w.venue,w.doi,w.authorsListed,...authorNames(w)].some(x=>String(x||'').toLowerCase().includes(search))));
 papers.sort((a,b)=>atlas.themes.indexOf(a.theme)-atlas.themes.indexOf(b.theme)||a.year-b.year||a.title.localeCompare(b.title));
 const ids=new Set(papers.map(w=>w.id)),byID=new Map(papers.map(w=>[w.id,w]));
 let candidates=atlas.links.filter(e=>ids.has(e.s)&&ids.has(e.t)).map(e=>({...e,types:[...e.types]}));
 const byAuthor=new Map();
 for(const w of papers)for(const a of metadata.get(clean(w.doi))?.authors||[]){if(!a.openalex_id)continue;if(!byAuthor.has(a.openalex_id))byAuthor.set(a.openalex_id,[]);byAuthor.get(a.openalex_id).push(w.id)}
 const joined=new Set();
 for(const row of byAuthor.values())if(row.length>1)for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length;j++){const a=Math.min(row[i],row[j]),b=Math.max(row[i],row[j]),key=a+'|'+b;if(!joined.has(key)){joined.add(key);candidates.push({s:a,t:b,score:900,types:['author']})}}
 mode=$('prRelation').value;
 candidates=candidates.filter(e=>mode==='all'?!e.types.includes('author'):e.types.includes(mode));
 candidates.sort((a,b)=>b.score-a.score);
 displayEdges=candidates.slice(0,Number($('prLimit').value)||120);
 // Relative tiers are percentile groups *within the currently displayed title-similarity links*.
 // Same-venue links have no scientific strength score; coauthorship is independently sourced.
 const titleLinks=displayEdges.filter(e=>e.types.includes('title_terms')).sort((a,b)=>b.score-a.score);
 titleLinks.forEach((link,i)=>{link.tier=i<Math.ceil(titleLinks.length*.24)?'high':i<Math.ceil(titleLinks.length*.60)?'medium':'light'});
 displayEdges.filter(e=>!e.types.includes('title_terms')).forEach(link=>link.tier=link.types.includes('author')?'author':'venue');
 rankScores=new Map();
 const degree=new Map();
 for(const link of displayEdges){
  const score=link.types.includes('author')?1:Number(link.score)||1;
  for(const id of [link.s,link.t]){
   rankScores.set(id,(rankScores.get(id)||0)+score);
   degree.set(id,(degree.get(id)||0)+1);
  }
 }
 rankedPapers=papers.filter(w=>degree.has(w.id)).map(w=>({w,count:degree.get(w.id),weight:rankScores.get(w.id)})).sort((a,b)=>b.weight-a.weight||b.count-a.count||a.w.title.localeCompare(b.w.title));
 // Preserve research communities while ordering the most strongly connected papers first clockwise.
 if($('prSort').value==='strength') papers.sort((a,b)=>atlas.themes.indexOf(a.theme)-atlas.themes.indexOf(b.theme)||(rankScores.get(b.id)||0)-(rankScores.get(a.id)||0)||(degree.get(b.id)||0)-(degree.get(a.id)||0)||a.title.localeCompare(b.title));
 SVG.replaceChildren();
 const n=papers.length;
 $('prStats').replaceChildren();
 for(const [name,val] of [['Works',n],['Journal papers',papers.filter(w=>w.type==='Journal article').length],['Research groups',new Set(papers.map(w=>w.theme)).size],['Displayed relations',displayEdges.length],['Source evidence',papers.filter(w=>supporting(w)).length]]){const t=tx('span',null,$('prStats'));tx('strong',val,t);tx('small',name,t)}
 if(!n){$('prCaption').textContent='No papers match this selection';showDetail(null);return}
 const angles=new Map(),themes=new Map();let j=0;
 for(const group of atlas.themes){const a=papers.filter(w=>w.theme===group);if(!a.length)continue;const first=-Math.PI/2+j/n*TWO,last=-Math.PI/2+(j+a.length)/n*TWO;themes.set(group,{from:first,to:last,mid:(first+last)/2,total:a.length});a.forEach((w,k)=>angles.set(w.id,-Math.PI/2+(j+k+.5)/n*TWO));j+=a.length}
 const lGroup=el('g'),rings=el('g'),nodes=el('g');SVG.append(lGroup,rings,nodes);
 for(const e of displayEdges){const a=byID.get(e.s),b=byID.get(e.t),aa=angles.get(e.s),bb=angles.get(e.t),ha=themes.get(a.theme).mid,hb=themes.get(b.theme).mid;
  const path=el('path',{d:curve([point(296,aa),point(220,aa),point(147,ha),point(47,ha),point(47,hb),point(147,hb),point(220,bb),point(296,bb)]),class:'prCurve tier-'+strengthTier(e)+(e.types.includes('author')?' author':''),'data-s':e.s,'data-t':e.t});
  path.append(el('title',{},strengthText(e)+(Array.isArray(e.words)&&e.words.length?' · '+e.words.slice(0,5).join(', '):'')+' · Click to inspect this relationship'));path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-label',a.title+' linked with '+b.title+': '+strengthText(e));path.onclick=()=>showConnection(e,a,b);path.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();showConnection(e,a,b)}};lGroup.append(path);
 }
 const radii=[[304,318],[325,339],[345,359],[366,380]];
 for(let i=0;i<4;i++){const layer=el('g',{'data-pr-ring':i});rings.append(layer);
  for(const w of papers){const a=angles.get(w.id);const x=el('path',{d:ra(radii[i][0],radii[i][1],a-TWO/(n*2)+.0005,a+TWO/(n*2)-.0005),fill:bandColor(w,i),class:'prSegment',role:'button',tabindex:0});
   x.append(el('title',{},field(w,i)+' · '+w.title));x.onclick=()=>showDetail(w);layer.append(x)}
 }
 for(const [name,group] of themes){const arc=el('path',{d:ra(385,397,group.from+.002,group.to-.002),fill:color[atlas.themes.indexOf(name)%color.length],class:'prTheme'});
  arc.append(el('title',{},name+' · '+group.total+' papers'));arc.onclick=()=>{focusTheme=focusTheme===name?'':name;selected=null;go()};rings.append(arc);
  // Label wider scientific communities on their own arcs. Keep smaller ones hover-only.
  const room=(group.to-group.from)*390;
  if(room>120&&group.total>=12){
   const a=group.mid,p=point(389,a),baseDeg=a*180/Math.PI+90;
   const flip=baseDeg>90&&baseDeg<270,rotation=baseDeg+(flip?180:0);
   const label=el('text',{x:p[0],y:p[1],transform:'rotate('+rotation+' '+p[0]+' '+p[1]+')','text-anchor':'middle',class:'prGroupLabel'},name.length>22?name.slice(0,20)+'…':name);
   label.append(el('title',{},name+' · '+group.total+' publications'));label.onclick=()=>{focusTheme=focusTheme===name?'':name;selected=null;go()};rings.append(label);
  }
 }
 for(const w of papers){const a=angles.get(w.id),p=point(298,a),q=point(413,a),right=Math.cos(a)>0,angle=a*180/Math.PI;
  const leaf=el('g',{class:'prLeaf','data-id':w.id,role:'button',tabindex:0,'aria-label':w.title});
  leaf.append(el('circle',{cx:p[0],cy:p[1],r:n>100?3.6:5.5,fill:color[atlas.themes.indexOf(w.theme)%color.length]}));
  const title=el('text',{x:q[0],y:q[1],transform:'rotate('+(right?angle:angle+180)+' '+q[0]+' '+q[1]+')','text-anchor':right?'start':'end'},w.title.length>21?w.title.slice(0,19)+'…':w.title);leaf.append(title);leaf.append(el('title',{},w.title));
  leaf.onclick=()=>showDetail(w);leaf.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showDetail(w)}};nodes.append(leaf)
 }
 // Rank badges are intentionally sparse to prevent labels from colliding at 230 papers.
 const markedAngles=[],rankLabels=el('g',{class:'prTopRankLabels'});SVG.append(rankLabels);
 for(let i=0;i<rankedPapers.length&&markedAngles.length<6;i++){
  const item=rankedPapers[i],angle=angles.get(item.w.id);if(angle===undefined)continue;
  if(markedAngles.some(a=>Math.abs(Math.atan2(Math.sin(a-angle),Math.cos(a-angle)))<.16))continue;
  markedAngles.push(angle);
  const p=point(277,angle),badge=el('g',{class:'prRankBadge',role:'button',tabindex:0,'aria-label':'Connected paper rank '+(i+1)+': '+item.w.title});
  badge.append(el('circle',{cx:p[0],cy:p[1],r:10,fill:'#0d3144',stroke:'#7ce2ca','stroke-width':1.5}));
  badge.append(el('text',{x:p[0],y:p[1]+3.4,'text-anchor':'middle'},String(i+1)));
  badge.append(el('title',{},'Rank '+(i+1)+' · '+item.count+' displayed links · '+item.w.title));
  badge.onclick=()=>showDetail(item.w);badge.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();showDetail(item.w)}};rankLabels.append(badge);
 }
 $('prCaption').textContent=n+' publications · '+displayEdges.length+' '+(mode==='author'?'OpenAlex author':'candidate title/venue')+' relations · strongest first clockwise within research groups';
 if(selected!=null&&byID.has(selected))showDetail(byID.get(selected));else{selected=null;showDetail(null)}
 mark();
}
for(const id of ['prSearch','prRelation','prLimit','prSort'])$(id).addEventListener(id==='prSearch'?'input':'change',()=>{selected=null;go()});
$('prReset').onclick=()=>{focusTheme='';selected=null;$('prSearch').value='';$('prRelation').value='title_terms';$('prLimit').value='120';$('prSort').value='strength';go()};
$('prMetadata').onclick=()=>$('prMetadataFile').click();
$('prMetadataFile').onchange=async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{const rows=(await file.text()).split(/\r?\n/).filter(Boolean);const map=new Map();
  for(const row of rows){const x=JSON.parse(row);if(x.doi&&Array.isArray(x.authors))map.set(clean(x.doi),x)}
  metadata=map;$('prRelation').value='author';selected=null;go();
  $('prCaption').textContent='Loaded '+rows.length+' OpenAlex rows locally · original bibliography remains public · author links are not uploaded';
 }catch(err){$('prCaption').textContent='Metadata file could not be loaded: '+err.message}
};
window.addEventListener('dashboard:paper-rendered',ev=>{sourceRows=ev.detail.rows||[];go()});
Promise.all([
 fetch('data/publication_atlas_public.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('No atlas data'))),
 fetch('data/mri_evidence_pilot.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null)
]).then(([a,b])=>{atlas=a;pilot=b;go()}).catch(err=>{$('prCaption').textContent='Source data unavailable: '+err.message});
})();
