'use strict';
(()=>{
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
let rows=[],cols=[],dims=[],chosen=[null,null,null],sort='desc',includeDup=false;
const colors=[['#538cf3','#8bb5ff','#3465bd','#accdff','#597db9'],['#23b8b0','#6bd7c4','#147d87','#9ae4d9','#36a7a1'],['#e7aa57','#f2cc87','#cb8142','#f6d7a4','#b7653c']];
const v=(r,c)=>String(r?.[c]??'').trim()||'Not specified';
const pct=(x,n)=>n?(100*x/n).toFixed(1)+'%':'0%';
const duplicate=r=>/^(yes|true|1|y)$/i.test(String(r['Counted as duplicate']??'').trim());
const el=(tag,props={})=>{const t=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(props))t.setAttribute(k,v);return t};
function polar(radius,angle){return [340+radius*Math.cos(angle),340+radius*Math.sin(angle)]}
function arc(ri,ro,a,b){if(b-a>=Math.PI*2)b=a+Math.PI*2-.00001;const p1=polar(ro,a),p2=polar(ro,b),p3=polar(ri,b),p4=polar(ri,a),big=b-a>Math.PI?1:0;return `M${p1} A${ro} ${ro} 0 ${big} 1 ${p2} L${p3} A${ri} ${ri} 0 ${big} 0 ${p4} Z`}

function totals(data,col){
  const counts = new Map();

  for(const row of data){
    const name = v(row,col);
    counts.set(name,(counts.get(name)||0)+1);
  }

  const result = [...counts].map(([name,n])=>({name,n}));

  // Year always runs earliest to latest, clockwise.
  if(/^year$/i.test(col.trim())){
    result.sort((a,b)=>{
      const yearA = /^\d{4}$/.test(a.name)
        ? Number(a.name) : Infinity;
      const yearB = /^\d{4}$/.test(b.name)
        ? Number(b.name) : Infinity;

      return yearA-yearB || a.name.localeCompare(b.name);
    });
  } else {
    // All other rings keep the existing sorting controls.
    result.sort((a,b)=>
      sort==='alpha'
        ? a.name.localeCompare(b.name)
        : sort==='asc'
          ? a.n-b.n || a.name.localeCompare(b.name)
          : b.n-a.n || a.name.localeCompare(b.name)
    );
  }

  return result;
}

function getBase(){return rows.filter(r=>includeDup||!duplicate(r))}
function filtered(){return getBase().filter(r=>chosen.every((label,i)=>label===null||v(r,dims[i])===label))}
function controlSetup(){for(let i=0;i<3;i++){const sel=$('paperLayer'+i);sel.replaceChildren();for(const c of cols){const opt=document.createElement('option');opt.value=c;opt.textContent=c;sel.append(opt)}sel.value=dims[i];sel.onchange=()=>{dims[i]=sel.value;chosen=[null,null,null];render()}}}
function linkFor(r){const s=String(r['DOI / record link']??'').trim(),doi=String(r.DOI??'').trim();const candidate=s|| (doi?'https://doi.org/'+doi:'');try{const u=new URL(candidate);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}}
function renderRecords(data){const container=$('paperRecords');container.replaceChildren();$('paperRecordCount').textContent=data.length+' matching records';for(const r of data.slice(0,35)){
const card=document.createElement('div');card.className='paperRecord';const title=document.createElement('div');title.className='paperTitle';const url=linkFor(r);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=r.Title;title.append(a)}else title.textContent=r.Title;
const meta=document.createElement('div');meta.className='paperMeta';meta.textContent=[r.Year,r['Cluster acknowledged'],r.Type,r.Authors,r.Venue].filter(Boolean).join(' · ');
card.append(title,meta);const privateEvidence=String(r['Evidence sources']??'').trim(),privateNote=String(r.Note??'').trim();if(privateEvidence||privateNote||duplicate(r)){const evidence=document.createElement('div');evidence.className='paperEvidence';evidence.textContent=[privateEvidence?'Evidence: '+privateEvidence:null,privateNote?'Note: '+privateNote:null,duplicate(r)?'Duplicate flagged':null].filter(Boolean).join(' · ');card.append(evidence)}container.append(card)}if(data.length>35){const t=document.createElement('p');t.textContent='Showing first 35 records. Select slices to narrow the results.';container.append(t)}}
function render(){const base=getBase(),current=filtered(),chart=$('paperChart'),legend=$('paperLegend');chart.replaceChildren();legend.replaceChildren();$('paperCount').textContent=base.length.toLocaleString();$('paperVisible').textContent=current.length.toLocaleString();$('paperCenter').textContent=current.length.toLocaleString();$('paperShare').textContent=pct(current.length,base.length)+' of included records';$('paperSelection').textContent=chosen.some(Boolean)?chosen.map((f,i)=>f?dims[i]+': '+f:null).filter(Boolean).join('  /  '):'All publications · click a segment to filter all rings';
for(let i=0;i<3;i++){const ri=[110,171,232][i],ro=ri+50,items=totals(current,dims[i]),n=current.length;let angle=-Math.PI/2;const group=document.createElement('div');group.className='legendGroup';const head=document.createElement('div');head.className='legendTitle';head.textContent=`RING ${i+1} · ${dims[i]}`;group.append(head);
for(let j=0;j<items.length;j++){const item=items[j],sw=item.n/n*Math.PI*2,end=angle+sw,color=colors[i][j%colors[i].length];if(sw>0){const p=el('path',{d:arc(ri,ro,angle,end),fill:color,class:'arc',tabindex:0,role:'button'});const title=el('title');title.textContent=`${dims[i]} · ${item.name}: ${item.n} (${pct(item.n,n)})`;p.append(title);p.addEventListener('click',()=>select(i,item.name));p.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();select(i,item.name)}});chart.append(p)}angle=end;
const btn=document.createElement('button');btn.className='legendRow';const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=color;const label=document.createElement('span');label.className='name';label.textContent=item.name;const value=document.createElement('span');value.className='pct';value.textContent=item.n+' · '+pct(item.n,n);btn.append(swatch,label,value);btn.onclick=()=>select(i,item.name);group.append(btn)}legend.append(group)}renderRecords(current)}
function select(i,name){chosen[i]=chosen[i]===name?null:name;render()}

function initializePublications(data,source){
  if(!data||!Array.isArray(data.columns)||!Array.isArray(data.rows))
    throw Error('Expected the export structure: { columns: [...], rows: [...] }');
  if(data.columns.length<3||!data.rows.length)
    throw Error('No publication records found in the selected file');
  const nextCols=data.columns.filter(c=>typeof c==='string'&&c.trim()&&c!=='#');
  if(nextCols.length<3)
    throw Error('At least three valid publication columns are required');
  if(data.rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))
    throw Error('Publication rows must be JSON objects');
  const nextRows=data.rows.map(r=>Object.fromEntries(nextCols.map(c=>[c,String(r[c]??'')])));
  const wanted=['Cluster acknowledged','Year','Type'];
  const nextDims=wanted.map((k,i)=>nextCols.includes(k)?k:nextCols[i]);
  if(nextDims.some(x=>!x))throw Error('Could not find the three publication ring categories');
  rows=nextRows;cols=nextCols;dims=nextDims;
  chosen=[null,null,null];includeDup=false;$('paperDup').checked=false;sort='desc';$('paperSort').value='desc';
  controlSetup();
  $('papersSection').classList.remove('publication-awaiting');
  $('paperLoaded').textContent=rows.length.toLocaleString()+' source records · '+cols.length+' columns · '+source;
  render();
}
async function load(){
  try{
    const resp=await fetch('data/publications.json?t='+Date.now(),{cache:'no-store'});
    if(!resp.ok)throw Error('publication JSON unavailable');
    const data=await resp.json();
    initializePublications(data,'published data');
    window.dispatchEvent(new CustomEvent('dashboard:source-data-loaded',{detail:{kind:'papers'}}));
  }catch(error){
    if(!rows.length){
      $('papersSection').classList.add('publication-awaiting');
      $('paperLoaded').textContent='Choose your local publications.json to load real metrics';
    }
  }
}
window.addEventListener('dashboard:load-papers',event=>{
  try{
    initializePublications(JSON.parse(event.detail.text),'browser-only file');
    window.dispatchEvent(new CustomEvent('dashboard:local-data-loaded',{detail:{
      name:event.detail.name,kind:'papers',count:rows.length
    }}));
  }catch(error){
    window.dispatchEvent(new CustomEvent('dashboard:local-data-error',{detail:{
      message:'Publication file could not be loaded: '+error.message
    }}));
  }
});
$('paperSort').onchange=e=>{sort=e.target.value;render()};$('paperDup').onchange=e=>{includeDup=e.target.checked;chosen=[null,null,null];render()};$('paperClear').onclick=()=>{chosen=[null,null,null];render()};$('paperReload').onclick=()=>window.dispatchEvent(new Event('dashboard:choose-publications'));load();
})();
