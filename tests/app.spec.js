import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const sampleCsvPath = path.join(__dirname, '..', 'csv', 'sample.csv');

// テキストエリアにサンプルCSVを入力してレンダリングできるかを確認

test('renders bars from sample CSV', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#csvInput');
  const csv = await fs.readFile(sampleCsvPath, 'utf-8');
  await page.fill('#csvInput', csv);
  await page.click('#renderBtn');
  // バーが生成されるまで待機し、1つ以上あることを確認
  await page.waitForSelector('#bars .bar');
  const count = await page.locator('#bars .bar').count();
  expect(count).toBeGreaterThan(0);
});
