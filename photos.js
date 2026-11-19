/* Cathay photo library v2.0 | Shared Firebase RTDB gallery, separate per-user favorites.
 * Static hosting + existing login code; RTDB permissions must be configured separately.
 * Large originals are retained in previous v1 local IndexedDB until manual migration.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const CATEGORIES = Object.freeze({news:"新聞剪報",cancer:"癌症議題",receipt:"醫療收據"});
  const MIME_TYPES = new Set(["image/png","image/jpeg","image/webp","image/gif"]);
  const FIREBASE_BASE = "https://cathay-app-5889a-default-rtdb.firebaseio.com";
  const ROOT = FIREBASE_BASE + "/photoLibraryV2";
  const ACCOUNT = String(localStorage.getItem("currentUser")||"").trim();
  const SESSION = String(localStorage.getItem("currentSession")||"").trim();
  const MAX_FILE = 20 * 1024 * 1024;
  const MAX_BATCH = 24;
  const FORMAT1 = "cathay-photo-library-backup-v1";
  const FORMAT2 = "cathay-photo-library-shared-backup-v2";
  const state={records:[],pins:{},accountKey:"",filter:"all",query:"",busy:false,
    viewIds:[],viewIndex:0,viewCache:new Map(),lastLoaded:0,refreshPromise:null};
  const isCat = x => Object.hasOwn(CATEGORIES,x);
  const limit = (s,n) => String(s||"").trim().slice(0,n);
  const safeDate = x => Number.isFinite(new Date(x).getTime()) ? new Date(x).toLocaleDateString("zh-TW") : "";
  const key = () => (crypto.randomUUID ? crypto.randomUUID() : "photo-"+Date.now()+"-"+Math.random().toString(36).slice(2));
  const qs = path => ROOT+"/"+path+".json";
  const validDataURL = value => typeof value==="string" && /^data:image\/(?:jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  const create = (tag,cls,txt) => {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(txt!==undefined)n.textContent=txt;
    return n;
  };
  function status(text,error=false){
    $("galleryStatus").textContent=text;
    $("galleryStatus").classList.toggle("error",error);
  }
  async function userHash(raw){
    const bytes = new TextEncoder().encode("cathay-photos-v2:"+raw.toUpperCase());
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
  }
  async function api(path,method="GET",body){
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),20000);
    try{
      const r=await fetch(qs(path),{
        method,
        headers:body===undefined?{}:{"Content-Type":"application/json"},
        body:body===undefined?undefined:JSON.stringify(body),
        cache:"no-store",
        signal:ctrl.signal
      });
      if(!r.ok){
        let message="";
        try{const json=await r.json();message=json.error||"";}catch{}
        if(r.status===401||r.status===403){
          throw new Error("Firebase 尚未授權共用照片資料讀寫（"+r.status+"）。請先完成資料庫權限設定。"+(message?" "+message:""));
        }
        throw new Error("共用資料庫回應 "+r.status+(message?"："+message:""));
      }
      if(r.status===204) return null;
      const txt=await r.text();
      return txt?JSON.parse(txt):null;
    }catch(err){
      if(err.name==="AbortError")throw new Error("Firebase 連線逾時，請檢查網路後重試。");
      throw err;
    }finally{clearTimeout(timeout);}
  }
  function sorted(category){
    const q=state.query.toLowerCase();
    return state.records.filter(x=>x.category===category && (
      !q || [x.title,x.description,x.fileName].some(v=>String(v||"").toLowerCase().includes(q))
    )).sort((a,b)=>{
      const pa=Number(state.pins[a.id]||0), pb=Number(state.pins[b.id]||0);
      return (pb>0)-(pa>0) || pb-pa || String(b.createdAt||"").localeCompare(String(a.createdAt||"")) || String(b.id).localeCompare(String(a.id));
    });
  }
  async function refresh(notice){
    if(state.refreshPromise) return state.refreshPromise;
    state.refreshPromise=(async()=>{
      const [catalog,pins]=await Promise.all([api("catalog"),api("pins/"+state.accountKey)]);
      state.records=Object.entries(catalog||{}).filter(([id,x])=>
        x && /^[\w-]{4,140}$/.test(id) && isCat(x.category) && validDataURL(x.thumb)
      ).map(([id,x])=>({...x,id}));
      state.pins=(pins && typeof pins==="object") ? pins : {};
      state.lastLoaded=Date.now();
      render();
      status(notice||"已同步共用照片庫："+state.records.length+" 張；★ 置頂只影響您自己的排序。");
    })();
    try{return await state.refreshPromise;}
    finally{state.refreshPromise=null;}
  }
  function button(txt,cls,fn){
    const el=create("button","photo-btn small "+(cls||""),txt);
    el.type="button";el.addEventListener("click",fn);
    return el;
  }
  function render(){
    for(const cat of Object.keys(CATEGORIES)){
      const n=state.records.filter(x=>x.category===cat).length;
      $("count-"+cat).textContent=n;
      $("section-count-"+cat).textContent=n+" 張";
    }
    $("count-all").textContent=state.records.length;
    document.querySelectorAll(".photo-tab[data-filter]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.filter===state.filter)));
    for(const cat of Object.keys(CATEGORIES)){
      const section=document.querySelector('[data-section="'+cat+'"]');
      section.hidden=!(state.filter==="all"||state.filter===cat);
      const grid=$("grid-"+cat);
      grid.replaceChildren();
      if(section.hidden)continue;
      const items=sorted(cat), ids=items.map(x=>x.id);
      if(items.length===0){
        const empty=create("div","photo-empty");
        empty.append(create("span","emoji",({news:"📰",cancer:"🎗️",receipt:"🧾"})[cat]));
        empty.append(document.createTextNode(state.query?"找不到符合搜尋條件的照片。":"目前沒有共用照片，歡迎上傳第一張。"));
        grid.append(empty);
        continue;
      }
      const fragment=document.createDocumentFragment();
      for(const p of items){
        const pinned=Boolean(state.pins[p.id]);
        const card=create("article","photo-card"+(pinned?" is-pinned":""));
        const thumb=create("div","photo-thumb-wrap");
        const open=create("button","photo-thumb-button");
        open.type="button";open.setAttribute("aria-label","放大查看 "+(p.title||p.fileName||"圖片"));
        const im=create("img");im.loading="lazy";im.alt=p.title||p.fileName||"照片";im.src=p.thumb;
        open.append(im);open.addEventListener("click",()=>openViewer(p.id,ids));thumb.append(open);
        if(pinned)thumb.append(create("span","photo-pin-flag","★ 我的最愛"));
        const body=create("div","photo-card-body");
        body.append(create("h3","photo-card-title",p.title||p.fileName||"未命名照片"));
        if(p.description)body.append(create("div","photo-card-note",p.description));
        body.append(create("div","photo-card-meta",safeDate(p.createdAt)));
        const tools=create("div","photo-card-actions");
        tools.append(button(pinned?"★ 取消置頂":"☆ 我的置頂",pinned?"pin-on":"",()=>togglePin(p.id)));
        // Content editing remains limited in UI to the uploader. Favorites are always personal.
        if(p.uploadedBy===state.accountKey){
          tools.append(button("編輯","",()=>openEditor(p.id)));
          tools.append(button("刪除","danger",()=>deletePhoto(p.id)));
        }
        card.append(thumb,body,tools);fragment.append(card);
      }
      grid.append(fragment);
    }
  }
  function openEditor(id=null){
    const p=id?state.records.find(x=>x.id===id):null;
    if(id&&(!p||p.uploadedBy!==state.accountKey))return;
    $("photoForm").reset();
    $("editPhotoId").value=p?.id||"";
    $("editorTitle").textContent=p?"編輯共用照片資料":"上傳共用照片";
    $("uploadFileField").hidden=!!p;
    $("photoCategory").value=p?.category||(state.filter==="all"?"news":state.filter);
    $("photoTitle").value=p?.title||"";
    $("photoDescription").value=p?.description||"";
    $("photoPinned").checked=Boolean(p&&state.pins[p.id]);
    $("savePhotos").textContent=p?"儲存修改":"上傳至共用照片庫";
    $("photoEditor").showModal();
  }
  function closeEditor(){$("photoEditor").close();}
  async function imageToDataURL(file,maxWidth,maxHeight,quality){
    const obj=URL.createObjectURL(file);
    try{
      const bitmap=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error("圖片解碼失敗："+file.name));
        img.src=obj;
      });
      const w=bitmap.naturalWidth,h=bitmap.naturalHeight;
      if(!w||!h)throw new Error("圖片沒有有效的尺寸");
      const sizeScale=Math.min(1,maxWidth/w,maxHeight/h,Math.sqrt(5500000/(w*h)));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(w*sizeScale));
      canvas.height=Math.max(1,Math.round(h*sizeScale));
      const ctx=canvas.getContext("2d",{alpha:false});
      ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return canvas.toDataURL("image/jpeg",quality);
    }finally{URL.revokeObjectURL(obj);}
  }
  async function prepareImage(file){
    if(!MIME_TYPES.has(file.type)||file.size<1||file.size>MAX_FILE){
      throw new Error("不支援的照片／檔案太大："+file.name+"（需 JPG、PNG、WebP、GIF 且不超過 20MB）");
    }
    const thumb=await imageToDataURL(file,430,430,.72);
    let image=await imageToDataURL(file,2200,3200,.86);
    // Realtime DB is not an object store. Keep individual images reasonably small.
    if(image.length>1150000)image=await imageToDataURL(file,1800,2700,.75);
    if(image.length>1450000)throw new Error(file.name+" 壓縮後仍超過共用資料庫單張限制，請先縮小圖片。");
    return {thumb,image};
  }
  async function uploadOne({file,category,title,description,pinned,id}){
    const image=await prepareImage(file);
    const uid=id||key();
    const now=new Date().toISOString();
    const record={
      category,title:limit(title||file.name||"未命名照片",120),
      description:limit(description,1500),fileName:limit(file.name,200),
      uploadedBy:state.accountKey,createdAt:now,updatedAt:now,thumb:image.thumb,
      size:file.size
    };
    // Save large image first, then publish in catalog. Catalog entries only show completed uploads.
    await api("images/"+uid,"PUT",{data:image.image});
    try{await api("catalog/"+uid,"PUT",record);}
    catch(err){await api("images/"+uid,"DELETE").catch(()=>{});throw err;}
    if(pinned)await api("pins/"+state.accountKey+"/"+uid,"PUT",Date.now());
    return uid;
  }
  async function saveEditor(e){
    e.preventDefault();
    if(state.busy)return;
    state.busy=true;$("savePhotos").disabled=true;
    const id=$("editPhotoId").value;
    const category=$("photoCategory").value;
    const title=limit($("photoTitle").value,120);
    const description=limit($("photoDescription").value,1500);
    const pinned=$("photoPinned").checked;
    try{
      if(!isCat(category))throw new Error("分類選擇無效");
      if(id){
        const record=state.records.find(x=>x.id===id);
        if(!record||record.uploadedBy!==state.accountKey)throw new Error("只能編輯自己上傳的照片");
        await api("catalog/"+id,"PATCH",{category,title:title||record.fileName,description,updatedAt:new Date().toISOString()});
        await setPin(id,pinned);
        closeEditor();await refresh("已更新共用照片資料，其他使用者重新載入後即可看見。");
      } else {
        const files=[...($("photoFiles").files||[])];
        if(files.length===0)throw new Error("請先選擇照片");
        if(files.length>MAX_BATCH)throw new Error("一次最多上傳 24 張");
        for(const file of files) if(!MIME_TYPES.has(file.type)||file.size<1||file.size>MAX_FILE)
          throw new Error("不支援的格式或大小："+file.name);
        let saved=0;
        for(const file of files){
          await uploadOne({file,category,title,description,pinned});
          saved++;
          status("已上傳 "+saved+"/"+files.length+" 張至共用照片庫…");
        }
        closeEditor();await refresh("成功將 "+saved+" 張照片上傳到共用照片庫。");
      }
    }catch(err){
      console.error(err);status("共用儲存失敗："+err.message,true);alert("照片儲存失敗："+err.message);
      await refresh().catch(()=>{});
    }finally{state.busy=false;$("savePhotos").disabled=false;}
  }
  async function setPin(id,on){
    if(on)await api("pins/"+state.accountKey+"/"+id,"PUT",Date.now());
    else await api("pins/"+state.accountKey+"/"+id,"DELETE");
  }
  async function togglePin(id){
    if(state.busy)return;
    state.busy=true;
    try{
      const active=Boolean(state.pins[id]);
      await setPin(id,!active);
      await refresh(active?"已取消我的置頂。":"★ 已設為我的最愛；其他使用者的排列不受影響。");
    }catch(err){status("個人置頂更新失敗："+err.message,true);}
    finally{state.busy=false;}
  }
  async function deletePhoto(id){
    const record=state.records.find(x=>x.id===id);
    if(!record||record.uploadedBy!==state.accountKey||state.busy)return;
    if(!confirm("確定刪除「"+(record.title||"這張照片")+"」？\n這是共用照片，刪除後所有使用者都看不到。"))return;
    state.busy=true;
    try{
      await api("catalog/"+id,"DELETE");
      await Promise.all([
        api("images/"+id,"DELETE").catch(()=>{}),
        api("pins/"+state.accountKey+"/"+id,"DELETE").catch(()=>{})
      ]);
      state.viewCache.delete(id);
      if($("photoViewer").open)$("photoViewer").close();
      await refresh("照片已從共用圖庫刪除。");
    }catch(err){status("共用刪除失敗："+err.message,true);}
    finally{state.busy=false;}
  }
  async function showViewer(){
    const id=state.viewIds[state.viewIndex];
    const rec=state.records.find(r=>r.id===id);
    if(!rec){$("photoViewer").close();return;}
    $("viewerImage").removeAttribute("src");
    $("viewerTitle").textContent=rec.title||rec.fileName||"圖片";
    $("viewerCaption").textContent=CATEGORIES[rec.category]+" · "+(state.viewIndex+1)+"/"+state.viewIds.length+(rec.description?"\n"+rec.description:"");
    $("viewerPrev").disabled=state.viewIndex===0;
    $("viewerNext").disabled=state.viewIndex>=state.viewIds.length-1;
    const expect=id;
    try{
      let img=state.viewCache.get(id);
      if(!img){
        const obj=await api("images/"+id);
        if(!validDataURL(obj?.data))throw new Error("找不到這張照片的放大圖片");
        img=obj.data;state.viewCache.set(id,img);
        if(state.viewCache.size>8)state.viewCache.delete(state.viewCache.keys().next().value);
      }
      if($("photoViewer").open&&state.viewIds[state.viewIndex]===expect)$("viewerImage").src=img;
    }catch(err){status("放大圖片載入失敗："+err.message,true);}
  }
  function openViewer(id,ids){
    state.viewIds=ids.slice();
    state.viewIndex=Math.max(0,ids.indexOf(id));
    if(!$("photoViewer").open)$("photoViewer").showModal();
    showViewer();
  }
  function moveViewer(step){
    state.viewIndex=Math.min(state.viewIds.length-1,Math.max(0,state.viewIndex+step));
    showViewer();
  }
  async function dataURLtoFile(url,name){
    if(!validDataURL(url))throw new Error("圖片備份格式不正確");
    const blob=await (await fetch(url)).blob();
    return new File([blob],name||"photo.jpg",{type:blob.type||"image/jpeg"});
  }
  async function exportBackup(){
    if(state.busy)return;
    if(!state.records.length){alert("目前沒有共用照片可以備份。");return;}
    if(state.records.length>220 && !confirm("共用照片很多，備份檔案可能很大，仍要繼續嗎？"))return;
    state.busy=true;$("exportPhotos").disabled=true;
    try{
      const records=[];
      for(const rec of state.records){
        const data=state.viewCache.get(rec.id)||(await api("images/"+rec.id))?.data;
        if(!validDataURL(data))continue;
        records.push({...rec,data,pinned:Boolean(state.pins[rec.id])});
        status("正在製作共用照片備份… "+records.length+"/"+state.records.length);
      }
      const payload={format:FORMAT2,exportedAt:new Date().toISOString(),photos:records};
      const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const link=create("a");link.href=url;link.download="國泰共用照片備份-"+new Date().toISOString().slice(0,10)+".json";
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      status("備份完成："+records.length+" 張照片。");
    }catch(err){status("備份失敗："+err.message,true);}
    finally{state.busy=false;$("exportPhotos").disabled=false;}
  }
  async function importBackup(file){
    if(!file||state.busy)return;
    if(file.size>180*1024*1024){alert("備份檔案超過 180MB，請分批處理。");return;}
    state.busy=true;$("importPhotos").disabled=true;
    try{
      const obj=JSON.parse(await file.text());
      if(![FORMAT1,FORMAT2].includes(obj?.format)||!Array.isArray(obj.photos)||obj.photos.length>250)
        throw new Error("請選擇支援的照片備份 JSON（最多 250 張）");
      if(!confirm("確定將備份照片上傳為所有人可見的共用圖片？\n本次最多 "+obj.photos.length+" 張。"))return;
      let saved=0,skipped=0;
      const existing=new Set(state.records.map(x=>x.id));
      for(const rec of obj.photos){
        if(!rec||!isCat(rec.category)||!validDataURL(rec.data)){skipped++;continue;}
        const sourceId=typeof rec.id==="string"&&/^[A-Za-z0-9_-]{4,140}$/.test(rec.id)?rec.id:null;
        if(sourceId&&existing.has(sourceId)){skipped++;continue;}
        const file=await dataURLtoFile(rec.data,limit(rec.fileName||"backup.jpg",200));
        const newId=await uploadOne({file,category:rec.category,title:rec.title,description:rec.description,pinned:!!rec.pinned,id:sourceId});
        existing.add(newId);
        saved++;status("正在匯入共用照片… "+saved+"/"+obj.photos.length);
      }
      await refresh("備份上傳完成："+saved+" 張；跳過 "+skipped+" 張。");
    }catch(err){console.error(err);status("備份匯入失敗："+err.message,true);alert(err.message);}
    finally{state.busy=false;$("importPhotos").disabled=false;$("backupInput").value="";}
  }
  function readLocalPhotos(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open("cathay-photo-library-v1-"+encodeURIComponent(ACCOUNT.slice(0,100)),1);
      req.onerror=()=>reject(req.error||new Error("無法讀取舊版照片庫"));
      req.onsuccess=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains("photos")){db.close();resolve([]);return;}
        const r=db.transaction("photos","readonly").objectStore("photos").getAll();
        r.onsuccess=()=>{const rows=r.result||[];db.close();resolve(rows.filter(x=>x.original instanceof Blob));};
        r.onerror=()=>{db.close();reject(r.error);};
      };
      req.onupgradeneeded=()=>{
        // Do not manufacture or delete local records. A new DB is empty.
      };
    });
  }
  async function migrateLocal(){
    if(state.busy)return;
    state.busy=true;$("migrateLocal").disabled=true;
    try{
      const local=await readLocalPhotos();
      if(!local.length){alert("目前這台裝置沒有舊版本機照片。");return;}
      if(!confirm("找到 "+local.length+" 張舊版照片，確定全部上傳到共用照片庫供其他人觀看？\n原本存在本機的照片會保留不刪除。"))return;
      let n=0,skipped=0;
      const existing=new Set(state.records.map(x=>x.id));
      for(const rec of local){
        if(!isCat(rec.category)||!(rec.original instanceof Blob))continue;
        const sourceId=typeof rec.id==="string"&&/^[A-Za-z0-9_-]{4,140}$/.test(rec.id)?rec.id:null;
        if(sourceId&&existing.has(sourceId)){skipped++;continue;}
        const file=new File([rec.original],rec.fileName||"local-photo.jpg",{type:rec.original.type||"image/jpeg"});
        const newId=await uploadOne({file,category:rec.category,title:rec.title,description:rec.description,pinned:!!rec.pinned,id:sourceId});
        existing.add(newId);
        n++;status("正在同步本機舊照片… "+n+"/"+local.length);
      }
      await refresh("成功搬移 "+n+" 張舊照片，略過 "+skipped+" 張已存在的照片；本機舊照片仍保留。");
    }catch(err){status("搬移舊照片失敗："+err.message,true);alert(err.message);}
    finally{state.busy=false;$("migrateLocal").disabled=false;}
  }
  async function init(){
    if(!ACCOUNT||!SESSION){
      status("請先登入網站再使用共用照片庫。",true);
      ["addPhoto","exportPhotos","importPhotos","migrateLocal","reloadPhotos"].forEach(id=>$(id).disabled=true);
      return;
    }
    try{
      state.accountKey=await userHash(ACCOUNT);
      await refresh();
    }catch(err){
      status("無法讀取共用照片："+err.message,true);
      $("addPhoto").disabled=true;
      $("importPhotos").disabled=true;
      $("exportPhotos").disabled=true;
      $("migrateLocal").disabled=true;
    }
  }
  $("addPhoto").addEventListener("click",()=>openEditor());
  $("closeEditor").addEventListener("click",closeEditor);
  $("cancelEditor").addEventListener("click",closeEditor);
  $("photoForm").addEventListener("submit",saveEditor);
  $("photoSearch").addEventListener("input",e=>{state.query=e.target.value.trim();render();});
  document.querySelectorAll(".photo-tab[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{state.filter=btn.dataset.filter;render();}));
  $("closeViewer").addEventListener("click",()=>$("photoViewer").close());
  $("viewerPrev").addEventListener("click",()=>moveViewer(-1));
  $("viewerNext").addEventListener("click",()=>moveViewer(1));
  $("photoViewer").addEventListener("keydown",e=>{
    if(e.key==="ArrowLeft"){e.preventDefault();moveViewer(-1);}
    else if(e.key==="ArrowRight"){e.preventDefault();moveViewer(1);}
  });
  $("exportPhotos").addEventListener("click",exportBackup);
  $("importPhotos").addEventListener("click",()=>$("backupInput").click());
  $("backupInput").addEventListener("change",e=>importBackup(e.target.files?.[0]));
  $("migrateLocal").addEventListener("click",migrateLocal);
  $("reloadPhotos").addEventListener("click",()=>refresh("共用照片庫已重新同步。").catch(e=>status("更新失敗："+e.message,true)));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&state.accountKey&&Date.now()-state.lastLoaded>30000)
      refresh().catch(e=>status("更新失敗："+e.message,true));
  });
  setInterval(()=>{
    if(!document.hidden&&state.accountKey&&!state.busy&&!$("photoEditor").open)
      refresh().catch(e=>status("共用照片更新失敗："+e.message,true));
  },60000);
  init();
})();
