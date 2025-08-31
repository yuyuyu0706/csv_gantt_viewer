// js/modal.js
export function openModal() {
  document.body.classList.add('modal-open');
}

export function closeModal() {
  document.body.classList.remove('modal-open');
}

/**
 * CSVプレビューを最新化してからモーダルを開く
 * @param {(text:string)=>void} renderCsvPreview  既存のプレビュー描画関数（app.js内）
 * @param {string} csvText                         現在のCSV文字列
 */
export function showCsvPreview(renderCsvPreview, csvText) {
  try {
    renderCsvPreview(csvText || '');
  } catch (e) {
    console.warn('renderCsvPreview failed:', e);
  }
  openModal();
}

