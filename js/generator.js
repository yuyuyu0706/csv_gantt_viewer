// js/generator.js
// @ts-check

/** @typedef {import('./types').Model} Model */

import { buildModel } from './model.js';
import { render, fixBottomSync } from './renderer.js';

/**
 * 生成パイプラインに注入する依存（UI 側から渡す）
 * @typedef {Object} GenerateDeps
 * @property {(mode:string)=>void} [setZoom]  ズームモードを変更（'day'|'week'|'month'）
 */

/**
 * CSV テキストをモデル化して描画まで行う、生成パイプラインの中核。
 * @param {Object} args
 * @param {string} args.csvText              入力 CSV テキスト
 * @param {('day'|'week'|'month')=} args.zoomMode  初期ズーム（未指定なら 'day'）
 * @param {(mode:string)=>void=} args.setZoom       外部から注入されるズーム setter
 * @param {boolean=} args.silent         エラー時のアラートを抑制するか
 * @returns {void}
 */
export function generateCore({ csvText, zoomMode, setZoom, silent = false }) {
  try {
    buildModel(csvText || '');
    if (setZoom) setZoom(zoomMode || 'day');   // setZoom は app.js から注入
    render();
    fixBottomSync();
  } catch (err) {
    // err は unknown として来るため、Error に絞り込んでから message を参照
    const e = /** @type {unknown} */ (err);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('generate error:', e);
    if (!silent) alert('チャート生成に失敗: ' + msg);
  }
}
