import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// テキストエリアにサンプルCSVを入力してレンダリングできるかを確認

test('renders bars from sample CSV', async ({ page }) => {
  await loadSampleCsv(page);
  // バーが生成されるまで待機し、1つ以上あることを確認
  await page.waitForSelector('#bars .bar');
  const count = await page.locator('#bars .bar').count();
  expect(count).toBeGreaterThan(0);
});
