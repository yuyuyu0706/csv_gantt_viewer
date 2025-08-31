// js/generator.js
// @ts-check

/** @typedef {import('./types').Model} Model */

import { buildModel } from './model.js';
import { render, fixBottomSync } from './renderer.js';

/**
 * @typedef {Object} GenerateDeps
 * @property {(mode:string)=>void} [setZoom]
 */

/**
 * 生成パイプライン本体
 * @param {{ csvText: string, zoomMode?: string } & GenerateDeps} args
 */
 
export function generateCore({ csvText, zoomMode, setZoom }) {
  try {
    buildModel(csvText || '');
    if (setZoom) setZoom(zoomMode || 'day');   // setZoom は app.js から注入
    render();
    fixBottomSync();
  } catch (err) {
    console.error('generate error:', err);
    alert('チャート生成に失敗: ' + (err?.message || err));
  }
}
