import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const prototypeDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(prototypeDir, "../..");
const source = join(repoRoot, "docs/data/wells.json");
const attachmentRoot = join(repoRoot, "docs/data/attachments");
const output = join(prototypeDir, "index.html");
const allWells = JSON.parse(await readFile(source, "utf8"));
const allowedFields = [
  "id", "wellNumber", "name", "station", "district", "section", "address",
  "latitude", "longitude", "twd97X", "twd97Y", "purpose", "depthMeters",
  "diameterMm", "pumpHorsepower", "pumpOutletInch", "planFlowCms",
  "benefitedAreaHa", "registeredFlowCms", "irrigationSystem", "waterRightNo",
  "waterRightPeriod", "nextApplicationPeriod", "completionDate", "constructionYear",
  "electricityNo", "agriculturalPower", "startedAt", "status", "managementUnit",
  "publicNote", "internalNote", "isPublic", "updatedAt"
];
function normalizeLandParcel(well) {
  const item = Object.fromEntries(allowedFields.map((field) => [field, well[field] ?? ""]));
  const match = String(item.address || "").match(/^臺中市([^區]+區)(.+)$/);
  if (!item.district && match) item.district = match[1];
  if (!item.section) item.section = match ? match[2] : item.address;
  return item;
}
const wells = allWells
  .filter((well) => well.station === "大甲")
  .map(normalizeLandParcel);
const seed = JSON.stringify(wells).replaceAll("<", "\\u003c");
const originalPhotosByWell = {};
for (const well of allWells.filter((item) => item.station === "大甲")) {
  originalPhotosByWell[well.id] = await Promise.all((well.photos || []).map(async (photo) => ({
    id: photo.id,
    name: photo.name,
    type: photo.mimeType,
    size: photo.size,
    createdAt: photo.uploadedAt,
    dataUrl: `data:${photo.mimeType};base64,${(await readFile(`${attachmentRoot}/${photo.storedName}`)).toString("base64")}`,
  })));
}
const originalPhotoSeed = JSON.stringify(originalPhotosByWell).replaceAll("<", "\\u003c");

const html = String.raw`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>地下水井基本資料維護</title>
  <style>
    :root { --ink:#17352d; --muted:#61756e; --line:#dce7e1; --green:#0b6b4f; --green2:#e7f5ef; --cream:#f6f4ed; --white:#fff; --warn:#9a5b00; --danger:#a43131; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:var(--cream); font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif; }
    button,input,select,textarea { font:inherit; }
    button { cursor:pointer; }
    .topbar { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1rem 1.4rem; color:white; background:linear-gradient(120deg,#174d3c,#0b6b4f); box-shadow:0 2px 14px #17352d22; }
    .topbar h1 { margin:.15rem 0 0; font-size:1.35rem; }
    .eyebrow { margin:0; opacity:.75; font-size:.78rem; letter-spacing:.12em; }
    .station-chip { padding:.45rem .75rem; border:1px solid #ffffff55; border-radius:999px; background:#ffffff16; white-space:nowrap; }
    .notice { margin:.9rem 1.1rem 0; padding:.75rem 1rem; border:1px solid #e0c58d; border-radius:.65rem; color:#6c4b08; background:#fff9e8; }
    .app { display:grid; grid-template-columns:320px minmax(0,1fr); min-height:calc(100vh - 126px); gap:1rem; padding:1rem; }
    .panel { background:var(--white); border:1px solid var(--line); border-radius:1rem; box-shadow:0 5px 22px #17352d0c; }
    .sidebar { padding:1rem; display:flex; flex-direction:column; gap:.8rem; min-height:680px; }
    .sidebar-head,.form-head,.actions { display:flex; align-items:center; justify-content:space-between; gap:.7rem; }
    .sidebar h2,.form-head h2 { margin:0; font-size:1.05rem; }
    .primary { border:0; border-radius:.55rem; padding:.62rem .9rem; color:white; background:var(--green); font-weight:700; }
    .secondary { border:1px solid var(--line); border-radius:.55rem; padding:.57rem .8rem; color:var(--ink); background:white; }
    .danger { color:var(--danger); }
    #search { width:100%; border:1px solid var(--line); border-radius:.55rem; padding:.65rem .75rem; }
    .well-list { display:grid; gap:.5rem; overflow:auto; max-height:610px; }
    .well-item { width:100%; text-align:left; padding:.7rem; border:1px solid var(--line); border-radius:.65rem; background:white; color:var(--ink); }
    .well-item.active { border-color:var(--green); background:var(--green2); }
    .well-item strong,.well-item span { display:block; }
    .well-item span { margin-top:.2rem; color:var(--muted); font-size:.84rem; }
    .editor { padding:1.1rem; }
    .form-head { padding-bottom:.9rem; border-bottom:1px solid var(--line); }
    .save-state { color:var(--muted); font-size:.86rem; }
    fieldset { margin:1rem 0; padding:1rem; border:1px solid var(--line); border-radius:.8rem; }
    legend { padding:0 .45rem; font-weight:800; color:var(--green); }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.8rem; }
    label { display:grid; gap:.35rem; color:var(--muted); font-size:.82rem; }
    label.wide { grid-column:span 2; }
    label.full { grid-column:1/-1; }
    input,select,textarea { width:100%; border:1px solid #cbd9d2; border-radius:.5rem; padding:.6rem .65rem; color:var(--ink); background:white; }
    input:focus,select:focus,textarea:focus { outline:3px solid #6fc5a83b; border-color:var(--green); }
    input[readonly] { background:#f0f4f2; color:#53655f; }
    .check { display:flex; align-items:center; gap:.5rem; align-self:end; padding:.55rem 0; }
    .check input { width:auto; }
    .actions { position:sticky; bottom:0; padding:.8rem 0 0; background:linear-gradient(transparent,var(--white) 30%); }
    .actions-left,.actions-right { display:flex; gap:.55rem; }
    .empty { padding:1rem; text-align:center; color:var(--muted); }
    .toast { position:fixed; right:1rem; bottom:1rem; max-width:420px; padding:.8rem 1rem; border-radius:.65rem; color:white; background:#17352d; box-shadow:0 6px 24px #0003; }
    .toast.error { background:var(--danger); }
    .photo-tools { display:flex; align-items:center; gap:.7rem; flex-wrap:wrap; }
    .photo-tools input { flex:1 1 320px; }
    .photo-help { margin:.65rem 0; color:var(--muted); font-size:.88rem; }
    .photo-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:.8rem; }
    .photo-card { overflow:hidden; border:1px solid var(--line); border-radius:.75rem; background:#f7faf8; }
    .photo-card img { display:block; width:100%; aspect-ratio:4/3; object-fit:cover; background:#e6eeea; }
    .photo-meta { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.55rem; }
    .photo-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.85rem; }
    .photo-source { flex:0 0 auto; padding:.15rem .4rem; border-radius:999px; color:#36584c; background:#e4efe9; font-size:.72rem; }
    .photo-delete { flex:0 0 auto; border:1px solid #d9b6b6; border-radius:.45rem; padding:.35rem .55rem; color:var(--danger); background:white; }
    [hidden] { display:none !important; }
    @media(max-width:900px){ .app{grid-template-columns:1fr}.sidebar{min-height:auto}.well-list{max-height:260px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))} }
    @media(max-width:560px){ .grid{grid-template-columns:1fr}label.wide{grid-column:auto}.topbar{align-items:flex-start;flex-direction:column}.actions{align-items:stretch;flex-direction:column}.actions-left,.actions-right{display:grid;grid-template-columns:1fr 1fr} }
  </style>
</head>
<body>
  <header class="topbar">
    <div><p class="eyebrow">農業部農田水利署臺中管理處</p><h1>地下水井基本資料維護</h1></div>
    <span class="station-chip">大甲工作站</span>
  </header>
  <div class="notice">此為操作介面試作。儲存結果目前只保存在這台裝置的瀏覽器，尚未寫入正式 Google Sheets 或 Drive。</div>
  <main class="app">
    <aside class="panel sidebar">
      <div class="sidebar-head"><h2>大甲站水井</h2><button id="addWell" class="primary" type="button">＋ 新增</button></div>
      <input id="search" type="search" placeholder="搜尋井名或水權狀號">
      <div id="wellCount" class="save-state"></div>
      <div id="wellList" class="well-list"></div>
    </aside>
    <section class="panel editor">
      <form id="wellForm">
        <div class="form-head"><div><h2 id="formTitle">編修水井資料</h2><span id="saveState" class="save-state"></span></div><span id="recordBadge" class="station-chip" style="color:var(--green);background:var(--green2);border-color:var(--line)"></span></div>
        <input id="id" type="hidden">
        <fieldset><legend>井籍基本資料</legend><div class="grid">
          <label>工作站<input id="station" value="大甲" readonly></label>
          <label>水權狀號<input id="waterRightNo" readonly></label>
          <label>井名<input id="name" required></label>
          <label>行政區<input id="district"></label>
          <label>地段號<input id="section" required></label>
          <label>狀態<select id="status"><option>使用中</option><option>故障待修</option><option>暫停使用</option><option>廢止</option><option>草稿</option></select></label>
        </div></fieldset>
        <fieldset><legend>設備與灌溉資料</legend><div class="grid">
          <label>井深（公尺）<input id="depthMeters" type="number" step="0.1"></label>
          <label>井徑（毫米）<input id="diameterMm" type="number" step="1"></label>
          <label>抽水機馬力（HP）<input id="pumpHorsepower" type="number" step="0.1"></label>
          <label>出水管徑（吋）<input id="pumpOutletInch" type="number" step="0.1"></label>
          <label>計畫出水量（cms）<input id="planFlowCms" type="number" step="0.0001"></label>
          <label>水權登記量（cms）<input id="registeredFlowCms" type="number" step="0.0001"></label>
          <label>受益面積（公頃）<input id="benefitedAreaHa" type="number" step="0.0001"></label>
          <label class="wide">灌溉系統<input id="irrigationSystem"></label>
          <label>用途<input id="purpose"></label>
        </div></fieldset>
        <fieldset><legend>位置與用電資料</legend><div class="grid">
          <label>TWD97 X<input id="twd97X"></label><label>TWD97 Y<input id="twd97Y"></label><label>完工日期<input id="completionDate"></label>
          <label>緯度<input id="latitude" type="number" step="0.0000001"></label><label>經度<input id="longitude" type="number" step="0.0000001"></label><label>啟用日期<input id="startedAt" type="date"></label>
          <label class="wide">用電電號<input id="electricityNo"></label><label>農業用電<select id="agriculturalPower"><option value="">未填寫</option><option value="有">是</option><option value="無">否</option></select></label>
        </div></fieldset>
        <fieldset><legend>水井照片</legend>
          <div class="photo-tools"><input id="photoFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><button id="addPhotos" class="secondary" type="button">上傳照片</button></div>
          <p class="photo-help">已帶入原有照片；另可上傳 JPG、PNG 或 WebP，每張最多 8 MB。試作版的上傳與刪除只保存在這台裝置的瀏覽器，正式版將改存 Google Drive。</p>
          <div id="photoGrid" class="photo-grid"></div>
        </fieldset>
        <div class="actions">
          <div class="actions-left"><button id="deleteDraft" class="secondary danger" type="button">刪除草稿</button><button id="resetDemo" class="secondary" type="button">還原試作資料</button></div>
          <div class="actions-right"><button id="exportData" class="secondary" type="button">匯出 JSON</button><button class="primary" type="submit">儲存資料</button></div>
        </div>
      </form>
    </section>
  </main>
  <div id="toast" class="toast" hidden></div>
  <script id="seedData" type="application/json">${seed}</script>
  <script id="originalPhotoData" type="application/json">${originalPhotoSeed}</script>
  <script>
    const STORAGE_KEY = 'groundwater-dajia-prototype-v1';
    const PHOTO_DB_NAME = 'groundwater-dajia-prototype-media-v1';
    const DELETED_ORIGINAL_PHOTOS_KEY = 'groundwater-dajia-deleted-original-photos-v1';
    const PHOTO_TYPES = new Set(['image/jpeg','image/png','image/webp']);
    const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
    const seedData = JSON.parse(document.getElementById('seedData').textContent);
    const originalPhotosByWell = JSON.parse(document.getElementById('originalPhotoData').textContent);
    const numericFields = new Set(['latitude','longitude','depthMeters','diameterMm','pumpHorsepower','pumpOutletInch','planFlowCms','benefitedAreaHa','registeredFlowCms']);
    const fields = ['id','waterRightNo','name','station','district','section','latitude','longitude','twd97X','twd97Y','purpose','depthMeters','diameterMm','pumpHorsepower','pumpOutletInch','planFlowCms','benefitedAreaHa','registeredFlowCms','irrigationSystem','completionDate','electricityNo','agriculturalPower','startedAt','status'];
    let wells = loadData(); let activeId = wells[0]?.id || '';
    let deletedOriginalPhotoIds = loadDeletedOriginalPhotoIds();
    let photoObjectUrls = [];
    const $ = id => document.getElementById(id);
    function normalizeStoredWell(well){ const match=String(well.address||'').match(/^臺中市([^區]+區)(.+)$/); return {...well,district:well.district||(match?match[1]:''),section:well.section||(match?match[2]:well.address||'')}; }
    function loadData(){ try { const value=JSON.parse(localStorage.getItem(STORAGE_KEY)); const source=Array.isArray(value)?value:structuredClone(seedData); return source.map(normalizeStoredWell); } catch { return structuredClone(seedData).map(normalizeStoredWell); } }
    function persist(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(wells)); }
    function loadDeletedOriginalPhotoIds(){ try { const value=JSON.parse(localStorage.getItem(DELETED_ORIGINAL_PHOTOS_KEY)); return new Set(Array.isArray(value)?value:[]); } catch { return new Set(); } }
    function persistDeletedOriginalPhotoIds(){ localStorage.setItem(DELETED_ORIGINAL_PHOTOS_KEY,JSON.stringify([...deletedOriginalPhotoIds])); }
    function esc(value){ return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
    function showToast(message,error=false){ const el=$('toast'); el.textContent=message; el.classList.toggle('error',error); el.hidden=false; clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>el.hidden=true,2800); }
    function openPhotoDb(){ return new Promise((resolve,reject)=>{ const request=indexedDB.open(PHOTO_DB_NAME,1); request.onupgradeneeded=()=>{ const store=request.result.createObjectStore('photos',{keyPath:'id'}); store.createIndex('wellId','wellId',{unique:false}); }; request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
    async function getPhotos(wellId){ const db=await openPhotoDb(); return new Promise((resolve,reject)=>{ const request=db.transaction('photos','readonly').objectStore('photos').index('wellId').getAll(wellId); request.onsuccess=()=>{ db.close(); resolve(request.result.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))); }; request.onerror=()=>{ db.close(); reject(request.error); }; }); }
    async function putPhoto(photo){ const db=await openPhotoDb(); return new Promise((resolve,reject)=>{ const request=db.transaction('photos','readwrite').objectStore('photos').put(photo); request.onsuccess=()=>{ db.close(); resolve(); }; request.onerror=()=>{ db.close(); reject(request.error); }; }); }
    async function removePhoto(id){ const db=await openPhotoDb(); return new Promise((resolve,reject)=>{ const request=db.transaction('photos','readwrite').objectStore('photos').delete(id); request.onsuccess=()=>{ db.close(); resolve(); }; request.onerror=()=>{ db.close(); reject(request.error); }; }); }
    async function deletePhotosForWell(wellId){ const photos=await getPhotos(wellId); await Promise.all(photos.map(photo=>removePhoto(photo.id))); }
    async function clearAllPhotos(){ const db=await openPhotoDb(); return new Promise((resolve,reject)=>{ const request=db.transaction('photos','readwrite').objectStore('photos').clear(); request.onsuccess=()=>{ db.close(); resolve(); }; request.onerror=()=>{ db.close(); reject(request.error); }; }); }
    async function renderPhotos(wellId){ photoObjectUrls.forEach(URL.revokeObjectURL); photoObjectUrls=[]; const grid=$('photoGrid'); if(!wellId){ grid.innerHTML='<p class="empty">請先選擇或新增水井</p>'; return; } try { const originals=(originalPhotosByWell[wellId]||[]).filter(photo=>!deletedOriginalPhotoIds.has(photo.id)).map(photo=>({...photo,source:'original'})); const added=(await getPhotos(wellId)).map(photo=>({...photo,source:'added'})); const photos=[...originals,...added]; if(activeId!==wellId)return; if(!photos.length){ grid.innerHTML='<p class="empty">尚未上傳照片</p>'; return; } grid.innerHTML=photos.map(photo=>{ const url=photo.source==='original'?photo.dataUrl:URL.createObjectURL(photo.blob); if(photo.source!=='original')photoObjectUrls.push(url); const sourceLabel=photo.source==='original'?'原有':'新增'; return '<article class="photo-card"><img src="'+url+'" alt="'+esc(photo.name)+'"><div class="photo-meta"><span class="photo-source">'+sourceLabel+'</span><span class="photo-name" title="'+esc(photo.name)+'">'+esc(photo.name)+'</span><button class="photo-delete" type="button" data-photo-id="'+esc(photo.id)+'" data-photo-source="'+photo.source+'">刪除</button></div></article>'; }).join(''); } catch { grid.innerHTML='<p class="empty">照片資料暫時無法讀取</p>'; showToast('照片資料暫時無法讀取',true); } }
    function renderList(){ const q=$('search').value.trim().toLowerCase(); const list=wells.filter(w=>!q||[w.name,w.waterRightNo,w.wellNumber,w.district,w.section].some(v=>String(v||'').toLowerCase().includes(q))); $('wellCount').textContent='共 '+wells.length+' 口井，顯示 '+list.length+' 筆'; $('wellList').innerHTML=list.map(w=>'<button class="well-item '+(w.id===activeId?'active':'')+'" type="button" data-id="'+esc(w.id)+'"><strong>'+esc(w.waterRightNo||w.wellNumber||'尚未編號')+'｜'+esc(w.name||'未命名水井')+'</strong><span>'+esc(w.status||'草稿')+' · '+esc([w.district,w.section].filter(Boolean).join(' ')||'尚未填寫地段號')+'</span></button>').join('')||'<p class="empty">沒有符合的水井</p>'; }
    function fillForm(well){ fields.forEach(name=>{ const el=$(name); if(!el)return; if(el.type==='checkbox')el.checked=Boolean(well?.[name]); else el.value=well?.[name]??''; }); $('station').value='大甲'; $('formTitle').textContent=well?'編修水井資料':'新增水井'; $('recordBadge').textContent=well?.waterRightNo||'新草稿'; $('saveState').textContent=well?.updatedAt?'最後更新 '+String(well.updatedAt).slice(0,19).replace('T',' '):'尚未儲存'; $('deleteDraft').disabled=!well||well.status!=='草稿'; $('photoFiles').value=''; renderPhotos(well?.id||activeId); }
    function newDraft(){ activeId='draft-'+crypto.randomUUID(); fillForm({id:activeId,station:'大甲',status:'草稿',isPublic:false}); renderList(); $('name').focus(); }
    function readForm(){ const result={}; fields.forEach(name=>{ const el=$(name); if(!el)return; if(el.type==='checkbox')result[name]=el.checked; else if(numericFields.has(name))result[name]=el.value===''?null:Number(el.value); else result[name]=el.value.trim(); }); result.station='大甲'; result.updatedAt=new Date().toISOString(); return result; }
    function validate(well){ const errors=[]; if(!well.name)errors.push('請填寫井名'); if(!well.section)errors.push('請填寫地段號'); if(well.waterRightNo&&!/^[BK]\d{7}$/.test(well.waterRightNo))errors.push('水權狀號格式應為 B/K 加七位數字'); if(!well.waterRightNo&&well.status!=='草稿')errors.push('需先由水權狀 PDF 建立水權資料'); if(well.waterRightNo&&wells.some(w=>w.id!==well.id&&w.waterRightNo===well.waterRightNo))errors.push('水權狀號已存在'); if(well.isPublic){ if(well.latitude==null||well.longitude==null)errors.push('公開水井必須填寫經緯度'); else if(well.latitude<21.8||well.latitude>25.5||well.longitude<119.3||well.longitude>122.1)errors.push('經緯度不在臺灣合理範圍'); } return errors; }
    $('wellForm').addEventListener('submit',event=>{ event.preventDefault(); const formData=readForm(); const existing=wells.find(item=>item.id===formData.id); const well={...(existing||{}),managementUnit:existing?.managementUnit||'大甲工作站',isPublic:existing?.isPublic??false,...formData}; const errors=validate(well); if(errors.length){ showToast(errors.join('、'),true); return; } const index=wells.findIndex(item=>item.id===well.id); if(index>=0)wells[index]={...wells[index],...well}; else wells.push(well); activeId=well.id; persist(); renderList(); fillForm(wells.find(item=>item.id===activeId)); showToast('已儲存於本機試作資料'); });
    $('wellList').addEventListener('click',event=>{ const button=event.target.closest('[data-id]'); if(!button)return; activeId=button.dataset.id; fillForm(wells.find(w=>w.id===activeId)); renderList(); window.scrollTo({top:0,behavior:'smooth'}); });
    $('addWell').addEventListener('click',newDraft); $('search').addEventListener('input',renderList);
    $('addPhotos').addEventListener('click',async()=>{ const files=Array.from($('photoFiles').files||[]); if(!files.length){ showToast('請先選擇照片',true); return; } const invalidType=files.find(file=>!PHOTO_TYPES.has(file.type)); if(invalidType){ showToast('僅支援 JPG、PNG 或 WebP',true); return; } const oversized=files.find(file=>file.size>PHOTO_MAX_BYTES); if(oversized){ showToast('每張照片不可超過 8 MB',true); return; } try { for(const file of files){ await putPhoto({id:crypto.randomUUID(),wellId:activeId,name:file.name,type:file.type,size:file.size,createdAt:new Date().toISOString(),blob:file}); } $('photoFiles').value=''; await renderPhotos(activeId); showToast('已加入 '+files.length+' 張照片'); } catch { showToast('照片儲存失敗，請確認瀏覽器可用空間',true); } });
    $('photoGrid').addEventListener('click',async event=>{ const button=event.target.closest('[data-photo-id]'); if(!button)return; if(!confirm('確定刪除這張照片嗎？'))return; try { if(button.dataset.photoSource==='original'){ deletedOriginalPhotoIds.add(button.dataset.photoId); persistDeletedOriginalPhotoIds(); } else { await removePhoto(button.dataset.photoId); } await renderPhotos(activeId); showToast('照片已刪除'); } catch { showToast('照片刪除失敗',true); } });
    $('deleteDraft').addEventListener('click',async()=>{ const removedId=activeId; const index=wells.findIndex(w=>w.id===removedId); if(index<0||wells[index].status!=='草稿')return; wells.splice(index,1); await deletePhotosForWell(removedId); activeId=wells[0]?.id||''; persist(); renderList(); activeId?fillForm(wells[0]):newDraft(); showToast('草稿已刪除'); });
    $('resetDemo').addEventListener('click',async()=>{ if(!confirm('要清除本機修改、照片並還原 12 口大甲站試作資料嗎？'))return; wells=structuredClone(seedData); await clearAllPhotos(); deletedOriginalPhotoIds=new Set(); localStorage.removeItem(DELETED_ORIGINAL_PHOTOS_KEY); activeId=wells[0]?.id||''; persist(); renderList(); fillForm(wells[0]); showToast('已還原試作資料'); });
    $('exportData').addEventListener('click',()=>{ const blob=new Blob([JSON.stringify({station:'大甲',exportedAt:new Date().toISOString(),wells},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='大甲工作站水井基本資料_'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500); });
    renderList(); if(activeId)fillForm(wells[0]); else newDraft();
  </script>
</body>
</html>`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, html, "utf8");
console.log(JSON.stringify({ output, wells: wells.length, bytes: Buffer.byteLength(html) }));
