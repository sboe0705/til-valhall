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

test('the info button opens the lore of the current rank', async ({ page }) => {
  await freshApp(page);

  await tab(page, 'Ränge').click();
  await page.getByRole('button', { name: 'Was ist Drengr?' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.info__name')).toHaveText('Drengr');
  await expect(dialog.locator('.info__lore')).toContainText('tapfere Krieger');
  await expect(dialog.locator('.info__threshold')).toHaveText('Startrang');

  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toBeHidden();
});

test('checking every set books the day and advances the cursor', async ({ page }) => {
  await freshApp(page);

  await expect(page.locator('.loot__xp')).toHaveText('0');
  await expect(page.locator('.loot__max')).toHaveText('/ 120 XP');

  // Tap the last planned pill of every block – that checks all sets below it.
  const cards = page.locator('.block');
  for (let i = 0; i < (await cards.count()); i++) {
    const pills = cards.nth(i).locator('.pill');
    await pills.nth((await pills.count()) - 1).click();
  }

  await expect(page.locator('.loot__xp')).toHaveText('120');
  await expect(page.locator('.finish')).toContainText('Tag vollständig');
  // 120 of the 840 XP a perfect week is worth.
  await expect(page.locator('.strip__pct').first()).toHaveText('14 %');

  // And underneath it, the next day as the Plan screen shows it – read-only,
  // so without the reorder column, the caret and the delete button.
  const preview = page.locator('.day');
  await expect(preview.locator('.day__name')).toHaveText('Tag 2 · Druck & Zug');
  await expect(preview.locator('.day__row')).toHaveCount(2);
  await expect(preview.locator('.day__reorder')).toHaveCount(0);
  await expect(preview.locator('.day__caret')).toHaveCount(0);
  await expect(preview.locator('.day__delete')).toHaveCount(0);

  // One extra set is offered, and only two of them ever.
  await cards.first().locator('.block__extra').click();
  await expect(page.locator('.loot__xp')).toHaveText('124');
  await cards.first().locator('.block__extra').click();
  await expect(page.locator('.loot__xp')).toHaveText('126');
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
  await expect(page.locator('.loot__xp')).toHaveText('126');
});

test('the schedule switch converts the plan and keeps the days', async ({ page }) => {
  await freshApp(page, '/plan');

  await expect(page.locator('.rotation')).toBeVisible();
  await expect(page.locator('.rule__caption').first()).toHaveText(
    'perfekte Woche: 840 / 840 XP',
  );

  await page.getByRole('button', { name: 'Wochentage' }).click();

  await expect(page.locator('.week__grid')).toBeVisible();
  await expect(page.locator('.day')).toHaveCount(4);
  await expect(page.locator('.rule__caption').first()).toHaveText(
    'perfekte Woche: 480 / 840 XP',
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
  await expect(page.locator('.draft__xp')).toHaveText('120 XP');
  await expect(save).toHaveClass(/draft__save--valid/);

  await save.click();

  const created = page.locator('.day', { hasText: 'Nacken & Griff' });
  await expect(created).toHaveCount(1);
  await expect(created.locator('.day__body')).toBeVisible();

  await created.locator('.day__delete').click();
  await expect(page.locator('.day')).toHaveCount(4);
});

test('the footer stamps the build and opens the Impressum', async ({ page }) => {
  await freshApp(page);

  await expect(page.locator('.foot__build')).toHaveText(/^v\S+ · \d{4}-\d{2}-\d{2}$/);

  // The link sits at the very bottom of the longest screen, so the shell's
  // scroller has to be rewound or the Impressum opens halfway down.
  await page.locator('.foot__link').scrollIntoViewIfNeeded();
  await page.locator('.foot__link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impressum');
  await expect(page.getByText('Angaben gemäß § 5 DDG')).toBeVisible();
  await expect(page.locator('.back')).toBeInViewport();

  // The screen is deep-linkable, and `‹ zurück` leads back to Heute.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impressum');

  await page.locator('.back').click();
  await expect(page.locator('.head__title')).toContainText('Tag 1');
});

test('a backup survives a wiped localStorage', async ({ page }) => {
  await freshApp(page);

  // Earn something worth restoring.
  const cards = page.locator('.block');
  for (let i = 0; i < (await cards.count()); i++) {
    const pills = cards.nth(i).locator('.pill');
    await pills.nth((await pills.count()) - 1).click();
  }
  await expect(page.locator('.loot__xp')).toHaveText('120');

  await page.goto('/impressum');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^til-valhall-\d{4}-\d{2}-\d{2}\.json$/);

  const file = (await download.path())!;
  await expect(page.locator('.legal__note')).toContainText('heruntergeladen');

  // Wipe everything – back to the seed.
  await page.evaluate(() => localStorage.clear());
  await page.goto('/heute');
  await expect(page.locator('.loot__xp')).toHaveText('0');

  // A file that is not a backup is refused, and changes nothing.
  await page.goto('/impressum');
  await page.locator('.legal__file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":true}'),
  });
  await expect(page.locator('.legal__note--error')).toContainText(
    'kein Til-Valhall-Backup',
  );
  await expect(page.locator('.legal__confirm')).toHaveCount(0);

  // The real one asks first, and `Abbrechen` leaves the data alone.
  await page.locator('.legal__file').setInputFiles(file);
  await expect(page.locator('.legal__confirm')).toContainText('überschreibt alle Daten');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.locator('.legal__confirm')).toHaveCount(0);

  await page.locator('.legal__file').setInputFiles(file);
  await page.getByRole('button', { name: 'Überschreiben' }).click();

  await page.goto('/heute');
  await expect(page.locator('.loot__xp')).toHaveText('120');
  await expect(page.locator('.finish')).toContainText('Tag vollständig');
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
