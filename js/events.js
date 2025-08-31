// events.js

export function initEvents(h = {}) {

  // ズーム
  if (h.onZoomChange) {
    const el = document.getElementById('zoom');
    el && el.addEventListener('change', h.onZoomChange, { passive: true });
  }

  // 描画ボタン
  if (h.onRenderClick) {
    const el = document.getElementById('renderBtn');
    el && el.addEventListener('click', h.onRenderClick);
  }

  // 以降、他イベントも同じパターンで追加していく
  if (h.onPreviewClick) {
    const el = document.getElementById('previewBtn');
    el && el.addEventListener('click', h.onPreviewClick);
  }

  if (h.onFileInputChange) {
    const el = document.getElementById('fileInput');
    el && el.addEventListener('change', h.onFileInputChange, { passive: true });
  }
  if (h.onSampleClick) {
    const el = document.getElementById('sampleBtn');
    el && el.addEventListener('click', h.onSampleClick);
  }
  if (h.onPngClick) {
    const el = document.getElementById('pngBtn');
    el && el.addEventListener('click', h.onPngClick, { passive: true });
  }
  if (h.onLabelsClick) {
    const wrap = document.getElementById('taskLabels');
    wrap && wrap.addEventListener('click', h.onLabelsClick, { passive: true });
  }
  if (h.onColResizerMouseDown) {
    const resizer = document.getElementById('colResizer');
    resizer && resizer.addEventListener('mousedown', h.onColResizerMouseDown, { passive: false });
  }
  if (h.onWindowResize) {
    window.addEventListener('resize', h.onWindowResize, { passive: true });
  }
  if (h.onFitClick) {
    const el = document.getElementById('fitBtn');
    el && el.addEventListener('click', h.onFitClick);
  }
  if (h.onToggleAllClick) {
    const el = document.getElementById('toggleAllBtn');
    el && el.addEventListener('click', h.onToggleAllClick);
  }
  if (h.onToggleSubsClick) {
    const el = document.getElementById('toggleSubsBtn');
    el && el.addEventListener('click', h.onToggleSubsClick);
  }
  if (h.onToggleTasksClick) {
    const el = document.getElementById('toggleTasksBtn');
    el && el.addEventListener('click', h.onToggleTasksClick);
  }
  if (h.onModalCloseClick || h.onBackdropClick || h.onEscKeydown) {
    const close = document.getElementById('modalClose');
    const backdrop = document.getElementById('modalBackdrop');
    close && close.addEventListener('click', h.onModalCloseClick);
    backdrop && backdrop.addEventListener('click', h.onBackdropClick);
    if (h.onEscKeydown) window.addEventListener('keydown', h.onEscKeydown);
  }
}

