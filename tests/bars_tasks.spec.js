import { test, expect } from '@playwright/test';
import { loadSampleCsv } from './utils.js';

// バーやタスク、担当者バッチが崩れず描画できていること

test('renders bars, tasks and assignee badges', async ({ page }) => {
  await loadSampleCsv(page);

  const barLocator = page.locator('#bars .bar');
  const taskLocator = page.locator('#taskLabels .label.task, #taskLabels .label.subtask');
  const assigneeLocator = page.locator('#taskLabels .label .assignee');

  expect(await barLocator.count()).toBeGreaterThan(0);
  expect(await taskLocator.count()).toBeGreaterThan(0);
  expect(await assigneeLocator.count()).toBeGreaterThan(0);

  const barBox = await barLocator.first().boundingBox();
  const taskBox = await taskLocator.first().boundingBox();
  const assigneeBox = await assigneeLocator.first().boundingBox();

  expect(barBox?.width || 0).toBeGreaterThan(0);
  expect(taskBox?.width || 0).toBeGreaterThan(0);
  expect(assigneeBox?.width || 0).toBeGreaterThan(0);
});
