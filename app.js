'use strict';
(()=>{
const $=id=>document.getElementById(id),SVG='http://www.w3.org/2000/svg';
const PALETTES=[['#5c9eff','#3c7fdb','#8ebdff','#4568ae','#a1ceef','#6669ba','#378dc0','#86a3d0'],['#2cbdaf','#159f94','#75d8bd','#3a8f85','#a1e0c9','#5eb3a2','#248478','#b1cfc1'],['#e6a85e','#d58e46','#f3c681','#b87555','#ffd59e','#caac71','#f0a27d','#ad805b'],['#ad91e4','#906dd1','#c4a9fa','#7157a9','#b39fe2','#9979bf','#d0b7ef','#71539a']];
let rows=[],columns=[],layers=[],filters=[null,null,null,null];
function csvParse(text){const raw=[];let f='',line=[],q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){f+='"';i++}else q=!q}else if(c===','&&!q){line.push(f);f=''}else if((c==='\r'||c==='\n')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;line.push(f);if(line.some(v=>v.trim()))raw.push(line);line=[];f=''}else f+=c}line.push(f);if(line.some(v=>v.trim()))raw.push(line);if(!raw.length)return {columns:[],rows:[]};const cols=raw.shift().map(v=>v.replace(/^\ufeff/,'').trim());return {columns:cols,rows:raw.map(a=>Object.fromEntries(cols.map((h,i)=>[h,(a[i]||'').trim()])))}}
function value(r,col){return (r[col]||'').trim()||'Not specified'}
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
    for(const column of columns){const o=document.createElement('option');o.value=column;o.textContent=column;s.append(o)}
    s.value=layers[i];s.onchange=()=>{layers[i]=s.value;filters=[null,null,null,null];render()};
  }
}
function countBy(items,col){const map=new Map();for(const r of items){const k=value(r,col);map.set(k,(map.get(k)||0)+1)}let a=[...map].map(([name,count])=>({name,count}));const sort=$('sort').value;a.sort((x,y)=>sort==='desc'?y.count-x.count||x.name.localeCompare(y.name):sort==='asc'?x.count-y.count||x.name.localeCompare(y.name):x.name.localeCompare(y.name));return a}
function point(r,a){return [340+r*Math.cos(a),340+r*Math.sin(a)]}
function path(ri,ro,a,b){const p1=point(ro,a),p2=point(ro,b),p3=point(ri,b),p4=point(ri,a),big=b-a>Math.PI?1:0;return `M ${p1.join(' ')} A ${ro} ${ro} 0 ${big} 1 ${p2.join(' ')} L ${p3.join(' ')} A ${ri} ${ri} 0 ${big} 0 ${p4.join(' ')} Z`}
function sEl(tag,props){const el=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(props))el.setAttribute(k,v);return el}
function clickSegment(i,label){filters[i]=filters[i]===label?null:label;render()}
function pct(n,d){return d?(100*n/d).toFixed(1)+'%':'0%'}
function render(){const chart=$('chart'),legend=$('legend');chart.replaceChildren();legend.replaceChildren();const filtered=rows.filter(r=>layers.every((col,i)=>filters[i]===null||value(r,col)===filters[i]));$('total').textContent=rows.length.toLocaleString();$('visible').textContent=filtered.length.toLocaleString();$('share').textContent=rows.length?pct(filtered.length,rows.length)+' of source records':'No records';$('categories').textContent=layers[0]?countBy(filtered,layers[0]).length:'—';$('categoryName').textContent=layers[0]||'No column';$('centerCount').textContent=filtered.length.toLocaleString();$('centerCaption').textContent=rows.length?pct(filtered.length,rows.length)+' of all records':'No data';
const selected=filters.map((f,i)=>f?layers[i]+': '+f:null).filter(Boolean);$('selection').replaceChildren();if(selected.length){const b=document.createElement('b');b.textContent='Active filters';$('selection').append(b,document.createTextNode(selected.join('  /  ')))}else $('selection').textContent='Click a segment or legend entry to filter users across all four rings.';
for(let i=0;i<4;i++){const ri=[96,150,204,258][i],ro=ri+47,group=document.createElement('div');group.className='legendGroup';const title=document.createElement('div');title.className='legendTitle';const a=document.createElement('strong');a.textContent='RING '+(i+1)+' · '+layers[i];const b=document.createElement('span');b.textContent='n='+filtered.length;title.append(a,b);group.append(title);
const items=layers[i]?countBy(filtered,layers[i]):[],n=filtered.length;let angle=-Math.PI/2;
if(!n){chart.append(sEl('circle',{cx:340,cy:340,r:(ri+ro)/2,fill:'none',stroke:'#26364b','stroke-width':50}));legend.append(group);continue}
for(let j=0;j<items.length;j++){const d=items[j],sweep=d.count/n*Math.PI*2,end=angle+sweep,color=PALETTES[i][j%PALETTES[i].length];if(sweep>0){const p=sEl('path',{d:path(ri,ro,angle,Math.min(end,angle+Math.PI*2-0.000001)),fill:color,class:'arc',role:'button',tabindex:0});p.setAttribute('aria-label',`${layers[i]}: ${d.name}, ${d.count} users, ${pct(d.count,n)}`);p.addEventListener('click',()=>clickSegment(i,d.name));p.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();clickSegment(i,d.name)}});const t=sEl('title',{});t.textContent=`${layers[i]} / ${d.name}: ${d.count} (${pct(d.count,n)})`;p.append(t);chart.append(p)}angle=end;
const row=document.createElement('button');row.className='legendRow';const dot=document.createElement('span');dot.className='swatch';dot.style.background=color;const name=document.createElement('span');name.className='name';name.textContent=d.name;name.title=d.name;const percent=document.createElement('span');percent.className='pct';percent.textContent=`${d.count} · ${pct(d.count,n)}`;row.append(dot,name,percent);row.onclick=()=>clickSegment(i,d.name);group.append(row)}legend.append(group)}
}
async function load(){const status=$('fileStatus');try{const response=await fetch('data/callie.csv?x='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const parsed=csvParse(await response.text());if(!parsed.columns.length)throw Error('CSV has no header');columns=parsed.columns;rows=parsed.rows;filters=[null,null,null,null];setup();$('badge').textContent='Synthetic demo loaded';$('badge').style.color='#8ee1cc';$('sourceName').textContent='synthetic_demo_users.csv';status.textContent=`${rows.length.toLocaleString()} records · ${columns.length} columns · synthetic demo CSV`;render();window.dispatchEvent(new CustomEvent('dashboard:demo-data-loaded',{detail:{kind:'users'}}))}catch(e){$('badge').textContent='Report not loaded';$('badge').style.color='#ffbc99';status.textContent='Run ./run.sh to copy the source CSV. '+e.message;columns=[];rows=[];render()}}
window.addEventListener('dashboard:load-users',event=>{
  try{
    const parsed=csvParse(event.detail.text);
    if(parsed.columns.length<4||!parsed.rows.length)throw Error('Expected a CSV with at least four columns and one record');
    columns=parsed.columns;rows=parsed.rows;filters=[null,null,null,null];setup();
    $('badge').textContent='Local browser file loaded';$('badge').style.color='#8ee1cc';
    $('sourceName').textContent=event.detail.name;
    $('fileStatus').textContent=rows.length.toLocaleString()+' records · '+columns.length+' columns · browser-only CSV';
    render();
    window.dispatchEvent(new CustomEvent('dashboard:local-data-loaded',{detail:{name:event.detail.name,kind:'users'}}));
  }catch(error){
    window.dispatchEvent(new CustomEvent('dashboard:local-data-error',{detail:{message:'CSV could not be loaded: '+error.message}}));
  }
});
$('sort').onchange=render;$('clear').onclick=()=>{filters=[null,null,null,null];render()};$('reload').onclick=load;load();
})();
