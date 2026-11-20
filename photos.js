/* Cathay photo library v2.7 | Shared Firebase RTDB gallery, separate per-user favorites.
 * Static hosting + existing login code; RTDB permissions must be configured separately.
 * Large originals are retained in previous v1 local IndexedDB until manual migration.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  // The four built-in areas always exist. Additional categories are shared in Firebase.
  const CATEGORIES={news:"新聞剪報",cancer:"癌症議題",receipt:"醫療收據",aging:"老化議題"};
  const CATEGORY_META={
    news:{emoji:"📰",description:"新聞報導、政策資訊與重要剪報"},
    cancer:{emoji:"🎗️",description:"癌症治療、新療法、衛教與保障觀念"},
    receipt:{emoji:"🧾",description:"醫療費用與自費項目的圖片資料"},
    aging:{emoji:"🧓",description:"老化、高齡健康、失能與長期照顧"}
  };
  // Emoji icon library: grouped choices for health, medical, aging, news and education.
  // Stored as the selected emoji string in the existing Firebase categories/{id}/emoji field.
  const ICON_GROUPS=[
    {name:"常用分類",icons:[
      ["📁","資料夾"],["🗂️","分類"],["📚","學習"],["📖","閱讀"],
      ["📷","照片"],["🖼️","圖片"],["⭐","最愛"],["📌","重點"],
      ["🔖","標籤"],["🗃️","檔案"],["📝","筆記"],["🗓️","日曆"]
    ]},
    {name:"醫療健康",icons:[
      ["🏥","醫院"],["🩺","診療"],["⚕️","醫學"],["🚑","救護"],
      ["💊","藥物"],["💉","注射"],["🩹","傷口"],["🧪","檢驗"],
      ["🩸","血液"],["🧬","基因"],["🫀","心臟"],["🧠","大腦"],
      ["🦴","骨骼"],["🦷","牙科"],["🩻","X光"],["🌡️","體溫"]
    ]},
    {name:"癌症・老化・長照",icons:[
      ["🎗️","癌症"],["🧓","老化"],["👵","長者"],["👴","高齡"],
      ["🦽","輪椅"],["🦯","行動"],["🤝","照護"],["🛏️","病床"],
      ["❤️","愛心"],["💗","關懷"],["💪","復健"],["🌿","健康"],
      ["👨‍👩‍👧‍👦","家庭"],["🏡","居家"],["🌻","樂齡"],["🧘","養生"]
    ]},
    {name:"新聞・文書",icons:[
      ["📰","新聞"],["🗞️","剪報"],["📄","文件"],["📑","資料"],
      ["🧾","收據"],["📋","清單"],["📢","公告"],["🎥","影片"],
      ["📊","統計"],["📈","趨勢"],["📉","變動"],["🔍","調查"]
    ]},
    {name:"科技・研究",icons:[
      ["🔬","研究"],["🧫","實驗"],["🤖","科技"],["💻","電腦"],
      ["📱","數位"],["⚙️","工具"],["🔭","探索"],["💡","創新"],
      ["📡","資訊"],["🧮","數據"],["🖥️","系統"],["🔋","能源"]
    ]},
    {name:"保險・理財・生活",icons:[
      ["🛡️","保障"],["💼","業務"],["💰","理財"],["💵","金錢"],
      ["🏦","金融"],["💳","支付"],["⚖️","法律"],["✅","核對"],
      ["🏠","住宅"],["🚗","車險"],["🏆","獎項"],["🎓","教育"]
    ]}
  ];
  const BASE_CATEGORIES={...CATEGORIES};
  const BASE_META=Object.fromEntries(Object.entries(CATEGORY_META).map(([id,meta])=>[id,{...meta}]));
  const CUSTOM_KEY=/^custom_[A-Za-z0-9_-]{6,90}$/;
  const MIME_TYPES = new Set(["image/png","image/jpeg","image/webp","image/gif"]);
  const FIREBASE_BASE = "https://cathay-app-5889a-default-rtdb.firebaseio.com";
  const ROOT = FIREBASE_BASE + "/photoLibraryV2";
  const ACCOUNT = String(localStorage.getItem("currentUser")||"").trim();
  const SESSION = String(localStorage.getItem("currentSession")||"").trim();
  const MAX_FILE = 20 * 1024 * 1024;
  const MAX_BATCH = 24;
  const MAX_SELECTED = 200;
  const FORMAT1 = "cathay-photo-library-backup-v1";
  const FORMAT2 = "cathay-photo-library-shared-backup-v2";
  const state={records:[],pins:{},accountKey:"",filter:"all",query:"",busy:false,
    viewIds:[],viewIndex:0,viewCache:new Map(),lastLoaded:0,refreshPromise:null,categoryError:null,
    categoryOrder:[],categoryRecords:{},categorySignature:"",editingCategoryId:null,movingPhotoId:null,
    deleteRequests:{},batchMode:false,selectedIds:new Set(),bulkMoveIds:null};
  const isCat = x => Object.hasOwn(CATEGORIES,x);
  const limit = (s,n) => String(s||"").trim().slice(0,n);
  const safeDate = x => Number.isFinite(new Date(x).getTime()) ? new Date(x).toLocaleDateString("zh-TW") : "";
  const key = () => (crypto.randomUUID ? crypto.randomUUID() : "photo-"+Date.now()+"-"+Math.random().toString(36).slice(2));
  const qs = path => path ? ROOT+"/"+path+".json" : ROOT+".json";
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
    const help=$("photoConnectionHelp");
    if(help)help.hidden=!(error&&ACCOUNT&&SESSION);
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
  function mergeSharedCategories(raw){
    const records=raw&&typeof raw==="object"?raw:{};
    state.categoryRecords=records;
    // Restore original IDs and metadata, then apply any shared renames.
    for(const id of Object.keys(CATEGORIES)){
      if(!Object.hasOwn(BASE_CATEGORIES,id)){
        delete CATEGORIES[id];delete CATEGORY_META[id];
      }
    }
    for(const [id,name] of Object.entries(BASE_CATEGORIES)){
      CATEGORIES[id]=name;CATEGORY_META[id]={...BASE_META[id]};
      const item=records[id];
      if(item&&typeof item==="object"){
        if(typeof item.name==="string"&&item.name.trim())CATEGORIES[id]=limit(item.name,24);
        if(typeof item.emoji==="string"&&item.emoji.trim())CATEGORY_META[id].emoji=limit(item.emoji,12);
        if(typeof item.description==="string")CATEGORY_META[id].description=limit(item.description,120);
      }
    }
    const customs=Object.entries(records)
      .filter(([id,item])=>CUSTOM_KEY.test(id)&&item&&typeof item.name==="string"&&item.name.trim())
      .sort((a,b)=>String(a[1].createdAt||"").localeCompare(String(b[1].createdAt||"")));
    for(const [id,item] of customs.slice(0,95)){
      CATEGORIES[id]=limit(item.name,24);
      CATEGORY_META[id]={
        emoji:limit(item.emoji||"📁",12)||"📁",
        description:limit(item.description,120)||"自訂共用照片資料區"
      };
    }
    const initial=Object.keys(CATEGORIES);
    const rank=id=>{
      const rawOrder=records[id]?.order;
      return rawOrder!==undefined&&rawOrder!==null&&Number.isFinite(Number(rawOrder))
        ? Number(rawOrder):1000+initial.indexOf(id);
    };
    state.categoryOrder=[...initial].sort((a,b)=>
      rank(a)-rank(b)||initial.indexOf(a)-initial.indexOf(b));
  }
  function ensureCategoryUI(){
    const ids=state.categoryOrder.length?state.categoryOrder:Object.keys(CATEGORIES);
    const sig=JSON.stringify(ids.map(id=>[id,CATEGORIES[id],CATEGORY_META[id]?.emoji,CATEGORY_META[id]?.description]));
    if(sig===state.categorySignature)return;
    state.categorySignature=sig;
    const tabs=document.querySelector(".photo-tabs");
    const sections=$("gallerySections");
    const picker=$("photoCategory");
    const currentSelection=picker.value;
    for(const id of ids){
      const name=CATEGORIES[id];
      const meta=CATEGORY_META[id]||{emoji:"📁",description:"共用照片資料區"};
      let count=$("count-"+id);
      let tab=count?.closest("button");
      if(!tab){
        tab=create("button","photo-tab");
        tab.type="button";tab.dataset.filter=id;
        count=create("small");count.id="count-"+id;tab.append(document.createTextNode(""),count);
      }
      tab.firstChild.textContent=meta.emoji+" "+name+" ";
      tabs.append(tab);
      let section=document.querySelector('[data-section="'+id+'"]');
      if(!section){
        section=create("section","photo-category");
        section.dataset.section=id;section.setAttribute("aria-labelledby","title-"+id);
        const head=create("div","photo-category-head");
        const wrap=create("div");
        const title=create("h2");title.id="title-"+id;
        wrap.append(title,create("p"));
        const total=create("span","hub-pill");total.id="section-count-"+id;
        head.append(wrap,total);
        const grid=create("div","photo-gallery");grid.id="grid-"+id;
        section.append(head,grid);
      }
      section.querySelector('#title-'+id).textContent=meta.emoji+" "+name;
      const desc=section.querySelector(".photo-category-head p");
      if(desc)desc.textContent=meta.description||"共用照片資料區";
      sections.append(section);
      let option=Array.from(picker.options).find(o=>o.value===id);
      if(!option){option=create("option");option.value=id;}
      option.textContent=meta.emoji+" "+name;
      picker.append(option);
    }
    if(ids.includes(currentSelection))picker.value=currentSelection;
    if($("categoryManager")?.open)renderCategoryManager();
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
      let categoryError=null;
      const [catalog,pins,customCategories,deleteRequests]=await Promise.all([
        api("catalog"),
        api("pins/"+state.accountKey),
        api("categories").catch(error=>{categoryError=error;return null;}),
        api("deleteRequests").catch(()=>({}))
      ]);
      state.deleteRequests=deleteRequests||{};
      mergeSharedCategories(customCategories);
      // Don't lose a photo if its custom category metadata is temporarily unavailable.
      for(const photo of Object.values(catalog||{})){
        if(photo && CUSTOM_KEY.test(String(photo.category||"")) && !isCat(photo.category)){
          CATEGORIES[photo.category]="其他資料區";
          CATEGORY_META[photo.category]={emoji:"📁",description:"分類資訊尚未同步"};
          state.categoryOrder.push(photo.category);
        }
      }
      state.categoryError=categoryError;
      state.records=Object.entries(catalog||{}).filter(([id,x])=>
        x && /^[\w-]{4,140}$/.test(id) && isCat(x.category) && validDataURL(x.thumb)
      ).map(([id,x])=>({...x,id}));
      state.pins=(pins && typeof pins==="object") ? pins : {};
      // Retain checkmarks across sync/filter changes, but remove entries that were deleted.
      const currentIds=new Set(state.records.map(x=>x.id));
      for(const id of state.selectedIds)if(!currentIds.has(id))state.selectedIds.delete(id);
      state.lastLoaded=Date.now();
      render();
      ["addPhoto","importPhotos","exportPhotos","migrateLocal"].forEach(id=>$(id).disabled=false);
      $("createCategory").disabled=Boolean(categoryError);
      $("manageCategories").disabled=Boolean(categoryError);
      status((notice||"已同步共用照片庫："+state.records.length+" 張；★ 置頂只影響您自己的排序。")+
        (categoryError?" 自訂分類同步失敗："+categoryError.message:""),Boolean(categoryError));
    })();
    try{return await state.refreshPromise;}
    finally{state.refreshPromise=null;}
  }
  // An in-flight poll may contain data read before a write. Wait for it,
  // then force a new database fetch so moved photos do not appear in an old section.
  async function refreshAfterMutation(notice){
    if(state.refreshPromise){
      try{await state.refreshPromise;}catch(e){/* A fresh fetch follows even if the prior one failed. */}
    }
    return refresh(notice);
  }
  function button(txt,cls,fn){
    const el=create("button","photo-btn small "+(cls||""),txt);
    el.type="button";el.addEventListener("click",fn);
    return el;
  }
  function selectedRecords(){
    return state.records.filter(record=>state.selectedIds.has(record.id));
  }
  const pendingDeletion=id=>state.deleteRequests[id]?.status==="pending";
  function eligibleForDelete(){
    return selectedRecords().filter(photo=>photo.uploadedBy===state.accountKey&&!pendingDeletion(photo.id));
  }
  function updateBatchUI(){
    const total=state.selectedIds.size;
    const allowed=eligibleForDelete().length;
    const mode=$("batchModeToggle");
    mode.setAttribute("aria-pressed",String(state.batchMode));
    mode.textContent=state.batchMode?"✓ 結束多選":"☑ 多選照片";
    $("photoBatchToolbar").classList.toggle("is-active",state.batchMode);
    $("gallerySections").classList.toggle("photo-batch-active",state.batchMode);
    $("batchSelectedCount").textContent=state.batchMode
      ? "已選 "+total+" 張"+(total>0?"（其中 "+allowed+" 張可送審）":"")
      : "選取多張照片後可批次移動／刪除";
    $("batchSelectVisible").disabled=!state.batchMode||state.busy||state.records.length===0;
    $("batchClear").disabled=!state.batchMode||state.busy||total===0;
    $("batchMove").disabled=!state.batchMode||state.busy||total===0;
    $("batchDelete").disabled=!state.batchMode||state.busy||allowed===0;
    $("batchDelete").textContent=allowed?"🗑 批次刪除 "+allowed+" 張":"🗑 批次刪除";
    document.querySelectorAll(".photo-card[data-photo-id]").forEach(card=>{
      const checked=state.selectedIds.has(card.dataset.photoId);
      card.classList.toggle("is-selected",state.batchMode&&checked);
      const input=card.querySelector(".photo-batch-choice input");
      if(input)input.checked=checked;
    });
  }
  function toggleBatchMode(){
    if(state.busy)return;
    state.batchMode=!state.batchMode;
    if(!state.batchMode)state.selectedIds.clear();
    updateBatchUI();
  }
  function togglePhotoSelection(id){
    if(state.busy)return;
    if(!state.batchMode)state.batchMode=true;
    if(state.selectedIds.has(id))state.selectedIds.delete(id);
    else{
      if(state.selectedIds.size>=MAX_SELECTED){
        alert("一次最多選擇 "+MAX_SELECTED+" 張照片，請分批操作。");
        return;
      }
      if(!state.records.some(photo=>photo.id===id))return;
      state.selectedIds.add(id);
    }
    updateBatchUI();
  }
  function selectAllVisible(){
    if(state.busy||!state.batchMode)return;
    const cats=state.filter==="all"?state.categoryOrder:[state.filter];
    let added=0;
    for(const cat of cats){
      for(const photo of sorted(cat)){
        if(state.selectedIds.size>=MAX_SELECTED)break;
        if(!state.selectedIds.has(photo.id)){
          state.selectedIds.add(photo.id);added++;
        }
      }
    }
    updateBatchUI();
    if(state.selectedIds.size>=MAX_SELECTED)status("已達每次最多 "+MAX_SELECTED+" 張的選取上限，請分批移動或刪除。");
    else if(added===0)status("目前顯示的照片都已勾選。");
  }
  function clearBatchSelection(){
    if(state.busy)return;
    state.selectedIds.clear();
    updateBatchUI();
  }
  function render(){
    ensureCategoryUI();
    // Same thumb means separate uploaded records with identical preview images.
    // Do not hide them or delete anything without an explicit user confirmation.
    const copiesByThumb=new Map();
    for(const item of state.records){
      if(!copiesByThumb.has(item.thumb))copiesByThumb.set(item.thumb,[]);
      copiesByThumb.get(item.thumb).push(item);
    }
    for(const cat of state.categoryOrder){
      const n=state.records.filter(x=>x.category===cat).length;
      $("count-"+cat).textContent=n;
      $("section-count-"+cat).textContent=n+" 張";
    }
    $("count-all").textContent=state.records.length;
    document.querySelectorAll(".photo-tab[data-filter]").forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.filter===state.filter)));
    for(const cat of state.categoryOrder){
      const section=document.querySelector('[data-section="'+cat+'"]');
      section.hidden=!(state.filter==="all"||state.filter===cat);
      const grid=$("grid-"+cat);
      grid.replaceChildren();
      if(section.hidden)continue;
      const items=sorted(cat), ids=items.map(x=>x.id);
      if(items.length===0){
        const empty=create("div","photo-empty");
        empty.append(create("span","emoji",CATEGORY_META[cat]?.emoji||"📁"));
        empty.append(document.createTextNode(state.query?"找不到符合搜尋條件的照片。":"目前沒有共用照片，歡迎上傳第一張。"));
        grid.append(empty);
        continue;
      }
      const fragment=document.createDocumentFragment();
      for(const p of items){
        const pinned=Boolean(state.pins[p.id]);
        const card=create("article","photo-card"+(pinned?" is-pinned":""));
        card.dataset.photoId=p.id;
        const thumb=create("div","photo-thumb-wrap");
        const open=create("button","photo-thumb-button");
        open.type="button";open.setAttribute("aria-label","放大查看 "+(p.title||p.fileName||"圖片"));
        const im=create("img");im.loading="lazy";im.alt=p.title||p.fileName||"照片";im.src=p.thumb;
        open.append(im);
        open.addEventListener("click",()=>state.batchMode?togglePhotoSelection(p.id):openViewer(p.id,ids));
        thumb.append(open);
        const selectLabel=create("label","photo-batch-choice");
        const selectBox=create("input");
        selectBox.type="checkbox";
        selectBox.checked=state.selectedIds.has(p.id);
        selectBox.setAttribute("aria-label","選取照片："+(p.title||p.fileName||"未命名照片"));
        selectBox.addEventListener("change",()=>togglePhotoSelection(p.id));
        selectLabel.append(selectBox);thumb.append(selectLabel);
        if(pinned)thumb.append(create("span","photo-pin-flag","★ 我的最愛"));
        const body=create("div","photo-card-body");
        body.append(create("h3","photo-card-title",p.title||p.fileName||"未命名照片"));
        if(p.description)body.append(create("div","photo-card-note",p.description));
        body.append(create("div","photo-card-meta",safeDate(p.createdAt)));
        const tools=create("div","photo-card-actions");
        tools.append(button(pinned?"★ 取消置頂":"☆ 我的置頂",pinned?"pin-on":"",()=>togglePin(p.id)));
        tools.append(button("📂 移動","",()=>openMovePhoto(p.id)));
        // Content editing remains limited in UI to the uploader. Favorites are always personal.
        if(p.uploadedBy===state.accountKey){
          tools.append(button("編輯","",()=>openEditor(p.id)));
          const remove=button("刪除","danger",()=>deletePhoto(p.id));
          remove.disabled=pendingDeletion(p.id);
          tools.append(remove);
        }
        if(pendingDeletion(p.id))body.append(create("div","photo-card-meta","刪除待管理者審核"));
        card.append(thumb,body,tools);
        const copies=copiesByThumb.get(p.thumb)||[];
        if(copies.length>1){
          const duplicatesOwned=copies.filter(item=>item.id!==p.id&&item.uploadedBy===state.accountKey&&!pendingDeletion(item.id));
          const duplicateNote=create("div","photo-card-duplicate");
          duplicateNote.append(create("span",null,"⚠ 相同影像有 "+copies.length+" 筆上傳紀錄；移動其中一筆不會刪掉另一筆。"));
          if(p.uploadedBy===state.accountKey&&duplicatesOwned.length>0){
            duplicateNote.append(button("保留此張、整理重複","",()=>removeDuplicateCopies(p.id)));
          }
          card.append(duplicateNote);
        }
        fragment.append(card);
      }
      grid.append(fragment);
    }
    updateBatchUI();
  }
  function openMovePhoto(id){
    if(state.busy)return;
    const photo=state.records.find(p=>p.id===id);
    if(!photo)return;
    state.bulkMoveIds=null;
    state.movingPhotoId=id;
    $("movePhotoTitle").textContent="移動照片到其他資料區";
    $("saveMovePhoto").textContent="確定移動";
    $("movingPhotoName").textContent="照片："+(photo.title||photo.fileName||"未命名圖片");
    const picker=$("movePhotoCategory");
    picker.replaceChildren();
    for(const catId of state.categoryOrder){
      const item=create("option",null,(CATEGORY_META[catId]?.emoji||"📁")+" "+CATEGORIES[catId]);
      item.value=catId;picker.append(item);
    }
    picker.value=photo.category;
    $("saveMovePhoto").disabled=true;
    // Reset control state on every open, including repeat moves of the same photo.
    picker.onchange=()=>{$("saveMovePhoto").disabled=picker.value===photo.category;};
    $("movePhotoDialog").showModal();
  }
  function closeMovePhoto(){
    $("movePhotoDialog").close();
    state.movingPhotoId=null;
    state.bulkMoveIds=null;
  }
  function openBulkMove(){
    if(state.busy||!state.batchMode)return;
    const picked=selectedRecords();
    if(!picked.length)return;
    state.bulkMoveIds=picked.map(p=>p.id);
    state.movingPhotoId=null;
    $("movePhotoTitle").textContent="批次移動 "+picked.length+" 張照片";
    $("movingPhotoName").textContent="已選 "+picked.length+" 張，請選擇要一起移往的專區；已在目標專區的照片會保留原位。";
    const picker=$("movePhotoCategory");
    picker.replaceChildren();
    const placeholder=create("option",null,"請選擇目標專區");
    placeholder.value="";placeholder.disabled=true;picker.append(placeholder);
    for(const id of state.categoryOrder){
      const item=create("option",null,(CATEGORY_META[id]?.emoji||"📁")+" "+CATEGORIES[id]);
      item.value=id;picker.append(item);
    }
    picker.value="";
    $("saveMovePhoto").textContent="確定批次移動";
    $("saveMovePhoto").disabled=true;
    picker.onchange=()=>{$("saveMovePhoto").disabled=
      !isCat(picker.value)||!picked.some(p=>p.category!==picker.value);};
    $("movePhotoDialog").showModal();
  }
  async function saveBulkMove(){
    const destination=$("movePhotoCategory").value;
    if(state.busy||!isCat(destination))return;
    const moving=(state.bulkMoveIds||[])
      .map(id=>state.records.find(p=>p.id===id))
      .filter(p=>p&&p.category!==destination);
    if(!moving.length){
      status("已選照片都在該資料區，無需移動。");
      return;
    }
    state.busy=true;$("saveMovePhoto").disabled=true;
    updateBatchUI();
    let committed=false;
    try{
      const updates={},now=new Date().toISOString();
      for(const photo of moving){
        updates[photo.id+"/category"]=destination;
        updates[photo.id+"/updatedAt"]=now;
      }
      // One atomic RTDB PATCH: keep images and personal favorites unchanged.
      await api("catalog","PATCH",updates);
      committed=true;
      closeMovePhoto();
      state.selectedIds.clear();
      state.batchMode=false;
      state.filter=destination;
      await refreshAfterMutation("已批次移動 "+moving.length+" 張照片至「"+CATEGORIES[destination]+"」，其他使用者同步後也會看到。");
    }catch(error){
      status(committed?"照片已移動，但重新載入失敗："+error.message:"批次移動失敗，照片未變更："+error.message,true);
      alert(committed?"批次移動成功，但請重新同步確認。":"批次移動失敗："+error.message);
    }finally{state.busy=false;updateBatchUI();}
  }
  async function requestPhotoDeletion(records, label){
    if(state.busy||!records.length||!confirm(label+"\n\n照片會保留，直到管理者核准刪除。"))return;
    state.busy=true;updateBatchUI();
    const requests={};
    for(const photo of records){
      requests[photo.id]={status:"pending",requestId:key(),requestedAt:{".sv":"timestamp"},requestedBy:state.accountKey};
    }
    try{
      await api("deleteRequests","PATCH",requests);
      for(const photo of records)state.selectedIds.delete(photo.id);
      if(state.selectedIds.size===0)state.batchMode=false;
      Object.assign(state.deleteRequests,requests);
      render();
      await refreshAfterMutation("已送出 "+records.length+" 張照片的刪除申請，等待管理者審核。");
    }catch(error){
      status("刪除申請同步未完成："+error.message+"。請重新同步確認。",true);
    }finally{state.busy=false;updateBatchUI();}
  }
  async function deleteSelectedPhotos(){
    if(!state.batchMode)return;
    const eligible=eligibleForDelete();
    const skipped=selectedRecords().length-eligible.length;
    await requestPhotoDeletion(eligible,"確定申請刪除 "+eligible.length+" 張照片？"+
      (skipped?" 另外 "+skipped+" 張未列入申請。":""));
  }
  async function saveMovePhoto(event){
    event.preventDefault();
    if(state.busy)return;
    if(state.bulkMoveIds?.length)return saveBulkMove();
    const photo=state.records.find(p=>p.id===state.movingPhotoId);
    const destination=$("movePhotoCategory").value;
    if(!photo||!isCat(destination)||destination===photo.category)return;
    state.busy=true;$("saveMovePhoto").disabled=true;
    try{
      await api("catalog/"+photo.id,"PATCH",{category:destination,updatedAt:new Date().toISOString()});
      closeMovePhoto();
      await refreshAfterMutation("已將「"+(photo.title||photo.fileName||"照片")+"」移至「"+CATEGORIES[destination]+"」，所有使用者都會看到更新。");
      state.filter=destination;
      render();
    }catch(error){
      status("移動照片失敗："+error.message,true);
      alert("移動失敗："+error.message);
    }finally{state.busy=false;$("saveMovePhoto").disabled=false;}
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
  function renderCategoryManager(){
    const container=$("categoryManagerList");
    if(!container)return;
    container.replaceChildren();
    state.categoryOrder.forEach((id,index)=>{
      const row=create("div","photo-manage-row");
      const info=create("div","photo-manage-info");
      const name=create("strong",null,(CATEGORY_META[id]?.emoji||"📁")+" "+CATEGORIES[id]);
      const count=state.records.filter(photo=>photo.category===id).length;
      info.append(name,create("small",null,count+" 張照片 · 第 "+(index+1)+" 個專區"));
      const actions=create("div","photo-manage-actions");
      const up=button("↑ 上移","",()=>moveCategory(id,-1));
      up.disabled=index===0||state.busy||Boolean(state.categoryError);
      const down=button("↓ 下移","",()=>moveCategory(id,1));
      down.disabled=index===state.categoryOrder.length-1||state.busy||Boolean(state.categoryError);
      const edit=button("✎ 改名","",()=>openCategoryEditor(id));
      edit.disabled=state.busy||Boolean(state.categoryError);
      actions.append(up,down,edit);
      row.append(info,actions);
      container.append(row);
    });
  }
  function openCategoryManager(){
    if(state.busy||state.categoryError)return;
    renderCategoryManager();
    $("categoryManager").showModal();
  }
  async function moveCategory(id,direction){
    if(state.busy||state.categoryError)return;
    const current=state.categoryOrder.indexOf(id);
    const target=current+direction;
    if(current<0||target<0||target>=state.categoryOrder.length)return;
    state.busy=true;
    try{
      const next=[...state.categoryOrder];
      [next[current],next[target]]=[next[target],next[current]];
      const patch={};
      next.forEach((key,index)=>{patch[key+"/order"]=index;});
      // Firebase supports atomic multi-path PATCH updates; preserve names and metadata.
      await api("categories","PATCH",patch);
      await refreshAfterMutation("已更新全部使用者的專區排列順序。");
      renderCategoryManager();
    }catch(error){
      status("儲存專區排序失敗："+error.message,true);
      alert("排序儲存失敗："+error.message);
      renderCategoryManager();
    }finally{
      state.busy=false;
      renderCategoryManager();
    }
  }
  function syncIconPreview(){
    const selected=limit($("categoryIcon").value,12)||"📁";
    $("categoryIconPreview").textContent=selected;
    const named=ICON_GROUPS.flatMap(group=>group.icons).find(([icon])=>icon===selected);
    $("categoryIconPreviewName").textContent=named?named[1]:"自訂圖示";
    document.querySelectorAll('#categoryIconChoices button[data-icon]').forEach(btn=>{
      btn.setAttribute("aria-pressed",String(btn.dataset.icon===selected));
    });
  }
  function renderIconPicker(){
    const search=limit($("categoryIconSearch").value,60).toLocaleLowerCase("zh-TW");
    const root=$("categoryIconChoices");
    root.replaceChildren();
    let found=0;
    for(const group of ICON_GROUPS){
      const groupMatch=group.name.toLocaleLowerCase("zh-TW").includes(search);
      const matching=group.icons.filter(([icon,name])=>!search||groupMatch||
        name.toLocaleLowerCase("zh-TW").includes(search)||icon.includes(search));
      if(!matching.length)continue;
      const section=create("section","photo-icon-group");
      const header=create("h3",null,group.name);section.append(header);
      const grid=create("div","photo-icon-grid");
      for(const [icon,name] of matching){
        const b=create("button","photo-icon-choice");b.type="button";b.dataset.icon=icon;
        b.setAttribute("aria-label","選擇"+name+"圖示");
        b.setAttribute("aria-pressed","false");
        b.append(create("span","photo-icon-glyph",icon),create("span","photo-icon-name",name));
        b.addEventListener("click",()=>{
          $("categoryIcon").value=icon;
          syncIconPreview();
        });
        grid.append(b);found++;
      }
      section.append(grid);root.append(section);
    }
    if(!found)root.append(create("div","photo-icon-empty","沒有找到符合的圖示；您仍可在上方自行輸入 Emoji。"));
    syncIconPreview();
  }
  function openCategoryEditor(id=null){
    if(state.busy||state.categoryError)return;
    const editId=(typeof id==="string"&&isCat(id))?id:null;
    state.editingCategoryId=editId;
    $("categoryForm").reset();
    $("categoryIconSearch").value="";
    $("categoryEditId").value=editId||"";
    $("categoryEditorTitle").textContent=editId?"修改共用資料區":"新增共用資料區";
    $("saveCategory").textContent=editId?"儲存資料區名稱":"建立共用資料區";
    if(editId){
      $("categoryName").value=CATEGORIES[editId];
      $("categoryIcon").value=CATEGORY_META[editId]?.emoji||"📁";
      $("categoryDescription").value=CATEGORY_META[editId]?.description||"";
    }
    renderIconPicker();
    $("categoryEditor").showModal();
    $("categoryName").focus();
  }
  async function saveCategory(e){
    e.preventDefault();
    if(state.busy)return;
    const name=limit($("categoryName").value,24);
    const emoji=limit($("categoryIcon").value,12)||"📁";
    const description=limit($("categoryDescription").value,120);
    const id=$("categoryEditId").value||null;
    if(!name){alert("請填入資料區名稱");return;}
    if(id&&!isCat(id)){alert("找不到要修改的資料區，請重新整理後重試。");return;}
    if(Object.entries(CATEGORIES).some(([key,value])=>key!==id&&value.toLocaleLowerCase()===name.toLocaleLowerCase())){
      alert("同名資料區已存在，請選用其他名稱。");return;
    }
    if(!id&&Object.keys(CATEGORIES).length>=100){alert("目前最多可建立 100 個資料區。");return;}
    state.busy=true;$("saveCategory").disabled=true;
    try{
      if(id){
        await api("categories/"+id,"PATCH",{name,emoji,description,updatedAt:new Date().toISOString()});
      }else{
        const newId="custom_"+key().replace(/[^A-Za-z0-9_-]/g,"").slice(0,55);
        await api("categories/"+newId,"PUT",{
          name,emoji,description,createdAt:new Date().toISOString(),createdBy:state.accountKey
        });
      }
      $("categoryEditor").close();
      await refreshAfterMutation(id?"已將專區改名為「"+name+"」，照片會保留在原專區。":"已建立共用資料區「"+name+"」。");
    }catch(error){
      status((id?"修改":"新增")+"資料區失敗："+error.message,true);
      alert((id?"修改":"建立")+"共用資料區失敗："+error.message);
    }finally{
      state.busy=false;$("saveCategory").disabled=false;
      if($("categoryManager").open)renderCategoryManager();
    }
  }
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
    const uid=id&&state.deleteRequests[id]?.status!=="approved"?id:key();
    const now=new Date().toISOString();
    const record={
      category,title:limit(title||file.name||"未命名照片",120),
      description:limit(description,1500),fileName:limit(file.name,200),
      uploadedBy:state.accountKey,createdAt:now,updatedAt:now,thumb:image.thumb,
      size:file.size
    };
    await api("","PATCH",{["images/"+uid]:{data:image.image},["catalog/"+uid]:record});
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
        closeEditor();await refreshAfterMutation("已更新共用照片資料，其他使用者重新載入後即可看見。");
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
        closeEditor();await refreshAfterMutation("成功將 "+saved+" 張照片上傳到共用照片庫。");
      }
    }catch(err){
      console.error(err);
      await refresh().catch(()=>{});
      status("共用儲存失敗："+err.message,true);
      alert("照片儲存失敗："+err.message);
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
      await refreshAfterMutation(active?"已取消我的置頂。":"★ 已設為我的最愛；其他使用者的排列不受影響。");
    }catch(err){status("個人置頂更新失敗："+err.message,true);}
    finally{state.busy=false;}
  }
  async function removeDuplicateCopies(keepId){
    if(state.busy)return;
    const keeper=state.records.find(p=>p.id===keepId);
    if(!keeper||keeper.uploadedBy!==state.accountKey)return;
    const removable=state.records.filter(p=>p.thumb===keeper.thumb&&p.id!==keepId&&
      p.uploadedBy===state.accountKey&&!pendingDeletion(p.id));
    await requestPhotoDeletion(removable,"保留「"+(keeper.title||keeper.fileName||"這張照片")+"」，並申請刪除 "+removable.length+" 筆重複上傳紀錄？");
  }
  async function deletePhoto(id){
    const record=state.records.find(x=>x.id===id);
    if(!record||record.uploadedBy!==state.accountKey||pendingDeletion(id))return;
    await requestPhotoDeletion([record],"確定申請刪除「"+(record.title||"這張照片")+"」？");
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
        if(sourceId)existing.add(sourceId);
        saved++;status("正在匯入共用照片… "+saved+"/"+obj.photos.length);
      }
      await refreshAfterMutation("備份上傳完成："+saved+" 張；跳過 "+skipped+" 張。");
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
        existing.add(rec.id);
        n++;status("正在同步本機舊照片… "+n+"/"+local.length);
      }
      await refreshAfterMutation("成功搬移 "+n+" 張舊照片，略過 "+skipped+" 張已存在的照片；本機舊照片仍保留。");
    }catch(err){status("搬移舊照片失敗："+err.message,true);alert(err.message);}
    finally{state.busy=false;$("migrateLocal").disabled=false;}
  }
  async function init(){
    if(!ACCOUNT||!SESSION){
      status("請先登入網站再使用共用照片庫。",true);
      ["addPhoto","createCategory","manageCategories","exportPhotos","importPhotos","migrateLocal","reloadPhotos"].forEach(id=>$(id).disabled=true);
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
      $("createCategory").disabled=true;
      $("manageCategories").disabled=true;
    }
  }
  $("createCategory").addEventListener("click",()=>openCategoryEditor());
  $("manageCategories").addEventListener("click",openCategoryManager);
  $("closeCategoryManager").addEventListener("click",()=>$("categoryManager").close());
  $("doneCategoryManager").addEventListener("click",()=>$("categoryManager").close());
  $("closeCategoryEditor").addEventListener("click",()=>$("categoryEditor").close());
  $("cancelCategoryEditor").addEventListener("click",()=>$("categoryEditor").close());
  $("categoryForm").addEventListener("submit",saveCategory);
  $("categoryIconSearch").addEventListener("input",renderIconPicker);
  $("categoryIcon").addEventListener("input",syncIconPreview);
  $("closeMovePhoto").addEventListener("click",closeMovePhoto);
  $("cancelMovePhoto").addEventListener("click",closeMovePhoto);
  $("movePhotoForm").addEventListener("submit",saveMovePhoto);
  $("batchModeToggle").addEventListener("click",toggleBatchMode);
  $("batchSelectVisible").addEventListener("click",selectAllVisible);
  $("batchClear").addEventListener("click",clearBatchSelection);
  $("batchMove").addEventListener("click",openBulkMove);
  $("batchDelete").addEventListener("click",deleteSelectedPhotos);
  $("addPhoto").addEventListener("click",()=>openEditor());
  $("closeEditor").addEventListener("click",closeEditor);
  $("cancelEditor").addEventListener("click",closeEditor);
  $("photoForm").addEventListener("submit",saveEditor);
  $("photoSearch").addEventListener("input",e=>{state.query=e.target.value.trim();render();});
  document.querySelector(".photo-tabs").addEventListener("click",event=>{
    const button=event.target.closest("button[data-filter]");
    if(!button||!document.querySelector(".photo-tabs").contains(button))return;
    if(button.dataset.filter!=="all"&&!isCat(button.dataset.filter))return;
    state.filter=button.dataset.filter;render();
  });
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
  $("reloadPhotos").addEventListener("click",async()=>{
    const btn=$("reloadPhotos");
    if(btn.disabled)return;
    btn.disabled=true;
    status("正在重新檢查 Firebase 共用照片庫連線…");
    try{
      await init(); // 包含重新取得帳號識別及檢查讀取權限；成功後解鎖上傳功能
    }finally{
      if(ACCOUNT&&SESSION)btn.disabled=false;
    }
  });
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
