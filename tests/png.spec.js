import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// PNG出力が機能すること

test('exports gantt chart as PNG', async ({ page }) => {
  await loadSampleCsv(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#pngBtn'),
  ]);
  expect(download.suggestedFilename()).toBe('gantt.png');
});
