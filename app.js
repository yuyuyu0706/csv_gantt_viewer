
// ===== Import =====
// v61 リファクタリング STEP1 module分割
import { $, $$, createEl } from './js/utils/dom.js';
import { parseCSV } from './js/utils/csv.js';
import { toDate, fmt, fmtMD, daysBetween } from './js/utils/date.js';
import { normHeaders, findHeaderIndex } from './js/utils/headers.js';
import { LEFT_START_PAD_DAYS, ROW_H, BAR_H, CATEGORY_ORDER, catRank } from './js/constants.js';
import { state } from './js/state.js';
import { render, renderHeader, fixBottomSync } from './js/renderer.js';  // v62


// ===== Utils =====

// 新規 v48 日付ラベル（M/D）をバーの左右に追加する共通ヘルパー ----
function appendDateLabels(containerEl, startX, endX, midY, startDate, endDate) {
  const s = document.createElement('div');
  s.className = 'date-label start';
  s.textContent = fmtMD(startDate);         // 既存の M/D 形式フォーマッタ
  s.style.left = (startX - 4) + 'px';          // 4px 左寄せ（ご要望どおり）
  s.style.top  = midY + 'px';
  containerEl.appendChild(s);

  const e = document.createElement('div');
  e.className = 'date-label end';
  e.textContent = fmtMD(endDate);
  e.style.left = (endX + 4) + 'px';            // 4px 右寄せ
  e.style.top  = midY + 'px';
  containerEl.appendChild(e);
}

function statusColor(s){
  const v=String(s||'').replace(/[　]/g,' ').trim();
  if(v==='完了済み') return '#bdbdbd';
  if(v==='開始前') return '#ffffff';
  if(v==='進行中') return '#66bb6a';
  if(v==='遅延') return '#ffd54f';
  return '#66bb6a';
}

// 新規 v50 === 観点内の行を「開始日→終了日→名前」で安定ソートする比較関数 ===
function cmpByStartThenName(a, b){
  const ax = a?.start ? a.start.getTime() : Infinity;
  const bx = b?.start ? b.start.getTime() : Infinity;
  if (ax !== bx) return ax - bx;

  // 開始日が同じなら終了日で
  const ay = a?.end ? a.end.getTime() : Infinity;
  const by = b?.end ? b.end.getTime() : Infinity;
  if (ay !== by) return ay - by;

  // それでも同じなら表示名（task/sub/name）で安定化（日本語ロケール）
  const an = String(a?.task || a?.sub || a?.name || '');
  const bn = String(b?.task || b?.sub || b?.name || '');
  return an.localeCompare(bn, 'ja');
}

// ===== DOM refs =====
let fileInput, sampleBtn, liveToggle, zoomSel, fitBtn, csvInput, renderBtn, dropzone;
let headerEl, leftHead, monthRow, dayRow, labelsEl, gridEl, todayEl, previewEl, colResizer;   // v56 追加

// ===== CSV -> model =====
function buildModel(text){
  const rows = parseCSV(text);
  if(rows.length===0) throw new Error('CSVが空です');
  const header = normHeaders(rows[0]);
  const idx = {
    cat:      findHeaderIndex(['カテゴリ','category'], header),
    sub:      findHeaderIndex(['観点','小タスク','サブ','subtask','viewpoint'], header),
    task:     findHeaderIndex(['タスク','task'], header),           // 追加 v41
    start:    findHeaderIndex(['start','開始','開始日'], header),
    end:      findHeaderIndex(['end','終了','終了日'], header),
    assignee: findHeaderIndex(['担当者','assignee','責任者'], header),
    status:   findHeaderIndex(['進行状況','status'], header),
    priority: findHeaderIndex(['優先度','priority'], header),
    check:    findHeaderIndex(['check','チェック','中間','中間チェック'], header),    // 削除 v58

    // 追加 v60 タスクID / 後続
    taskno:   findHeaderIndex(['タスクno','taskno','task no','id','ID','タスクNo'], header),
    succ:     findHeaderIndex(['後続タスクno','後続タスクno','後続タスク','後続','successors','next','後続タスクNo'], header),
  };

  if(idx.cat<0 || idx.start<0 || idx.end<0) throw new Error('ヘッダ行に カテゴリ, Start, End が必要です');

  const rows2 = rows.slice(1).map(r=>{
    const sub = idx.sub>=0 ? (r[idx.sub]||'').trim() : '';
    const task = idx.task >= 0 ? (r[idx.task] ||'').trim() : '';    // 追加 v41
    const nm  = task || sub || (r[idx.cat]||'').trim();
    const s   = toDate(r[idx.start]);
    const e   = toDate(r[idx.end]) || s;
    return {
      cat:(r[idx.cat]||'').trim(),
      sub, task, name:nm, start:s, end:e,    // 追加 v41
      assignee: idx.assignee>=0 ? (r[idx.assignee]||'') : '',
      status:   idx.status>=0 ? (r[idx.status]||'') : '',
      priority: idx.priority>=0 ? (r[idx.priority]||'') : '',     // 追加 v58
      check:    idx.check>=0    ? toDate(r[idx.check])   : null,  // 追加 v58

      // 追加: TaskNo / successorsRaw
      taskNo: idx.taskno>=0 ? (r[idx.taskno]||'').trim() : '',
      successorsRaw: idx.succ>=0 ? (r[idx.succ]||'').trim() : '',
    };
  }).filter(t=> t.name && t.start && t.end && t.end>=t.start);

  if(rows2.length===0) throw new Error('有効なタスクがありません');

  let min = rows2[0].start, max = rows2[0].end;
  for(const t of rows2){
    if(t.start<min) min=t.start;
    if(t.end>max) max=t.end;
  }

  // group by category and sort
  const map = new Map();
  for(const t of rows2){ const k=t.cat||'(未分類)'; if(!map.has(k)) map.set(k,[]); map.get(k).push(t); }
  const groups = Array.from(map.entries())
    .sort((a,b)=>{ const ra=catRank(a[0]), rb=catRank(b[0]); if(ra!==rb) return ra-rb; return a[0].localeCompare(b[0],'ja'); })
    .map(([cat,items])=>({ cat, items: items.sort((x,y)=> (x.sub||'').localeCompare(y.sub||'','ja')) }));

  // id -> task オブジェクトマップを作成（taskNo は文字列として扱う）
  const idMap = new Map();
  for (const t of rows2) {
    if (t.taskNo) idMap.set(String(t.taskNo), t);
  }
  // successorsRaw ('1;2;3' など) を ; 区切りでパースして actual オブジェクト参照に変換
  for (const t of rows2) {
    t.successors = [];
    if (!t.successorsRaw) continue;
    const parts = String(t.successorsRaw).split(';').map(x=>x.trim()).filter(x=>x!=='');
    for (const pid of parts) {
      const key = String(pid);
      const toTask = idMap.get(key);
      if (toTask && toTask !== t) {
        t.successors.push(toTask);
      } else {
        console.warn('後続タスク参照が見つかりません:', key, 'from', t.taskNo);
      }
    }
  }

  state.model = { tasks: rows2, groups, min, max, dayWidth: state.model.dayWidth };

  // v55 最も早いStartの2日前から描画を開始
  const minPadded = new Date(min.getTime() - LEFT_START_PAD_DAYS * 86400000);
  
  state.model = { tasks:rows2, groups, min: minPadded, max, dayWidth: state.model.dayWidth };
}

// ===== Preview (modal) =====
function renderCsvPreview(text){
  const rows = parseCSV(text);
  if(rows.length===0){ previewEl.innerHTML='<p class="muted">CSVが空です</p>'; return; }
  const table=document.createElement('table');
  const thead=document.createElement('thead'); const trh=document.createElement('tr');
  rows[0].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); }); thead.appendChild(trh); table.appendChild(thead);
  const tbody=document.createElement('tbody');
  rows.slice(1,501).forEach(r=>{ const tr=document.createElement('tr'); r.forEach(c=>{ const td=document.createElement('td'); td.textContent=c; tr.appendChild(td); }); tbody.appendChild(tr); });
  table.appendChild(tbody);
  previewEl.innerHTML=''; previewEl.appendChild(table);
}

// ===== Rendering =====
function setZoom(mode){
  state.model.dayWidth = (mode==='day') ? 28 : (mode==='week' ? 12 : 7);  // ← 編集 v40 patch
  state.model.dayWidth = Math.round(state.model.dayWidth); // ← 追加 v39 patch
}

function prioClassText(p){
  const v=(p||'').trim();
  if(v==='緊急') return ['urgent','緊急'];
  if(v==='高') return ['high','高'];
  if(v==='中') return ['mid','中'];
  if(v==='低') return ['low','低'];
  return ['',''];
}

function __isBoundary(d,mode){
  if(mode==='day') return true;
  if(mode==='week') return d.getUTCDay()===0;
  if(mode==='month') return d.getUTCDate()===1;
  return true;
}

function __tickLabel(d,mode){
  if(mode==='day') return String(d.getUTCDate());
  if(mode==='week') return (d.getUTCMonth()+1)+'/'+d.getUTCDate();
  if(mode==='month') return (d.getUTCMonth()+1)+'月';
  return '';
}

// === PNG出力（全体を撮る） ==========================================
async function exportPNGAll() {
  // v57 追加 ヘッダー（.gantt-header）も含めるため .gantt-wrapper を丸ごと撮る
  const src = document.querySelector('.gantt-wrapper');
  // onst src = document.querySelector('.gantt-body');    // 削除  v57
  if (!src) { alert('gantt body not found'); return; }

  // 1) 表示用DOMのクローンを作成（画面外に配置）
  const clone = src.cloneNode(true);
  clone.id = 'exportClone';
  Object.assign(clone.style, {
    position: 'absolute',
    left: '-100000px',
    top: '0',
    maxHeight: 'none',
    height: 'auto',
    overflow: 'visible',
  });
  // v57 クローン配下だけに輸出用スタイルを効かせるためのクラス
  clone.classList.add('export-capture');
  document.body.appendChild(clone);

  // v57 2) クローン内で高さ/overflow 制限を解除 
  const cGrid    = clone.querySelector('.gantt-grid');
  const cLabels  = clone.querySelector('.task-labels');
  const cHeader  = clone.querySelector('.gantt-header');

  // const cGrid   = clone.querySelector('.gantt-grid');    // v57 削除
  // const cLabels = clone.querySelector('.task-labels');   // v57 削除 
  if (cGrid)   { cGrid.style.maxHeight = 'none'; cGrid.style.height = 'auto'; cGrid.style.overflow = 'visible'; }
  if (cLabels) { cLabels.style.maxHeight = 'none'; cLabels.style.height = 'auto'; cLabels.style.overflow = 'visible'; }
  if (cHeader) { cHeader.style.position = 'static'; } // v57 追加 sticky解除（撮影時に崩れやすいため）

  // 3) ヘッダーの translateX をゼロに（スクショの基準を固定：全幅キャプチャ）
  const cMonth = clone.querySelector('#monthRow');
  const cDay   = clone.querySelector('#dayRow');
  if (cMonth) cMonth.style.transform = 'none';
  if (cDay)   cDay.style.transform   = 'none';

  // 4) “本当に必要な”描画サイズを確定（gridCanvasの幅も考慮）
  // v57 削除 const w = clone.scrollWidth;
  const cCanvas = clone.querySelector('#gridCanvas');
  const w = Math.max(
    clone.scrollWidth,
    cGrid ? cGrid.scrollWidth : 0,
    cCanvas ? cCanvas.scrollWidth : 0
  );

  // bars/labels のどちらが高いかを見て、+ヘッダー高ぶん余裕を持たせる
  const cBars = clone.querySelector('#bars');

  // const barsH   = cBars ? cBars.scrollHeight : 0;     // v57 削除
  // const labelsH = cLabels ? cLabels.scrollHeight : 0; // v57 削除
  // const headH   = 62; // .gantt-header相当            // v57 削除
  // const h = Math.max(barsH, labelsH) + headH + 4;     // v57 削除

  // v57 新規
  const barsH   = cBars ? cBars.scrollHeight : 0;
  const labelsH = cLabels ? cLabels.scrollHeight : 0;
  const headH   = (cHeader?.offsetHeight || 62);
  const h = Math.max(barsH, labelsH) + headH + 8;

  // 5) html2canvas で撮影
  const canvas = await html2canvas(clone, {
    backgroundColor: '#ffffff',
    scale: 2,                 // きれいに
    width: w,
    height: h,
    windowWidth:  w,
    windowHeight: h,
    scrollX: 0,
    scrollY: 0,
    useCORS: true
  });

  // 6) ダウンロード
  const a = document.createElement('a');
  a.download = 'gantt.png';
  a.href = canvas.toDataURL('image/png');
  a.click();

  // 7) 後片付け
  document.body.removeChild(clone);
}


// expand/collapse helpers
function anyExpanded(){
  try{
    const cats=[...document.querySelectorAll('#taskLabels .label.group')].map(el=>el.dataset.cat).filter(Boolean);
    if(cats.length===0) return false;
    return cats.some(c=>! state.collapsedCats.has(c));
  }catch(e){ return false; }
}

function updateToggleAllBtn(){
  const btn = document.getElementById('toggleAllBtn');
  if(!btn) return;
  btn.textContent = anyExpanded() ? '全て折りたたむ' : '全て展開';
}

// 新規 v44 ボタンの文言を現在状態から自動更新
function updateGlobalButtons(){
  const subsBtn  = document.getElementById('toggleSubsBtn');
  const tasksBtn = document.getElementById('toggleTasksBtn');

  // 観点ボタンの文言：1つでも展開されていれば「観点のみ折りたたみ」、全て折りたたみ済みなら「観点のみ展開」
  if (subsBtn) {
    // 現在DOMにある観点キーを収集
    const keys = Array.from(document.querySelectorAll('#taskLabels .label.subgroup')).map(el=>{
      const key = el.dataset.key || `${el.dataset.cat}::${el.querySelector('.name')?.textContent || ''}`;
      return key;
    });
    const anyExpanded = keys.some(k =>! state.collapsedSubs.has(k));
    subsBtn.textContent = anyExpanded ? '観点のみ折りたたみ' : '観点のみ展開';
  }

  // タスクボタンの文言：非表示なら「タスクのみ展開」、表示中なら「タスクのみ折りたたみ」
  if (tasksBtn) {
    tasksBtn.textContent = state.hideTaskRows ? 'タスクのみ展開' : 'タスクのみ折りたたみ';
  }
}

// Events/Init
let _syncingV = false;

function attachScrollSync(){
  const tl = document.getElementById('taskLabels');
  const gg = document.getElementById('ganttGrid');
  const gh = document.getElementById('ganttHeader');
  if(!tl || !gg || !gh) return;

  // vertical sync
  tl.addEventListener('scroll', ()=>{
    if(_syncingV) return;
    _syncingV=true;
    gg.scrollTop = tl.scrollTop;
    _syncingV=false;
  }, {passive:true});

  gg.addEventListener('scroll', ()=>{
    if(_syncingV) return;
    _syncingV=true;
    tl.scrollTop = gg.scrollTop;
    // gh.scrollLeft = gg.scrollLeft; // 削除 v39 patch
    _syncingV=false;
  }, {passive:true});

  // gg.addEventListener('scroll', ()=>{ gh.scrollLeft = gg.scrollLeft; }, {passive:true}); // 削除 v39 patch
}

function bindEvents(){

  // toggle
  const toggleAllBtn = document.getElementById('toggleAllBtn');
  if(toggleAllBtn){
    toggleAllBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const cats=[...document.querySelectorAll('#taskLabels .label.group')].map(el=>el.dataset.cat).filter(Boolean);
      const allCollapsed = cats.length>0 && cats.every(c=> state.collapsedCats.has(c));
      if(allCollapsed){
        state.collapsedCats.clear();
      } else {
        state.collapsedCats=new Set(cats);
      }
      render();
      updateToggleAllBtn();
      fixBottomSync();
    });
  }

  // 観点のみ：全観点を一括で展開/折りたたみ
  const toggleSubsBtn = document.getElementById('toggleSubsBtn');
  if (toggleSubsBtn) {
    toggleSubsBtn.addEventListener('click', ()=>{
      // 現在のモデルから全観点キーを列挙
      const keys = [];
      for (const g of state.model.groups) {
        const seen = new Set();
        for (const t of g.items) {
          const subName = t.sub || '(なし)';
          if (!seen.has(subName)) {
            seen.add(subName);
            keys.push(`${g.cat}::${subName}`);
          }
        }
      }
      // すでに全て折りたたみ済みなら → 全展開、それ以外は → 全折りたたみ
      const allCollapsed = keys.length>0 && keys.every(k => state.collapsedSubs.has(k));
      if (allCollapsed) {
        state.collapsedSubs.clear();
      } else {
        keys.forEach(k => state.collapsedSubs.add(k));
      }
      render();
      fixBottomSync();
      updateGlobalButtons();
    });
  }

  // タスクのみ：孫タスク行の一括表示/非表示
  const toggleTasksBtn = document.getElementById('toggleTasksBtn');
  if (toggleTasksBtn) {
    toggleTasksBtn.addEventListener('click', ()=>{
      state.hideTaskRows = !state.hideTaskRows;
      render();
      fixBottomSync();
      updateGlobalButtons();
    });
  }

  // modal
  const previewBtn = document.getElementById('previewBtn');
  const modalClose = document.getElementById('modalClose');
  const backdrop   = document.getElementById('modalBackdrop');
  const openModal = ()=>document.body.classList.add('modal-open');
  const closeModal= ()=>document.body.classList.remove('modal-open');
  if(previewBtn) previewBtn.addEventListener('click', openModal);
  if(modalClose) modalClose.addEventListener('click', closeModal);
  if(backdrop)   backdrop.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

  // file/drag
  fileInput.addEventListener('change', async (e)=>{
    try{
      const file=e.target.files?.[0]; if(!file) return;
      const txt=await file.text();
      csvInput.value=txt; e.target.value='';
      renderCsvPreview(txt);
      generate();
    }catch(err){ console.error(err); alert('CSV読み込み失敗: '+(err.message||err)); }
  });
  ['dragenter','dragover'].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave','drop'  ].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', async (e)=>{
    try{
      const file=e.dataTransfer?.files?.[0]; if(!file) return;
      const txt=await file.text();
      csvInput.value=txt;
      renderCsvPreview(txt);
      generate();
    }catch(err){ console.error(err); alert('CSVドロップ失敗: '+(err.message||err)); }
  });

  renderBtn.addEventListener('click', ()=>generate());

  // 拡大
  zoomSel.addEventListener('change', ()=>{
    if(state.model.tasks.length){
      setZoom(zoomSel.value);
      render();
      fixBottomSync();
    }
  });

  // 幅フィット
  fitBtn.addEventListener('click', ()=>{
    if(!state.model.tasks.length) return;
    const containerWidth = document.querySelector('.gantt-grid').clientWidth || 800;
    const totalDays = daysBetween(state.model.min, state.model.max);
    state.model.dayWidth = Math.max(4, Math.round(containerWidth / totalDays));
    render();
    fixBottomSync();
  });

  // サンプルCSV読込み
  sampleBtn.addEventListener('click', ()=>{
    const s=sampleCSV();
    csvInput.value=s;
    renderCsvPreview(s);
    generate();
  });

  // v54 PNG出力ボタン
  const pngBtn = document.getElementById('pngBtn');
  if (pngBtn) pngBtn.addEventListener('click', exportPNGAll);
  
  // v43 label click toggle（カテゴリ & 観点）
  document.getElementById('taskLabels').addEventListener('click', (e)=>{
    const elCat = e.target.closest('.label.group');
    if (elCat) {
      const cat = elCat.dataset.cat || elCat.textContent.trim();
      if (state.collapsedCats.has(cat)) state.collapsedCats.delete(cat); else state.collapsedCats.add(cat);
      render();
      updateToggleAllBtn();
      fixBottomSync();
      return;
    }
    const elSub = e.target.closest('.label.subgroup');
    if (elSub) {
      const key = elSub.dataset.key;
      if (state.collapsedSubs.has(key)) state.collapsedSubs.delete(key); else state.collapsedSubs.add(key);
      render();
      fixBottomSync();
      updateGlobalButtons();   // 追記 v44
    }
  });

  // header follow width changes
  new ResizeObserver(()=>{ renderHeader(daysBetween(state.model.min, state.model.max), 80); }).observe(document.getElementById('taskLabels'));
  window.addEventListener('resize', ()=>{ fixBottomSync(); }, {passive:true});

  // v56 新規 ====== 列幅リサイズ（ドラッグ） ======
  if (colResizer) {
    let startX = 0, startW = 0, dragging = false;
    const rootStyle = document.documentElement.style;

    const minW = 260;  // 最小幅（お好みで調整）
    const maxW = 720;  // 最大幅（お好みで調整）

    const onMove = (e)=>{
      if (!dragging) return;
      const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      const dx = clientX - startX;
      let w = Math.max(minW, Math.min(maxW, startW + dx));
      rootStyle.setProperty('--labels-w', w + 'px');
      // ヘッダは ResizeObserver で追従するが、下端同期は明示で
      fixBottomSync();
    };
    const onUp = ()=>{
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    const onDown = (e)=>{
      dragging = true;
      startX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
      startW = document.getElementById('taskLabels').offsetWidth;
      document.addEventListener('mousemove', onMove, {passive:false});
      document.addEventListener('mouseup', onUp, {passive:true});
      document.addEventListener('touchmove', onMove, {passive:false});
      document.addEventListener('touchend', onUp, {passive:true});
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    };
    colResizer.addEventListener('mousedown', onDown);
    colResizer.addEventListener('touchstart', onDown, {passive:false});
  }

}


function generate(){
  try{
    buildModel(csvInput.value||'');
    setZoom(zoomSel?zoomSel.value:'day');
    render();
    fixBottomSync();
  }catch(err){
    console.error('generate error:', err);
    alert('チャート生成に失敗: ' + (err.message||err));
  }
}

// Sample CSV（改行は \n で）
function sampleCSV(){
  return [
    'カテゴリ,観点,タスクNo,後続タスクNo,進行状況,優先度,Start,End,check',
    'マイルストーン,キックオフ,1,,進行中,高,2025/08/20,2025/08/20',
    'PMO,ケイデンス管理,2,3;4,進行中,高,2025/07/28,2025/08/08',
    '構築-基盤環境,契約事務,3,,遅延,高,2025/07/14,2025/08/15',
    '活用 PoC① エージェント構築,取り組み具体化,4,,進行中,中,2025/08/25,2025/09/18,2025/09/02'
  ].join('\n');
}

window.addEventListener('DOMContentLoaded', ()=>{
  // refs
  fileInput = document.getElementById('fileInput');
  sampleBtn = document.getElementById('sampleBtn');
  liveToggle = document.getElementById('liveToggle');
  zoomSel = document.getElementById('zoom');
  fitBtn = document.getElementById('fitBtn');
  csvInput = document.getElementById('csvInput');
  renderBtn = document.getElementById('renderBtn');
  dropzone = document.getElementById('dropzone');
  headerEl = document.getElementById('ganttHeader');
  leftHead = document.getElementById('leftHead');
  monthRow = document.getElementById('monthRow');
  dayRow = document.getElementById('dayRow');
  labelsEl = document.getElementById('taskLabels');
  colResizer = document.getElementById('colResizer');   // v56 追加
  gridEl = document.getElementById('ganttGrid');
  todayEl = document.getElementById('todayLine');
  previewEl = document.getElementById('csvPreview');
  bindEvents();
  attachScrollSync();

  // modal closed at init
  document.body.classList.remove('modal-open');
  const s = sampleCSV();
  csvInput.value = s;
  renderCsvPreview(s);
  generate();
  updateGlobalButtons();   // 追記 v44
});

// ヘッダー同期
function syncHeaderToGrid(){
  const grid  = document.getElementById('ganttGrid');
  const month = document.getElementById('monthRow');
  const day   = document.getElementById('dayRow');
  if(!grid || !month || !day) return;

  // 横スクロールに応じてヘッダーを逆方向へ移動
  const onScroll = ()=>{
    const x = grid.scrollLeft;
    month.style.transform = `translateX(${-x}px)`;
    day.style.transform   = `translateX(${-x}px)`;
  };

  // 重複登録防止
  if(grid.__onHSync) grid.removeEventListener('scroll', grid.__onHSync);
  grid.__onHSync = onScroll;
  grid.addEventListener('scroll', onScroll, {passive:true});

  // 初期反映
  onScroll();
}

