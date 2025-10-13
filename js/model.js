// js/model.js
import { parseCSV } from './utils/csv.js';
import { normHeaders, findHeaderIndex } from './utils/headers.js';
import { toDate } from './utils/date.js';
import { LEFT_START_PAD_DAYS } from './constants.js';
import { catRank } from './config.js';
import { state } from './state.js';

// ===== CSV -> model =====
export function buildModel(text){
  const rows = parseCSV(text);
  if(rows.length===0) throw new Error('CSVが空です');

  const header = normHeaders(rows[0]);
  const idx = {
    cat:      findHeaderIndex(['カテゴリ','category'], header),
    sub:      findHeaderIndex(['観点','小タスク','サブ','subtask','viewpoint'], header),
    task:     findHeaderIndex(['タスク','task'], header),
    start:    findHeaderIndex(['start','開始','開始日'], header),
    end:      findHeaderIndex(['end','終了','終了日'], header),
    assignee: findHeaderIndex(['担当者','assignee','責任者'], header),
    status:   findHeaderIndex(['進行状況','status'], header),
    priority: findHeaderIndex(['優先度','priority'], header),
    check:    findHeaderIndex(['check','チェック','中間','中間チェック'], header),
    taskno:   findHeaderIndex(['タスクno','taskno','task no','id','ID','タスクNo'], header),
    succ:     findHeaderIndex(['後続タスクno','後続タスクno','後続タスク','後続','successors','next','後続タスクNo'], header),
  };
  if(idx.cat<0 || idx.start<0 || idx.end<0) throw new Error('ヘッダ行に カテゴリ, Start, End が必要です');

  const rows2 = rows.slice(1).map(r=>{
    const sub   = idx.sub>=0 ? (r[idx.sub]||'').trim() : '';
    const task  = idx.task>=0 ? (r[idx.task]||'').trim() : '';
    const nm    = task || sub || (r[idx.cat]||'').trim();
    const s     = toDate(r[idx.start]);
    const e     = toDate(r[idx.end]) || s;
    return {
      cat:(r[idx.cat]||'').trim(),
      sub, task, name:nm, start:s, end:e,
      assignee: idx.assignee>=0 ? (r[idx.assignee]||'') : '',
      status:   idx.status>=0 ? (r[idx.status]||'') : '',
      priority: idx.priority>=0 ? (r[idx.priority]||'') : '',
      check:    idx.check>=0    ? toDate(r[idx.check])   : null,
      taskNo:   idx.taskno>=0 ? (r[idx.taskno]||'').trim() : '',
      successorsRaw: idx.succ>=0 ? (r[idx.succ]||'').trim() : '',
    };
  }).filter(t=> t.name && t.start && t.end && t.end>=t.start);
  if(rows2.length===0) throw new Error('有効なタスクがありません');

  let min = rows2[0].start, max = rows2[0].end;
  for(const t of rows2){ if(t.start<min) min=t.start; if(t.end>max) max=t.end; }

  // カテゴリごとにグループ化＋ソート
  const map = new Map();
  for(const t of rows2){ const k=t.cat||'(未分類)'; if(!map.has(k)) map.set(k,[]); map.get(k).push(t); }
  const groups = Array.from(map.entries())
    .sort((a,b)=>{ const ra=catRank(a[0]), rb=catRank(b[0]); if(ra!==rb) return ra-rb; return a[0].localeCompare(b[0],'ja'); })
    .map(([cat,items])=>({ cat, items: items.sort((x,y)=> (x.sub||'').localeCompare(y.sub||'','ja')) }));

  // 初期表示では観点（subgroup）を閉じた状態にする
  const subgroupKeys = new Set();
  for (const g of groups) {
    const seen = new Set();
    for (const t of g.items) {
      const subName = t.sub || '(なし)';
      if (seen.has(subName)) continue;
      seen.add(subName);
      subgroupKeys.add(`${g.cat}::${subName}`);
    }
  }

  if (!state.subsInitialized) {
    state.collapsedSubs = new Set(subgroupKeys);
    state.subsInitialized = true;
  } else {
    const prev = state.collapsedSubs || new Set();
    const next = new Set();
    for (const key of subgroupKeys) {
      if (prev.has(key)) next.add(key);
    }
    state.collapsedSubs = next;
  }

  // 後続タスクの実体参照を解決
  const idMap = new Map(); for (const t of rows2) if (t.taskNo) idMap.set(String(t.taskNo), t);
  for (const t of rows2) {
    t.successors = [];
    if (!t.successorsRaw) continue;
    const parts = String(t.successorsRaw).split(';').map(x=>x.trim()).filter(Boolean);
    for (const pid of parts) {
      const toTask = idMap.get(String(pid));
      if (toTask && toTask !== t) t.successors.push(toTask);
      else console.warn('後続タスク参照が見つかりません:', pid, 'from', t.taskNo);
    }
  }

  // 左余白（日数）を考慮して state.model を更新
  const minPadded = new Date(min.getTime() - LEFT_START_PAD_DAYS * 86400000);
  state.model = { tasks:rows2, groups, min: minPadded, max, dayWidth: state.model.dayWidth };
}

