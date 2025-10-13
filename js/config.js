// js/config.js
// 設定ファイル（config.json）の読み込みと正規化を担当

/**
 * @typedef {{ viewpointOrder?: { enabled?: boolean, order?: unknown[] } }} RawConfig
 * @typedef {{ viewpointOrder: { enabled: boolean, order: string[] } }} AppConfig
 */

const DEFAULT_VIEWPOINT_ORDER = Object.freeze({ enabled: false, order: [] });

let currentConfig = cloneDefaultConfig();

function cloneDefaultConfig() {
  return {
    viewpointOrder: {
      enabled: DEFAULT_VIEWPOINT_ORDER.enabled,
      order: [...DEFAULT_VIEWPOINT_ORDER.order]
    }
  };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (item == null) continue;
    const text = String(item).trim();
    if (!text) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

/**
 * @param {unknown} raw
 * @returns {AppConfig}
 */
function normalizeConfig(raw) {
  const next = cloneDefaultConfig();
  if (!raw || typeof raw !== 'object') return next;

  const vp = /** @type {RawConfig['viewpointOrder']} */ ((raw).viewpointOrder);
  if (vp && typeof vp === 'object') {
    next.viewpointOrder.enabled = vp.enabled === true;
    next.viewpointOrder.order = toStringArray(vp.order);
  }
  return next;
}

/**
 * 現在の設定を取得する。
 * @returns {AppConfig}
 */
export function getConfig() {
  return currentConfig;
}

/**
 * config.json を読み込み、現在の設定を更新する。
 * 読み込みに失敗した場合は既定値にフォールバックする。
 * @param {string} [url]
 * @returns {Promise<AppConfig>}
 */
export async function loadConfig(url = './config.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
    const data = await res.json();
    currentConfig = normalizeConfig(data);
  } catch (err) {
    console.warn('[config] 設定の読み込みに失敗しました。既定値を使用します。', err);
    currentConfig = cloneDefaultConfig();
  }
  return currentConfig;
}

export const DEFAULT_CONFIG_SNAPSHOT = cloneDefaultConfig();
export { normalizeConfig as _normalizeConfigForTest };

