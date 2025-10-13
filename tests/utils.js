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

  // チャート生成後はモーダルを閉じて操作系をブロックしないようにする
  const modalOpen = await page.evaluate(() => document.body.classList.contains('modal-open'));
  if (modalOpen) {
    const closeBtn = await page.$('#modalClose');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForSelector('#csvModal', { state: 'hidden' });
    } else {
      await page.evaluate(() => document.body.classList.remove('modal-open'));
    }
  }

  // 初期表示では観点が折りたたまれているため、テストでは展開しておく
  const toggleSubsBtn = await page.$('#toggleSubsBtn');
  if (toggleSubsBtn) {
    await toggleSubsBtn.click();
  }

  await page.waitForSelector('#bars .bar:not(.cat):not(.subcat)');
}
