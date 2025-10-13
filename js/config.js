// js/config.js
import { DEFAULT_CATEGORY_ORDER } from './constants.js';

const DEFAULT_CONFIG = {
  categoryOrderEnabled: false,
  categoryOrder: [...DEFAULT_CATEGORY_ORDER],
};

const configState = {
  loaded: false,
  categoryOrderEnabled: DEFAULT_CONFIG.categoryOrderEnabled,
  categoryOrder: [...DEFAULT_CONFIG.categoryOrder],
};

function normalizeCategoryOrder(order) {
  if (!Array.isArray(order)) return [];
  return order
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => name.length > 0);
}

export async function loadAppConfig(url = './config.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[config] ${url} の取得に失敗しました (status: ${res.status})`);
      }
      return configState;
    }

    const data = await res.json();
    const enabled = data?.categoryOrderEnabled === true;
    const order = normalizeCategoryOrder(data?.categoryOrder);

    configState.categoryOrderEnabled = enabled;
    configState.categoryOrder = order.length ? order : [...DEFAULT_CONFIG.categoryOrder];
  } catch (err) {
    console.warn('[config] config.json の読み込みに失敗したため既定値を使用します', err);
  } finally {
    configState.loaded = true;
  }

  return configState;
}

export function getAppConfig() {
  return { ...configState, categoryOrder: [...configState.categoryOrder] };
}

export function getActiveCategoryOrder() {
  if (configState.categoryOrderEnabled) return [...configState.categoryOrder];
  return [...DEFAULT_CATEGORY_ORDER];
}

export function catRank(name) {
  const order = getActiveCategoryOrder();
  const index = order.indexOf(name);
  return index < 0 ? 9999 : index;
}
