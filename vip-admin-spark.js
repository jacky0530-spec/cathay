// Spark-compatible administrator UI. Existing VIP code login remains unchanged.
// A separate deployment and explicit Firebase rules publish are required.
import {nextVipStatus} from './vip-admin-spark-toggle.mjs';
// Manual VIP code utilities are embedded so login never depends on loading another module.
const CODE_FORMAT=/^[A-Z0-9_-]{6,32}$/;
const RESERVED=new Set(['VIP888','CATHAY2025']);
function normalizeNewVipCode(value){
 if(typeof value!=='string')throw new Error('invalid_vip_code');
 const code=value.trim().toUpperCase();
 if(!CODE_FORMAT.test(code))throw new Error('invalid_vip_code');
 if(RESERVED.has(code))throw new Error('reserved_vip_code');
 return code;
}
function insertNewVipCodeIfAbsent(current){return current===null?true:undefined;}
function normalizeVipLabel(value){
 if(typeof value!=='string')throw new Error('invalid_vip_label');
 const cleaned=value.trim();
 if(cleaned.length<1||cleaned.length>80)throw new Error('invalid_vip_label');
 return cleaned;
}

import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {initializeAuth,inMemoryPersistence,signInWithEmailAndPassword,signOut}
 from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {getDatabase,ref,get,set,remove,runTransaction}
 from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
const config={
 apiKey:"AIzaSyAXmxp2R7oeM-DJsbDoT6YAVlHV4vKC_Xo",
 authDomain:"cathay-app-5889a.firebaseapp.com",
 databaseURL:"https://cathay-app-5889a-default-rtdb.firebaseio.com",
 projectId:"cathay-app-5889a",
 appId:"1:222981030218:web:5f557a386a38cf3d1c41b3"
};
const app=initializeApp(config,'cathay-spark-vip-manager');
const auth=initializeAuth(app,{persistence:inMemoryPersistence});
const db=getDatabase(app);
const el=id=>document.getElementById(id);
const codeFormat=/^[A-Z0-9_-]{1,64}$/;
let justCreated='';
function say(message,error=false){el('status').textContent=message;el('status').className=error?'error':'';}
function reportError(error){
 if(error?.code==='PERMISSION_DENIED'||error?.code==='database/permission-denied')
  return '操作遭 Firebase Rules 拒絕。請先確認規則已完成模擬測試及正式發布。';
 if(error?.message==='authorization_changed')return '授權狀態已被修改，請重新整理清單再試。';
 if(error?.message==='code_missing')return '找不到這組授權碼，請重新整理清單。';
 if(error?.message==='delete_requires_disabled')return '必須先停用授權碼，才能刪除舊帳號。';
 if(error?.message==='retirement_not_enabled')return 'Firebase 尚未發布永久刪除權限規則，請勿直接清除資料。';
 if(error?.message==='retirement_verification_failed')return '已執行刪除，但資料庫狀態確認失敗，請按重新整理後檢查。';
 if(error?.message==='retirement_profile_cleanup_failed')return 'VIP 授權已刪除，但人員標籤清除失敗。請檢查資料庫管理員規則。';

 if(error?.message==='verify_failed')return '資料庫變更後驗證失敗，請重新整理清單確認狀態。';
 if(error?.message==='duplicate_vip_code')return '這組 VIP 授權碼已存在（包含已停用），請另外輸入一組，不會覆蓋原授權。';
 if(error?.message==='retired_vip_code')return '這組授權碼曾經永久刪除，禁止重新發行，請另外設定一組。';
 if(error?.message==='invalid_vip_label')return '識別標籤不可空白，最多 80 個字元。';
 if(error?.message==='label_verify_failed')return '標籤已嘗試更新，但重新讀取的值不一致；請按「重新整理清單」確認。';
 if(error?.message==='label_timeout')return '修改標籤逾時，請先重新整理清單確認是否已儲存，避免重複操作。';
 if(error?.message==='label_retired')return '該授權碼已永久註銷，不能修改識別標籤。';

 if(error?.message==='invalid_vip_code')return '授權碼請填寫 6～32 位英文、數字、底線或連字號。';
 if(error?.message==='reserved_vip_code')return '這組授權碼為舊版共用碼，不可再分配給新人。';
 if(error?.code==='auth/network-request-failed')return '無法連接 Firebase Authentication，請確認網路後重新整理頁面。';
 if(error?.code==='auth/too-many-requests')return 'Firebase 暫時限制登入次數，請稍後再試。';
 if(error?.code==='auth/unauthorized-domain')return '目前網址尚未列入 Firebase Authentication 授權網域。';
 if(error?.code==='auth/user-disabled')return 'Firebase 管理員帳號已停用，請檢查 Authentication 設定。';
 if(error?.message==='auth_timeout')return 'Firebase 帳號驗證逾時。請確認網路，重新整理後再試。';
 if(error?.message==='membership_timeout')return 'Firebase 帳號已驗證，但管理員權限查詢逾時。請檢查資料庫連線及規則。';
 if(error?.message==='list_timeout')return '授權清單讀取逾時；登入身分已通過，請按「重新整理清單」再試。';
 if(error?.message==='login_required')return '登入狀態已失效，請重新登入。';
 if(error?.message==='retire_timeout')return '永久刪除操作逾時，請先重新整理確認實際授權狀態，勿連續按刪除。';
 if(error?.message==='db_request_timeout')return '已驗證 Firebase 帳號，但 Realtime Database 讀取逾時，請檢查連線或網路安全軟體。';
 if(error?.message==='db_network_failed')return '無法連接 Firebase Realtime Database。請檢查網路，或使用瀏覽器無痕模式測試。';
 if(error?.message==='member_access_denied')return 'Firebase 資料庫拒絕驗證此管理員的會員資料，請確認 members/UID 規則與帳號角色。';
 if(error?.message?.startsWith('db_http_'))return 'Firebase 資料庫回應錯誤（HTTP '+error.message.slice(8)+'）。';
 if(error?.message==='hub_log_verify_failed')return 'hubUsageLog 寫入後讀回驗證失敗。';
 if(error?.message==='not_admin')return '登入帳號沒有管理員權限。';
 if(error?.code==='auth/invalid-credential')return '帳號或密碼驗證失敗。';
 return '操作未完成：'+String(error?.code||error?.message||'未知錯誤');
}
// Use authenticated REST reads instead of the persistent Realtime Database
// connection for admin verification and list loading. On some browsers the SDK
// read can remain pending after Firebase Authentication succeeds.
// Firebase officially accepts its ID token as the REST "auth" query parameter.
async function firebaseRest(path,method="GET",body,query={}){
 if(!auth.currentUser)throw new Error('login_required');
 const idToken=await auth.currentUser.getIdToken();
 const ctrl=new AbortController();
 const timeout=setTimeout(()=>ctrl.abort(),10000);
 try{
  const endpoint=new URL(config.databaseURL+'/'+path+'.json');
  for(const [name,value] of Object.entries(query))endpoint.searchParams.set(name,value);
  endpoint.searchParams.set('auth',idToken);
  const response=await fetch(endpoint.toString(),{
   method,cache:'no-store',referrerPolicy:'no-referrer',
   headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},
   body:body===undefined?undefined:JSON.stringify(body),signal:ctrl.signal
  });
  if(!response.ok){
   if(response.status===401||response.status===403)throw new Error('member_access_denied');
   throw new Error('db_http_'+response.status);
  }
  return await response.json();
 }catch(error){
  if(error?.name==='AbortError')throw new Error('db_request_timeout');
  if(error?.name==='TypeError')throw new Error('db_network_failed');
  throw error;
 }finally{clearTimeout(timeout);}
}
const readFirebaseRest=path=>firebaseRest(path);
async function checkAdmin(){
 const uid=auth.currentUser?.uid;
 if(!uid)throw new Error('login_required');
 const m=await readFirebaseRest('members/'+encodeURIComponent(uid));
 if(!m||m.active!==true||m.role!=='admin')throw new Error('not_admin');
}
const photoRoot='photoLibraryV2';
const photoReviewStatus=message=>{el('photoReviewStatus').textContent=message;};
async function loadPhotoReviews(){
 const rows=el('photoReviewRows');
 rows.replaceChildren();
 photoReviewStatus('正在載入待審照片…');
 await checkAdmin();
 const requests=await readFirebaseRest(photoRoot+'/deleteRequests');
 const pending=Object.entries(requests||{}).filter(([id,request])=>
  /^[\w-]{4,140}$/.test(id)&&request?.status==='pending');
 const catalog=pending.length?await readFirebaseRest(photoRoot+'/catalog'):{};
 if(!auth.currentUser)return;
 rows.replaceChildren();
 for(const [id,request] of pending){
  const photo=catalog?.[id];
  const row=document.createElement('li');
  const title=document.createElement('strong');
  title.textContent=photo?.title||photo?.fileName||'照片 '+id;
  row.append(title);
  if(/^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(photo?.thumb||'')){
   const image=document.createElement('img');
   image.src=photo.thumb;image.alt='';image.width=140;image.loading='lazy';
   row.append(document.createElement('br'),image,document.createElement('br'));
  }
  for(const [decision,label] of [['approved','核准刪除'],['rejected','駁回']]){
   const button=document.createElement('button');
   button.type='button';button.textContent=label;
   button.addEventListener('click',async()=>{
    if(!confirm(label+'「'+title.textContent+'」？'))return;
    row.querySelectorAll('button').forEach(item=>{item.disabled=true;});
    try{
     await checkAdmin();
     const patch={['deleteRequests/'+id]:{...request,status:decision,
      reviewedBy:auth.currentUser.uid,reviewedAt:{'.sv':'timestamp'}}};
     if(decision==='approved'){
      patch['catalog/'+id]=null;
      patch['images/'+id]=null;
     }
     await firebaseRest(photoRoot,'PATCH',patch);
     await loadPhotoReviews();
     photoReviewStatus(decision==='approved'?'已核准刪除。':'已駁回，照片仍保留。');
    }catch(error){photoReviewStatus('請重新整理待審照片以確認結果。'+reportError(error));}
   });
   row.append(button);
  }
  rows.append(row);
 }
 photoReviewStatus(pending.length?'待審 '+pending.length+' 張照片。':'目前沒有待審照片。');
}
function refreshPhotoReviews(){
 return loadPhotoReviews().catch(error=>photoReviewStatus(reportError(error)));
}
el('refreshPhotoReviews').addEventListener('click',refreshPhotoReviews);
const photoUsageActions={
 openPhoto:'點選照片',pin:'置頂／取消置頂',move:'移動照片',edit:'編輯照片',
 deleteRequest:'刪除',duplicateCleanup:'整理重複照片',createCategory:'新增資料區',
 manageCategories:'管理資料區',batchSelect:'切換多選',batchSelectAll:'全選',
 batchMove:'批次移動',batchDelete:'批次刪除',upload:'新增照片',export:'匯出備份',
 import:'匯入備份',migrate:'搬移舊版照片',sync:'重新同步',search:'搜尋',filter:'切換資料區'
};
const hubUsagePages={
 "prod_rider":"附約比較表",
 "calc": "財務試算工具",
 "calc_ah": "116年日本東北高峰會",
 "calc_business": "業務員薪資試算器 Pro (UI優化版)",
 "calc_combo": "勞保+國保 雙年金試算表",
 "calc_labor": "勞保年金進階試算：提早退休與總額分析",
 "calc_plan": "遺產稅規劃工具 (含估價提示版)",
 "calc_retire": "退休儲蓄目標試算表 (萬元版)",
 "prod_accident": "國泰人壽 - 傷害險全方位比較與試算 (更新XB費率)",
 "prod_accident_history": "國泰人壽意外險歷代商品比較表",
 "prod_bone": "新金骨力(XJ2) 精細骨骼試算",
 "prod_cancer_protect": "國泰人壽防癌保障整合試算",
 "prod_full_heart": "滿溢鍾心",
 "prod_good_health": "國泰人壽 豪/好康愛 全方位保障試算",
 "prod_invest_enjoy": "國泰人壽月月(享)溢 - 配息與費用試算",
 "prod_invest_forever": "國泰人壽月月永溢 - 配息模擬試算",
 "prod_invest_full": "國泰人壽月月滿溢 - 配息模擬試算",
 "prod_invest_taifu": "國泰人壽月月泰富 - 撥回與費用試算",
 "prod_lifetime_medical": "國泰好順心 (四主約-新配色版)",
 "prod_overflow_love": "國泰人壽滿溢康愛防癌定期健康保險（外溢型）試算",
 "prod_surgery": "國泰人壽手術險全系列進化比較表",
 "products": "商品試算與保障工具"
};
const hubUsageActions={open:'開啟頁面',calculate:'執行試算',adjust:'調整條件',activate:'操作功能'};
let photoUsage=null;
let activeUsageLogTab='hub';
function setUsageLogTab(tab){
 activeUsageLogTab=tab==='photo'?'photo':'hub';
 const hub=activeUsageLogTab==='hub';
 el('hubUsageLogTab').classList.toggle('is-active',hub);
 el('photoUsageLogTab').classList.toggle('is-active',!hub);
 el('hubUsageLogTab').setAttribute('aria-selected',String(hub));
 el('photoUsageLogTab').setAttribute('aria-selected',String(!hub));
 el('hubUsageLogPanel').hidden=!hub;
 el('photoUsageLogPanel').hidden=hub;
}
el('hubUsageLogTab').addEventListener('click',()=>setUsageLogTab('hub'));
el('photoUsageLogTab').addEventListener('click',()=>setUsageLogTab('photo'));
function usageRow(body,values){
 const row=body.insertRow();
 for(const value of values)row.insertCell().textContent=value;
}
function renderPhotoUsage(){
 const filter=el('photoUsageAccount').value;
 const counts=el('photoUsageCounts'),log=el('photoUsageLog'),hubLog=el('hubUsageLog');
 counts.replaceChildren();log.replaceChildren();hubLog.replaceChildren();
 const hubRows=el("hubUsageRows");hubRows.replaceChildren();
 if(!photoUsage)return;
 const {users,events=[],hubEvents=[],countsByUser={},catalog={},hubCounts={}}=photoUsage;
 for(const [account,name] of users){
  if(filter&&account!==filter)continue;
  for(const [page,actions] of Object.entries(hubCounts[account]||{})){
   if(!Object.hasOwn(hubUsagePages,page))continue;
   const section=page.startsWith('prod')?'商品區':'試算區';
   for(const [action,count] of Object.entries(actions)){
    if(Object.hasOwn(hubUsageActions,action))usageRow(hubRows,[name,section,hubUsagePages[page],hubUsageActions[action],count]);
   }
  }
  for(const [action,count] of Object.entries(countsByUser[account]||{})){
   if(Object.hasOwn(photoUsageActions,action))usageRow(counts,[name,photoUsageActions[action],count]);
  }
 }
 for(const event of hubEvents){
  if(filter&&event.account!==filter)continue;
  if(!Object.hasOwn(hubUsagePages,event.page)||!Object.hasOwn(hubUsageActions,event.action))continue;
  const section=event.page.startsWith('prod')?'商品區':'試算區';
  usageRow(hubLog,[new Date(event.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}),
   users.get(event.account)||'未命名帳號 · '+String(event.account||'').slice(0,8),
   section,hubUsagePages[event.page],hubUsageActions[event.action]]);
 }
 for(const event of events){
  if(filter&&event.account!==filter)continue;
  const photo=catalog[event.photoId];
  usageRow(log,[new Date(event.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}),
   users.get(event.account),photo?.title||photo?.fileName||event.photoId]);
 }
 const notes=[...photoUsage.unavailable];
 const trackerVersion=localStorage.getItem('hubUsageTrackerVersion');
 const trackerStatus=localStorage.getItem('hubUsageTrackerStatus');
 const trackerAt=Number(localStorage.getItem('hubUsageTrackerStatusAt')||0);
 if(trackerVersion||trackerStatus){
  notes.push('本機追蹤器：版本 '+(trackerVersion||'未知')+'／狀態 '+(trackerStatus||'未知')+
   (trackerAt?'／'+new Date(trackerAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'')+'。');
 }
 if(!hubLog.rows.length)notes.push('目前沒有操作畫面逐筆紀錄；請先重新整理商品／試算頁並操作一次。若上方次數有增加但此處仍為 0，代表 Firebase hubUsageLog 規則尚未正式發布。');
 if(!log.rows.length&&counts.rows.length)notes.push('照片功能有累積次數但最近照片紀錄為 0；已啟用備援讀取，若仍空白請確認 photoClickLog 讀取規則。');
 el('photoUsageStatus').textContent='顯示 '+hubRows.rows.length+' 筆商品與試算統計、'+counts.rows.length+' 筆照片功能統計、'+hubLog.rows.length+' 筆操作畫面紀錄、'+log.rows.length+' 筆照片點選紀錄。 '+notes.join(' ');
}
el('photoUsageAccount').addEventListener('change',renderPhotoUsage);
el('testHubUsageLog').addEventListener('click',async()=>{
 const button=el('testHubUsageLog');
 button.disabled=true;
 el('photoUsageStatus').textContent='正在測試 hubUsageLog 寫入…';
 try{
  await checkAdmin();
  const raw=new TextEncoder().encode('cathay-photos-v2:HUB-LOG-SELF-TEST');
  const digest=await crypto.subtle.digest('SHA-256',raw);
  const account=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const eventId='admin-test-'+Date.now();
  const payload={account,page:'products',action:'activate',at:{'.sv':'timestamp'}};
  await firebaseRest(photoRoot+'/hubUsageLog/'+eventId,'PUT',payload);
  const saved=await readFirebaseRest(photoRoot+'/hubUsageLog/'+eventId);
  if(!saved||saved.account!==account||saved.page!=='products'||saved.action!=='activate'||!Number(saved.at))
   throw new Error('hub_log_verify_failed');
  el('photoUsageStatus').textContent='✅ hubUsageLog 寫入與讀回成功。Firebase Rules 已正確發布；若商品頁仍沒有紀錄，問題在商品／試算頁追蹤程式或快取。';
 }catch(error){
  const detail=error?.message?.startsWith('db_http_')
   ? 'Firebase 回傳 HTTP '+error.message.slice(8)
   : reportError(error);
  el('photoUsageStatus').textContent='❌ hubUsageLog 測試失敗：'+detail+'。這代表正式 Firebase Rules 尚未允許這個路徑，或規則位置仍不正確。';
 }finally{button.disabled=false;}
});
async function readRecentUsageLog(path,label,unavailable){
 try{
  return await firebaseRest(path,'GET',undefined,{orderBy:'"at"',limitToLast:100});
 }catch(queryError){
  try{
   const all=await readFirebaseRest(path);
   const latest=Object.entries(all||{}).sort((a,b)=>Number(b[1]?.at||0)-Number(a[1]?.at||0)).slice(0,100);
   return Object.fromEntries(latest);
  }catch(fullError){
   unavailable.push(label+'暫無法讀取（Firebase 規則或索引尚未開放）。');
   return {};
  }
 }
}
el('loadPhotoUsage').addEventListener('click',async()=>{
 const button=el('loadPhotoUsage');
 const user=auth.currentUser;
 button.disabled=true;
 el('photoUsageStatus').textContent='正在載入使用分析…';
 try{
  await checkAdmin();
  const unavailable=[];
  const optional=(promise,message)=>promise.catch(()=>{unavailable.push(message);return {};});
  const [counts,log,catalog,profiles,hubCounts,hubLog]=await Promise.all([
   optional(readFirebaseRest(photoRoot+'/usageCounts'),'照片功能統計暫無法讀取。'),
   readRecentUsageLog(photoRoot+'/photoClickLog','照片點選紀錄',unavailable),
   optional(readFirebaseRest(photoRoot+'/catalog'),'照片名稱暫無法讀取。'),
   readFirebaseRest('vipProfiles').catch(()=>({})),
   optional(readFirebaseRest(photoRoot+'/hubUsageCounts'),'商品與試算區統計暫無法讀取。'),
   readRecentUsageLog(photoRoot+'/hubUsageLog','操作畫面紀錄',unavailable)
  ]);
  const labels=new Map(await Promise.all(Object.entries(profiles||{}).map(async([code,label])=>{
   const raw=new TextEncoder().encode('cathay-photos-v2:'+code.toUpperCase());
   const digest=await crypto.subtle.digest('SHA-256',raw);
   const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
   return [hash,label];
  })));
  if(auth.currentUser!==user)return;
  const events=Object.values(log||{}).sort((a,b)=>b.at-a.at);
  const hubEvents=Object.values(hubLog||{}).sort((a,b)=>b.at-a.at);
  const accounts=new Set([...Object.keys(counts||{}),...Object.keys(hubCounts||{}),...events.map(event=>event.account),...hubEvents.map(event=>event.account)]);
  const users=new Map(Array.from(accounts,account=>[account,
   (labels.get(account)||'未命名帳號')+' · '+account.slice(0,8)]));
  photoUsage={users,events,hubEvents,countsByUser:counts||{},catalog:catalog||{},hubCounts:hubCounts||{},unavailable};
  const select=el('photoUsageAccount');
  const current=select.value;
  select.replaceChildren(new Option('全部使用者',''));
  for(const [account,name] of users)select.add(new Option(name,account));
  select.value=users.has(current)?current:'';
  renderPhotoUsage();
 }catch(error){
  el('photoUsageStatus').textContent=reportError(error);
 }finally{button.disabled=false;}
});
function clearIssued(){justCreated='';el('issuedValue').textContent='';el('issued').hidden=true;}
let accountRows=[];
function applyAccountFilter(){
 const search=el('accountFilter').value.trim().toUpperCase();
 let visible=0;
 for(const item of accountRows){
  const show=!search||item.code.includes(search)||item.label.toUpperCase().includes(search);
  item.row.hidden=!show;
  if(show)visible++;
 }
 el('accountCount').textContent='顯示 '+visible+' / '+accountRows.length+' 筆授權';
}

async function refresh(){
 await checkAdmin();
 const [whitelist,labels,retirementEnabled]=await Promise.all([
  readFirebaseRest('whitelist'),readFirebaseRest('vipProfiles'),
  // Until the separately approved Firebase Rules are published, deleting
  // accounts stays unavailable instead of showing a nonfunctional button.
  readFirebaseRest('vipRetired').then(()=>true,()=>false)
 ]);
 const entries=Object.entries(whitelist||{}).filter(([code,val])=>codeFormat.test(code)&&typeof val==='boolean');
 const names=labels||{};
 const tbody=el('rows');tbody.replaceChildren();
 const newRows=[];
 for(const [code,enabled] of entries.sort((a,b)=>a[0].localeCompare(b[0]))){
  const row=document.createElement('tr');
  const storedLabel=typeof names[code]==='string'?names[code]:'';
  const searchItem={row,code,label:storedLabel};
  const nameCell=document.createElement('td');
  const nameText=document.createElement('span');
  nameText.textContent=storedLabel||'既有授權';
  nameCell.append(nameText);
  row.append(nameCell);
  for(const value of ['••••'+code.slice(-4),enabled?'啟用':'停用']){
   const cell=document.createElement('td');cell.textContent=value;row.append(cell);
  }
  const actionCell=document.createElement('td'),button=document.createElement('button');
  button.type='button';button.className=enabled?'danger':'secondary';
  button.textContent=enabled?'停用':'啟用';
  button.addEventListener('click',async()=>{
   if(!confirm('確定要'+(enabled?'停用':'啟用')+'尾碼 '+code.slice(-4)+' 的授權碼？'))return;
   button.disabled=true;
   try{
    await checkAdmin();
    // Firebase may call the transaction callback with null before this
    // individual code has been cached. Verify its real value first.
    const entryRef=ref(db,'whitelist/'+code);
    const latest=(await get(entryRef)).val();
    if(typeof latest!=='boolean')throw new Error('code_missing');
    if(latest!==enabled)throw new Error('authorization_changed');
    const update=await runTransaction(entryRef,current=>nextVipStatus(current,enabled),{applyLocally:false});
    if(!update.committed)throw new Error('authorization_changed');
    const saved=(await get(entryRef)).val();
    if(saved!==!enabled)throw new Error('verify_failed');
    say('授權狀態已更新為'+(saved?'啟用':'停用')+'，已重新確認資料庫。');await refresh();
   }catch(error){say(reportError(error),true);button.disabled=false;}
  });
  actionCell.append(button);
  const edit=document.createElement('button');
  edit.type='button';edit.className='secondary';edit.textContent='修改標籤';
  edit.style.marginLeft='8px';
  edit.addEventListener('click',()=>{
   if(edit.disabled)return;
   edit.disabled=true;
   const editor=document.createElement('div');editor.className='label-editor';
   const input=document.createElement('input');
   input.type='text';input.maxLength=80;
   input.value=searchItem.label;
   input.setAttribute('aria-label','識別標籤，授權碼末四碼 '+code.slice(-4));
   const save=document.createElement('button');save.type='button';save.textContent='儲存';
   const cancel=document.createElement('button');
   cancel.type='button';cancel.className='secondary';cancel.textContent='取消';
   const close=()=>{editor.remove();edit.disabled=false;};
   cancel.addEventListener('click',close);
   save.addEventListener('click',async()=>{
    save.disabled=true;cancel.disabled=true;
    try{
     const updatedLabel=normalizeVipLabel(input.value);
     if(updatedLabel===searchItem.label){
      close();say('識別標籤沒有變更，不需儲存。');return;
     }
     await withDeadline(checkAdmin(),15000,'membership');
     const liveStatus=await readFirebaseRest('whitelist/'+encodeURIComponent(code));
     if(typeof liveStatus!=='boolean')throw new Error('code_missing');
     const retired=await readFirebaseRest('vipRetired/'+encodeURIComponent(code));
     if(retired===true)throw new Error('label_retired');
     // Keep the VIP key and active status unchanged; write only the private label.
     await withDeadline(set(ref(db,'vipProfiles/'+code),updatedLabel),15000,'label');
     if(await readFirebaseRest('vipProfiles/'+encodeURIComponent(code))!==updatedLabel)
      throw new Error('label_verify_failed');
     searchItem.label=updatedLabel;
     nameText.textContent=updatedLabel;
     close();
     applyAccountFilter();
     say('已儲存「'+updatedLabel+'」的識別標籤。授權碼與啟用狀態完全不變。');
    }catch(error){say(reportError(error),true);save.disabled=false;cancel.disabled=false;}
   });
   input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();cancel.click();}
    else if(event.key==='Enter'){event.preventDefault();save.click();}
   });
   editor.append(input,save,cancel);nameCell.append(editor);input.focus();
  });
  actionCell.append(edit);
  if(!enabled && !RESERVED.has(code) && retirementEnabled){
   const del=document.createElement('button');
   del.type='button';del.className='danger';del.textContent='永久刪除';
   del.style.marginLeft='10px';
   del.addEventListener('click',async()=>{
    const displayName=names[code]||'既有授權';
    const suffix=code.slice(-4);
    if(!confirm('永久刪除「'+displayName+'」(授權碼尾碼 '+suffix+')？此操作不可復原；登入歷史和客戶資料不會刪除。'))return;
    const phrase='刪除-'+suffix;
    const typed=prompt('請輸入「'+phrase+'」確認永久刪除已停用的 VIP 授權：');
    if(typed!==phrase){say('沒有完成二次確認，未刪除任何資料。');return;}
    del.disabled=true;
    try{
     await checkAdmin();
     const base='whitelist/'+encodeURIComponent(code);
     const current=await readFirebaseRest(base);
     if(current!==false)throw new Error('delete_requires_disabled');
     const tombstone='vipRetired/'+encodeURIComponent(code);
     const retired=await readFirebaseRest(tombstone);
     if(retired!==true){
      if(retired!==null)throw new Error('retirement_not_enabled');
      // Permanent tombstone prevents future reissue even if the old code is removed.
      await withDeadline(set(ref(db,'vipRetired/'+code),true),15000,'retire');
      if(await readFirebaseRest(tombstone)!==true)throw new Error('retirement_verification_failed');
     }
     // Server-side Rules require BOTH disabled status and retirement tombstone.
     await withDeadline(remove(ref(db,'whitelist/'+code)),15000,'retire');
     if(await readFirebaseRest(base)!==null)throw new Error('retirement_verification_failed');
     const profilePath='vipProfiles/'+encodeURIComponent(code);
     const profile=await readFirebaseRest(profilePath);
     if(profile!==null){
      try{
       await withDeadline(remove(ref(db,'vipProfiles/'+code)),15000,'retire');
       if(await readFirebaseRest(profilePath)!==null)throw new Error('retirement_profile_cleanup_failed');
      }catch(_){throw new Error('retirement_profile_cleanup_failed');}
     }
     say('已永久刪除已停用的 VIP 授權；同一代碼不可再次發行。登入歷史與客戶資料仍保留。');
     await refresh();
    }catch(error){say(reportError(error),true);}
    finally{del.disabled=false;}
   });
   actionCell.append(del);
  }
  row.append(actionCell);tbody.append(row);newRows.push(searchItem);
 }
 accountRows=newRows;
 applyAccountFilter();
}
// Keep Firebase Authentication, membership validation and list loading separate.
// A slow or denied list read must never make a successful login look stuck.
function withDeadline(promise,ms,phase){
 let timeout;
 const timer=new Promise((_,reject)=>{
  timeout=setTimeout(()=>reject(new Error(phase+'_timeout')),ms);
 });
 return Promise.race([promise,timer]).finally(()=>clearTimeout(timeout));
}
el('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!el('password').value){say('請先輸入 Firebase 管理員密碼。',true);return;}
 const button=el('loginButton');
 button.disabled=true;button.textContent='驗證中…';
 let signedIn=false;
 try{
  say('步驟 1／3：正在驗證 Firebase 管理員帳號…');
  await withDeadline(signInWithEmailAndPassword(auth,el('email').value.trim(),el('password').value),15000,'auth');
  signedIn=true;
  el('password').value='';
  say('步驟 2／3：帳號驗證成功，正在確認管理員權限…');
  await withDeadline(checkAdmin(),15000,'membership');
  el('loginArea').hidden=true;el('manageArea').hidden=false;
  void refreshPhotoReviews();
  say('步驟 3／3：管理員登入成功，正在載入 VIP 授權清單…');
  // The admin UI is usable even when the optional list read fails or stalls.
  void withDeadline(refresh(),15000,'list').then(
   ()=>say('管理員登入成功，授權清單已載入。'),
   error=>say('管理員登入成功，但清單載入失敗：'+reportError(error),true)
  );
 }catch(error){
  el('password').value='';
  if(signedIn){try{await signOut(auth);}catch(_){}}
  say(reportError(error),true);
 }finally{
  button.disabled=false;button.textContent='登入後台';
 }
});
el('createForm').addEventListener('submit',async event=>{
 event.preventDefault();el('createButton').disabled=true;clearIssued();
 try{
  await checkAdmin();
  const label=el('label').value.trim();
  if(!label||label.length>80)throw new Error('invalid_label');
  const code=normalizeNewVipCode(el('vipCode').value);
  const codeRef=ref(db,'whitelist/'+code);
  // Old codes that were permanently retired must never be reissued.
  // Legacy rules may not expose vipRetired yet; the original creation path
  // must continue working until updated deletion rules are published.
  let previouslyRetired=false;
  try{previouslyRetired=(await readFirebaseRest('vipRetired/'+encodeURIComponent(code)))===true;}
  catch(error){if(error?.message!=='member_access_denied')throw error;}
  if(previouslyRetired)throw new Error('retired_vip_code');
  // Check both enabled and disabled codes; never overwrite/re-enable an existing person.
  if((await get(codeRef)).exists())throw new Error('duplicate_vip_code');
  // Firebase transaction retries on concurrent writes to preserve uniqueness.
  const result=await runTransaction(codeRef,insertNewVipCodeIfAbsent,{applyLocally:false});
  if(!result.committed)throw new Error('duplicate_vip_code');
  const confirmed=(await get(codeRef)).val();
  if(confirmed!==true)throw new Error('verify_failed');
  justCreated=code;el('issuedValue').textContent=code;el('issued').hidden=false;
  el('label').value='';el('vipCode').value='';
  try{
   await set(ref(db,'vipProfiles/'+code),label);
   say('管理員指定的 VIP 授權碼已建立，請透過私密管道交給本人。');
  }catch(_){say('授權碼已建立，但識別標籤未成功儲存；請先記下畫面上的授權碼。',true);}
  await refresh();
 }catch(error){say(reportError(error),true);}
 finally{el('createButton').disabled=false;}
});
el('accountFilter').addEventListener('input',applyAccountFilter);
el('refresh').addEventListener('click',()=>refresh().catch(e=>say(reportError(e),true)));
el('hideCode').addEventListener('click',clearIssued);
el('copy').addEventListener('click',async()=>{
 if(!justCreated)return;
 try{await navigator.clipboard.writeText(justCreated);say('已複製授權碼。');}
 catch(_){say('瀏覽器不允許複製，請自行複製本次授權碼。',true);}
});
el('logout').addEventListener('click',async()=>{
 clearIssued();el('rows').replaceChildren();
 photoUsage=null;renderPhotoUsage();
 el('photoUsageAccount').replaceChildren(new Option('全部使用者',''));
 el('photoUsageStatus').textContent='';
 setUsageLogTab('hub');
 accountRows=[];el('accountFilter').value='';applyAccountFilter();
 await signOut(auth);el('manageArea').hidden=true;el('loginArea').hidden=false;say('已安全登出。');
});
