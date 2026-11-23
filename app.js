'use strict';
(()=>{
const $=id=>document.getElementById(id),SVG='http://www.w3.org/2000/svg';
const PALETTES=[['#5c9eff','#3c7fdb','#8ebdff','#4568ae','#a1ceef','#6669ba','#378dc0','#86a3d0'],['#2cbdaf','#159f94','#75d8bd','#3a8f85','#a1e0c9','#5eb3a2','#248478','#b1cfc1'],['#e6a85e','#d58e46','#f3c681','#b87555','#ffd59e','#caac71','#f0a27d','#ad805b'],['#ad91e4','#906dd1','#c4a9fa','#7157a9','#b39fe2','#9979bf','#d0b7ef','#71539a']];
let rows=[],columns=[],layers=[],filters=[null,null,null,null];
function csvParse(text){const raw=[];let f='',line=[],q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){f+='"';i++}else q=!q}else if(c===','&&!q){line.push(f);f=''}else if((c==='\r'||c==='\n')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;line.push(f);if(line.some(v=>v.trim()))raw.push(line);line=[];f=''}else f+=c}line.push(f);if(line.some(v=>v.trim()))raw.push(line);if(!raw.length)return {columns:[],rows:[]};const cols=raw.shift().map(v=>v.replace(/^\ufeff/,'').trim());return {columns:cols,rows:raw.map(a=>Object.fromEntries(cols.map((h,i)=>[h,(a[i]||'').trim()])))}}

/* PUBLIC_DATA.csv is the canonical default source.
 * Preserve actual department and academic-program labels (the earlier version
 * reclassified them into generic buckets, making the display look unchanged).
 * Unique User IDs and advisor names are NEVER included in chart rows.
 * Rare individual department/program labels (<5 occurrences) are grouped,
 * keeping detail while protecting small categories.
 */
function groupedPublicData(parsed){
 if(!parsed.columns.includes('User')||!parsed.columns.includes('Descr')||!parsed.columns.includes('Classficiation'))return parsed;
 const frequency=(name)=>{
  const m=new Map();
  for(const r of parsed.rows){const v=String(r[name]||'').trim()||(name==='Classficiation'?'Unknown':'Not specified');m.set(v,(m.get(v)||0)+1)}
  return m;
 };
 const deptFreq=frequency('Descr'),programFreq=frequency('Classficiation');
 const keyCount=new Map(); let rareDeptRecords=0,rareProgramRecords=0;
 for(const r of parsed.rows){
  const d=String(r.Descr||'').trim()||'Not specified';
  const degree=String(r.Classficiation||'').trim()||'Unknown';
  const dept=deptFreq.get(d)>=5?d:'Other departments (<5 per department)';
  const program=programFreq.get(degree)>=5?degree:'Other academic programs (<5 per program)';
  if(dept!==d)rareDeptRecords++;
  if(program!==degree)rareProgramRecords++;
  const status=String(r.Status||'').trim()||'Not specified';
  const advisor=String(r.Advisor||'').trim()?'Advisor recorded':'No advisor recorded';
  const k=JSON.stringify([dept,program,status,advisor]);
  keyCount.set(k,(keyCount.get(k)||0)+1);
 }
 const rows=[...keyCount].map(([key,count])=>{
  const fields=JSON.parse(key);
  return {Descr:fields[0],Classficiation:fields[1],Status:fields[2],Advisor:fields[3],Count:String(count)};
 }).sort((a,b)=>Number(b.Count)-Number(a.Count));
 return {columns:['Descr','Classficiation','Status','Advisor','Count'],rows,sourceRows:parsed.rows.length,rareDeptRecords,rareProgramRecords,
  distinctDepartments:new Set(rows.map(r=>r.Descr)).size,distinctPrograms:new Set(rows.map(r=>r.Classficiation)).size,sourceType:'PUBLIC_DATA.csv'};
}
function value(r,col){return (r[col]||'').trim()||'Not specified'}
function weight(r){const n=Number(r.Count);return r.Count!==undefined&&Number.isFinite(n)&&n>0?n:1}
function totalWeight(items){return items.reduce((n,r)=>n+weight(r),0)}
function guess(col){const s=col.toLowerCase();if(/(role|type|affiliation|faculty|student|user.?type|person)/.test(s))return 0;if(/(degree|classification|education|academic|level|program)/.test(s))return 1;if(/(status|active|enroll|graduate|working)/.test(s))return 2;return 9}
function setup(){
  const used=[];
  const patterns=[
    [/^descr$/i,/department|dept/i],
    [/^classficiation$/i,/^classification$/i,/^class$/i],
    [/^status$/i],
    [/^advisor$/i,/adviser|manager|supervisor|\bpi\b/i]
  ];
  layers=patterns.map(options=>{
    const match=columns.find(c=>!used.includes(c)&&options.some(re=>re.test(c)))
      || columns.find(c=>!used.includes(c)) || '';
    used.push(match);return match;
  });
  for(let i=0;i<4;i++){
    const s=$('layer'+i);s.replaceChildren();
    for(const column of columns.filter(c=>c!=='Count')){const o=document.createElement('option');o.value=column;o.textContent=column;s.append(o)}
    s.value=layers[i];s.onchange=()=>{layers[i]=s.value;filters=[null,null,null,null];render()};
  }
}
function countBy(items,col){const map=new Map();for(const r of items){const k=value(r,col);map.set(k,(map.get(k)||0)+weight(r))}let a=[...map].map(([name,count])=>({name,count}));const sort=$('sort').value;a.sort((x,y)=>sort==='desc'?y.count-x.count||x.name.localeCompare(y.name):sort==='asc'?x.count-y.count||x.name.localeCompare(y.name):x.name.localeCompare(y.name));return a}
function point(r,a){return [340+r*Math.cos(a),340+r*Math.sin(a)]}
function path(ri,ro,a,b){const p1=point(ro,a),p2=point(ro,b),p3=point(ri,b),p4=point(ri,a),big=b-a>Math.PI?1:0;return `M ${p1.join(' ')} A ${ro} ${ro} 0 ${big} 1 ${p2.join(' ')} L ${p3.join(' ')} A ${ri} ${ri} 0 ${big} 0 ${p4.join(' ')} Z`}
function sEl(tag,props){const el=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(props))el.setAttribute(k,v);return el}
function clickSegment(i,label){filters[i]=filters[i]===label?null:label;render()}
function pct(n,d){return d?(100*n/d).toFixed(1)+'%':'0%'}
function spotlightRing(ring,category,active){
  document.querySelectorAll('#chart .arc').forEach(path=>{
    if(path.dataset.ring===String(ring)){
      path.style.opacity=active&&path.dataset.category!==category?'0.19':'1';
      path.style.filter=active&&path.dataset.category===category?'brightness(1.3)':'none';
    }
  });
  document.querySelectorAll('#legend .legendRow').forEach(button=>{
    if(button.dataset.ring===String(ring)){
      button.style.opacity=active&&button.dataset.category!==category?'0.35':'1';
      button.style.background=active&&button.dataset.category===category?'#314a67':'';
    }
  });
}
function render(){const chart=$('chart'),legend=$('legend');chart.replaceChildren();legend.replaceChildren();const filtered=rows.filter(r=>layers.every((col,i)=>filters[i]===null||value(r,col)===filters[i]));const allN=totalWeight(rows),selectedN=totalWeight(filtered);$('total').textContent=allN.toLocaleString();$('visible').textContent=selectedN.toLocaleString();$('share').textContent=allN?pct(selectedN,allN)+' of source records':'No records';$('categories').textContent=layers[0]?countBy(filtered,layers[0]).length:'—';$('categoryName').textContent=layers[0]||'No column';$('centerCount').textContent=selectedN.toLocaleString();$('centerCaption').textContent=allN?pct(selectedN,allN)+' of all records':'No data';
const selected=filters.map((f,i)=>f?layers[i]+': '+f:null).filter(Boolean);$('selection').replaceChildren();if(selected.length){const b=document.createElement('b');b.textContent='Active filters';$('selection').append(b,document.createTextNode(selected.join('  /  ')))}else $('selection').textContent='Click a segment or legend entry to filter users across all four rings.';
for(let i=0;i<4;i++){const ri=[96,150,204,258][i],ro=ri+47,group=document.createElement('div');group.className='legendGroup';const title=document.createElement('div');title.className='legendTitle';const a=document.createElement('strong');a.textContent='RING '+(i+1)+' · '+layers[i];const b=document.createElement('span');b.textContent='n='+selectedN;title.append(a,b);group.append(title);
const items=layers[i]?countBy(filtered,layers[i]):[],n=selectedN;let angle=-Math.PI/2;
if(!n){chart.append(sEl('circle',{cx:340,cy:340,r:(ri+ro)/2,fill:'none',stroke:'#26364b','stroke-width':50}));legend.append(group);continue}
for(let j=0;j<items.length;j++){const d=items[j],sweep=d.count/n*Math.PI*2,end=angle+sweep,color=PALETTES[i][j%PALETTES[i].length];if(sweep>0){const p=sEl('path',{d:path(ri,ro,angle,Math.min(end,angle+Math.PI*2-0.000001)),fill:color,class:'arc',role:'button',tabindex:0});p.setAttribute('aria-label',`${layers[i]}: ${d.name}, ${d.count} users, ${pct(d.count,n)}`);p.dataset.ring=String(i);p.dataset.category=d.name;p.addEventListener('mouseenter',()=>spotlightRing(i,d.name,true));p.addEventListener('mouseleave',()=>spotlightRing(i,d.name,false));p.addEventListener('focus',()=>spotlightRing(i,d.name,true));p.addEventListener('blur',()=>spotlightRing(i,d.name,false));p.addEventListener('click',()=>clickSegment(i,d.name));p.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();clickSegment(i,d.name)}});const t=sEl('title',{});t.textContent=`${layers[i]} / ${d.name}: ${d.count} (${pct(d.count,n)})`;p.append(t);chart.append(p)}angle=end;
const row=document.createElement('button');row.className='legendRow';const dot=document.createElement('span');dot.className='swatch';dot.style.background=color;const name=document.createElement('span');name.className='name';name.textContent=d.name;name.title=d.name;const percent=document.createElement('span');percent.className='pct';percent.textContent=`${d.count} · ${pct(d.count,n)}`;row.append(dot,name,percent);row.onclick=()=>clickSegment(i,d.name);row.dataset.ring=String(i);row.dataset.category=d.name;row.onmouseenter=()=>spotlightRing(i,d.name,true);row.onmouseleave=()=>spotlightRing(i,d.name,false);row.onfocus=()=>spotlightRing(i,d.name,true);row.onblur=()=>spotlightRing(i,d.name,false);group.append(row)}legend.append(group)}
}
async function load(){
 const status=$('fileStatus');
 try{
  const response=await fetch('data/PUBLIC_DATA.csv?x='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const original=csvParse(await response.text());
  if(!original.rows.length||!original.columns.includes('User'))throw Error('PUBLIC_DATA.csv must contain User and category columns');
  const parsed=groupedPublicData(original);
  columns=parsed.columns;rows=parsed.rows;filters=[null,null,null,null];setup();
  $('badge').textContent='Public dataset · grouped view';
  $('badge').style.color='#8ee1cc';
  $('sourceName').textContent='PUBLIC_DATA.csv · detailed departments/programs · anonymized chart';
  status.textContent=parsed.sourceRows.toLocaleString()+' PUBLIC_DATA.csv rows · '+parsed.distinctDepartments+' department categories · '+parsed.distinctPrograms+' academic programs · advisor names excluded';
  render();
  window.dispatchEvent(new CustomEvent('dashboard:source-data-loaded',{detail:{kind:'users'}}));
 }catch(error){
  // Keep a working public dashboard if the new source is temporarily unavailable.
  try{
   const fallback=await fetch('data/callie.csv?x='+Date.now(),{cache:'no-store'});
   if(!fallback.ok)throw Error('No fallback CSV');
   const parsed=csvParse(await fallback.text());columns=parsed.columns;rows=parsed.rows;filters=[null,null,null,null];setup();
   $('badge').textContent='Fallback grouped Mill data';$('badge').style.color='#f8c987';
   $('sourceName').textContent='callie.csv · PUBLIC_DATA.csv unavailable';
   status.textContent='Fallback aggregate loaded. New dataset error: '+error.message;
   render();window.dispatchEvent(new CustomEvent('dashboard:source-data-loaded',{detail:{kind:'users'}}));
  }catch(_){
   $('badge').textContent='Dataset unavailable';$('badge').style.color='#ffbc99';
   status.textContent='Unable to load PUBLIC_DATA.csv: '+error.message;columns=[];rows=[];render();
  }
 }
}
window.addEventListener('dashboard:load-users',event=>{
  try{
    const parsed=groupedPublicData(csvParse(event.detail.text));
    if(parsed.columns.length<4||!parsed.rows.length)throw Error('Expected a CSV with at least four columns and one record');
    columns=parsed.columns;rows=parsed.rows;filters=[null,null,null,null];setup();
    $('badge').textContent='Local browser file loaded';$('badge').style.color='#8ee1cc';
    $('sourceName').textContent=event.detail.name;
    $('fileStatus').textContent=totalWeight(rows).toLocaleString()+' records · '+columns.length+' columns · browser-only CSV';
    render();
    window.dispatchEvent(new CustomEvent('dashboard:local-data-loaded',{detail:{name:event.detail.name,kind:'users'}}));
  }catch(error){
    window.dispatchEvent(new CustomEvent('dashboard:local-data-error',{detail:{message:'CSV could not be loaded: '+error.message}}));
  }
});
$('sort').onchange=render;$('clear').onclick=()=>{filters=[null,null,null,null];render()};$('reload').onclick=load;load();
})();
