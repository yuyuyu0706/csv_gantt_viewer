import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// 縦スクロール：タスクとバーが同期すること
// 横スクロール：ヘッダーとバーが同期すること


test('synchronizes vertical scrolling', async ({ page }) => {
  await loadSampleCsv(page);

  // 高さを縮めてスクロールバーを確実に出す
  await page.evaluate(() => {
    const tl = document.getElementById('taskLabels');
    const gg = document.getElementById('ganttGrid');
    if (tl) tl.style.maxHeight = '100px';
    if (gg) gg.style.maxHeight = '100px';
  });

  const tl = page.locator('#taskLabels');
  const gg = page.locator('#ganttGrid');

  // ラベル側をスクロール
  await tl.evaluate(el => el.scrollTo(0, 120));
  await page.waitForTimeout(100);
  const tlScroll = await tl.evaluate(el => el.scrollTop);
  const ggScroll = await gg.evaluate(el => el.scrollTop);
  expect(ggScroll).toBe(tlScroll);

  // グリッド側をスクロール
  await gg.evaluate(el => el.scrollTo(0, 160));
  await page.waitForTimeout(100);
  const tlScroll2 = await tl.evaluate(el => el.scrollTop);
  const ggScroll2 = await gg.evaluate(el => el.scrollTop);
  expect(tlScroll2).toBe(ggScroll2);
});

test('synchronizes horizontal scrolling', async ({ page }) => {
  await loadSampleCsv(page);

  // 幅を縮めて横スクロールバーを確実に出す
  await page.evaluate(() => {
    const grid = document.getElementById('ganttGrid');
    if (grid) grid.style.width = '400px';
  });

  const grid = page.locator('#ganttGrid');
  const month = page.locator('#monthRow');
  const day = page.locator('#dayRow');

  await grid.evaluate(el => el.scrollTo(150, 0));
  await page.waitForTimeout(100);
  const scrollLeft = await grid.evaluate(el => el.scrollLeft);

  const monthX = await month.evaluate(el => {
    const m = el.style.transform.match(/translateX\((-?\d+)px\)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const dayX = await day.evaluate(el => {
    const m = el.style.transform.match(/translateX\((-?\d+)px\)/);
    return m ? parseInt(m[1], 10) : 0;
  });

  expect(monthX).toBe(-scrollLeft);
  expect(dayX).toBe(-scrollLeft);
});
