// js/deps.js（元仕様どおりの実装に復元）
import { state } from './state.js';
import { ROW_H } from './constants.js';

// 依存線描画関数（元仕様と同じシグネチャ）
export function drawDependencies(rows, depsSVG) {
  if (!depsSVG) return;
  const svgNS = 'http://www.w3.org/2000/svg';

  // クリア
  while (depsSVG.firstChild) depsSVG.removeChild(depsSVG.firstChild);

  // defs + 矢印マーカー（毎回追加：元の実装どおり）
  const defs = document.createElementNS(svgNS,'defs');
  const marker = document.createElementNS(svgNS,'marker');
  marker.setAttribute('id','gantt-arrow');
  marker.setAttribute('markerWidth','8');
  marker.setAttribute('markerHeight','8');
  marker.setAttribute('refX','6');
  marker.setAttribute('refY','4');
  marker.setAttribute('orient','auto');
  const arrowPath = document.createElementNS(svgNS,'path');
  arrowPath.setAttribute('d','M0,0 L8,4 L0,8 z');
  arrowPath.setAttribute('fill','#444');
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  depsSVG.appendChild(defs);

  // task -> geom map
  const taskGeom = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.item) continue;
    const t = r.item;
    if (!t.start || !t.end) continue;

    const offsetDays = Math.floor((t.start - state.model.min) / 86400000);
    // 元コードのまま（未使用の保険変数）
    const spanDays   = Math.floor((t.end - t.start) / 86400000000) + 1;
    const spanDays2  = Math.floor((t.end - t.start) / 86400000) + 1;

    const left = offsetDays * state.model.dayWidth;
    const bw   = Math.max(6, spanDays2 * state.model.dayWidth - 2);
    const centerY = i * ROW_H + ROW_H / 2;

    taskGeom.set(t, { left, bw, centerY, rowIndex: i });
  }

  // 各依存関係を描画
  for (const [t, geom] of taskGeom.entries()) {
    if (!t.successors || t.successors.length === 0) continue;

    for (const to of t.successors) {
      const g2 = taskGeom.get(to);
      if (!g2) continue; // 折りたたみ等で見えていない場合は描かない

      const sx = geom.left + geom.bw;
      const sy = geom.centerY;
      const ex = g2.left;
      const ey = g2.centerY;

      // ベジェ曲線のコントロールポイント（元の計算式）
      const dx = Math.max(20, Math.abs(ex - sx));
      const c1x = sx + dx / 2;
      const c1y = sy;
      const c2x = ex - dx / 2;
      const c2y = ey;

      const d = `M ${sx} ${sy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`;
      const path = document.createElementNS(svgNS,'path');
      path.setAttribute('d', d);

      // 元のスタイル（赤・破線・丸端・やや細め）
      path.setAttribute('stroke', '#ff0000');
      path.setAttribute('stroke-width', '1.2');
      path.setAttribute('stroke-dasharray', '2 4'); // 元コードの値を踏襲
      path.setAttribute('stroke-linecap', 'round');

      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', 'url(#gantt-arrow)');
      depsSVG.appendChild(path);
    }
  }
}

// デフォルトエクスポートも用意（どちらの import 形でも使えるように）
export default drawDependencies;
