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
 async function count(action){
  try{
   const key=await accountKey;
   const response=await fetch(database+'/photoLibraryV2/hubUsageCounts/'+key+'/'+page+'/'+action+'.json',{
    method:'PUT',headers:{'Content-Type':'application/json'},keepalive:true,
    body:JSON.stringify({'.sv':{increment:1}})
   });
   if(!response.ok)throw new Error('HTTP '+response.status);
  }catch(error){console.warn('使用統計同步失敗',error.message);}
 }
 void count('open');
 if(page!=='products'&&page!=='calc'){
  for(const type of ['click','change']){
   document.addEventListener(type,event=>{
    if(!event.isTrusted||!(event.target instanceof Element)||event.target.closest('header,nav,footer'))return;
    const action=actionFor(event);
    if(action)void count(action);
   },true);
  }
 }
}
