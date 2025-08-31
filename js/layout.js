// js/layout.js
import { fixBottomSync } from './renderer.js';

/* 月/日ヘッダの水平追従（今の実装をそのまま） */
export function syncHeaderToGrid(){
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

/* 左ラベル↔グリッドの縦同期 */
export function attachScrollSync(){
  //let tl, gg, gh;
  const tl = document.getElementById('taskLabels');
  const gg = document.getElementById('ganttGrid');
  const gh = document.getElementById('ganttHeader');
  if(!tl || !gg || !gh) return;
  // 再入防止
  let _syncingV = false;

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
    _syncingV=false;
  }, {passive:true});
}

/* 列幅ドラッグ（今の実装をそのまま） */
export function onColResizerMouseDown(e){
  const labels = document.getElementById('taskLabels');
  if (!labels) return;
  let startX = 0, startW = 0, dragging = false;
  const rootStyle = document.documentElement.style;
  const minW = 260, maxW = 720;

  const onMove = (ev)=>{
    if (!dragging) return;
    const clientX = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
    const dx = clientX - startX;
    let w = Math.max(minW, Math.min(maxW, startW + dx));
    rootStyle.setProperty('--labels-w', w + 'px');
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
  dragging = true;
  startX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
  startW = labels.offsetWidth;
  document.addEventListener('mousemove', onMove, {passive:false});
  document.addEventListener('mouseup', onUp, {passive:true});
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('touchend', onUp, {passive:true});
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
}

