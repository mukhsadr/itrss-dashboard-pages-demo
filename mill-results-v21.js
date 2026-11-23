'use strict';
/* Interactive Mill result explorer: only counted grouped records, never raw User or advisor names. */
(()=>{
 const $=id=>document.getElementById(id);
 const panel=$('millResultsPanel');
 if(!panel)return;
 const tbody=$('millTableBody'),summary=$('millResultsSummary'),stat=$('millTableStatus');
 const search=$('millTableSearch'),sort=$('millTableSort');
 let report={rows:[],columns:[],filters:[],visible:0,total:0,source:'loading'};
 const compact=n=>Number(n||0).toLocaleString('en-US');
 const text=(tag,value,container,cls)=>{
   const node=document.createElement(tag);
   if(value!=null)node.textContent=String(value);
   if(cls)node.className=cls;
   if(container)container.append(node);
   return node;
 };
 const meaningfulCount=5;
 function togglePanel(open,scroll=false){
   panel.open=open;
   $('millResultsNav').setAttribute('aria-expanded',String(open));
   if(scroll&&open)requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 function select(values){
   window.dispatchEvent(new CustomEvent('dashboard:filter-users-from-table',{detail:{values}}));
 }
 function groupedSafeRows(rows){
   const kept=[],small=[];
   for(const row of rows){
     const count=Number(row.Count)||0;
     if(count>=meaningfulCount)kept.push({...row,Count:count,isGrouped:false});
     else if(count>0)small.push(row);
   }
   const omitted=small.reduce((n,r)=>n+Number(r.Count||0),0);
   if(omitted>=meaningfulCount)kept.push({
     Descr:'Other grouped combinations',
     Classficiation:'Suppressed rare combinations',
     Status:'Not individually shown',
     Advisor:'Grouped',
     Count:omitted,isGrouped:true
   });
   return {kept,rareCount:omitted};
 }
 const escapeCell=s=>String(s??'').trim()||'Not specified';
 function render(){
   const selected=report.filters.map((f,i)=>f?report.columns[i]+': '+f:null).filter(Boolean);
   summary.textContent='Filtered results · '+compact(report.visible)+' of '+compact(report.total)+' records';
   const chips=$('millActiveFilters');chips.replaceChildren();
   if(selected.length){
     selected.forEach(x=>text('span',x,chips,'millFilterChip'));
   }else text('span','All Mill user groups',chips,'millFilterNeutral');
   $('millResultsCount').textContent=compact(report.visible);
   $('millTableSource').textContent=
     report.source==='local'?'Local browser CSV · no upload':
     report.source==='error'?'Source unavailable':
     'PUBLIC_DATA.csv · aggregated user records; not Slurm utilization';
   const {kept,rareCount}=groupedSafeRows(report.rows);
   const term=search.value.trim().toLowerCase();
   let shown=kept.filter(row=>!term||[
     row.Descr,row.Classficiation,row.Status,row.Advisor
   ].some(x=>escapeCell(x).toLowerCase().includes(term)));
   switch(sort.value){
     case 'department':shown.sort((a,b)=>a.Descr.localeCompare(b.Descr)||b.Count-a.Count);break;
     case 'program':shown.sort((a,b)=>a.Classficiation.localeCompare(b.Classficiation)||b.Count-a.Count);break;
     case 'asc':shown.sort((a,b)=>a.Count-b.Count);break;
     default:shown.sort((a,b)=>b.Count-a.Count);
   }
   tbody.replaceChildren();
   if(!shown.length){
     const tr=text('tr',null,tbody),td=text('td',report.visible?'No matching groups. Change the table search or ring filters.':'No records in this selection.',tr);
     td.colSpan=7;td.className='millTableEmpty';
   }
   for(const row of shown){
     const tr=text('tr',null,tbody);
     if(row.isGrouped)tr.className='millPrivacyGroup';
     const vals=[row.Descr,row.Classficiation,row.Status,row.Advisor,compact(row.Count),
       report.visible?(100*row.Count/report.visible).toFixed(1)+'%':'—'];
     vals.forEach((v,index)=>{
       const td=text('td',v,tr);
       if(index>=4)td.className='millNumeric';
     });
     const action=text('td',null,tr);
     if(!row.isGrouped){
       const btn=text('button','Filter rings',action,'millApplyRow');
       btn.type='button';
       btn.title='Filter all four Mill rings to this category combination';
       btn.addEventListener('click',()=>select({
         Descr:row.Descr,Classficiation:row.Classficiation,
         Status:row.Status,Advisor:row.Advisor
       }));
     }else text('span','Combined for privacy',action,'millGroupedNote');
   }
   const listed=shown.reduce((n,r)=>n+r.Count,0);
   stat.textContent=
     compact(shown.length)+' groups shown · '+compact(listed)+' records'+
     (term?' match table search':'')+
     (rareCount>0&&rareCount<meaningfulCount?' · tiny groups omitted':'')+
     ' · click “Filter rings” to apply a group';
   const btn=$('millResultsNav');
   btn.textContent=panel.open?'Hide results':'Results';
 }
 window.addEventListener('dashboard:users-rendered',ev=>{
   const d=ev.detail||{};
   report={rows:Array.isArray(d.rows)?d.rows:[],columns:d.columns||[],
     filters:d.filters||[],visible:Number(d.visible)||0,total:Number(d.total)||0,
     source:d.source||'loading'};
   render();
 });
 search.addEventListener('input',render);
 sort.addEventListener('change',render);
 $('millResultsNav').addEventListener('click',()=>{
   togglePanel(!panel.open,!panel.open);
   render();
 });
 panel.addEventListener('toggle',()=>{
   $('millResultsNav').setAttribute('aria-expanded',String(panel.open));
   render();
 });
 $('millClearRingFilters').addEventListener('click',()=>select({}));
 $('millTableBack').addEventListener('click',()=>{
   const chart=$('chart');
   chart.scrollIntoView({behavior:'smooth',block:'center'});
 });
 // The table can mount after app.js; request state once for a reliable first render.
 window.dispatchEvent(new Event('dashboard:request-user-results'));
 render();
})();
