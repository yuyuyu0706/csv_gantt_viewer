import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// 幅フィットが正常に動作すること

test('fits gantt chart width to container', async ({ page }) => {
  await loadSampleCsv(page);

  const before = await page.evaluate(() => {
    const grid = document.getElementById('ganttGrid');
    const canvas = document.getElementById('gridCanvas');
    return { gridWidth: grid.clientWidth, canvasWidth: canvas.scrollWidth };
  });
  expect(before.canvasWidth).toBeGreaterThan(before.gridWidth);

  await page.click('#fitBtn');

  const after = await page.evaluate(() => {
    const grid = document.getElementById('ganttGrid');
    const canvas = document.getElementById('gridCanvas');
    return { gridWidth: grid.clientWidth, canvasWidth: canvas.scrollWidth };
  });
  expect(after.canvasWidth).toBeLessThanOrEqual(after.gridWidth + 1);
});
