'use strict';
(() => {
  const $=id=>document.getElementById(id), body=document.body, chooser=$('presentationInput');
  let view='users';
  const localFiles={users:null,papers:null,graph:null};
  const sourceLoaded={users:false,papers:false};
  function alert(message){$('presentationAlert').textContent=message||''}
  function refresh(){
    const editing=body.classList.contains('presentation-details');
    body.classList.add('presentation-mode');
    body.classList.toggle('presentation-papers',view==='papers');
    body.classList.toggle('presentation-graph',view==='graph');
    $('presentationToggle').classList.toggle('active',!editing);
    $('presentationDetails').classList.toggle('active',editing);
    $('presentationToggle').setAttribute('aria-pressed',String(!editing));
    $('presentationDetails').setAttribute('aria-pressed',String(editing));
    for(const [id,name] of [['presentationUsers','users'],['presentationPapers','papers'],['presentationGraph','graph']]){
      $(id).classList.toggle('active',view===name);
      $(id).setAttribute('aria-pressed',String(view===name));
    }
    $('presentationFile').textContent=view==='users'?'Open local CSV':view==='papers'?'Open local JSON':'Open research CSVs';
    const graphOriginal=$('graphSource')?.value==='research';
    const badge=localFiles[view]?'Local files · browser only':
      view==='graph'?(graphOriginal?'Research files pending':'Real Mill metrics'):
      sourceLoaded[view]?(view==='users'?'Real Mill metrics':'Original publications loaded'):'Original data pending';
    $('presentationDataMode').textContent=badge;
  }
  $('presentationToggle').addEventListener('click',()=>{
    body.classList.remove('presentation-details');refresh();
  });
  $('presentationDetails').addEventListener('click',()=>{
    body.classList.add('presentation-details');refresh();
  });
  for(const [id,name] of [['presentationUsers','users'],['presentationPapers','papers'],['presentationGraph','graph']]){
    $(id).addEventListener('click',()=>{view=name;alert('');refresh()});
  }
  $('presentationClear').addEventListener('click',()=>{
    if(view==='graph')$('graphReset').click();
    else $(view==='users'?'clear':'paperClear').click();
  });
  $('presentationFull').addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch(err){alert('Fullscreen unavailable: '+err.message)}
  });
  document.addEventListener('fullscreenchange',()=>{
    $('presentationFull').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';
  });
  $('presentationFile').addEventListener('click',()=>{
    if(view==='graph'){$('graphImport').click();return}
    chooser.value='';
    chooser.accept=view==='users'?'.csv,text/csv':'.json,application/json';
    chooser.click();
  });
  chooser.addEventListener('change',async()=>{
    const file=chooser.files&&chooser.files[0],chosenView=view;
    if(!file)return;
    if(file.size>15*1024*1024){alert('File too large (15 MB limit)');return}
    if(chosenView==='users'&&!/\.csv$/i.test(file.name)||chosenView==='papers'&&!/\.json$/i.test(file.name)){
      alert('Please choose the expected '+(chosenView==='users'?'CSV':'JSON')+' file');return;
    }
    try{
      const contents=await file.text();
      window.dispatchEvent(new CustomEvent(chosenView==='users'?'dashboard:load-users':'dashboard:load-papers',
        {detail:{text:contents,name:file.name}}));
    }catch(err){alert('Cannot read file: '+err.message)}
  });
  window.addEventListener('dashboard:local-data-loaded',event=>{
    localFiles[event.detail.kind||view]=event.detail.name;
    refresh();alert('Loaded '+event.detail.name+' only in this browser session.');
  });
  window.addEventListener('dashboard:local-data-error',event=>alert(event.detail.message));
  window.addEventListener('dashboard:source-data-loaded',event=>{
    localFiles[event.detail.kind]=null;sourceLoaded[event.detail.kind]=true;refresh();
  });
  window.addEventListener('dashboard:graph-loaded',event=>{
    localFiles.graph='Original research graph';refresh();
    alert('Loaded '+event.detail.works+' publications and '+event.detail.authors+' authorship entries locally. Nothing uploaded.');
  });
  $('graphSource').addEventListener('change',refresh);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!document.fullscreenElement&&body.classList.contains('presentation-details')){
      body.classList.remove('presentation-details');refresh();
    }
  });
  refresh();
})();