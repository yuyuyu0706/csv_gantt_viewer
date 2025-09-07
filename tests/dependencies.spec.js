import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// 依存線が正しく描画できていること

test('renders dependency lines', async ({ page }) => {
  await loadSampleCsv(page);
  await page.waitForSelector('#bars svg.deps path');
  const depCount = await page.locator('#bars svg.deps path').count();
  expect(depCount).toBeGreaterThan(0);
});
