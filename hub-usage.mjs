const TRACKER_VERSION='20261122-4';
if (!window.__cathayHubUsageStarted) {
 window.__cathayHubUsageStarted=true;
 try{
  localStorage.setItem('hubUsageTrackerVersion',TRACKER_VERSION);
  localStorage.setItem('hubUsageTrackerStatus','started');
  localStorage.setItem('hubUsageTrackerStatusAt',String(Date.now()));
 }catch(_){}
// Count trusted browser interactions without collecting field values or labels.
const account=localStorage.getItem('currentUser')?.trim();
const session=localStorage.getItem('currentSession');
const page=location.pathname.split('/').pop()?.replace(/\.html$/,'');
const database='https://cathay-app-5889a-default-rtdb.firebaseio.com';

function actionFor(event){
 if(event.type==='change'){
  return event.target.matches('select,input:not([type=hidden]),textarea')?'adjust':null;
 }
 const control=event.target.closest('button:not([disabled]),[role=button],summary,[data-usage-action],a[download]');
 if(!control||control.matches(':disabled'))return null;
 return control.dataset.usageAction||'activate';
}

if(account&&session&&/^(products|prod_[a-z_]+|calc(?:_[a-z_]+)?)$/.test(page)){
 const accountKey=crypto.subtle.digest('SHA-256',new TextEncoder().encode('cathay-photos-v2:'+account.toUpperCase()))
  .then(digest=>Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join(''));
 function eventKey(){
  return typeof crypto.randomUUID==='function'
   ? crypto.randomUUID()
   : 'hub-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 }
 async function track(action){
  try{
   const key=await accountKey;
   const eventId=eventKey();
   const updates={
    ['hubUsageCounts/'+key+'/'+page+'/'+action]:{'.sv':{increment:1}},
    ['hubUsageLog/'+eventId]:{account:key,page,action,at:{'.sv':'timestamp'}}
   };
   const response=await fetch(database+'/photoLibraryV2.json',{
    method:'PATCH',headers:{'Content-Type':'application/json'},keepalive:true,
    body:JSON.stringify(updates)
   });
   if(!response.ok)throw new Error('HTTP '+response.status);
   try{
    localStorage.setItem('hubUsageTrackerStatus','ok');
    localStorage.setItem('hubUsageTrackerStatusAt',String(Date.now()));
   }catch(_){}
  }catch(error){
   try{
    localStorage.setItem('hubUsageTrackerStatus','error:'+String(error?.message||error));
    localStorage.setItem('hubUsageTrackerStatusAt',String(Date.now()));
   }catch(_){}
   console.warn('網站使用紀錄同步失敗',error.message);
  }
 }
 void track('open');
 if(page!=='products'&&page!=='calc'){
  for(const type of ['click','change']){
   document.addEventListener(type,event=>{
    if(!event.isTrusted||!(event.target instanceof Element)||event.target.closest('header,nav,footer'))return;
    const action=actionFor(event);
    if(action)void track(action);
   },true);
  }
 }
}

}
