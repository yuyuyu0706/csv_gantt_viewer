// js/csv-select.js  ← ESM（app.js から import）

/**
 * @typedef {{ name: string, kind: 'sample'|'stored' }} Item
 * @typedef {{ selectId: string, onLoadCsvText: (text:string, meta:{name:string, source:'server'})=>void,
 *             manifestUrl?: string, samplesUrl?: string, csvBase?: string, maxItems?: number }} PickerOptions
 */

/**
 * サーバ保管CSV＋サンプルCSVのプルダウンを初期化。
 * - 先頭10件（既定）に整形（サンプル優先→保管済）
 * - 選択＝即fetch→onLoadCsvText
 * - 初期化時に「サンプルの先頭」を自動ロード（あれば）
 */
export async function initServerCsvPicker(opts /** @type {PickerOptions} */) {
  const MANIFEST_URL = opts.manifestUrl ?? './csv/manifest.json';
  const SAMPLES_URL  = opts.samplesUrl  ?? './csv/samples.json';
  const CSV_BASE     = opts.csvBase     ?? './csv/';
  const MAX_ITEMS    = opts.maxItems    ?? 10;

  /** @type {HTMLSelectElement|null} */
  const selectEl = document.getElementById(opts.selectId);
  if (!selectEl) { console.warn(`[csv-select] #${opts.selectId} が見つかりません`); return; }

  // 初期ロード
  selectEl.disabled = true;
  setOptions(selectEl, [{ label: '(読み込み中...)', value: '' }]);

  try {
    const [samples, stored] = await Promise.all([
      fetchList(SAMPLES_URL),         // サンプル
      fetchList(MANIFEST_URL),        // 保管済（以前からの manifest）
    ]);
    // サンプル→保管済の順に詰め、最大MAX_ITEMS件
    /** @type {Item[]} */
    const merged = [
      ...samples.map(name => ({ name, kind: 'sample' })),
      ...stored .map(name => ({ name, kind: 'stored'  })),
    ].slice(0, MAX_ITEMS);

    if (merged.length === 0) {
      setOptions(selectEl, [{ label: '(csv/ に表示可能なCSVがありません)', value: '' }]);
      return;
    }

    setOptions(selectEl, [
    //  { label: '(選択してください)', value: '' },
      ...merged.map(it => ({
        // 先頭に [S] をつけてサンプルを軽く識別（文言はお好みで）
        label: (it.kind === 'sample' ? '[S] ' : '') + it.name,
        value: it.name
      }))
    ]);
    selectEl.disabled = false;

    // === 初回自動ロード：サンプルの先頭があればそれを、なければ先頭項目 ===
    const firstSample = merged.find(it => it.kind === 'sample') ?? merged[0];
    if (firstSample) {
      await loadAndRender(firstSample.name);
      // UIの選択状態も揃える
      const idx = Array.from(selectEl.options).findIndex(o => o.value === firstSample.name);
      if (idx >= 0) selectEl.selectedIndex = idx;
    }
  } catch (e) {
    console.error('[csv-select] 初期化失敗:', e);
    setOptions(selectEl, [{ label: '(manifest/samples の読み込みに失敗)', value: '' }]);
  }

  // 選択＝即描画
  selectEl.addEventListener('change', async () => {
    const filename = selectEl.value;
    if (!filename) return;
    await loadAndRender(filename);
  });

  async function loadAndRender(filename) {
    const beforeLabel = selectEl.selectedOptions[0]?.textContent ?? filename;
    const idx = selectEl.selectedIndex;
    selectEl.disabled = true;
    if (idx >= 0) selectEl.options[idx].textContent = `${beforeLabel} (読込中...)`;
    try {
      const res = await fetch(CSV_BASE + filename, { cache: 'no-store' });
      if (!res.ok) throw new Error(`csv fetch failed: ${res.status}`);
      const text = await res.text();
      opts.onLoadCsvText(text, { name: filename, source: 'server' });
    } finally {
      if (idx >= 0) selectEl.options[idx].textContent = beforeLabel;
      selectEl.disabled = false;
    }
  }
}

/** @returns {Promise<string[]>} */
async function fetchList(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`list fetch failed: ${res.status} @ ${url}`);
  /** @type {unknown} */ const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter(v => typeof v === 'string' && v.toLowerCase().endsWith('.csv'));
}

/** @param {HTMLSelectElement} el @param {{label:string,value:string}[]} items */
function setOptions(el, items) {
  el.innerHTML = '';
  for (const it of items) el.append(new Option(it.label, it.value));
}

