import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

test('renders today line', async ({ page }) => {
  await loadSampleCsv(page);
  await page.waitForSelector('#todayLightning path', { state: 'attached' });
  const todayCount = await page.locator('#todayLightning path').count();
  expect(todayCount).toBeGreaterThan(0);
});
