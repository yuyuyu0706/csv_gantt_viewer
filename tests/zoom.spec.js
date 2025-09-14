import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// 週・月表示への切り替えが正常に行われレイアウトが崩れないこと

test('switches to week view without layout issues', async ({ page }) => {
  await loadSampleCsv(page);
  await page.selectOption('#zoom', 'week');
  await page.waitForSelector('#dayRow .label');

  const labelText = await page.locator('#dayRow .label').first().textContent();
  expect(labelText).toMatch(/\d+\/\d+/);

  const barBox = await page.locator('#bars .bar').first().boundingBox();
  const labelBox = await page.locator('#taskLabels .label').first().boundingBox();
  const barsTop = await page.locator('#bars').boundingBox();
  const labelsTop = await page.locator('#taskLabels').boundingBox();
  expect(barBox?.width || 0).toBeGreaterThan(0);
  expect(labelBox?.width || 0).toBeGreaterThan(0);
  const barY = (barBox?.y || 0) - (barsTop?.y || 0);
  const labelY = (labelBox?.y || 0) - (labelsTop?.y || 0);
  expect(Math.abs(barY - labelY)).toBeLessThan(5);
});

test('switches to month view without layout issues', async ({ page }) => {
  await loadSampleCsv(page);
  await page.selectOption('#zoom', 'month');
  await page.waitForSelector('#dayRow .label');

  const labelText = await page.locator('#dayRow .label').first().textContent();
  expect(labelText).toMatch(/\d+月/);

  const barBox = await page.locator('#bars .bar').first().boundingBox();
  const labelBox = await page.locator('#taskLabels .label').first().boundingBox();
  const barsTop = await page.locator('#bars').boundingBox();
  const labelsTop = await page.locator('#taskLabels').boundingBox();
  expect(barBox?.width || 0).toBeGreaterThan(0);
  expect(labelBox?.width || 0).toBeGreaterThan(0);
  const barY = (barBox?.y || 0) - (barsTop?.y || 0);
  const labelY = (labelBox?.y || 0) - (labelsTop?.y || 0);
  expect(Math.abs(barY - labelY)).toBeLessThan(5);
});
