import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// 今日線が正しく描画できていること

test('renders today line', async ({ page }) => {
  await loadSampleCsv(page);
  await page.waitForSelector('#todayLightning path');
  const todayCount = await page.locator('#todayLightning path').count();
  expect(todayCount).toBeGreaterThan(0);
});
