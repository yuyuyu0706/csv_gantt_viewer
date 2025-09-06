// renderer.js — original behavior-preserving rendering split (ESM)
// @ts-check

/**
 * @typedef {Object} TaskItem
 * @property {string=} task
 * @property {string=} sub
 * @property {string=} name
 * @property {Date=}   start
 * @property {Date=}   end
 * @property {Date=}   check
 * @property {string=} status
 * @property {string=} priority
 * @property {string=} taskNo
 * /

/**
 * @typedef {{type:'group',    cat:string, items: TaskItem[]}}    GroupRow
 * @typedef {{type:'subgroup', cat:string, sub:string, key:string, items: TaskItem[]}} SubGroupRow
 * @typedef {{type:'task',     cat:string, item: TaskItem, displayName:string}}        TaskRow
 * @typedef {{type:'subtask',  cat:string, item: TaskItem, displayName:string}}        SubtaskRow
 * @typedef {{type:'milestone',cat:string, item: TaskItem, displayName:string}}        MilestoneRow
 * @typedef {GroupRow|SubGroupRow|TaskRow|SubtaskRow|MilestoneRow} Row
 */

/**
 * Gantt Chart のレンダリングモジュール
 * 
 * 主な機能:
 * - state.model のデータをもとに、行とバーを描画
 * - 依存線・マイルストーン・ラベルを生成
 * - 今日線（イナズマ線）を描画
 */
 
import { state } from './state.js';
import { toDate } from './utils/date.js'; // 既存と整合
import { ROW_H, BAR_H } from './constants.js';
import { fmtMD, daysBetween } from './utils/date.js';
import { drawDependencies } from './deps.js';
import { updateToggleAllBtn, updateGlobalButtons } from './toggles.js';

/**
 * 優先度テキストからCSSクラスとラベル文字を返すヘルパー
 * @param {string} p 優先度文字列（例: "高", "緊急"）
 * @returns {[string, string]} CSSクラス名と表示テキスト
 */

/** @type {(p:string)=>[string,string]} */
const prioClassText = (window.prioClassText) ? window.prioClassText : function(p){
  const v=(p||'').trim();
  if(v==='緊急') return ['urgent','緊急'];
  if(v==='高') return ['high','高'];
  if(v==='中') return ['mid','中'];
  if(v==='低') return ['low','低'];
  return ['',''];
};

/**
 * ステータスからバーの色コードを返すヘルパー
 * @param {string} s ステータス文字列
 * @returns {string} カラーコード
 */

/** @type {(s:string)=>string} */
const statusColor = (window.statusColor) ? window.statusColor : function(s){
  const v=String(s||'').replace(/[　]/g,' ').trim();
  if(v==='完了済み') return '#bdbdbd';
  if(v==='開始前') return '#ffffff';
  if(v==='進行中') return '#66bb6a';
  if(v==='遅延') return '#ffd54f';
  return '#66bb6a';
};

/**
 * バーの開始・終了日ラベルを追加するヘルパー
 * @param {HTMLElement} containerEl バーのコンテナ要素
 * @param {number} startX 開始位置X座標
 * @param {number} endX 終了位置X座標
 * @param {number} midY バー中央のY座標
 * @param {Date} startDate 開始日
 * @param {Date} endDate 終了日
 */

/** @type {(containerEl:HTMLElement,startX:number,endX:number,midY:number,startDate:Date,endDate:Date)=>void} */
const appendDateLabels = (window.appendDateLabels) ? window.appendDateLabels : function(containerEl, startX, endX, midY, startDate, endDate) {
  const s = document.createElement('div');
  s.className = 'date-label start';
  s.textContent = fmtMD(startDate);
  s.style.left = (startX - 4) + 'px';
  s.style.top  = midY + 'px';
  containerEl.appendChild(s);

  const e = document.createElement('div');
  e.className = 'date-label end';
  e.textContent = fmtMD(endDate);
  e.style.left = (endX + 4) + 'px';
  e.style.top  = midY + 'px';
  containerEl.appendChild(e);
};

/**
 * 開始日→終了日→名前の順に安定ソートする比較関数
 * @param {object} a タスクオブジェクト
 * @param {object} b タスクオブジェクト
 * @returns {number} 比較結果
 */

/** @type {(a:TaskItem,b:TaskItem)=>number} */
const cmpByStartThenName = (window.cmpByStartThenName) ? window.cmpByStartThenName : function(a, b){
  const ax = a?.start ? a.start.getTime() : Infinity;
  const bx = b?.start ? b.start.getTime() : Infinity;
  if (ax !== bx) return ax - bx;
  const ay = a?.end ? a.end.getTime() : Infinity;
  const by = b?.end ? b.end.getTime() : Infinity;
  if (ay !== by) return ay - by;
  const an = String(a?.task || a?.sub || a?.name || '');
  const bn = String(b?.task || b?.sub || b?.name || '');
  return an.localeCompare(bn, 'ja');
};

/**
 * 境界線を引くかどうかを判定する
 * @param {Date} d 日付
 * @param {'day'|'week'|'month'} mode ズームモード
 * @returns {boolean} true: 境界に該当
 */

/** @type {(d:Date,mode:'day'|'week'|'month')=>boolean} */
 const __isBoundary = (window.__isBoundary) ? window.__isBoundary : function(d,mode){
  if(mode==='day')   return true;
  if(mode==='week')  return d.getUTCDay()===0;
  if(mode==='month') return d.getUTCDate()===1;
  return true;
};

/**
 * 日付をUTC基準でその日の00:00に丸める
 * @param {Date} d 入力日付
 * @returns {Date} 丸められた日付
 */
function _startOfDayUTC(d) {
  // 本プロジェクトは getUTC* を用いた日付扱いのため、UTC基準で0時に丸める
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return x;
}

/**
 * タスク番号から階層深度を返す
 * @param {string} taskNo タスク番号 (例: "1.2.3")
 * @returns {number} 階層深度
 */
function _depthOfTaskNo(taskNo) {
  const s = String(taskNo || '').trim();
  if (!s) return 0;
  return s.split('.').filter(Boolean).length;
}

/**
 * 孫タスクかどうか判定する
 * @param {object} t タスクオブジェクト
 * @returns {boolean} 孫タスクならtrue
 */
function _isGrandchildTask(t) {
  return _depthOfTaskNo(t.taskNo) === 3;
}

/**
 * ステータスが「完了済み」か判定する
 * @param {object} t タスクオブジェクト
 * @returns {boolean} 完了済みならtrue
 */
function _isDoneStatus(t) {
  return String(t.status || '').replace(/[　]/g,' ').trim() === '完了済み';
}

/**
 * 孫タスクのうち未完了かつ終了日が今日より前の最も近い日を返す
 * @param {Array<object>} tasks タスク配列
 * @param {Date} todayUTC0 今日(UTC)の00:00
 * @returns {Date|null} スナップ対象の日付
 */
function findSnapDateForTodayLine(tasks, todayUTC0) {
  // 対象：孫タスク && 未完了 && End < today
  const cands = tasks.filter(t =>
    _isGrandchildTask(t) && !_isDoneStatus(t) && (t.end instanceof Date) && (t.end < todayUTC0)
  );
  if (!cands.length) return null;
  return cands.reduce((best, cur) => (best === null || cur.end > best ? cur.end : best), null);
}

/**
 * DOM参照をまとめて取得
 * @returns {{
 *   labelsEl: HTMLElement|null,
 *   gridEl: HTMLElement|null,
 *   monthRow: HTMLElement|null,
 *   dayRow: HTMLElement|null,
 *   leftHead: HTMLElement|null,
 *   headerEl: HTMLElement|null,
 *   zoomSel: HTMLSelectElement|null,
 *   canvas: HTMLElement|null,
 *   bars: HTMLElement|null
 * }}
 */
function _refs(){
  return {
    labelsEl: /** @type {HTMLElement|null} */ (document.getElementById('taskLabels')),
    gridEl:   /** @type {HTMLElement|null} */ (document.getElementById('ganttGrid')),
    monthRow: /** @type {HTMLElement|null} */ (document.getElementById('monthRow')),
    dayRow:   /** @type {HTMLElement|null} */ (document.getElementById('dayRow')),
    leftHead: /** @type {HTMLElement|null} */ (document.getElementById('leftHead')),
    headerEl: /** @type {HTMLElement|null} */ (document.getElementById('ganttHeader')),
    zoomSel:  /** @type {HTMLElement|null} */ (document.getElementById('zoom')),
    canvas:   /** @type {HTMLElement|null} */ (document.getElementById('gridCanvas')),
    bars:     /** @type {HTMLElement|null} */ (document.getElementById('bars')),
    todayEl:  /** @type {HTMLElement|null} */ (document.getElementById('todayLine')),
  };
}

/**
 * メイン描画関数
 *
 * 行構造の生成、ラベル、バー、依存線、今日線イナズマをすべて描画する。
 * @returns {void}
 */
export function render(){
  //const { labelsEl, canvas } = _refs();

  // rows list
  //labelsEl.innerHTML='';
  //const rows=[];

  const { labelsEl, canvas, gridEl, monthRow, dayRow, leftHead } = _refs();
  if (!labelsEl || !canvas || !gridEl || !monthRow || !dayRow || !leftHead) return;
  if (!state.model || !state.model.min || !state.model.max) return;

  // rows list
  labelsEl.innerHTML='';
  /** @type {Row[]} */
  const rows=[];

  for(const g of state.model.groups){
    rows.push({type:'group', cat:g.cat, items:g.items});
    if (state.collapsedCats.has(g.cat)) continue;

    // v52: マイルストーンカテゴリは特別扱い
    if (g.cat === 'マイルストーン') {
      for (const t of g.items) {
        const title = t.sub || t.task || t.name || '';
        rows.push({ type:'milestone', cat:g.cat, item:t, displayName:title });
      }
      continue;
    }

    // 観点ごとにグループ化
//    const bySub = new Map();
//    for(const t of g.items){

    /** @type {Map<string, TaskItem[]>} */
    const bySub = new Map();
    for (const t of g.items){
      const key = (t.sub || '(なし)');
      if(!bySub.has(key)) bySub.set(key, []);
      bySub.get(key).push(t);
    }

    // v49: 観点の最小開始日で並べ替え
//    const subsArr = Array.from(bySub.entries()).map(([subName, items]) => {
    const subsArr = Array.from(bySub.entries()).map(([subName, items]) => {
      /** @type {Date|null} */

      let minS = null;
      for (const it of /** @type {TaskItem[]} */(items)) {
//      for (const it of items) {
        if (!it.start) continue;
        if (minS === null || it.start < minS) minS = it.start;
      }
      return { subName, items, minS };
    }).sort((a, b) => {
      const ax = a.minS ? a.minS.getTime() : Infinity;
      const bx = b.minS ? b.minS.getTime() : Infinity;
      if (ax !== bx) return ax - bx;
      return (a.subName || '').localeCompare(b.subName || '', 'ja');
    });

    // rows 構築
    for (const { subName, items } of subsArr) {
      const key = `${g.cat}::${subName}`;
//      const withTask = items.some(it => it.task);
      let withTask = false;
      for (const it of /** @type {TaskItem[]} */ (items)) { if (it.task) { withTask = true; break; } }
      // 観点見出し行
      rows.push({ type:'subgroup', cat:g.cat, sub:subName, key, items });

      // 折りたたみ中なら子行なし
      if (state.collapsedSubs.has(key)) continue;

      // v50: 観点内も開始日→終了日→名前で安定ソート
//      const tasksInSub = items.filter(it => it.task).slice().sort(cmpByStartThenName);
//      const plainSub   = items.filter(it => !it.task).slice().sort(cmpByStartThenName);
      const tasksInSub = /** @type {TaskItem[]} */ (items.filter((it)=> !!it.task)).slice().sort(cmpByStartThenName);
      const plainSub   = /** @type {TaskItem[]} */ (items.filter((it)=> !it.task)).slice().sort(cmpByStartThenName);
      if (withTask) {
        if (!state.hideTaskRows) {
          for (const t of tasksInSub) {
            rows.push({ type:'task', cat:g.cat, item:t, displayName:t.task });
          }
        }
        for (const t of plainSub) {
          rows.push({ type:'subtask', cat:g.cat, item:t, displayName:t.sub || t.name });
        }
      } else {
        for (const t of plainSub) {
          rows.push({ type:'subtask', cat:g.cat, item:t, displayName:t.sub || t.name });
        }
      }
    }
  }

  // 左ペインラベル
  for(const r of rows){
    if(r.type==='group'){
      const n=document.createElement('div');
      n.className='label group'+(state.collapsedCats.has(r.cat)?' collapsed':'');
      n.dataset.cat=r.cat;
      n.innerHTML = `<span class="name">${r.cat}</span><span class="prio"></span>`;
      _refs().labelsEl.appendChild(n);

    } else if (r.type === 'subgroup') {
      const n = document.createElement('div');
      const key = r.key || `${r.cat}::${r.sub}`;
      n.className = 'label subgroup' + (state.collapsedSubs.has(key) ? ' collapsed' : '');
      n.dataset.cat = r.cat;
      n.dataset.key = key;
      n.innerHTML = `<span class="name">${r.sub}</span><span class="prio"></span>`;
      _refs().labelsEl.appendChild(n);

    }else if(r.type==='task'){
      const n=document.createElement('div');
      n.className='label task';
      n.dataset.cat=r.cat;
      const pp=prioClassText(r.item.priority);
      n.innerHTML = `<span class="name">${r.displayName || r.item.name}</span><span class="prio ${pp[0]}">${pp[1]}</span>`;
      _refs().labelsEl.appendChild(n);

    } else if (r.type === 'milestone') {
      const n = document.createElement('div');
      n.className = 'label milestone';
      n.dataset.cat = r.cat;
      n.innerHTML = `<span class="name">${r.displayName || ''}</span><span class="prio"></span>`;
      _refs().labelsEl.appendChild(n);

    }else{ // 'subtask'
      const n=document.createElement('div');
      n.className='label subtask';
      n.dataset.cat=r.cat;
      const pp=prioClassText(r.item.priority);
      n.innerHTML = `<span class="name">${r.displayName || r.item.sub || r.item.name}</span><span class="prio ${pp[0]}">${pp[1]}</span>`;
      _refs().labelsEl.appendChild(n);
    }
  }

  //const canvas   = _refs().canvas;
//  const linesWrap= canvas.querySelector('.grid-lines');
//  const bars     = canvas.querySelector('#bars');
//  const todayEl  = canvas.querySelector('#todayLine');

  const linesWrapEl = canvas.querySelector('.grid-lines');
  const barsEl      = canvas.querySelector('#bars');
  const todayEl     = _refs().todayEl; // id で取得したものを利用
  if (!(linesWrapEl instanceof HTMLElement) || !(barsEl instanceof HTMLElement)) return;
  const linesWrap = linesWrapEl;
  const bars = barsEl;

  linesWrap.innerHTML='';
  bars.innerHTML='';

  // 幅計算（右パディング込み）
  const RIGHT_PAD = 120;
//  const totalDays = daysBetween(state.model.min, state.model.max);
//  const widthPx   = totalDays * state.model.dayWidth + RIGHT_PAD;

  const min = /** @type {Date} */ (state.model.min);
  const max = /** @type {Date} */ (state.model.max);
  const dayWidth = /** @type {number} */ (state.model.dayWidth);
  const totalDays = daysBetween(min, max);
  const widthPx   = totalDays * dayWidth + RIGHT_PAD;

  canvas.style.width = widthPx + 'px';

  const rowsCount = rows.length;
  const contentH  = rowsCount * ROW_H;
  bars.style.height = contentH+'px';

  // 依存線用 SVG レイヤ
  let depsSVG = document.createElementNS('http://www.w3.org/2000/svg','svg');
  depsSVG.setAttribute('class','deps');
  depsSVG.setAttribute('width','100%');
  depsSVG.setAttribute('height', contentH + 'px');
  depsSVG.style.position = 'absolute';
  depsSVG.style.left = '0';
  depsSVG.style.top = '0';
  depsSVG.style.overflow = 'visible';
  depsSVG.style.pointerEvents = 'none';
  bars.appendChild(depsSVG);

  // 縦罫線（日/週/月）…元仕様：day は毎日、週/月は境界のみ
  const zoomSel = _refs().zoomSel;
  const mode = zoomSel ? zoomSel.value : 'day';
  let cur = new Date(state.model.min);
  for(let d=0; d<=totalDays; d++){
    if(d<totalDays && (mode==='day' || __isBoundary(cur,mode))){
      const x = d * state.model.dayWidth;
      const v = document.createElement('div');
      v.className='vline';
      v.style.left=x+'px';
      v.style.height=contentH+'px';
      linesWrap.appendChild(v);
    }
    cur = new Date(cur.getTime()+86400000);
  }

  // 横罫線
  for(let r=0; r<rowsCount; r++){
    const h=document.createElement('div');
    h.className='hline';
    h.style.top=(r*ROW_H + ROW_H)+'px';
    linesWrap.appendChild(h);
  }

  // バー群
  let rowIndex=0;
  const Y_PAD = Math.floor((ROW_H - BAR_H)/2);
  const catH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cat-bar-h')) || 12;

  // === イナズマ線用：今日(UTC 0時)と候補格納 ===
  const __today = new Date();
  const __todayUTC0 = new Date(Date.UTC(__today.getUTCFullYear(), __today.getUTCMonth(), __today.getUTCDate()));
  const __zigTargets = [];  // {rowTop, rowBottom, midY, endX}

  for(const r of rows){
    if(r.type==='group'){
      if (r.cat === 'マイルストーン') { rowIndex++; continue; }
      let minS=null,maxE=null;
      for(const t of r.items){
        if(!t.start||!t.end) continue;
        if(minS===null||t.start<minS) minS=t.start;
        if(maxE===null||t.end>maxE) maxE=t.end;
      }
      if(minS && maxE){
        const offsetDays = Math.floor((minS - state.model.min)/86400000);
        const spanDays   = Math.floor((maxE - minS)/86400000)+1;
        const left = offsetDays * state.model.dayWidth;
        const bw = Math.max(6, spanDays * state.model.dayWidth - 2);
        const bar=document.createElement('div');
        bar.className='bar cat';
        bar.dataset.cat=r.cat;
        const top = rowIndex*ROW_H + Math.max(0, Math.floor((ROW_H - catH)/2)) + 2; // center +2px
        bar.style.left=left+'px';
        bar.style.width=bw+'px';
        bar.style.top=top+'px';
        bars.appendChild(bar);

        // Start/End M/D
        const midY = top + catH/2;
        //appendDateLabels(bars, left, left + bw, midY, minS, maxE);
        appendDateLabels(bars, left, left + bw, midY, /** @type {Date} */(minS), /** @type {Date} */(maxE));
      }
      rowIndex++;
      continue;
    }

    if(r.type==='subgroup'){
      if (r.cat === 'マイルストーン') { rowIndex++; continue; }

      let minS = null, maxE = null;
      for (const t of r.items || []) {
        if (!t.start || !t.end) continue;
        if (minS === null || t.start < minS) minS = t.start;
        if (maxE === null || t.end   > maxE) maxE = t.end;
      }
      if (minS && maxE) {
        const offsetDays = Math.floor((minS - state.model.min)/86400000);
        const spanDays   = Math.floor((maxE - minS)/86400000) + 1;
        const left = offsetDays * state.model.dayWidth;
        const bw   = Math.max(6, spanDays * state.model.dayWidth - 2);
        const bar  = document.createElement('div');
        bar.className = 'bar subcat';   // 青バー
        bar.dataset.cat = r.cat;
        bar.dataset.sub = r.sub;
        const top = rowIndex*ROW_H + Math.max(0, Math.floor((ROW_H - catH)/2)) + 2;
        bar.style.left  = left + 'px';
        bar.style.width = bw   + 'px';
        bar.style.top   = top  + 'px';
        bars.appendChild(bar);

        const midY = top + catH/2;
//        appendDateLabels(bars, left, left + bw, midY, minS, maxE);
        appendDateLabels(bars, left, left + bw, midY, /** @type {Date} */(minS), /** @type {Date} */(maxE));
        // v59: 観点にも中間チェック ★M/D
        let repCheck = null;
        for (const t of (r.items || [])) {
          if (t.check instanceof Date) {
            if (repCheck === null || t.check < repCheck) repCheck = t.check;
          }
        }
        if (repCheck) {
          const checkX = Math.floor((repCheck - state.model.min)/86400000) * state.model.dayWidth;
          const star = document.createElement('div');
          star.className = 'check-label';
          star.textContent = '★ ' + fmtMD(repCheck) + '中間';
          star.style.left = (checkX + 0) + 'px';
          star.style.top  = (midY + 9) + 'px';
          bars.appendChild(star);
        }
      }
      rowIndex++;
      continue;
    }

    if (r.type === 'milestone') {
      const t = r.item;
//      const offsetDays = Math.floor((t.start - state.model.min)/86400000);
      const offsetDays = Math.floor((t.start - min)/86400000);
      const left = offsetDays * state.model.dayWidth;
      const midY = (rowIndex * ROW_H) + (ROW_H / 2);

      const star = document.createElement('div');
      star.className = 'ms-star';
      star.textContent = `★ ${fmtMD(t.start)} ${t.name}`;
      star.style.left = (left + 6) + 'px';
      star.style.top  = midY + 'px';
      bars.appendChild(star);

      rowIndex++;
      continue;
    }

    // 通常タスクバー
    const t = r.item;
//    const offsetDays = Math.floor((t.start - state.model.min)/86400000);
    const offsetDays = Math.floor((t.start - min)/86400000);
    const spanDays   = Math.floor((t.end   - t.start)/86400000)+1;

//    const left = offsetDays * state.model.dayWidth;
//    const bw   = Math.max(6, spanDays * state.model.dayWidth - 2);
    const left = offsetDays * dayWidth;
    const bw   = Math.max(6, spanDays * dayWidth - 2);

    const barTop = (rowIndex * ROW_H + Y_PAD);
    const bar  = document.createElement('div');
    bar.className   = 'bar';
    bar.style.left  = left+'px';
    bar.style.width = bw+'px';
    bar.style.top   = (rowIndex*ROW_H + Y_PAD)+'px';
    const color     = statusColor(t.status);
    bar.style.background = color;

    if(color==='#ffffff'){
      bar.style.borderColor=getComputedStyle(document.documentElement).getPropertyValue('--status-not-border')||'#cfd8dc';
    }

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent= t.name;
    bar.appendChild(name);

    // バー外側の M/D ラベル
    const BAR_H_PX = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || BAR_H;
    const centerY = barTop + BAR_H_PX / 2;

    const startLbl = document.createElement('div');
    startLbl.className = 'date-label start';
    startLbl.textContent = fmtMD(t.start);
    startLbl.style.left = left + 'px';
    startLbl.style.top  = centerY + 'px';

    const endLbl = document.createElement('div');
    endLbl.className = 'date-label end';
    endLbl.textContent = fmtMD(t.end);
    endLbl.style.left = (left + bw) + 'px';
    endLbl.style.top  = centerY + 'px';

    bars.appendChild(bar);
    bars.appendChild(startLbl);
    bars.appendChild(endLbl);

    // --- イナズマ対象：孫タスク(= t.task あり) & 未完了 & End<今日 の End「ラベル」を記録 ---
    const isLeaf = (r.type === 'task' || r.type === 'subtask');
    if (isLeaf) {
      const st = String(t.status || '').replace(/[　]/g,' ').trim();
      if (st !== '完了済み' && (t.end instanceof Date)) {
        // 今日(UTC0)より前かは後段でまとめて判定する。ここではラベル要素を保持。
        __zigTargets.push({
          rowTop: (rowIndex * ROW_H),
          rowBottom: (rowIndex * ROW_H) + ROW_H,
          midY: barTop + ((parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || BAR_H) / 2),
          endLbl,
          endDate: t.end,
        });
      }
    }

    // 中間チェック ★M/D
    if (t.check instanceof Date) {
      const checkDaysFromMin = Math.floor((t.check - state.model.min)/86400000);
      const checkX = checkDaysFromMin * state.model.dayWidth;
      const cx = Math.max(left + 0, Math.min(left + bw, checkX));
      const cy = barTop + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || BAR_H)/2 + 15;
      const ck = document.createElement('div');
      ck.className = 'check-label';
      ck.textContent = '★ ' + fmtMD(t.check) + '中間';
      ck.style.left = cx + 'px';
      ck.style.top  = cy + 'px';
      bars.appendChild(ck);
    }
    rowIndex++;
  }

  // 依存線描画（元仕様どおり）
  drawDependencies(rows, depsSVG);

  // ヘッダ／同期／ボタン
  renderHeader(totalDays, RIGHT_PAD);
  syncHeaderToGrid();
  fixBottomSync();
  updateToggleAllBtn();
  updateGlobalButtons();

  // === 今日“イナズマ線”（End の M/D ラベル左端へ“食い込む”） ======================
  // 0) 事前準備（ターゲット整列） — ※ __todayUTC0 は上部で一度だけ定義済みを再利用
  const targets = (__zigTargets || [])
    .filter(x => (x.endDate instanceof Date) && x.endDate < __todayUTC0)
    .sort((a,b)=> a.rowTop - b.rowTop);

  // 1) 今日の X（表示範囲外なら描かない）
  const todayDaysFromMin = Math.floor((__todayUTC0 - state.model.min)/86400000);
  const todayX = todayDaysFromMin * state.model.dayWidth;
  if (todayX < 0 || todayX > canvas.offsetWidth) {
    todayEl.hidden = true;
  }

  // 2) 既存縦線は隠す（重複を避ける）
  if (todayEl) todayEl.hidden = true;

  // 3) 旧イナズマを消去 → 新規 SVG 追加（ラベルが上に出るよう z-index を低めに）
  let lightning = canvas.querySelector('#todayLightning');
  if (lightning) lightning.remove();
  lightning = document.createElementNS('http://www.w3.org/2000/svg','svg');
  lightning.setAttribute('id','todayLightning');
  lightning.setAttribute('width','100%');
  lightning.setAttribute('height', contentH + 'px');
  lightning.style.position='absolute';
  lightning.style.left='0'; lightning.style.top='0';
  lightning.style.pointerEvents='none';
  lightning.style.overflow='visible';
  lightning.style.zIndex = '1';   // ← ラベルより下
  bars.appendChild(lightning);

  // 4) ベジェで“なめらか”に食い込むパスを構築
  //    縦に降りて、対象行では： todayX → (行上端+R) → Q(丸め) → [labelLeftX+bite] → Q → (行下端-R) → todayX
  const R = 8;         // カーブ半径
  const TOUCH_GAP = 1;  // ラベル“手前”で止めるギャップ(px)
  const barsRect = bars.getBoundingClientRect();
  const parts = [];
  let cursorY = 0;
  parts.push(`M ${Math.round(todayX)} ${0}`);

  for (const seg of targets) {
    const topY = Math.max(0, seg.rowTop);
    const botY = Math.min(contentH, seg.rowBottom);
    if (cursorY < topY) {
      // 対象行の直前まで縦に
      parts.push(`L ${Math.round(todayX)} ${Math.round(topY + Math.min(R, (botY-topY)/2))}`);
    }

    // ラベル右端（bars内相対X）を測る
    const lblRect = seg.endLbl.getBoundingClientRect();
    const labelRightX = (lblRect.right - barsRect.left);
    // 食い込み位置：ラベル右端“直外側”でピタッと止める（重なりなし）
    //  ※todayX より右へ出ないよう軽くクランプ
    const touchX = Math.max(0, Math.min(todayX - 1, labelRightX + TOUCH_GAP));
    const midY  = Math.round(seg.midY);
    
    // Qベジェで滑らかに左へ → さらに戻る
    //  todayX, topY+R  →  (CP: todayX, midY)  →  (touchX, midY)
    parts.push(`Q ${Math.round(todayX)} ${midY} ${Math.round(touchX)} ${midY}`);
    //  (biteX, midY)   →  (CP: todayX, midY)  →  (todayX, botY-R)
    parts.push(`Q ${Math.round(todayX)} ${midY} ${Math.round(todayX)} ${Math.round(botY - Math.min(R, (botY-topY)/2))}`);

    cursorY = botY;
  }
  if (cursorY < contentH) {
    parts.push(`L ${Math.round(todayX)} ${Math.round(contentH)}`);
  }

  // 5) path を描画（太めの濃いピンク＋丸端/丸継ぎ＋高精度レンダリング）
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d', parts.join(' '));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#d81b60');         // ← 濃いピンク
  path.setAttribute('stroke-width', '3');         // ← もう少し太く
  path.setAttribute('stroke-linecap', 'round');   // ← 丸端
  path.setAttribute('stroke-linejoin', 'round');  // ← 丸継ぎ
  path.setAttribute('shape-rendering', 'geometricPrecision');
  lightning.appendChild(path);

  // transform 同期に一本化するためゼロ固定
  const headerEl = _refs().headerEl;
  if (headerEl) headerEl.scrollLeft = 0;
}

/**
 * ヘッダー部（日付ラベルや縦線）の描画
 * @param {number} totalDays 全体の日数
 * @param {number} RIGHT_PAD 右側パディング幅
 * @returns {void}
 */
export function renderHeader(totalDays, RIGHT_PAD){
  const { monthRow, dayRow, leftHead, gridEl } = _refs();

  monthRow.innerHTML='';
  dayRow.innerHTML='';

  // ラベル列ぶんだけ押し出す
  const spacerW = document.getElementById('taskLabels').offsetWidth
      || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--labels-w')) || 360;
  leftHead.style.width = spacerW + 'px';
  monthRow.style.marginLeft = spacerW + 'px';
  dayRow.style.marginLeft   = spacerW + 'px';

  // 可視幅を本体に合わせる
  const grid = document.getElementById('ganttGrid');
  const w = grid ? grid.scrollWidth : 0;
  if(w){
    monthRow.style.width = w + 'px';
    dayRow.style.width   = w + 'px';
  }

  const zoomSel = _refs().zoomSel;
  const mode = zoomSel ? zoomSel.value : 'day';
  const dayWidth = state.model.dayWidth;

  // ガード分
  const GUARD_DAYS = 2;
  const headerWidth = (totalDays + GUARD_DAYS) * dayWidth;
  dayRow.style.width   = headerWidth + 'px';
  monthRow.style.width = headerWidth + 'px';

  // 日/週/月 目盛り（境界のみ）
  let cursor = new Date(state.model.min);
  for(let d=0; d<=totalDays + GUARD_DAYS; d++){
    const x=d*dayWidth;
    if(d < totalDays + GUARD_DAYS){
      if(mode==='day' || __isBoundary(cursor,mode)){
        const v=document.createElement('div');
        v.className='vline';
        v.style.left=x+'px';
        v.style.height='62px';
        dayRow.appendChild(v);

        const label=document.createElement('div');
        label.className='label';

        if(mode==='month'){
          label.style.left = (x + 6) + 'px';
          label.style.transform='translateX(0)';
          label.textContent=(cursor.getUTCMonth()+1)+'月';
        }else if(mode==='week'){
          label.style.left = (x + 6) + 'px';
          label.style.transform='translateX(0)';
          label.textContent=(cursor.getUTCMonth()+1)+'/'+cursor.getUTCDate();
        }else{
          label.style.left = (x + dayWidth/2) + 'px';
          label.textContent=String(cursor.getUTCDate());
        }
        dayRow.appendChild(label);
      }
    }
    cursor = new Date(cursor.getTime()+86400000);
  }

  // 月ラベル（dayのみ年+月、他は省略）
  if(mode!=='month'){
    let d0 = new Date(state.model.min), start = 0;
    for(let d=0; d<=totalDays + GUARD_DAYS; d++){
      const d1 = new Date(d0.getTime()+d*86400000);
      const monthChanged = (d === totalDays + GUARD_DAYS) || (d1.getUTCDate() === 1);
      if(monthChanged){
        const span = d - start;
        const labelDate = new Date(d0.getTime()+start*86400000);
        const label = document.createElement('div');
        label.className='label';
        label.style.left = (start*dayWidth + span*dayWidth/2) + 'px';
        label.textContent = `${labelDate.getUTCFullYear()}年 ${labelDate.getUTCMonth()+1}月`;
        monthRow.appendChild(label);
        start = d;
      }
    }
  }

  // 右パディング（スクロール末尾揃え）
  const pad1 = document.createElement('div');
  pad1.style.position='absolute';
  pad1.style.left=(totalDays*dayWidth)+'px';
  pad1.style.width=RIGHT_PAD+'px';
  pad1.style.height='1px';
  const pad2 = pad1.cloneNode();
  dayRow.appendChild(pad1);
  monthRow.appendChild(pad2);

  // ヘッダー横スクロール同期（translateXで追従）
  const sync = ()=>{
    const x = (_refs().gridEl.scrollLeft || 0);
    monthRow.style.transform = `translateX(${-x}px)`;
    dayRow.style.transform   = `translateX(${-x}px)`;
  };
  if (_refs().gridEl.__headerSync) _refs().gridEl.removeEventListener('scroll', _refs().gridEl.__headerSync);
  _refs().gridEl.__headerSync = sync;
  _refs().gridEl.addEventListener('scroll', sync, { passive: true });
  sync();
}

/**
 * ラベル部分とバー部分の高さを同期
 * @returns {void}
 */
export function fixBottomSync(){
  try{
    const labels = document.getElementById('taskLabels');
    const grid   = document.getElementById('ganttGrid');
    const bars   = document.getElementById('bars');
    if(!labels || !grid || !bars) return;
    const hsb = Math.max(0, grid.offsetHeight - grid.clientHeight);
    labels.style.paddingBottom = hsb + 'px';
    let spacer = document.getElementById('bottomSpacer');
    if(!spacer){
      spacer = document.createElement('div');
      spacer.id = 'bottomSpacer';
      bars.appendChild(spacer);
    }
    const need = Math.max(0, labels.scrollHeight - bars.scrollHeight);
    spacer.style.height = need + 'px';
  }catch(e){ console.error(e); }
}

/**
 * ヘッダー位置をスクロール位置と同期
 * @returns {void}
 */
function syncHeaderToGrid(){
  const { gridEl, monthRow, dayRow } = _refs();
  const x = gridEl.scrollLeft || 0;
  monthRow.style.transform = `translateX(${-x}px)`;
  dayRow.style.transform   = `translateX(${-x}px)`;
}

