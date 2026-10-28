import { createDatabaseClient } from '@job-agent/database';
import { RecommendationService } from '@job-agent/database/matching';
import { readFile } from 'node:fs/promises';
import { seedUiMatches } from '../../../scripts/ui-preview-matches.js';
import { test, expect } from '@playwright/test';

const webOrigin = `http://127.0.0.1:${process.env.UI_TEST_WEB_PORT || '5179'}`;

async function go(page: import('@playwright/test').Page, name: string) {
  const legacy: Record<string, string> = {
    Jobs: 'Explore',
    Home: 'Explore',
    Applications: 'Applications',
    'My Profile': 'Profile',
  };
  if (name === 'Settings') {
    await go(page, 'My Profile');
    await page.getByRole('tab', { name: 'Account & connections', exact: true }).click();
  } else if (['Approvals', 'Interviews', 'Messages'].includes(name)) {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('button', { name: 'Applications', exact: true })
      .click();
    if (['Interviews', 'Messages'].includes(name)) await showDetails(page, 'Messages & interviews');
    await page
      .getByRole('tablist', {
        name: ['Interviews', 'Messages'].includes(name) ? 'Application tools' : 'Application views',
      })
      .getByRole('tab', { name: name === 'Approvals' ? 'Needs review' : name, exact: true })
      .click();
  } else {
    await page
      .locator('.sidebar')
      .getByRole('button', { name: legacy[name] || name, exact: true })
      .click();
  }
}
async function showDetails(page: import('@playwright/test').Page, label: string) {
  const details = page
    .locator('details')
    .filter({ has: page.locator(':scope > summary', { hasText: label }) })
    .first();
  if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open)))
    await details.locator(':scope > summary').click();
}
async function preparedMaterials(page: import('@playwright/test').Page) {
  await showDetails(page, 'More tools');
  await page.getByRole('button', { name: 'Prepared materials', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ||
      ['blob:', 'data:'].includes(url.protocol)
      ? route.continue()
      : route.abort('blockedbyclient');
  });
  const response = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: webOrigin },
    data: { email: 'alex.morgan@example.test', password: 'JobeePreview123!' },
  });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  const seeded = JSON.parse(await readFile('/tmp/jobee-ui-preview-seed.json', 'utf8'));
  expect(seeded.userId).toBe(session.user.id);
  await seedUiMatches(process.env.UI_TEST_DATABASE_URL!, session.user.id, seeded.jobIds, true);
});
test('three-section shell opens Explore with real synthetic local records', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button'),
  ).toHaveCount(3);
  for (const name of ['Explore', 'Applications', 'Profile'])
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('button', { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.locator('.sidebar').getByRole('button', { name: 'Home', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('.sidebar').getByRole('button', { name: 'Settings', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const settings = await page.request.get('/api/job-search/settings');
  expect(settings.ok()).toBeTruthy();
  await page.screenshot({ path: 'output/playwright/explore-light.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test('grouped Profile and Settings destinations preserve the original views', async ({ page }) => {
  await page.goto('/');
  await go(page, 'My Profile');
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.getByText('Alex Morgan', { exact: true }).last()).toBeVisible();
  await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Uploaded Documents', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Saved Answers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved Answers', exact: true })).toBeVisible();
  await go(page, 'Settings');
  await page
    .getByRole('group', { name: 'Color theme' })
    .getByRole('button', { name: 'Dark', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await go(page, 'Settings');
  await page.getByRole('tab', { name: 'System activity', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'System activity', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({ path: 'output/playwright/settings-activity-dark.png', fullPage: true });
});
test('document selection, TXT preview, zoom and close', async ({ page }) => {
  await page.goto('/');
  await go(page, 'My Profile');
  await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
  await page.getByRole('button', { name: 'Master Student CV', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Preview of preview-cv.txt' })).toBeVisible();
  await expect(page.getByText('Synthetic preview document.', { exact: false })).toBeVisible();
  await page.getByLabel('Preview zoom').selectOption('125');
  await page.screenshot({ path: 'output/playwright/documents-txt-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'View your uploaded documents' })).toBeVisible();
});
test('Jobs and CRM load real records in both themes without root overflow', async ({ page }) => {
  await page.goto('/');
  await go(page, 'Jobs');
  await expect(
    page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'output/playwright/jobs-light.png', fullPage: true });
  await go(page, 'Applications');
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Software Engineering Intern');
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/applications-board-light.png', fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('jobee.theme', 'dark');
  });
  await page.reload();
  await go(page, 'Applications');
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Software Engineering Intern');
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/applications-board-dark.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
test('notification dialog traps focus, Escape closes and restores the trigger', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /^Notifications/ });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#root')).toHaveJSProperty('inert', true);
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test('existing mobile navigation remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await go(page, 'My Profile');
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.locator('.sidebar')).toHaveAttribute('aria-hidden', 'true');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'output/playwright/jobs-mobile.png', fullPage: true });
});

async function openDocuments(page: import('@playwright/test').Page) {
  await page.goto('/');
  await go(page, 'My Profile');
  await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Master Student CV', exact: true })).toBeVisible();
}
async function openApplication(page: import('@playwright/test').Page) {
  await page.goto('/');
  await go(page, 'Applications');
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await page
    .locator('.application-list .action-row')
    .filter({ hasText: 'Frontend Developer Intern' })
    .getByRole('button', {
      name: /^(Open application|Resolve review|Open follow-up|Open next step|Verify submission|Review stopped attempt)$/,
    })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Frontend Developer Intern · Northstar', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open detailed record', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Application progress', exact: true }),
  ).toBeVisible();
  for (const label of [
    'Update status & manage application',
    'Notes',
    'Recruiter contacts',
    'Offer & compensation',
    'Browser assistance & run history',
  ])
    await showDetails(page, label);
}

test('PDF and sandboxed DOCX render locally; document paper stays light in dark mode', async ({
  page,
}) => {
  await openDocuments(page);
  await page.getByRole('button', { name: 'PDF preview example', exact: true }).click();
  await expect(
    page.getByText('ALEX MORGAN - PREVIEW CV Synthetic PDF for local UI validation.', {
      exact: true,
    }),
  ).toBeAttached();
  await expect(page.locator('canvas')).toHaveJSProperty('width', 685);
  await page.getByRole('button', { name: 'DOCX preview example', exact: true }).click();
  const frame = page.frameLocator('iframe');
  await expect(
    frame.getByText('Synthetic DOCX preview for local UI validation.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-same-origin');
  expect(
    await frame.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'),
  ).toContain("default-src 'none'");
  await page.getByLabel('Preview zoom').selectOption('125');
  await page.screenshot({ path: 'output/playwright/documents-docx-light.png', fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('jobee.theme', 'dark');
  });
  await page.reload();
  await go(page, 'My Profile');
  await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
  await page.getByRole('button', { name: 'PDF preview example', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  expect(
    await page
      .locator('canvas')
      .evaluate((n) => getComputedStyle(n.parentElement!).backgroundColor),
  ).toBe('rgb(255, 255, 255)');
  await page.screenshot({ path: 'output/playwright/documents-pdf-dark.png', fullPage: true });
});
test('preview access failures, damaged files, retry and rapid selection are recoverable', async ({
  page,
}) => {
  await openDocuments(page);
  await page.route('**/api/candidate/documents/*/download', (r) =>
    r.fulfill({ status: 403, body: 'Denied' }),
  );
  await page.getByRole('button', { name: 'PDF preview example', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('do not have access');
  await page.unroute('**/api/candidate/documents/*/download');
  await page.route('**/api/candidate/documents/*/download', (r) =>
    r.fulfill({ status: 200, contentType: 'application/pdf', body: 'damaged PDF' }),
  );
  await page.getByRole('button', { name: 'Retry preview', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('canvas')).not.toBeVisible();
  await page.unroute('**/api/candidate/documents/*/download');
  await page.getByRole('button', { name: 'Master Student CV', exact: true }).click();
  await expect(page.getByText('Synthetic preview document.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'PDF preview example', exact: true }).click();
  await page.getByRole('button', { name: 'Master Student CV', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Preview of preview-cv.txt' })).toBeVisible();
  await expect(page.getByText('Synthetic preview document.', { exact: false })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});
test('System follows device changes while explicit preferences stay remembered', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await go(page, 'Settings');
  await page
    .getByRole('group', { name: 'Color theme' })
    .getByRole('button', { name: 'Dark', exact: true })
    .click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
test('all supporting workspaces load and remain usable at 1280px and 1920px', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  for (const width of [1280, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => {
        localStorage.setItem('jobee.theme', theme);
      }, theme);
      await page.reload();
      for (const name of [
        'Home',
        'Jobs',
        'Applications',
        'Approvals',
        'Interviews',
        'Messages',
        'My Profile',
        'Settings',
      ]) {
        await go(page, name);
        await expect(page.locator('main').getByRole('heading').first()).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          name + ' ' + width + ' ' + theme,
        ).toBeTruthy();
      }
    }
  }
  expect(errors).toEqual([]);
});
test('profile skill create, validation, cancel and confirmed delete retain behavior', async ({
  page,
}) => {
  await page.goto('/');
  await go(page, 'My Profile');
  await page.getByRole('button', { name: 'More profile details', exact: true }).click();
  await page.getByRole('tab', { name: /^Skills/ }).click();
  await page.getByRole('button', { name: '+ Add Skill', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Skill Name')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save', exact: false }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Skill Name').fill('UI migration fixture skill');
  await dialog.getByRole('button', { name: 'Save', exact: false }).click();
  await expect(page.getByText('UI migration fixture skill', { exact: true })).toBeVisible();
  const row = page.getByText('UI migration fixture skill', { exact: true }).locator('../..');
  await row.getByRole('button', { name: 'Delete record', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('UI migration fixture skill', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Delete record', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('UI migration fixture skill', { exact: true })).toHaveCount(0);
});
test('application details preserve note editing and cancellation of browser submission', async ({
  page,
}) => {
  const note = 'Synthetic UI migration note ' + Date.now();
  await openApplication(page);
  await page.getByRole('button', { name: '+ Add Note', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Note Content').fill(note);
  await page.getByRole('button', { name: 'Save Note', exact: true }).click();
  await expect(page.getByText(note, { exact: true })).toBeVisible();
  const calls: string[] = [];
  await page.route(
    /\/api\/applications\/[^/]+\/(browser-runs|submission-authorization)$/,
    (route) => {
      if (route.request().method() === 'POST') {
        calls.push('POST');
        return route.abort();
      }
      return route.continue();
    },
  );
  await page.getByRole('button', { name: 'Submit via Browser Worker', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Human Authorization Required');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(calls).toEqual([]);
  await page.screenshot({ path: 'output/playwright/application-detail-light.png', fullPage: true });
});
test('application workspace retains document editors, questions, independent blockers and job navigation', async ({
  page,
}) => {
  await page.goto('/');
  await go(page, 'Applications');
  await preparedMaterials(page);
  await page
    .getByRole('button', { name: /Open Application Studio/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your application documents', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Final review', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Document versions', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Document version history', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Loading versions…')).toHaveCount(0);
  await page.getByRole('button', { name: 'View CV', exact: true }).click();
  await expect(page.locator('#studio-panel')).toBeVisible();
  await page.getByRole('tab', { name: 'Cover letter', exact: true }).click();
  await page
    .getByRole('tablist', { name: 'Application workspace' })
    .getByRole('tab', { name: 'Questions', exact: true })
    .click();
  await expect(page.locator('#studio-panel')).toBeVisible();
  await page.getByRole('button', { name: /Review pending decisions/ }).click();
  await expect(page.getByRole('tab', { name: 'Final review', exact: true })).toBeDisabled();
  await page
    .getByRole('tablist', { name: 'Application workspace' })
    .getByRole('tab', { name: 'Documents', exact: true })
    .click();
  await page.getByRole('button', { name: 'Document details & downloads', exact: true }).click();
  await expect(page.getByText(/required application question\(s\) are unresolved/)).toBeVisible();
  await page.screenshot({ path: 'output/playwright/studio-light.png', fullPage: true });
  await page.getByRole('button', { name: 'View Job & Requirements', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Selected job', exact: true })
      .getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
  ).toBeVisible();
  await showDetails(page, 'Requirements, fit details & sources');
  await page.getByRole('tab', { name: /^Requirements/ }).click();
  await expect(page.getByRole('heading', { name: /Extracted Requirements/ })).toBeVisible();
});
test('cancelled answer editing preserves independent authorization blockers', async ({ page }) => {
  await page.goto('/');
  await go(page, 'Approvals');
  await showDetails(page, 'Review individual decisions');
  const edit = page.getByRole('button', { name: 'Edit & Approve', exact: true }).first();
  await edit.click();
  await page
    .getByRole('dialog')
    .getByLabel('Answer')
    .fill('Synthetic answer provided explicitly by the local preview user.');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(edit).toBeVisible();
  await page.screenshot({ path: 'output/playwright/approvals-light.png', fullPage: true });
  // Cancel leaves the queue and readiness untouched. Existing service tests cover approval/override independence.
  await page.getByRole('button', { name: 'Open application', exact: true }).first().click();
  await page
    .getByRole('tablist', { name: 'Application workspace' })
    .getByRole('tab', { name: 'Documents', exact: true })
    .click();
  await page.getByRole('button', { name: 'Document details & downloads', exact: true }).click();
  await expect(page.getByText(/pending approval request\(s\) require human review/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to my applications', exact: false }).first().click();
  await expect(page.getByRole('tab', { name: 'Needs review', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
test('interview dialogs and calendar tabs remain accessible without external connections', async ({
  page,
}) => {
  await page.goto('/');
  await go(page, 'Interviews');
  await expect(page.getByText('Panel conversation', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /Record Debrief/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Availability & conflicts', exact: true }).click();
  await expect(page.locator('#interviews-panel')).toContainText(/Availability/);
  await page.getByRole('tab', { name: /Calendar accounts/ }).click();
  await expect(page.locator('#interviews-panel')).toContainText(/Connect/);
});
test('signed out state opens an accessible sign-in dialog and invitation deep link', async ({
  page,
}) => {
  await page.context().clearCookies();
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (
      /^\/api\/(candidate|jobs|applications|notifications)(?:[/?]|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      privateRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Jobee', exact: true })).toBeVisible();
  expect(privateRequests).toEqual([]);
  await page.getByRole('button', { name: 'Sign in / Join pilot', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel(/Email/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/?invite=invalid-local-preview-invite');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(`${webOrigin}/`);
});

test('analytics, invitations, notifications and Smart Import dialogs retain their controls in both themes', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await page.evaluate((theme) => localStorage.setItem('jobee.theme', theme), theme);
    await page.reload();
    await go(page, 'Applications');
    await showDetails(page, 'More tools');
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText(/Funnel|Conversion/);
    await page.screenshot({ path: `output/playwright/analytics-${theme}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Invites', exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel(/Email/)).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel(/Role/)).toBeVisible();
    await page.screenshot({ path: `output/playwright/invites-${theme}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await page.getByRole('button', { name: /Preferences/ }).click();
    await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(5);
    await page.screenshot({
      path: `output/playwright/notification-preferences-${theme}.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await go(page, 'My Profile');
    await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
    await page.getByRole('button', { name: 'Add document', exact: true }).click();
    await page.getByRole('button', { name: 'Choose a CV', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `output/playwright/smart-import-${theme}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
test('all direct profile editors render labelled fields and cancel without mutation', async ({
  page,
}) => {
  await page.goto('/');
  await go(page, 'My Profile');
  await page.getByRole('button', { name: 'More profile details', exact: true }).click();
  for (const [tab, button] of [
    [/^Experience/, '+ Add Experience'],
    [/^Education/, '+ Add Education'],
    [/^Projects/, '+ Add Project'],
    [/^Skills/, '+ Add Skill'],
    [/^Languages/, '+ Add Language'],
    [/^Certifications/, '+ Add Certification'],
    [/^Links/, '+ Add Link'],
    [/^Verified Facts/, '+ Add Fact'],
  ] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await page.getByRole('button', { name: button, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (const input of await dialog.locator('input:not([type="hidden"]),select,textarea').all())
      await expect(input).toHaveAccessibleName(/\S/);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});
test('application contact, assessment, interview, offer and transition forms retain required fields', async ({
  page,
}) => {
  await openApplication(page);
  for (const name of [
    '+ Add Contact',
    '+ Assessment',
    '+ Interview',
    '+ Record Offer',
    'Final Interview',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (const input of await dialog.locator('input:not([type="hidden"]),select,textarea').all())
      await expect(input).toHaveAccessibleName(/\S/);
    await page.screenshot({
      path: 'output/playwright/application-form-' + name.replace(/[^a-z]/gi, '') + '.png',
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});
test('Saved Answers, Preferences and Career Intelligence retain the grouped flows', async ({
  page,
}) => {
  await page.goto('/');
  await go(page, 'My Profile');
  await page.getByRole('tab', { name: 'Saved Answers', exact: true }).click();
  await page.getByRole('button', { name: '+ Add Answer', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Question / Application Prompt')).toBeVisible();
  await expect(dialog.getByLabel('Approved Answer Text')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Preferences', exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/playwright/preferences-light.png', fullPage: true });
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review & suggestions', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'output/playwright/career-intelligence-light.png',
    fullPage: true,
  });
});
test('Jobs add, edit and archive dialogs retain cancellation and job detail tabs', async ({
  page,
}) => {
  await page.goto('/');
  await go(page, 'Jobs');
  await page.getByRole('button', { name: 'Add a job link', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Job Posting Public URL')).toBeVisible();
  await page.keyboard.press('Escape');
  const sourceUrl = `https://example.test/import-recovery/${crypto.randomUUID()}`;
  const shell = await page.request.post('/api/jobs/text', {
    headers: { Origin: webOrigin },
    data: {
      title: 'Synthetic Careers Shell',
      company: 'Fixture employer',
      url: sourceUrl,
      text: 'Please enable JavaScript to view this vacancy.',
    },
  });
  expect(shell.ok()).toBeTruthy();
  const shellBody = await shell.json();
  const ownedJobId = shellBody.data.job.id;
  await page.route('**/api/jobs/url', (route) => route.fulfill({ status: 201, json: shellBody }));
  await page.getByRole('button', { name: 'Add a job link', exact: true }).click();
  await page.getByLabel('Job Posting Public URL').fill(sourceUrl);
  await page.getByRole('button', { name: 'Import Job', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('did not expose the vacancy details');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'output/playwright/import-recovery-mobile.png', fullPage: true });
  const description =
    'Title: Recovered Project Intern\nCompany: Fixture employer\nLocation: Warsaw, Poland\nResponsibilities:\nSupport project scheduling and reporting for this synthetic local browser fixture.\nRequirements:\n• Must have project coordination skills.';
  await page.getByLabel('Pasted Job Description *').fill(description);
  await page.getByRole('button', { name: 'Save Job', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const recovered = (await (await page.request.get(`/api/jobs/${ownedJobId}`)).json()).data;
  expect(recovered.id).toBe(ownedJobId);
  expect(recovered.originalUrl).toBe(sourceUrl);
  expect(recovered.title).toBe('Recovered Project Intern');
  expect(recovered.city).toBe('Warsaw');
  await page.unroute('**/api/jobs/url');
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page
    .locator('.job-card')
    .filter({ has: page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }) })
    .getByRole('button', { name: 'View job', exact: true })
    .click();
  await showDetails(page, 'Requirements, fit details & sources');
  for (const tab of [
    /^Overview$/,
    /^Requirements/,
    /^Sections/,
    /^Sources & history$/,
    /^Match analysis/,
  ]) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.locator('#job-details-panel')).toBeVisible();
  }
  await showDetails(page, 'More options');
  await page.getByRole('button', { name: 'Correct Fields', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('complete desktop render inventory in Light and Dark', async ({ page }) => {
  test.setTimeout(120000);
  const failures: string[] = [];
  page.on('pageerror', (e) => failures.push(e.message));
  const pending = new Set<import('@playwright/test').Request>();
  page.on('request', (r) => {
    if (r.resourceType() === 'fetch' && r.url().includes('/api/')) pending.add(r);
  });
  page.on('response', (r) => pending.delete(r.request()));
  page.on('requestfinished', (r) => pending.delete(r));
  page.on('requestfailed', (r) => pending.delete(r));
  const shot = async (name: string, theme: string) => {
    await expect.poll(() => pending.size).toBe(0);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      name + ' ' + theme,
    ).toBeTruthy();
    await page.screenshot({
      path: `output/playwright/screens/${name}-${theme}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  };
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await page.evaluate((theme) => localStorage.setItem('jobee.theme', theme), theme);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();
    pending.clear();
    await shot('explore-default', theme);
    await go(page, 'My Profile');
    await expect(page.getByText('Alex Morgan', { exact: true }).last()).toBeVisible();
    await shot('profile-overview', theme);
    await page.getByRole('button', { name: 'More profile details', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your details', exact: true })).toBeVisible();
    await shot('profile', theme);
    await page.getByRole('tab', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Review & suggestions', exact: true }),
    ).toBeVisible();
    await shot('career-intelligence', theme);
    await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Master Student CV', exact: true }),
    ).toBeVisible();
    await shot('documents', theme);
    await page.getByRole('tab', { name: 'Saved Answers', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Saved Answers', exact: true })).toBeVisible();
    await shot('answers', theme);
    await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Preferences', exact: true })).toBeVisible();
    await shot('preferences', theme);
    await go(page, 'Jobs');
    await expect(
      page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
    ).toBeVisible();
    await shot('jobs', theme);
    await page
      .locator('.job-card')
      .filter({
        has: page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
      })
      .getByRole('button', { name: 'View job', exact: true })
      .click();
    await expect(page.getByRole('tab', { name: /^Requirements/ })).toBeHidden();
    await showDetails(page, 'Requirements, fit details & sources');
    await expect(page.getByRole('tab', { name: /^Requirements/ })).toBeVisible();
    await shot('job-detail', theme);
    await go(page, 'Applications');
    await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
    await expect(page.locator('main')).toContainText('Frontend Developer Intern');
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await shot('applications-board', theme);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.application-list')).toBeVisible();
    await shot('applications-list', theme);
    await page
      .locator('.application-list .action-row')
      .filter({ hasText: 'Frontend Developer Intern' })
      .getByRole('button', {
        name: /^(Open application|Resolve review|Open follow-up|Open next step|Verify submission|Review stopped attempt)$/,
      })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Frontend Developer Intern · Northstar', exact: true }),
    ).toBeVisible();
    await shot('application-detail', theme);
    await go(page, 'Applications');
    await preparedMaterials(page);
    await expect(
      page.getByRole('button', { name: /Open Application Studio/ }).first(),
    ).toBeVisible();
    await shot('prepared-materials', theme);
    await page
      .getByRole('button', { name: /Open Application Studio/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Your application documents', exact: true }),
    ).toBeVisible();
    await shot('studio', theme);
    await go(page, 'Approvals');
    await expect(
      page.getByRole('heading', { name: 'Review what needs your decision', exact: true }),
    ).toBeVisible();
    await shot('approvals', theme);
    await go(page, 'Messages');
    await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
    await shot('messages', theme);
    await go(page, 'Interviews');
    await expect(page.getByText('Panel conversation', { exact: true })).toBeVisible();
    await shot('interviews', theme);
    await go(page, 'Settings');
    await expect(page.getByRole('group', { name: 'Color theme' })).toBeVisible();
    await shot('settings', theme);
    await page.getByRole('tab', { name: 'System activity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'System activity', exact: true })).toBeVisible();
    await shot('activity', theme);
  }
  expect(failures).toEqual([]);
});

test('all 17 lifecycle choices and eight browser-run states remain represented', async ({
  page,
}) => {
  const { ApplicationLifecycleStatus, BrowserRunStatus } = await import('@job-agent/shared');
  await page.goto('/');
  await go(page, 'Applications');
  await showDetails(page, 'Filters');
  await expect(page.getByLabel('Application status').locator('option')).toHaveCount(18);
  expect(
    await page
      .getByLabel('Application status')
      .locator('option')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value).filter(Boolean)),
  ).toEqual(Object.values(ApplicationLifecycleStatus));
  let state: string = 'PENDING';
  await page.route('**/api/applications/*/browser-runs', (r) =>
    r.fulfill({
      json: {
        status: 'ok',
        data: [
          {
            id: 'synthetic-run',
            applicationId: 'synthetic-application',
            userId: 'synthetic-user',
            atsProvider: 'GREENHOUSE',
            targetUrl: 'https://example.test/northstar',
            mode: 'DRY_RUN',
            status: state,
            fieldsDetectedCount: 4,
            fieldsFilledCount: 2,
            unmatchedRequiredFields: [],
            stepLogs: [],
            screenshotPaths: [],
            createdAt: '2026-10-18T10:00:00Z',
            updatedAt: '2026-10-18T10:00:00Z',
          },
        ],
      },
    }),
  );
  for (const status of Object.values(BrowserRunStatus)) {
    state = status;
    await openApplication(page);
    await page.getByRole('button', { name: 'View Latest Audit Trail', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(
      status === 'SUBMISSION_UNCERTAIN' ? 'SUBMISSION UNCERTAIN' : status,
    );
    await page.keyboard.press('Escape');
  }
});
test('a second local user cannot retrieve another user’s document or access admin invitations', async ({
  page,
  playwright,
}) => {
  const docs = await (await page.request.get('/api/candidate/documents')).json();
  const target = docs.data[0].id;
  const isolated = await playwright.request.newContext({ baseURL: webOrigin });
  const signup = await isolated.post('/api/auth/sign-up/email', {
    headers: { Origin: webOrigin },
    data: {
      name: 'Jordan Preview',
      email: `jordan-${Date.now()}@example.test`,
      password: 'JobeePreview123!',
    },
  });
  expect(signup.ok()).toBeTruthy();
  const denied = await isolated.get('/api/candidate/documents/' + target + '/download');
  expect([403, 404]).toContain(denied.status());
  const invites = await isolated.get('/api/pilot/invitations');
  expect(invites.status()).toBe(403);
  await isolated.dispose();
});

test('Explore remains usable in both themes with three navigation destinations', async ({
  page,
}) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await page.evaluate((theme) => localStorage.setItem('jobee.theme', theme), theme);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Explore', exact: true })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button'),
    ).toHaveCount(3);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(
      page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `output/playwright/screens/explore-${theme}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  }
});

test('student defaults reduce empty work without changing review permissions', async ({ page }) => {
  await page.goto('/');
  await go(page, 'Applications');
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await go(page, 'Home');
  await go(page, 'Applications');
  await expect(page.getByRole('button', { name: 'Board', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await go(page, 'Messages');
  await expect(page.getByRole('tab', { name: /^Messages \(/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await go(page, 'My Profile');
  await page.getByRole('tab', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Needs verification', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unverify', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^All \(/ }).click();
  await expect(page.getByRole('button', { name: 'Unverify', exact: true }).first()).toBeVisible();
});

test('document purpose is explicit and opening either path does not upload or extract', async ({
  page,
}) => {
  await openDocuments(page);
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && /documents|smart-import/.test(request.url()))
      writes.push(request.url());
  });
  const add = page.getByRole('button', { name: 'Add document', exact: true });
  await add.click();
  await expect(page.getByRole('dialog')).toContainText('This does not extract profile details.');
  await page.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Upload Candidate Document');
  await page.keyboard.press('Escape');
  await expect(add).toBeFocused();
  await add.click();
  await page.getByRole('button', { name: 'Choose a CV', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(add).toBeFocused();
  expect(writes).toEqual([]);
});

test('progress drafts survive workspace tabs and final-review navigation skips unresolved readiness', async ({
  page,
}) => {
  await openApplication(page);
  const card = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Next Action & Follow-up', exact: true }) });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Next action', { exact: true }).fill('Unsaved student follow-up draft');
  const tabs = page.getByRole('tablist', { name: 'Application workspace' });
  await tabs.getByRole('tab', { name: 'Questions', exact: true }).click();
  await expect(tabs.getByRole('tab', { name: 'Final review', exact: true })).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Progress & details', exact: true })).toBeFocused();
  await expect(page.getByLabel('Next action', { exact: true })).toHaveValue(
    'Unsaved student follow-up draft',
  );
  await card.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('returning through the sidebar opens the tracker after prepared materials', async ({
  page,
}) => {
  await page.goto('/');
  await go(page, 'Applications');
  await preparedMaterials(page);
  await expect(page.getByRole('button', { name: /Open Application Studio/ }).first()).toBeVisible();
  await go(page, 'Home');
  await go(page, 'Applications');
  await expect(page.locator('.application-list')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'All applications', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('a fully reviewed application exposes final review while sending still requires explicit confirmation', async ({
  page,
}) => {
  // Browser-only synthetic readiness state; no approval or application data is mutated.
  await page.route(/\/api\/application-packages\/[a-f0-9-]{36}$/i, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const data = json.data;
    data.package = { ...data.package, status: 'READY', isStale: false, hasPolicyBlocker: false };
    data.readiness = {
      ...data.readiness,
      isReady: true,
      status: 'READY',
      blockingIssues: [],
      reasons: ['Synthetic reviewed documents and answers'],
    };
    data.questions = data.questions.map((item: Record<string, unknown>) => ({
      ...item,
      approvalState: 'APPROVED',
      finalAnswer: 'Explicit synthetic preview answer',
    }));
    data.approvals = data.approvals.map((item: Record<string, unknown>) => ({
      ...item,
      status: 'APPROVED',
    }));
    if (data.currentVersion) data.currentVersion.coverLetterApproved = true;
    await route.fulfill({ response, json });
  });
  const writes: string[] = [];
  await page.route(
    /\/api\/applications\/[^/]+\/(browser-runs|submission-authorization)$/,
    (route) => {
      if (route.request().method() === 'POST') {
        writes.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    },
  );
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await page.evaluate((value) => localStorage.setItem('jobee.theme', value), theme);
    await page.reload();
    await openApplication(page);
    await page.locator('.browser-assistance > summary').click();
    await page.getByRole('tab', { name: 'Final review', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Choose how to apply', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Continue on employer website', exact: true }),
    ).toHaveAttribute('href', /^https?:\/\//);
    await page.screenshot({
      path: `output/playwright/screens/final-review-${theme}.png`,
      fullPage: true,
    });
    await showDetails(page, 'Browser assistance & run history');
    await page.getByRole('button', { name: 'Submit via Browser Worker', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Human Authorization Required');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(writes).toEqual([]);
});

test('review lookup failures remain visible before expanding individual decisions and can be retried', async ({
  page,
}) => {
  await page.route('**/api/approvals?*', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: 'Synthetic unavailable review queue' } },
    }),
  );
  await page.goto('/');
  await go(page, 'Approvals');
  await expect(page.getByRole('alert')).toContainText('Could not load review items');
  await expect(
    page.locator('details').filter({
      has: page.locator(':scope > summary', { hasText: 'Review individual decisions' }),
    }),
  ).not.toHaveAttribute('open', '');
  await page.unroute('**/api/approvals?*');
  await page.getByRole('button', { name: 'Retry review items', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Applications to review', exact: true }),
  ).toBeVisible();
});

test('a failed application refresh is visible from the summary and preserves a retry path', async ({
  page,
}) => {
  await openApplication(page);
  const url = /\/api\/applications\/[a-f0-9-]{36}$/i;
  await page.route(url, (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: 'Synthetic application refresh failure' } },
    }),
  );
  const tabs = page.getByRole('tablist', { name: 'Application workspace' });
  await tabs.getByRole('tab', { name: 'Questions', exact: true }).click();
  await tabs.getByRole('tab', { name: 'Progress & details', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'The latest application details could not be refreshed.',
  );
  await page.unroute(url);
  await page.getByRole('button', { name: 'Retry application details', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Application progress', exact: true }),
  ).toBeVisible();
});

test('candidate preferences preserve confirmed eligibility and do not enable application permissions', async ({
  page,
}) => {
  const original = (await (await page.request.get('/api/candidate/preferences')).json()).data;
  const policy = (await (await page.request.get('/api/candidate/policy')).json()).data;
  try {
    await page.goto('/');
    await go(page, 'My Profile');
    await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
    await page
      .getByLabel('Countries Where You Are Authorized to Work', { exact: true })
      .fill('Poland, Germany');
    await page.getByLabel('Internship Eligibility', { exact: true }).selectOption('yes');
    await page
      .getByLabel('Availability or Notice Period', { exact: true })
      .fill('Four weeks notice');
    await page
      .getByRole('group', { name: 'Employment types', exact: true })
      .getByLabel('Contract', { exact: true })
      .check();
    await page.getByRole('button', { name: 'Save Job Preferences', exact: true }).click();
    await expect(page.getByText('Job search preferences saved', { exact: true })).toBeVisible();
    await page.reload();
    await go(page, 'My Profile');
    await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
    await expect(
      page.getByLabel('Countries Where You Are Authorized to Work', { exact: true }),
    ).toHaveValue('Poland, Germany');
    await expect(page.getByLabel('Internship Eligibility', { exact: true })).toHaveValue('yes');
    await expect(page.getByLabel('Availability or Notice Period', { exact: true })).toHaveValue(
      'Four weeks notice',
    );
    await expect(
      page
        .getByRole('group', { name: 'Employment types', exact: true })
        .getByLabel('Contract', { exact: true }),
    ).toBeChecked();
    await page.setViewportSize({ width: 393, height: 852 });
    await expect(page.locator('.sidebar')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.sidebar')).toHaveJSProperty('inert', true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await expect(
      page.getByLabel('Countries Where You Are Authorized to Work', { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: 'output/playwright/screens/preferences-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    const currentPolicy = (await (await page.request.get('/api/candidate/policy')).json()).data;
    expect(currentPolicy.autoApplyEnabled).toBe(policy.autoApplyEnabled);
  } finally {
    expect(
      (await page.request.put('/api/candidate/preferences', { data: original })).ok(),
    ).toBeTruthy();
  }
});

test('unavailable preferences cannot be overwritten with defaults and can be retried', async ({
  page,
}) => {
  await page.route('**/api/candidate/preferences', (route) =>
    route.fulfill({ status: 503, json: { error: { message: 'Synthetic preference outage' } } }),
  );
  await page.goto('/');
  await go(page, 'My Profile');
  await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not load your preferences');
  await expect(page.getByRole('button', { name: 'Save Job Preferences', exact: true })).toHaveCount(
    0,
  );
  await page.unroute('**/api/candidate/preferences');
  await page.getByRole('button', { name: 'Retry preferences', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save Job Preferences', exact: true }),
  ).toBeVisible();
});

test('saved answers require explicit verification and edits clear that confirmation', async ({
  page,
}) => {
  const question = `Synthetic reusable answer ${Date.now()}`;
  try {
    await page.goto('/');
    await go(page, 'My Profile');
    await page.getByRole('tab', { name: 'Saved Answers', exact: true }).click();
    await page.getByRole('button', { name: '+ Add Answer', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Question / Application Prompt', { exact: true }).fill(question);
    await dialog
      .getByLabel('Approved Answer Text', { exact: true })
      .fill('Confirmed synthetic answer');
    const verified = dialog.getByLabel('I confirm this answer is accurate', { exact: true });
    await verified.check();
    await dialog
      .getByLabel('Approved Answer Text', { exact: true })
      .fill('Updated synthetic answer');
    await expect(verified).not.toBeChecked();
    await verified.check();
    await dialog.getByRole('button', { name: /Save/ }).click();
    await expect(dialog).toHaveCount(0);
    const saved = (await (await page.request.get('/api/candidate/answers')).json()).data.find(
      (entry: { question: string }) => entry.question === question,
    );
    expect(saved?.verificationStatus).toBe('VERIFIED');
    expect(saved?.automationLevel).toBe('REVIEW');
  } finally {
    const saved = (await (await page.request.get('/api/candidate/answers')).json()).data.find(
      (entry: { question: string }) => entry.question === question,
    );
    if (saved)
      expect((await page.request.delete(`/api/candidate/answers/${saved.id}`)).ok()).toBeTruthy();
  }
});

test('Explore preserves search and selection across desktop panes and mobile back navigation', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByLabel('Search jobs', { exact: true }).fill('Frontend Developer');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const role = page.locator('.job-card').filter({
      has: page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
    });
    const open = role.getByRole('button', { name: 'View job', exact: true });
    await open.click();
    const detail = page.getByRole('region', { name: 'Selected job', exact: true });
    await expect(
      detail.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Requirements/ })).toBeHidden();
    await showDetails(page, 'Requirements, fit details & sources');
    await expect(page.getByRole('tab', { name: /^Requirements/ })).toBeVisible();
    if (viewport.width > 1100) {
      await expect(role).toBeVisible();
      const left = await role.boundingBox(),
        right = await detail.boundingBox();
      expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
      await expect(open).toHaveAttribute('aria-current', 'true');
    } else {
      await expect(role).toBeHidden();
      await expect(page.getByLabel('Search jobs', { exact: true })).toBeHidden();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: `output/playwright/explore-detail-${viewport.width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /Back to results/ }).click();
    await expect(page.getByLabel('Search jobs', { exact: true })).toHaveValue('Frontend Developer');
    await expect(open).toBeFocused();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(page.getByLabel('Search jobs', { exact: true })).toHaveValue('');
  }
});

test('Explore explains fit and unresolved eligibility beside the selected role', async ({
  page,
}) => {
  await page.goto('/');
  const role = page
    .locator('.job-card')
    .filter({ has: page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }) });
  await role.getByRole('button', { name: 'View job', exact: true }).click();
  const overview = page.locator('.job-fit-overview');
  await expect(overview.getByRole('heading', { name: 'Your fit', exact: true })).toBeVisible();
  await overview.getByRole('button', { name: /Check your fit|Refresh your fit/ }).click();
  await expect(overview).toContainText('Unconfirmed:');
  await expect(overview.getByRole('alert')).toHaveCount(0);
  await expect(role).toHaveCount(0);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: 'output/playwright/explore-fit-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await expect(overview).toBeVisible();
  await expect(page.locator('.sidebar')).not.toBeInViewport();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: 'output/playwright/explore-fit-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('Explore offers Quick Apply for supported forms and an honest employer handoff for other forms', async ({
  page,
}) => {
  const created: string[] = [];
  const marker = `Apply smoke ${crypto.randomUUID()}`;
  try {
    for (const [suffix, url, automatic] of [
      [
        'supported',
        `https://boards.greenhouse.io/fixture/jobs/${encodeURIComponent(marker)}`,
        true,
      ],
      ['manual', `https://employer.example.test/vacancy/${encodeURIComponent(marker)}`, false],
    ] as const) {
      const response = await page.request.post('/api/jobs/text', {
        data: {
          title: `${marker} ${suffix}`,
          company: 'Synthetic test employer',
          url,
          text: 'Junior frontend developer. Build accessible web applications with React and JavaScript. Location: Warsaw, Poland. Paid entry-level role.',
        },
      });
      expect(response.ok()).toBeTruthy();
      const id = (await response.json()).data.job.id;
      created.push(id);
      await page.goto('/');
      await page.getByLabel('Search jobs', { exact: true }).fill(`${marker} ${suffix}`);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await showDetails(page, 'More tools');
      await page.getByLabel('Show all saved jobs', { exact: true }).check();
      await page.locator(`[data-job-id="${id}"]`).click();
      if (automatic) {
        await expect(
          page.getByRole('button', { name: 'Apply with Jobee', exact: true }),
        ).toBeEnabled();
        await expect(page.getByText(/you authorize one application/)).toBeVisible();
      } else {
        await expect(page.getByRole('link', { name: 'Apply on employer website' })).toHaveAttribute(
          'href',
          url,
        );
        await expect(
          page.getByRole('button', { name: 'Apply with Jobee', exact: true }),
        ).toHaveCount(0);
      }
    }
  } finally {
    // Archive only these disposable smoke-test records; no real employer interaction.
    for (const id of created)
      await page.request.post(`/api/jobs/${id}/archive`, {
        data: { reason: 'Synthetic smoke test complete' },
      });
  }
});

test('Explore automatically queues analysis and publishes a new job only after a completed MATCH', async ({
  page,
}) => {
  const title = `Junior Frontend Developer ${crypto.randomUUID()}`;
  const created = await page.request.post('/api/jobs/text', {
    data: {
      title,
      company: 'Synthetic recommendation fixture',
      text: 'Location: Warsaw, Poland\nBuild accessible frontend applications. Synthetic junior role for local browser verification.',
      url: `https://employer.example.test/${crypto.randomUUID()}`,
    },
  });
  expect(created.ok()).toBeTruthy();
  const id = (await created.json()).data.job.id;
  const seeded = JSON.parse(await readFile('/tmp/jobee-ui-preview-seed.json', 'utf8'));
  const client = createDatabaseClient(process.env.UI_TEST_DATABASE_URL!);
  try {
    await page.goto('/');
    await page.getByLabel('Search jobs', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Checking jobs against your profile. Only completed matches appear below.', {
        exact: true,
      }),
    ).toBeVisible();
    // Actual queue processor with an explicitly synthetic local evaluator; no AI/provider requests.
    const processor = new RecommendationService(client.db, {
      analyzeJob: async (jobId, userId) =>
        seedUiMatches(process.env.UI_TEST_DATABASE_URL!, userId, [jobId]),
    });
    await processor.processOne(seeded.userId);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Analysis not run yet', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Search jobs', { exact: true })).toHaveValue(title);
  } finally {
    await client.close();
    await page.request.post(`/api/jobs/${id}/archive`, {
      data: { reason: 'Synthetic recommendation test complete' },
    });
  }
});

test('strong profile recommendations keep unknown salary and eligibility visible on desktop and mobile', async ({
  page,
}) => {
  const seeded = JSON.parse(await readFile('/tmp/jobee-ui-preview-seed.json', 'utf8'));
  await seedUiMatches(process.env.UI_TEST_DATABASE_URL!, seeded.userId, seeded.jobIds, true, [
    'Salary has not been published',
    'Work authorization still needs confirmation',
  ]);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const card = page.locator('.job-card').filter({
      has: page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Details to confirm: Salary has not been published');
    await expect(card).not.toContainText('Applied');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.screenshot({
      path: `output/playwright/profile-match-unknowns-${width}.png`,
      fullPage: true,
    });
    await card.getByRole('button', { name: 'View job', exact: true }).click();
    await expect(page.locator('.job-fit-overview')).toContainText(
      'Work authorization still needs confirmation',
    );
  }
});
