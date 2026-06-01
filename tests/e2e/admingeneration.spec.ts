import { test, expect } from '@playwright/test';

test.describe('/admingeneration production UI', () => {
  test('loads preview-first builder with right advanced fields', async ({ page }) => {
    await page.goto('/admingeneration');

    await expect(page.getByText('Good evening, Creator')).toBeVisible();
    await expect(page.getByText('Advanced Prompt Builder')).toBeVisible();
    await expect(page.getByText('Timeline / Keyframes')).toBeVisible();
    await expect(page.getByText('1. Main Prompt')).toBeVisible();
    await expect(page.getByText('2. Scene Description')).toBeVisible();
    await expect(page.getByText('3. Subject')).toBeVisible();
    await expect(page.getByText('4. Environment')).toBeVisible();
  });

  test('studio cards are in left rail and selectable', async ({ page }) => {
    await page.goto('/admingeneration');

    await expect(page.getByText('Studio Systems')).toBeVisible();
    await expect(page.getByText('Text to Image')).toBeVisible();
    await expect(page.getByText('Image to Video')).toBeVisible();
    await expect(page.getByText('Text to Video')).toBeVisible();

    await page.getByText('Text to Video').click();
    await expect(page.getByText('Text to Video')).toBeVisible();
  });

  test('AI helper drawer opens and closes by X, outside click, and Escape', async ({ page }) => {
    await page.goto('/admingeneration');

    await page.getByRole('button', { name: /AI Helper/i }).click();
    await expect(page.getByText('AI Helper / Analyzer Console')).toBeVisible();

    await page.getByRole('button', { name: 'Close AI Helper' }).click();
    await expect(page.getByText('AI Helper / Analyzer Console')).not.toBeVisible();

    await page.getByRole('button', { name: /AI Helper/i }).click();
    await expect(page.getByText('AI Helper / Analyzer Console')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('AI Helper / Analyzer Console')).not.toBeVisible();

    await page.getByRole('button', { name: /AI Helper/i }).click();
    await expect(page.getByText('AI Helper / Analyzer Console')).toBeVisible();
    await page.mouse.click(20, 20);
    await expect(page.getByText('AI Helper / Analyzer Console')).not.toBeVisible();
  });

  test('AI helper has chat, voice, upload, URL, and search controls', async ({ page }) => {
    await page.goto('/admingeneration');
    await page.getByRole('button', { name: /AI Helper/i }).click();

    await expect(page.getByPlaceholder(/Talk to the helper/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Mic/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Speak/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Send/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Paste YouTube/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze/i })).toBeVisible();
    await expect(page.getByText(/Drop \/ upload references/i)).toBeVisible();
  });

  test('typing in helper sends to helper route, not old auth-blocked route', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', request => {
      requests.push(request.url());
    });

    await page.goto('/admingeneration');
    await page.getByRole('button', { name: /AI Helper/i }).click();

    const input = page.getByPlaceholder(/Talk to the helper/i);
    await input.fill('HELLO');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.waitForTimeout(1200);

    expect(requests.some(url => url.includes('/api/admingeneration/helper'))).toBeTruthy();
    expect(requests.some(url => url.includes('/api/streams/chat'))).toBeFalsy();
  });

  test('URL analyzer calls intake wrapper', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', request => {
      requests.push(request.url());
    });

    await page.goto('/admingeneration');
    await page.getByRole('button', { name: /AI Helper/i }).click();

    await page.getByPlaceholder(/Paste YouTube/i).fill('https://example.com');
    await page.getByRole('button', { name: /^Analyze$/ }).click();
    await page.waitForTimeout(1200);

    expect(requests.some(url => url.includes('/api/admingeneration/intake'))).toBeTruthy();
  });
});
