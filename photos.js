/* 國泰雲端學習站 · 照片資料專區 v1.0
 * 本機 IndexedDB 照片庫。不能代替具備身份驗證/存取規則的雲端儲存。
 */
(() => {
  "use strict";
  const TYPES = new Set(["image/jpeg","image/png","image/webp","image/gif"]);
  const CATEGORIES = {news:"新聞剪報",cancer:"癌症議題",receipt:"醫療收據"};
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_FILES_BATCH = 30;
  const BACKUP_FORMAT = "cathay-photo-library-backup-v1";
  const account = (localStorage.getItem("currentUser") || "").trim().slice(0,100);
  const session = localStorage.getItem("currentSession");
  const $ = id => document.getElementById(id);
  const state = {
    db:null,items:[],filter:"all",query:"",editingId:null,busy:false,
    urls:[],viewerUrl:null,viewIds:[],viewIndex:0
  };

  function setStatus(message,error=false) {
    $("galleryStatus").textContent = message;
    $("galleryStatus").classList.toggle("error",Boolean(error));
  }
  function newId(){
    if (self.crypto && typeof self.crypto.randomUUID === "function") return self.crypto.randomUUID();
    return "photo-"+Date.now()+"-"+Math.random().toString(36).slice(2);
  }
  function isCategory(category){return Object.prototype.hasOwnProperty.call(CATEGORIES,category);}
  function dbRequest(request) {
    return new Promise((resolve,reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("資料庫請求失敗"));
    });
  }
  function openDB() {
    return new Promise((resolve,reject) => {
      if (!("indexedDB" in window)) { reject(new Error("目前瀏覽器不支援本機照片儲存"));return; }
      const request = indexedDB.open("cathay-photo-library-v1-"+encodeURIComponent(account),1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("photos")) {
          const store = db.createObjectStore("photos",{keyPath:"id"});
          store.createIndex("category","category",{unique:false});
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error("無法開啟本機資料庫"));
      request.onblocked = () => reject(new Error("請關閉其他開啟照片專區的分頁再重新整理"));
    });
  }
  async function loadRecords(){
    const records = await dbRequest(state.db.transaction("photos","readonly").objectStore("photos").getAll());
    state.items = records.filter(rec => rec && isCategory(rec.category) && rec.original instanceof Blob);
  }
  async function writeRecord(record) {
    await dbRequest(state.db.transaction("photos","readwrite").objectStore("photos").put(record));
  }
  async function removeRecord(id) {
    await dbRequest(state.db.transaction("photos","readwrite").objectStore("photos").delete(id));
  }
  function clearThumbUrls(){
    for (const url of state.urls) URL.revokeObjectURL(url);
    state.urls = [];
  }
  function fileDate(iso){
    const dt = new Date(iso);
    return Number.isFinite(dt.getTime()) ? dt.toLocaleDateString("zh-TW") : "";
  }
  function sortItems(items){
    return [...items].sort((a,b)=>
      Number(Boolean(b.pinned))-Number(Boolean(a.pinned))
      || (b.pinned ? String(b.pinnedAt||"").localeCompare(String(a.pinnedAt||"")) : 0)
      || String(b.createdAt||"").localeCompare(String(a.createdAt||""))
      || String(a.id).localeCompare(String(b.id))
    );
  }
  function visibleInCategory(category) {
    const query = state.query.toLowerCase();
    return sortItems(state.items.filter(item=>
      item.category===category && (
        !query || [item.title,item.description,item.fileName].some(v=>String(v||"").toLowerCase().includes(query))
      )
    ));
  }
  function el(tag,cls,text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function actionButton(text,cls,fn,aria) {
    const btn=el("button","photo-btn small "+(cls||""),text);
    btn.type="button";
    if (aria) btn.setAttribute("aria-label",aria);
    btn.addEventListener("click",fn);
    return btn;
  }
  function renderCard(item,viewIds) {
    const card=el("article","photo-card"+(item.pinned?" is-pinned":""));
    const thumb=el("div","photo-thumb-wrap");
    const open=el("button","photo-thumb-button");
    open.type="button";
    open.setAttribute("aria-label","放大查看："+(item.title||item.fileName||"圖片"));
    const img=el("img");
    img.alt=item.title||item.fileName||"圖片";
    img.loading="lazy";
    const url=URL.createObjectURL(item.thumb instanceof Blob?item.thumb:item.original);
    state.urls.push(url);
    img.src=url;
    open.appendChild(img);
    open.addEventListener("click",()=>openViewer(item.id,viewIds));
    thumb.appendChild(open);
    if (item.pinned) thumb.appendChild(el("span","photo-pin-flag","★ 最愛置頂"));
    const body=el("div","photo-card-body");
    body.appendChild(el("h3","photo-card-title",item.title||item.fileName||"未命名照片"));
    if(item.description)body.appendChild(el("div","photo-card-note",item.description));
    body.appendChild(el("div","photo-card-meta",fileDate(item.createdAt)));
    const actions=el("div","photo-card-actions");
    actions.appendChild(actionButton(item.pinned?"★ 取消置頂":"☆ 最愛置頂",item.pinned?"pin-on":"",()=>togglePinned(item.id),"切換最愛置頂："+(item.title||item.fileName)));
    actions.appendChild(actionButton("編輯","",()=>openEditor(item.id),"編輯照片："+(item.title||item.fileName)));
    actions.appendChild(actionButton("刪除","danger",()=>deletePhoto(item.id),"刪除照片："+(item.title||item.fileName)));
    card.append(thumb,body,actions);
    return card;
  }
  function render(){
    clearThumbUrls();
    const countBy = key => state.items.filter(x=>x.category===key).length;
    for(const key of Object.keys(CATEGORIES)){
      $("count-"+key).textContent=String(countBy(key));
      $("section-count-"+key).textContent=countBy(key)+" 張";
    }
    $("count-all").textContent=String(state.items.length);
    document.querySelectorAll(".photo-tab[data-filter]").forEach(btn=>{
      btn.setAttribute("aria-pressed",String(btn.dataset.filter===state.filter));
    });
    for(const key of Object.keys(CATEGORIES)){
      const section=document.querySelector('[data-section="'+key+'"]');
      section.hidden=state.filter!=="all" && state.filter!==key;
      const grid=$("grid-"+key);
      grid.replaceChildren();
      if(section.hidden) continue;
      const visible=visibleInCategory(key);
      if(!visible.length){
        const empty=el("div","photo-empty");
        empty.appendChild(el("span","emoji",({news:"📰",cancer:"🎗️",receipt:"🧾"})[key]));
        empty.appendChild(document.createTextNode(state.query?"找不到符合搜尋條件的照片。":"此分類尚無照片，點選上方「上傳照片」開始收藏。"));
        grid.appendChild(empty);
      } else {
        const viewIds=visible.map(x=>x.id);
        const fragment=document.createDocumentFragment();
        for(const item of visible)fragment.appendChild(renderCard(item,viewIds));
        grid.appendChild(fragment);
      }
    }
  }
  async function refresh(message){
    await loadRecords();
    render();
    if(message)setStatus(message);
    else setStatus("本機照片庫已開啟，共 "+state.items.length+" 張照片；最愛照片自動排在各分類最上方。");
  }
  function openEditor(id=null){
    const record=id?state.items.find(x=>x.id===id):null;
    if(id&&!record)return;
    state.editingId=record?.id||null;
    $("photoForm").reset();
    $("editorTitle").textContent=record?"編輯照片資料":"上傳照片";
    $("uploadFileField").hidden=Boolean(record);
    $("editPhotoId").value=record?.id||"";
    $("photoCategory").value=record?.category||(state.filter==="all"?"news":state.filter);
    $("photoTitle").value=record?.title||"";
    $("photoDescription").value=record?.description||"";
    $("photoPinned").checked=Boolean(record?.pinned);
    $("savePhotos").textContent=record?"儲存修改":"儲存照片";
    $("photoEditor").showModal();
  }
  function closeEditor(){ $("photoEditor").close(); }
  async function makeThumbnail(blob){
    return new Promise((resolve)=>{
      const sourceURL=URL.createObjectURL(blob);
      const img=new Image();
      let resolved=false;
      const done=(result)=>{
        if(resolved)return;
        resolved=true;
        URL.revokeObjectURL(sourceURL);
        resolve(result||blob);
      };
      img.onload=()=>{
        try {
          const scale=Math.min(1,560/Math.max(img.naturalWidth,img.naturalHeight));
          const canvas=document.createElement("canvas");
          canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
          canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
          canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
          canvas.toBlob(b=>done(b),"image/jpeg",.77);
        }catch(e){done(blob);}
      };
      img.onerror=()=>done(blob);
      img.src=sourceURL;
    });
  }
  async function savePhotoForm(event){
    event.preventDefault();
    if(state.busy)return;
    state.busy=true;
    $("savePhotos").disabled=true;
    const category=$("photoCategory").value;
    const title=$("photoTitle").value.trim().slice(0,120);
    const description=$("photoDescription").value.trim().slice(0,1500);
    const pinned=$("photoPinned").checked;
    try{
      if(!isCategory(category))throw new Error("請選擇正確分類");
      const now=new Date().toISOString();
      if(state.editingId){
        const record=state.items.find(x=>x.id===state.editingId);
        if(!record)throw new Error("找不到要編輯的照片");
        await writeRecord({...record,category,title:title||record.fileName,description,pinned,
          pinnedAt:pinned?(record.pinnedAt||now):null,updatedAt:now});
        closeEditor();
        await refresh("照片資料已更新。");
      }else{
        const files=Array.from($("photoFiles").files||[]);
        if(!files.length)throw new Error("請先選擇至少一張照片");
        if(files.length>MAX_FILES_BATCH)throw new Error("一次最多上傳 30 張，請分批選擇");
        for(const file of files){
          if(!TYPES.has(file.type))throw new Error("不支援的格式："+file.name+"（僅 JPG、PNG、WebP、GIF）");
          if(file.size===0||file.size>MAX_FILE_BYTES)throw new Error(file.name+" 檔案超過 20 MB 或為空檔");
        }
        let saved=0;
        for(const file of files){
          const thumb=await makeThumbnail(file);
          const record={
            id:newId(),category,title:title||(file.name||"未命名照片"),
            description,fileName:file.name||"",mime:file.type,size:file.size,
            pinned,pinnedAt:pinned?now:null,createdAt:new Date().toISOString(),updatedAt:now,
            original:file,thumb
          };
          await writeRecord(record);
          saved++;
          setStatus("正在儲存照片… "+saved+"／"+files.length);
        }
        closeEditor();
        await refresh("成功儲存 "+saved+" 張照片，已放入「"+CATEGORIES[category]+"」。");
      }
    }catch(err){
      console.error(err);
      setStatus("操作失敗："+(err?.message||String(err)),true);
      alert("無法儲存照片："+(err?.message||"請檢查瀏覽器儲存容量"));
      try{await loadRecords();render();}catch(e){}
    }finally{
      state.busy=false;
      $("savePhotos").disabled=false;
    }
  }
  async function togglePinned(id){
    const record=state.items.find(x=>x.id===id);
    if(!record||state.busy)return;
    try{
      const isPinned=!record.pinned;
      const now=new Date().toISOString();
      await writeRecord({...record,pinned:isPinned,pinnedAt:isPinned?now:null,updatedAt:now});
      await refresh(isPinned?"★ 已設為最愛，並移到「"+CATEGORIES[record.category]+"」最上方。":"已取消最愛置頂。");
    }catch(err){setStatus("置頂更新失敗："+err.message,true);}
  }
  async function deletePhoto(id){
    const record=state.items.find(x=>x.id===id);
    if(!record||state.busy)return;
    if(!confirm("確定永久刪除「"+(record.title||record.fileName)+"」？刪除後無法復原（除非有備份）。"))return;
    try{
      await removeRecord(id);
      if($("photoViewer").open)closeViewer();
      await refresh("已刪除照片。");
    }catch(err){setStatus("刪除失敗："+err.message,true);}
  }
  function releaseViewerUrl(){
    if(state.viewerUrl){URL.revokeObjectURL(state.viewerUrl);state.viewerUrl=null;}
    $("viewerImage").removeAttribute("src");
  }
  function showViewer(){
    const record=state.items.find(x=>x.id===state.viewIds[state.viewIndex]);
    if(!record){closeViewer();return;}
    releaseViewerUrl();
    state.viewerUrl=URL.createObjectURL(record.original);
    $("viewerImage").src=state.viewerUrl;
    $("viewerImage").alt=record.title||record.fileName||"圖片";
    $("viewerTitle").textContent=record.title||record.fileName||"圖片";
    $("viewerCaption").textContent=CATEGORIES[record.category]+" · "+(state.viewIndex+1)+"/"+state.viewIds.length+
      (record.description?"\n"+record.description:"");
    $("viewerPrev").disabled=state.viewIndex===0;
    $("viewerNext").disabled=state.viewIndex===state.viewIds.length-1;
  }
  function openViewer(id,ids){
    const index=ids.indexOf(id);
    if(index<0)return;
    state.viewIds=ids.slice();
    state.viewIndex=index;
    if(!$("photoViewer").open)$("photoViewer").showModal();
    showViewer();
  }
  function stepViewer(direction){
    state.viewIndex=Math.max(0,Math.min(state.viewIds.length-1,state.viewIndex+direction));
    showViewer();
  }
  function closeViewer(){
    $("photoViewer").close();
    releaseViewerUrl();
  }
  function readAsDataURL(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(reader.error||new Error("讀取圖片失敗"));
      reader.readAsDataURL(blob);
    });
  }
  async function exportBackup(){
    if(state.busy)return;
    if(!state.items.length){alert("尚無照片可以備份。");return;}
    const bytes=state.items.reduce((sum,rec)=>sum+(rec.original?.size||0),0);
    if(bytes>70*1024*1024&&!confirm("照片原檔約 "+Math.round(bytes/1024/1024)+" MB，備份 JSON 可能很大，確定匯出？"))return;
    state.busy=true;
    $("exportPhotos").disabled=true;
    try{
      const records=[];
      for(let i=0;i<state.items.length;i++){
        const {original,thumb,...meta}=state.items[i];
        records.push({...meta,data:await readAsDataURL(original)});
        setStatus("正在製作備份… "+(i+1)+"／"+state.items.length);
      }
      const payload={format:BACKUP_FORMAT,exportedAt:new Date().toISOString(),photos:records};
      const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;link.download="國泰照片專區備份-"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      setStatus("已製作含 "+records.length+" 張照片的備份。備份檔包含原始圖片，請妥善保護。");
    }catch(err){console.error(err);setStatus("匯出備份失敗："+err.message,true);}
    finally{state.busy=false;$("exportPhotos").disabled=false;}
  }
  async function importBackup(file){
    if(!file||state.busy)return;
    if(file.size>220*1024*1024){alert("備份超過 220 MB，請分批匯入。");return;}
    state.busy=true;
    $("importPhotos").disabled=true;
    try{
      const json=JSON.parse(await file.text());
      if(json.format!==BACKUP_FORMAT||!Array.isArray(json.photos))throw new Error("不是支援的照片資料庫備份格式");
      if(json.photos.length>400)throw new Error("單次最多匯入 400 張");
      if(!confirm("這份備份包含 "+json.photos.length+" 張照片。\n將以照片 ID 跳過目前已有的照片，確定匯入到此瀏覽器？"))return;
      const existing=new Set(state.items.map(x=>x.id));
      let saved=0,skipped=0;
      for(const entry of json.photos){
        if(!entry||typeof entry.id!=="string"||entry.id.length>140||!isCategory(entry.category)||typeof entry.data!=="string"){
          skipped++;continue;
        }
        if(existing.has(entry.id)){skipped++;continue;}
        const m=/^data:(image\/(?:jpeg|png|webp|gif));base64,/.exec(entry.data);
        if(!m){skipped++;continue;}
        const raw=await (await fetch(entry.data)).blob();
        if(raw.size===0||raw.size>MAX_FILE_BYTES){skipped++;continue;}
        const thumb=await makeThumbnail(raw);
        await writeRecord({
          id:entry.id,category:entry.category,
          title:String(entry.title||entry.fileName||"未命名照片").slice(0,120),
          description:String(entry.description||"").slice(0,1500),
          fileName:String(entry.fileName||"").slice(0,200),
          mime:m[1],size:raw.size,
          pinned:Boolean(entry.pinned),
          pinnedAt:entry.pinned?String(entry.pinnedAt||entry.createdAt||new Date().toISOString()):null,
          createdAt:String(entry.createdAt||new Date().toISOString()),
          updatedAt:String(entry.updatedAt||new Date().toISOString()),
          original:raw,thumb
        });
        existing.add(entry.id);
        saved++;
        setStatus("正在匯入備份… "+saved+" 張");
      }
      await refresh("已匯入 "+saved+" 張照片；略過 "+skipped+" 張（重複或格式不符）。");
    }catch(err){console.error(err);setStatus("匯入備份失敗："+err.message,true);alert("備份匯入失敗："+err.message);}
    finally{state.busy=false;$("importPhotos").disabled=false;$("backupInput").value="";}
  }
  async function init(){
    if(!account||!session){
      setStatus("請先完成本站登入後再使用照片資料專區。",true);
      $("addPhoto").disabled=true;
      $("importPhotos").disabled=true;
      $("exportPhotos").disabled=true;
      return;
    }
    try{
      state.db=await openDB();
      await refresh();
    }catch(err){
      setStatus("無法開啟照片庫："+err.message+"。請檢查私人瀏覽模式、儲存權限或剩餘空間。",true);
      ["addPhoto","importPhotos","exportPhotos"].forEach(id=>$(id).disabled=true);
    }
  }
  $("addPhoto").addEventListener("click",()=>openEditor());
  $("closeEditor").addEventListener("click",closeEditor);
  $("cancelEditor").addEventListener("click",closeEditor);
  $("photoForm").addEventListener("submit",savePhotoForm);
  $("photoSearch").addEventListener("input",event=>{state.query=event.target.value.trim();render();});
  document.querySelectorAll(".photo-tab[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
    state.filter=btn.dataset.filter;render();
  }));
  $("closeViewer").addEventListener("click",closeViewer);
  $("viewerPrev").addEventListener("click",()=>stepViewer(-1));
  $("viewerNext").addEventListener("click",()=>stepViewer(1));
  $("photoViewer").addEventListener("close",releaseViewerUrl);
  $("photoViewer").addEventListener("keydown",event=>{
    if(event.key==="ArrowLeft"){event.preventDefault();stepViewer(-1);}
    else if(event.key==="ArrowRight"){event.preventDefault();stepViewer(1);}
  });
  $("exportPhotos").addEventListener("click",exportBackup);
  $("importPhotos").addEventListener("click",()=>$("backupInput").click());
  $("backupInput").addEventListener("change",event=>importBackup(event.target.files?.[0]));
  window.addEventListener("beforeunload",()=>{
    clearThumbUrls();
    if(state.viewerUrl)URL.revokeObjectURL(state.viewerUrl);
    state.db?.close();
  });
  init();
})();
