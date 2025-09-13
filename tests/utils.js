import fs from 'fs/promises';
import path from 'path';

const sampleCsvPath = path.join(__dirname, '..', 'csv', 'sample.csv');

export async function loadSampleCsv(page) {
  await page.goto('/');
  await page.click('#previewBtn');
  await page.waitForSelector('#csvInput', { state: 'visible' });
  const csv = await fs.readFile(sampleCsvPath, 'utf-8');
  await page.fill('#csvInput', csv);
  await page.click('#renderBtn');
  await page.waitForSelector('#bars .bar');
}
