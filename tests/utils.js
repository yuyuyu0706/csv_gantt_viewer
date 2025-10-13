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
  await page.waitForSelector('#taskLabels .label.subgroup');

  // 初期表示では観点が折りたたまれているため、テストでは展開しておく
  const toggleSubsBtn = await page.$('#toggleSubsBtn');
  if (toggleSubsBtn) {
    await toggleSubsBtn.click();
  }

  await page.waitForSelector('#bars .bar:not(.cat):not(.subcat)');
  // Ensure modal backdrop is removed before proceeding so clicks are not blocked
  await page.evaluate(() => {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.remove();
  });
}
