// js/png.js
// NOTE: html2canvas は <script> で先に読み込んで window.html2canvas として使える前提
export async function exportPNGAll() {
  const src = document.querySelector('.gantt-wrapper');
  if (!src) { alert('gantt body not found'); return; }

  const clone = src.cloneNode(true);
  clone.id = 'exportClone';
  Object.assign(clone.style, {
    position: 'absolute', left: '-100000px', top: '0',
    maxHeight: 'none', height: 'auto', overflow: 'visible',
  });
  clone.classList.add('export-capture'); // 撮影用スタイル適用
  document.body.appendChild(clone);

  const cGrid   = clone.querySelector('.gantt-grid');
  const cLabels = clone.querySelector('.task-labels');
  const cHeader = clone.querySelector('.gantt-header');
  if (cGrid)   { cGrid.style.maxHeight = 'none'; cGrid.style.height = 'auto'; cGrid.style.overflow = 'visible'; }
  if (cLabels) { cLabels.style.maxHeight = 'none'; cLabels.style.height = 'auto'; cLabels.style.overflow = 'visible'; }
  if (cHeader) { cHeader.style.position = 'static'; }

  const cMonth = clone.querySelector('#monthRow');
  const cDay   = clone.querySelector('#dayRow');
  if (cMonth) cMonth.style.transform = 'none';
  if (cDay)   cDay.style.transform   = 'none';

  const cCanvas = clone.querySelector('#gridCanvas');
  const w = Math.max(
    clone.scrollWidth,
    cGrid ? cGrid.scrollWidth : 0,
    cCanvas ? cCanvas.scrollWidth : 0
  );

  const cBars = clone.querySelector('#bars');
  const barsH   = cBars ? cBars.scrollHeight : 0;
  const labelsH = cLabels ? cLabels.scrollHeight : 0;
  const headH   = (cHeader?.offsetHeight || 62);
  const h = Math.max(barsH, labelsH) + headH + 8;

  const canvas = await html2canvas(clone, {
    backgroundColor: '#ffffff', scale: 2,
    width: w, height: h, windowWidth: w, windowHeight: h,
    scrollX: 0, scrollY: 0, useCORS: true
  });

  const a = document.createElement('a');
  a.download = 'gantt.png';
  a.href = canvas.toDataURL('image/png');
  a.click();

  document.body.removeChild(clone);
}

