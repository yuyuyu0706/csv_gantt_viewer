// state.js
// app.js 内のグローバル状態を一元化:contentReference[oaicite:12]{index=12}
import { DEFAULT_CONFIG_SNAPSHOT } from './config.js';

export const state = {
  model: { tasks:[], groups:[], min:null, max:null, dayWidth:28 }, // 既定28px:contentReference[oaicite:13]{index=13}
  collapsedCats: new Set(),
  collapsedSubs: new Set(),
  hideTaskRows: false,
  subsInitialized: false,
  config: DEFAULT_CONFIG_SNAPSHOT
};

