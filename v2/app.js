'use strict';
(()=>{
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const palettes=[['#5c9eff','#3c7fdb','#8ebdff','#4568ae','#a1ceef','#6669ba','#378dc0','#86a3d0'],['#2cbdaf','#159f94','#75d8bd','#3a8f85','#a1e0c9','#5eb3a2','#248478','#b1cfc1'],['#e6a85e','#d58e46','#f3c681','#b87555','#ffd59e','#caac71','#f0a27d','#ad805b'],['#ad91e4','#906dd1','#c4a9fa','#7157a9','#b39fe2','#9979bf','#d0b7ef','#71539a']];
let source=null, dims=[],selected=[null,null,null,null];
const pct=(n,d)=>d?(100*n/d).toFixed(1)+'%':'0%';
const point=(r,a)=>[340+r*Math.cos(a),340+r*Math.sin(a)];
function arc(ri,ro,a,b){b=Math.min(b,a+Math.PI*2-.00001);const [x1,y1]=point(ro,a),[x2,y2]=point(ro,b),[x3,y3]=point(ri,b),[x4,y4]=point(ri,a),large=b-a>Math.PI?1:0;return `M${x1} ${y1} A${ro} ${ro} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${ri} ${ri} 0 ${large} 0 ${x4} ${y4} Z`}
function svg(tag,attrs={}){const t=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))t.setAttribute(k,v);return t}
function sorted(values){let a=[...values],sort=$('sort').value;a.sort((x,y)=>sort==='alpha'?x.name.localeCompare(y.name):sort==='asc'?x.count-y.count||x.name.localeCompare(y.name):y.count-x.count||x.name.localeCompare(y.name));return a}
function pick(i,name){
  // Pin one slice at a time. Clicking it again unpins.
  const wasPinned=selected[i]===name;
  selected=[null,null,null,null];
  if(!wasPinned)selected[i]=name;
  render();
}
function render(){if(!source)return;const n=source.source_total, chart=$('chart'),legend=$('legend');chart.replaceChildren();legend.replaceChildren();const active=selected.findIndex(x=>x!==null),focus=active>=0?dims[active].values.find(x=>x.name===selected[active]):null,visible=focus?focus.count:n;
$('total').textContent=n.toLocaleString();$('visible').textContent=visible.toLocaleString();$('share').textContent=active>=0?'Pinned category · '+pct(visible,n)+' of source rows':'All source rows';$('categories').textContent=dims[0].values.length;$('categoryName').textContent=dims[0].label;$('centerCount').textContent=visible.toLocaleString();$('centerCaption').textContent=pct(visible,n)+' of all source rows';
$('selection').textContent=active>=0
  ? 'PINNED · '+dims[active].label+' → '+selected[active]+' · '+visible.toLocaleString()+' rows ('+pct(visible,n)+'). All other rings stay frozen in place with their full-source counts. Click the same slice to unpin.'
  : 'Click a slice or legend entry to pin a category. Other rings stay fixed for comparison. A second click releases the pin; individual cross-ring combinations are not available in public aggregates.';
for(let i=0;i<4;i++){const dim=dims[i],ri=[96,150,204,258][i],ro=ri+47,items=sorted(dim.values),group=document.createElement('div');group.className='legendGroup';const heading=document.createElement('div');heading.className='legendTitle';heading.textContent=`RING ${i+1} · ${dim.label} · n=${n.toLocaleString()}`;group.append(heading);let angle=-Math.PI/2;
for(let j=0;j<items.length;j++){const item=items[j],sweep=item.count/n*Math.PI*2,end=angle+sweep,color=palettes[i][j%palettes[i].length],p=svg('path',{d:arc(ri,ro,angle,end),fill:color,class:'arc',role:'button',tabindex:'0'});p.setAttribute('aria-label',dim.label+': '+item.name+', '+item.count+' source rows');const tooltip=svg('title');tooltip.textContent=dim.label+' / '+item.name+': '+item.count+' ('+pct(item.count,n)+')';p.append(tooltip);p.addEventListener('click',()=>pick(i,item.name));p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(i,item.name)}});const pinned=active===i&&selected[i]===item.name;
if(active===i&&!pinned)p.style.opacity='.22';
if(pinned){p.style.stroke='#f5faff';p.style.strokeWidth='2.5';p.setAttribute('aria-pressed','true')}
else p.setAttribute('aria-pressed','false');chart.append(p);const btn=document.createElement('button');btn.className='legendRow';const dot=document.createElement('span');dot.className='swatch';dot.style.background=color;const label=document.createElement('span');label.className='name';label.textContent=item.name;const stat=document.createElement('span');stat.className='pct';stat.textContent=item.count+' · '+pct(item.count,n);btn.append(dot,label,stat);btn.setAttribute('aria-pressed',String(active===i&&selected[i]===item.name));
if(active===i&&selected[i]===item.name){
  btn.style.background='#304968';
  btn.style.outline='1px solid #94c8ff';
}
btn.onclick=()=>pick(i,item.name);group.append(btn);angle=end}legend.append(group)}
}
async function load(){try{const response=await fetch('data/user_aggregates.json?x='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);source=await response.json();if(!Number.isInteger(source.source_total)||source.source_total<=0||source.dimensions.length!==4)throw Error('Invalid aggregate JSON');for(const d of source.dimensions){if(d.values.reduce((s,v)=>s+v.count,0)!==source.source_total)throw Error('Counts do not reconcile: '+d.label)}const columnNames=source.dimensions.map(d=>d.label);dims=[...source.dimensions];for(let i=0;i<4;i++){const s=$('layer'+i);s.replaceChildren();for(const name of columnNames){const opt=document.createElement('option');opt.value=name;opt.textContent=name;s.append(opt)}s.value=dims[i].label;s.onchange=()=>{dims[i]=source.dimensions.find(d=>d.label===s.value);selected=[null,null,null,null];render()}}selected=[null,null,null,null];$('badge').textContent='Aggregate report loaded';$('badge').style.color='#8ee1cc';$('sourceName').textContent='Privacy-reviewed aggregate metrics';$('fileStatus').textContent=`${source.source_total.toLocaleString()} source rows · 4 independent summaries · no user records`;render()}catch(e){$('badge').textContent='Aggregate report unavailable';$('fileStatus').textContent=e.message;console.error(e)}}
$('sort').onchange=render;$('clear').onclick=()=>{selected=[null,null,null,null];render()};$('reload').onclick=load;load();
})();
