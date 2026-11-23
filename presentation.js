'use strict';
(() => {
  const $=id=>document.getElementById(id), body=document.body, chooser=$('presentationInput');
  let view='users';
  const ringVisibility={users:[true,true,true,true],papers:[true,true,true,true]};
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
    const graphSource=$('graphSource')?.value;
    const graphBadge=graphSource==='papers'?'Public bibliography · auto-loaded':
      graphSource==='entities'?'Authors · Papers · candidate grants':
      graphSource==='research'?'Original coauthor data · choose JSON':'Real grouped Mill metrics';
    const badge=localFiles[view]?'Local files · browser only':
      view==='graph'?graphBadge:
      sourceLoaded[view]?(view==='users'?'Public Mill roster · grouped':'Public publications loaded'):'Original data pending';
    $('presentationDataMode').textContent=badge;
    const ringPanel=$('ringVisibility');
    if(ringPanel)ringPanel.style.display=(view==='users'||view==='papers')?'flex':'none';
    const activeRings=ringVisibility[view]||ringVisibility.users;
    document.querySelectorAll('[data-ring-toggle]').forEach(btn=>btn.setAttribute('aria-pressed',String(activeRings[Number(btn.dataset.ringToggle)])));
    for(const kind of ['users','papers'])for(let i=0;i<4;i++)body.classList.toggle('hide-'+(kind==='users'?'user':'paper')+'-ring-'+i,!ringVisibility[kind][i]);
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
  let requestedFileKind=null;
  function chooseFile(kind){
    if(kind==='graph'){$('graphImport').click();return}
    requestedFileKind=kind;
    chooser.value='';
    chooser.accept=kind==='users'?'.csv,text/csv':'.json,application/json';
    chooser.click();
  }
  async function readLocalFile(file,kind){
    if(!file)return;
    if(file.size>15*1024*1024){alert('Choose a file smaller than 15 MB');return}
    if(kind==='users'&&!/\.csv$/i.test(file.name) ||
       kind==='papers'&&!/\.json$/i.test(file.name)){
      alert('Please choose a '+(kind==='users'?'CSV':'JSON')+' file');return;
    }
    try{
      const contents=await file.text();
      window.dispatchEvent(new CustomEvent(kind==='users'?'dashboard:load-users':'dashboard:load-papers',
        {detail:{text:contents,name:file.name}}));
    }catch(err){alert('Cannot read file: '+err.message)}
  }
  $('presentationFile').addEventListener('click',()=>chooseFile(view));
  chooser.addEventListener('change',()=>readLocalFile(chooser.files?.[0],requestedFileKind||view));
  window.addEventListener('dashboard:choose-publications',()=>{
    view='papers';refresh();chooseFile('papers');
  });
  $('paperChooseLocal').addEventListener('click',()=>window.dispatchEvent(new Event('dashboard:choose-publications')));
  const paperDrop=$('paperDropZone');
  for(const eventType of ['dragenter','dragover']){
    paperDrop.addEventListener(eventType,event=>{
      event.preventDefault();paperDrop.classList.add('drag-over');
    });
  }
  for(const eventType of ['dragleave','drop']){
    paperDrop.addEventListener(eventType,event=>{
      event.preventDefault();paperDrop.classList.remove('drag-over');
    });
  }
  paperDrop.addEventListener('drop',event=>{
    view='papers';refresh();
    readLocalFile(event.dataTransfer?.files?.[0],'papers');
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
  document.querySelectorAll('[data-ring-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
    const kind=view==='users'?'users':'papers',ring=Number(btn.dataset.ringToggle);
    ringVisibility[kind][ring]=!ringVisibility[kind][ring];refresh();
  }));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!document.fullscreenElement&&body.classList.contains('presentation-details')){
      body.classList.remove('presentation-details');refresh();
    }
  });
  refresh();
})();