// js/toggles.js
import { state } from './state.js';

// 現在、カテゴリ行に「展開中」が1つでもあるか
function anyExpanded(){
  try{
    const cats = [...document.querySelectorAll('#taskLabels .label.group')]
      .map(el => el.dataset.cat).filter(Boolean);
    if (cats.length === 0) return false;
    return cats.some(c => !state.collapsedCats.has(c));
  }catch(_){ return false; }
}

// WBS側のトグル操作 依存注入で UI 側の再描画を呼んでもらう
export function makeOnToggleAllClick({ render, fixBottomSync, updateToggleAllBtn } = {}){
  return function onToggleAllClick(e){
    e?.stopPropagation?.();
    const cats = [...document.querySelectorAll('#taskLabels .label.group')]
      .map(el => el.dataset.cat).filter(Boolean);
    const allCollapsed = cats.length > 0 && cats.every(c => state.collapsedCats.has(c));
    if (allCollapsed) {
      state.collapsedCats.clear();
    } else {
      state.collapsedCats = new Set(cats);
    }
    // UI側のフックを“呼ぶだけ”
    render && render();
    updateToggleAllBtn && updateToggleAllBtn();
    fixBottomSync && fixBottomSync();
  };
}

export function makeOnToggleSubsClick({ render, fixBottomSync, updateGlobalButtons } = {}) {
  return function onToggleSubsClick() {
    const keys = [];
    for (const g of state.model.groups) {
      const seen = new Set();
      for (const t of g.items) {
        const subName = t.sub || '(なし)';
        if (!seen.has(subName)) { seen.add(subName); keys.push(`${g.cat}::${subName}`); }
      }
    }
    const allCollapsed = keys.length > 0 && keys.every(k => state.collapsedSubs.has(k));
    if (allCollapsed) state.collapsedSubs.clear();
    else keys.forEach(k => state.collapsedSubs.add(k));
    render && render();
    fixBottomSync && fixBottomSync();
    updateGlobalButtons && updateGlobalButtons();
  };
}

export function makeOnToggleTasksClick({ render, fixBottomSync, updateGlobalButtons } = {}) {
  return function onToggleTasksClick() {
    state.hideTaskRows = !state.hideTaskRows;
    render && render();
    fixBottomSync && fixBottomSync();
    updateGlobalButtons && updateGlobalButtons();
  };
}

export function updateToggleAllBtn(){
  const btn = document.getElementById('toggleAllBtn');
  if(!btn) return;
  btn.textContent = anyExpanded() ? '全て折りたたむ' : '全て展開';
}

export function updateGlobalButtons(){
  const subsBtn  = document.getElementById('toggleSubsBtn');
  const tasksBtn = document.getElementById('toggleTasksBtn');

  // 観点ボタンの文言：1つでも展開されていれば「観点のみ折りたたみ」、全て折りたたみ済みなら「観点のみ展開」
  if (subsBtn) {
    // 現在DOMにある観点キーを収集
    const keys = Array.from(document.querySelectorAll('#taskLabels .label.subgroup')).map(el=>{
      const key = el.dataset.key || `${el.dataset.cat}::${el.querySelector('.name')?.textContent || ''}`;
      return key;
    });
    const anyExpandedSub = keys.some(k => !state.collapsedSubs.has(k));
    subsBtn.textContent = anyExpandedSub ? '観点のみ折りたたみ' : '観点のみ展開';
  }

  // タスクボタンの文言：非表示なら「タスクのみ展開」、表示中なら「タスクのみ折りたたみ」
  if (tasksBtn) {
    tasksBtn.textContent = state.hideTaskRows ? 'タスクのみ展開' : 'タスクのみ折りたたみ';
  }
}


