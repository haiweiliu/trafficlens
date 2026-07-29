/**
 * TrafficLens live journey — paste domains, Run analysis, expect Monthly Visits.
 */
export default async function run({ page, assert, step, capture, device }) {
  const canaryDomain = 'threads.com';
  const secondDomain = 'github.com';

  await step(`[${device}] Load homepage and verify TrafficLens shell`, async () => {
    await page.getByRole('heading', { name: 'TrafficLens' }).waitFor({ timeout: 15000 });
    await page.locator('#domains').waitFor({ timeout: 15000 });
    await capture(`${device}-homepage-ready`, page);
  });

  await step(`[${device}] Run bulk lookup with bypass cache`, async () => {
    const textarea = page.locator('#domains');
    await textarea.click();
    await textarea.fill(`${canaryDomain}\n${secondDomain}`);

    const bypass = page.getByRole('checkbox', { name: /Bypass cache/i });
    if (!(await bypass.isChecked())) {
      await bypass.check();
    }

    await page.getByRole('button', { name: /Run analysis/i }).click();

    await page.getByRole('heading', { name: /Results/i }).waitFor({
      timeout: 90000,
    });

    await page.waitForFunction(() => {
      const run = Array.from(document.querySelectorAll('button')).find(
        (btn) => /Run analysis/i.test((btn.textContent || '').trim())
      );
      return Boolean(run);
    }, { timeout: 90000 });

    const runLabel = await page.getByRole('button', { name: /Run analysis/i }).textContent();
    assert(/Run analysis/i.test(runLabel || ''), `Run analysis button still loading: "${runLabel}"`);
  });

  await step(`[${device}] Assert Monthly Visits are populated (not N/A)`, async () => {
    const threadsRow = page.locator('tbody tr').filter({ hasText: canaryDomain });
    await threadsRow.first().waitFor({ timeout: 15000 });

    const visitsCell = threadsRow.first().locator('td').nth(1);
    const visitsText = ((await visitsCell.textContent()) || '').trim();

    assert(visitsText.length > 0, 'threads.com visits cell is empty.');
    assert(visitsText !== 'N/A', `threads.com Monthly Visits still N/A on ${device}.`);
    assert(/\d/.test(visitsText), `threads.com visits not numeric: "${visitsText}"`);

    const githubRow = page.locator('tbody tr').filter({ hasText: secondDomain });
    const githubVisits = ((await githubRow.first().locator('td').nth(1).textContent()) || '').trim();
    assert(githubVisits !== 'N/A', `github.com Monthly Visits still N/A on ${device}.`);
    assert(/\d/.test(githubVisits), `github.com visits not numeric: "${githubVisits}"`);

    const statusOk = await threadsRow.first().locator('td').last().textContent();
    assert(
      !statusOk?.includes('Pending'),
      'threads.com still shows pending scraping status.'
    );

    await capture(`${device}-traffic-results`, page, { fullPage: true });
  });
}
