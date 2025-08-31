// js/generator.js
import { buildModel } from './model.js';
import { render, fixBottomSync } from './renderer.js';

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
