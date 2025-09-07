
// ===== Import =====
// v61 リファクタリング STEP1 module分割
import { $, $$, createEl } from './js/utils/dom.js';
import { parseCSV } from './js/utils/csv.js';
import { toDate, fmt, fmtMD, daysBetween } from './js/utils/date.js';
import { normHeaders, findHeaderIndex } from './js/utils/headers.js';
import { LEFT_START_PAD_DAYS, ROW_H, BAR_H, CATEGORY_ORDER, catRank } from './js/constants.js';
import { state } from './js/state.js';
// v62
import { render, renderHeader, fixBottomSync } from './js/renderer.js';
// v63
import { initEvents } from './js/events.js';
// v64
import { generateCore } from './js/generator.js';
// v68
import { initServerCsvPicker } from './js/csv-select.js';
import { openModal, closeModal, showCsvPreview } from './js/modal.js';
import { syncHeaderToGrid, attachScrollSync, onColResizerMouseDown } from './js/layout.js';
import { makeOnToggleAllClick, makeOnToggleSubsClick, makeOnToggleTasksClick,
         updateToggleAllBtn, updateGlobalButtons  } from './js/toggles.js';
import { exportPNGAll } from './js/png.js';

// ===== Utils =====
// v48 日付ラベル（M/D）をバーの左右に追加する共通ヘルパー ----
function appendDateLabels(containerEl, startX, endX, midY, startDate, endDate) {
  const s = document.createElement('div');
  s.className = 'date-label start';
  s.textContent = fmtMD(startDate);         // 既存の M/D 形式フォーマッタ
  s.style.left = (startX - 4) + 'px';       // 4px 左寄せ（ご要望どおり）
  s.style.top  = midY + 'px';
  containerEl.appendChild(s);

  const e = document.createElement('div');
  e.className = 'date-label end';
  e.textContent = fmtMD(endDate);
  e.style.left = (endX + 4) + 'px';         // 4px 右寄せ
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

// v50 === 観点内の行を「開始日→終了日→名前」で安定ソートする比較関数 ===
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
let fileInput, sampleBtn, liveToggle, zoomSel, fitBtn, csvInput, renderBtn;
let headerEl, leftHead, monthRow, dayRow, labelsEl, gridEl, todayEl, previewEl, colResizer;   // v56

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
  state.model.dayWidth = (mode==='day') ? 28 : (mode==='week' ? 12 : 7);  // v40 patch
  state.model.dayWidth = Math.round(state.model.dayWidth); // v39 patch
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

// Events/Init
let _syncingV = false;

function bindEvents(){
  // header follow width changes
  new ResizeObserver(()=>{
    // モデル未構築時はスキップ（初回起動のエラーを回避）
    if (!state?.model?.min || !state?.model?.max) return;
    const span = Math.max(1, daysBetween(state.model.min, state.model.max));
    renderHeader(span, 80);
  }).observe(document.getElementById('taskLabels'));
}

// v64 機能分割
export function generate(){
  const csv = csvInput?.value ?? '';
  const mode = zoomSel?.value ?? 'day';
  generateCore({ csvText: csv, zoomMode: mode, setZoom }); // ← setZoom を注入
}

// v63 ===== 画面イベント関数 =====
// 日表示・週表示・月表示のズームイベント
export function onZoomChange() { setZoom(zoomSel.value); render(); fixBottomSync(); }
// モーダル開閉
export function onModalCloseClick(){ closeModal(); }
export function onBackdropClick(){ closeModal(); }
export function onEscKeydown(e){ if (e.key === 'Escape') closeModal(); }

// 描画
export function onRenderClick(){ generate(); }
// プレビュー
export function onPreviewClick(){
  showCsvPreview(renderCsvPreview, csvInput?.value ?? '');
}
// CSV読込み
export function onFileInputChange() {
  const fileInput = document.getElementById('fileInput');
  const csvInput  = document.getElementById('csvInput');
  const f = fileInput?.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (csvInput) csvInput.value = String(reader.result || '');
    // プレビューも最新化（安全にtryで）
    try { renderCsvPreview(csvInput?.value || ''); } catch(_) {}
    generate();
    // 同じファイルを次回選んでも change が発火するようにクリア
    try { if (fileInput) fileInput.value = ''; } catch(_) {}
  }
  reader.readAsText(f);
}
// 子タスク・孫タスク開閉
export function onLabelsClick(ev){
  const g = ev.target.closest?.('.label.group');
  if (g) {
    const cat = g.dataset.cat;
    if (state.collapsedCats.has(cat)) state.collapsedCats.delete(cat);
    else state.collapsedCats.add(cat);
    render(); return;
  }
  const s = ev.target.closest?.('.label.subgroup');
  if (s) {
    const key = s.dataset.key;
    if (state.collapsedSubs.has(key)) state.collapsedSubs.delete(key);
    else state.collapsedSubs.add(key);
    render(); return;
  }
}
// PNG出力
export async function onPngClick(){ if (exportPNGAll) await exportPNGAll(); }
export function onWindowResize(){ fixBottomSync(); }

// 幅フィット
export function onFitClick(){
  if (!state.model.tasks.length) return;
  const grid = document.getElementById('ganttGrid');
  const containerWidth = (grid && grid.clientWidth) ? grid.clientWidth : 800;
  const totalDays = daysBetween(state.model.min, state.model.max);
  state.model.dayWidth = Math.max(4, Math.round(containerWidth / totalDays));
  render();
  fixBottomSync();
}

// v68 取得CSVテキストを既存パイプラインへ投入
function handleServerCsvText(csvText, meta) {
  const ta = document.getElementById('csvInput');
  if (ta) ta.value = csvText;
  try { renderCsvPreview(csvText); } catch (_) {}

  // 既存のパイプライン（parse→model→render）に投入
  generate();

  // 同じファイルを input で再選択しても change が走るようにクリア
  const fi = document.getElementById('fileInput');
  if (fi) { try { fi.value = ''; } catch(_) {} }
  if (meta?.name) console.log(`[server csv] ${meta.name} を読み込み→描画しました`);
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
  // 初期レンダリング前にヘッダとグリッドの水平同期を設定
  syncHeaderToGrid();

  // v64 依存注入で“完成したハンドラ”を作る
  const onToggleAllClick  = makeOnToggleAllClick({
    render, fixBottomSync, updateToggleAllBtn
  });
  const onToggleSubsClick = makeOnToggleSubsClick({
    render, fixBottomSync, updateGlobalButtons
  });
  const onToggleTasksClick = makeOnToggleTasksClick({
    render, fixBottomSync, updateGlobalButtons
  });

  // v63 イベントを初期化時に起動
  initEvents({
    onZoomChange, onRenderClick, onPreviewClick,
    onFileInputChange, onLabelsClick,
    onColResizerMouseDown,
    onToggleAllClick, onToggleSubsClick, onToggleTasksClick,
    onModalCloseClick, onBackdropClick, onEscKeydown,
    onPngClick, onWindowResize, onFitClick
  });

  // modal closed at init
  document.body.classList.remove('modal-open');
  updateGlobalButtons();   // v44

  // v68 保管済CSVプルダウンを初期化（ESMコールバック連携）
  // v69 保管済CSV＋サンプルCSVプルダウンを初期化（サンプルの先頭を自動描画）
  initServerCsvPicker({
    selectId: 'csvSelector',
    onLoadCsvText: (text, meta) => handleServerCsvText(text, meta),
    manifestUrl: './csv/manifest.json',
    samplesUrl:  './csv/samples.json',
    csvBase: './csv/',
    maxItems: 10,
  })
});

