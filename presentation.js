'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const body = document.body, chooser = $('presentationInput');
  let view = 'users';
  const localFiles = {users:null,papers:null};
  function setAlert(message){$('presentationAlert').textContent=message||'';}
  function refresh(){
    const presenting = body.classList.contains('presentation-mode');
    const details = body.classList.contains('presentation-details');
    $('presentationToggle').textContent = presenting ? 'Exit presentation' : 'Present';
    $('presentationToggle').setAttribute('aria-pressed',String(presenting));
    $('presentationDetails').textContent = details ? 'Hide labels & controls' : 'Show labels & controls';
    $('presentationUsers').classList.toggle('active',view==='users');
    $('presentationPapers').classList.toggle('active',view==='papers');
    $('presentationUsers').setAttribute('aria-pressed',String(view==='users'));
    $('presentationPapers').setAttribute('aria-pressed',String(view==='papers'));
    $('presentationFile').textContent = view==='users' ? 'Open local CSV' : 'Open local JSON';
    $('presentationDataMode').textContent = localFiles[view] ? 'Local file · browser only' : 'Synthetic demo';
  }
  $('presentationToggle').addEventListener('click',() => {
    body.classList.toggle('presentation-mode');
    if(!body.classList.contains('presentation-mode'))body.classList.remove('presentation-details');
    refresh();
  });
  for(const [id,nextView] of [['presentationUsers','users'],['presentationPapers','papers']]){
    $(id).addEventListener('click',()=>{
      view=nextView;body.classList.toggle('presentation-papers',view==='papers');setAlert('');refresh();
    });
  }
  $('presentationDetails').addEventListener('click',()=>{
    body.classList.toggle('presentation-details');refresh();
  });
  $('presentationClear').addEventListener('click',()=>{
    $(view==='users'?'clear':'paperClear').click();
  });
  $('presentationFull').addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch(error){setAlert('Fullscreen was unavailable: '+error.message);}
  });
  document.addEventListener('fullscreenchange',()=>{
    $('presentationFull').textContent=document.fullscreenElement?'Exit fullscreen':'Fullscreen';
  });
  $('presentationFile').addEventListener('click',()=>{
    chooser.value='';
    chooser.accept=view==='users'?'.csv,text/csv':'.json,application/json';
    chooser.click();
  });
  chooser.addEventListener('change',async()=>{
    const file=chooser.files&&chooser.files[0];if(!file)return;
    const targetView=view;
    if(file.size>15*1024*1024){setAlert('Choose a file smaller than 15 MB.');return;}
    if(targetView==='users'&&!file.name.toLowerCase().endsWith('.csv') ||
       targetView==='papers'&&!file.name.toLowerCase().endsWith('.json')){
      setAlert('Please select a '+(targetView==='users'?'CSV':'JSON')+' file.');return;
    }
    try{
      const contents=await file.text();
      window.dispatchEvent(new CustomEvent(targetView==='users'?'dashboard:load-users':'dashboard:load-papers',
        {detail:{text:contents,name:file.name}}));
    }catch(error){setAlert('Unable to read the file: '+error.message);}
  });
  window.addEventListener('dashboard:local-data-loaded',event=>{
    localFiles[event.detail.kind||view]=event.detail.name;
    refresh();
    setAlert('Loaded '+event.detail.name+' in this browser session only; no data uploaded.');
  });
  window.addEventListener('dashboard:local-data-error',event=>setAlert(event.detail.message));
  window.addEventListener('dashboard:demo-data-loaded',event=>{localFiles[event.detail.kind]=null;refresh();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&body.classList.contains('presentation-mode')&&!document.fullscreenElement){
      body.classList.remove('presentation-mode','presentation-details');refresh();
    }
  });
  refresh();
})();
