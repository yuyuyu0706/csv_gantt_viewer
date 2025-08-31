// renderer.js — original behavior-preserving rendering split (ESM)
import { state } from './state.js';
import { ROW_H, BAR_H } from './constants.js';
import { fmtMD, daysBetween } from './utils/date.js';
import { drawDependencies } from './deps.js';
import { updateToggleAllBtn, updateGlobalButtons } from './toggles.js';

// ---- helpers（元の app.js 相当。window に無ければフォールバック実装）----
const prioClassText = (window.prioClassText) ? window.prioClassText : function(p){
  const v=(p||'').trim();
  if(v==='緊急') return ['urgent','緊急'];
  if(v==='高') return ['high','高'];
  if(v==='中') return ['mid','中'];
  if(v==='低') return ['low','低'];
  return ['',''];
};
const statusColor = (window.statusColor) ? window.statusColor : function(s){
  const v=String(s||'').replace(/[　]/g,' ').trim();
  if(v==='完了済み') return '#bdbdbd';
  if(v==='開始前') return '#ffffff';
  if(v==='進行中') return '#66bb6a';
  if(v==='遅延') return '#ffd54f';
  return '#66bb6a';
};
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
const __isBoundary = (window.__isBoundary) ? window.__isBoundary : function(d,mode){
  if(mode==='day')   return true;
  if(mode==='week')  return d.getUTCDay()===0;
  if(mode==='month') return d.getUTCDate()===1;
  return true;
};

// 参照取得（元はグローバル変数だったもの）
function _refs(){
  return {
    labelsEl: document.getElementById('taskLabels'),
    gridEl:   document.getElementById('ganttGrid'),
    monthRow: document.getElementById('monthRow'),
    dayRow:   document.getElementById('dayRow'),
    leftHead: document.getElementById('leftHead'),
    headerEl: document.getElementById('ganttHeader'),
    zoomSel:  document.getElementById('zoom'),
    canvas:   document.getElementById('gridCanvas'),
    bars:     document.getElementById('bars'),
  };
}

// ===================== 元の render() =====================
export function render(){
  const { labelsEl, canvas } = _refs();

  // rows list
  labelsEl.innerHTML='';
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
    const bySub = new Map();
    for(const t of g.items){
      const key = (t.sub || '(なし)');
      if(!bySub.has(key)) bySub.set(key, []);
      bySub.get(key).push(t);
    }

    // v49: 観点の最小開始日で並べ替え
    const subsArr = Array.from(bySub.entries()).map(([subName, items]) => {
      let minS = null;
      for (const it of items) {
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
      const withTask = items.some(it => it.task);

      // 観点見出し行
      rows.push({ type:'subgroup', cat:g.cat, sub:subName, key, items });

      // 折りたたみ中なら子行なし
      if (state.collapsedSubs.has(key)) continue;

      // v50: 観点内も開始日→終了日→名前で安定ソート
      const tasksInSub = items.filter(it => it.task).slice().sort(cmpByStartThenName);
      const plainSub   = items.filter(it => !it.task).slice().sort(cmpByStartThenName);

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
  const linesWrap= canvas.querySelector('.grid-lines');
  const bars     = canvas.querySelector('#bars');
  const todayEl  = canvas.querySelector('#todayLine');
  linesWrap.innerHTML='';
  bars.innerHTML='';

  // 幅計算（右パディング込み）
  const RIGHT_PAD = 120;
  const totalDays = daysBetween(state.model.min, state.model.max);
  const widthPx   = totalDays * state.model.dayWidth + RIGHT_PAD;
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
        appendDateLabels(bars, left, left + bw, midY, minS, maxE);
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
        appendDateLabels(bars, left, left + bw, midY, minS, maxE);

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
      const offsetDays = Math.floor((t.start - state.model.min)/86400000);
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
    const offsetDays = Math.floor((t.start - state.model.min)/86400000);
    const spanDays   = Math.floor((t.end   - t.start)/86400000)+1;
    const left = offsetDays * state.model.dayWidth;
    const bw   = Math.max(6, spanDays * state.model.dayWidth - 2);
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

  // 今日線
  const today=new Date();
  const tz=new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if(tz>=state.model.min && tz<=state.model.max){
    const off=Math.floor((tz-state.model.min)/86400000) * state.model.dayWidth;
    todayEl.hidden=false; todayEl.style.left=off+'px';
    todayEl.style.height=contentH+'px';
  } else {
    todayEl.hidden=true;
  }

  // transform 同期に一本化するためゼロ固定
  const headerEl = _refs().headerEl;
  if (headerEl) headerEl.scrollLeft = 0;
}

// ===================== 元の renderHeader() =====================
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

// ===================== 元の fixBottomSync() =====================
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

// 初期同期（render() から呼ぶ小ヘルパ）
function syncHeaderToGrid(){
  const { gridEl, monthRow, dayRow } = _refs();
  const x = gridEl.scrollLeft || 0;
  monthRow.style.transform = `translateX(${-x}px)`;
  dayRow.style.transform   = `translateX(${-x}px)`;
}

