import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke coverage: the four screens render and the one flow that ties them
 * together – checking sets – moves XP, the cursor and the chronicle.
 *
 * The interaction rules themselves are covered by the Vitest specs; this only
 * proves they survive the trip through the store and the DOM.
 */

async function freshApp(page: Page, route = '/heute') {
  await page.goto(route);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.vh-screen')).toBeVisible();
}

const tab = (page: Page, name: string) => page.locator(`nav a[aria-label="${name}"]`);

test('all four tabs render', async ({ page }) => {
  await freshApp(page);

  await expect(page.locator('.head__title')).toContainText('Tag 1');

  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Walhall-Zyklus');

  await tab(page, 'Chronik').click();
  await expect(page.locator('.cal__cell').first()).toBeVisible();

  await tab(page, 'Ränge').click();
  await expect(page.locator('.ladder')).toHaveCount(3);
  await expect(page.locator('.ladder__name').first()).toHaveText('Drengr');
});

test('checking every set books the day and advances the cursor', async ({ page }) => {
  await freshApp(page);

  await expect(page.locator('.loot__xp')).toHaveText('0');
  await expect(page.locator('.loot__max')).toHaveText('/ 140 XP');

  // Tap the last planned pill of every block – that checks all sets below it.
  const cards = page.locator('.block');
  for (let i = 0; i < (await cards.count()); i++) {
    const pills = cards.nth(i).locator('.pill');
    await pills.nth((await pills.count()) - 1).click();
  }

  await expect(page.locator('.loot__xp')).toHaveText('140');
  await expect(page.locator('.finish')).toContainText('Tagesbonus gebucht');
  // 140 of a perfect 830 week.
  await expect(page.locator('.strip__pct').first()).toHaveText('17 %');

  // One extra set is offered, and only two of them ever.
  await cards.first().locator('.block__extra').click();
  await expect(page.locator('.loot__xp')).toHaveText('148');
  await cards.first().locator('.block__extra').click();
  await expect(page.locator('.loot__xp')).toHaveText('151');
  await expect(cards.first().locator('.block__extra')).toHaveCount(0);

  // The cursor moved on.
  await tab(page, 'Plan').click();
  const current = page.locator('.day', { has: page.locator('.day__badge--now') });
  await expect(current.locator('.day__name')).toContainText('Tag 2');

  // And the chronicle knows about it.
  await tab(page, 'Chronik').click();
  await expect(page.locator('.detail__status')).toHaveText('vollständig');
  await expect(page.locator('.row').first()).toContainText('Tag 1');

  // Survives a reload.
  await page.reload();
  await tab(page, 'Heute').click();
  await expect(page.locator('.loot__xp')).toHaveText('151');
});

test('the schedule switch converts the plan and keeps the days', async ({ page }) => {
  await freshApp(page, '/plan');

  await expect(page.locator('.rotation')).toBeVisible();
  await expect(page.locator('.rule__caption').first()).toHaveText(
    'perfekte Woche: 830 XP',
  );

  await page.getByRole('button', { name: 'Wochentage' }).click();

  await expect(page.locator('.week__grid')).toBeVisible();
  await expect(page.locator('.day')).toHaveCount(4);
  await expect(page.locator('.rule__caption').first()).toHaveText(
    'perfekte Woche: 470 XP',
  );
  await expect(page.locator('.week__tile--free')).toHaveCount(3);

  await page.getByRole('button', { name: 'Zyklus' }).click();
  await expect(page.locator('.rotation')).toBeVisible();
  await expect(page.locator('.day')).toHaveCount(4);
});

test('a new day can be drafted, opened and removed again', async ({ page }) => {
  await freshApp(page, '/plan');

  await page.locator('.add').click();

  // Invalid without a name: the save button is inert, and clicking it does nothing.
  const save = page.getByRole('button', { name: 'Tag anlegen' });
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await save.click({ force: true });
  await expect(page.locator('.draft')).toBeVisible();

  await page.locator('.draft__input').fill('Nacken & Griff');
  await page.locator('.draft__chip', { hasText: 'Klimmzüge' }).click();
  await expect(page.locator('.draft__xp')).toHaveText('80 XP');
  await expect(save).toHaveClass(/draft__save--valid/);

  await save.click();

  const created = page.locator('.day', { hasText: 'Nacken & Griff' });
  await expect(created).toHaveCount(1);
  await expect(created.locator('.day__body')).toBeVisible();

  await created.locator('.day__delete').click();
  await expect(page.locator('.day')).toHaveCount(4);
});

test('the chronicle steps back but never past the current month', async ({ page }) => {
  await freshApp(page, '/chronik');

  const title = page.getByRole('heading', { level: 1 });
  const current = (await title.textContent())!.trim();
  const next = page.getByRole('button', { name: 'Nächster Monat' });

  // Already at the current month – `›` is inert.
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await next.click({ force: true });
  await expect(title).toHaveText(current);

  await page.getByRole('button', { name: 'Vorheriger Monat' }).click();
  await expect(title).not.toHaveText(current);
  await expect(next).toHaveAttribute('aria-disabled', 'false');

  await next.click();
  await expect(title).toHaveText(current);
});
