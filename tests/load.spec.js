import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// 起動してサンプルCSVを読み込み、エラーせず描画すること

test('loads sample CSV without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await loadSampleCsv(page);
  expect(errors).toHaveLength(0);
});
