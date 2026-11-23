'use strict';
/* Source-linked Publications Results: single dataset shared with the circular atlas.
   Filter chart -> table, table -> chart, and focus a paper from either view. */
(()=>{
 const $=id=>document.getElementById(id), panel=$('publicationResultsPanel');
 if(!panel)return;
 const body=$('pubResultBody'),summary=$('pubResultSummary'),status=$('pubResultStatus');
 const search=$('pubResultSearch'),resource=$('pubResultResource'),type=$('pubResultType'),year=$('pubResultYear'),theme=$('pubResultTheme'),sort=$('pubResultSort');
 const topButton=$('publicationResultsNav');
 let report={rows:[],allCount:0,selectedId:null,relations:0,filter:{},themes:[]};
 let cachedYears=[],cachedTypes=[];
 const num=n=>Number(n||0).toLocaleString('en-US');
 const node=(tag,label,parent,cls)=>{
  const n=document.createElement(tag);if(label!==null&&label!==undefined)n.textContent=String(label);
  if(cls)n.className=cls;if(parent)parent.append(n);return n;
 };
 function optionList(select,items,firstText,sortFunction){
  const current=select.value;
  select.replaceChildren();
  const empty=node('option',firstText,select);empty.value='';
  const values=[...new Set(items.filter(x=>x!==null&&x!==undefined&&String(x).trim()).map(x=>String(x)))];
  values.sort(sortFunction||((a,b)=>a.localeCompare(b)));
  for(const v of values){const o=node('option',v,select);o.value=v}
  select.value=values.includes(current)?current:'';
 }
 function syncFields(){
  const f=report.filter||{};
  search.value=f.search||'';
  resource.value=f.facility||'';
  type.value=f.type||'';
  year.value=f.year||'';
  theme.value=f.theme||'';
 }
 function applyChartFilters(){
  window.dispatchEvent(new CustomEvent('dashboard:publication-filter-request',{
   detail:{filter:{search:search.value.trim(),facility:resource.value,year:year.value,type:type.value,theme:theme.value}}
  }));
 }
 function toggle(open,scroll){
  panel.open=open;
  topButton.setAttribute('aria-expanded',String(open));
  topButton.textContent=open?'Hide results':'Results';
  if(scroll&&open)requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 function selectedCount(){return report.rows.filter(w=>Number(w.id)===Number(report.selectedId)).length}
 function render(){
  summary.textContent='Publication results · '+num(report.rows.length)+' of '+num(report.allCount)+' works';
  const chips=$('pubFilterChips');chips.replaceChildren();
  const f=report.filter||{};
  const labels=[['Search',f.search],['Facility',f.facility],['Year',f.year],['Output',f.type],['Research theme',f.theme]].filter(([,v])=>v);
  if(labels.length){for(const [k,v]of labels)node('span',k+': '+v,chips,'pubFilterChip')}
  else node('span','All included bibliography works · duplicates excluded',chips,'pubFilterNeutral');
  if(report.selectedId!=null&&selectedCount()){
   const w=report.rows.find(x=>Number(x.id)===Number(report.selectedId));
   if(w)node('span','Selected: '+w.title,chips,'pubFilterSelected');
  }
  let rows=report.rows.slice();
  switch(sort.value){
   case 'year-desc':rows.sort((a,b)=>Number(b.year)-Number(a.year)||a.title.localeCompare(b.title));break;
   case 'year-asc':rows.sort((a,b)=>Number(a.year)-Number(b.year)||a.title.localeCompare(b.title));break;
   case 'title':rows.sort((a,b)=>a.title.localeCompare(b.title));break;
   case 'theme':rows.sort((a,b)=>a.theme.localeCompare(b.theme)||Number(b.connections)-Number(a.connections));break;
   default:rows.sort((a,b)=>Number(b.connections)-Number(a.connections)||a.title.localeCompare(b.title));
  }
  body.replaceChildren();
  if(!rows.length){const tr=node('tr',null,body),td=node('td','No matching publications. Clear filters to restore the bibliography.',tr,'pubEmpty');td.colSpan=8}
  for(const w of rows){
   const tr=node('tr',null,body);
   if(Number(w.id)===Number(report.selectedId)&&report.selectedId!==null)tr.classList.add('pubSelectedRow');
   tr.dataset.paperId=String(w.id);
   const titleTd=node('td',null,tr,'pubTitleCell');
   const h=node('strong',w.title,titleTd);
   if(w.venue)node('small',w.venue,titleTd);
   if(w.url&&/^https?:\/\//.test(w.url)){const a=node('a','Open publication source',titleTd);a.href=w.url;a.target='_blank';a.rel='noopener noreferrer'}
   node('td',w.year||'—',tr,'pubNumeric');
   node('td',w.resource||'Not listed',tr);
   node('td',w.type||'Not specified',tr);
   node('td',w.theme||'Not specified',tr);
   node('td',num(w.connections),tr,'pubNumeric');
   const review=node('td',null,tr);
   const ev=String(w.evidence||'not_reviewed');
   const label=ev==='not_reviewed'?'Not reviewed':ev.replaceAll('_',' ');
   node('span',label,review,ev==='not_reviewed'?'pubUnreviewed':'pubReviewed');
   const actions=node('td',null,tr,'pubRowActions');
   const focus=node('button','Focus paper',actions,'pubFocusBtn');focus.type='button';
   focus.title='Highlight this publication and its connections in the circular chart';
   focus.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('dashboard:publication-focus-request',{detail:{id:w.id}})));
   const focusThemeBtn=node('button','Theme',actions,'pubThemeBtn');focusThemeBtn.type='button';
   focusThemeBtn.title='Show the research group '+w.theme;
   focusThemeBtn.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('dashboard:publication-filter-request',{detail:{filter:{theme:w.theme}}})));
  }
  const selected=report.selectedId!==null&&report.selectedId!==undefined?' · paper selected':'';
  status.textContent=num(rows.length)+' papers shown · '+num(report.relations)+' displayed candidate connections'+selected+
   ' · output labels and citation links from public bibliography';
  topButton.textContent=panel.open?'Hide results':'Results';
 }
 window.addEventListener('dashboard:publication-results',ev=>{
  const next=ev.detail||{};
  report={rows:Array.isArray(next.rows)?next.rows:[],allCount:next.allCount||0,
   selectedId:next.selectedId??null,relations:next.relations||0,
   filter:next.filter||{},themes:next.themes||[]};
  // Prefer all-source choices over only currently filtered works.
  if(!cachedTypes.length){cachedTypes=[...new Set(report.rows.map(w=>w.type))]}
  if(!cachedYears.length){cachedYears=[...new Set(report.rows.map(w=>String(w.year)))]}
  optionList(type,cachedTypes,'All output types');
  optionList(year,cachedYears,'All years',(a,b)=>Number(b)-Number(a));
  optionList(theme,report.themes,'All research themes');
  syncFields();render();
 });
 window.addEventListener('dashboard:publication-selection',ev=>{
  report.selectedId=ev.detail?.id??null;render();
 });
 search.addEventListener('input',applyChartFilters);
 for(const control of [resource,type,year,theme])control.addEventListener('change',applyChartFilters);
 sort.addEventListener('change',render);
 topButton.addEventListener('click',()=>toggle(!panel.open,!panel.open));
 panel.addEventListener('toggle',()=>{topButton.setAttribute('aria-expanded',String(panel.open));topButton.textContent=panel.open?'Hide results':'Results'});
 $('pubClearFilters').addEventListener('click',()=>window.dispatchEvent(new Event('dashboard:publication-reset-request')));
 $('pubBackToChart').addEventListener('click',()=>$('prSvg').scrollIntoView({behavior:'smooth',block:'center'}));
 window.dispatchEvent(new Event('dashboard:publication-results-request'));
 render();
})();
