import { test, expect } from '@playwright/test';

const webOrigin = `http://127.0.0.1:${process.env.UI_TEST_WEB_PORT || '5179'}`;

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
});
test('desktop shell and Home use real synthetic local records', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button'),
  ).toHaveCount(6);
  await expect(
    page.getByRole('navigation', { name: 'Profile and settings' }).getByRole('button'),
  ).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Review approvals', exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/playwright/home-light.png', fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test('grouped Profile and Settings destinations preserve the original views', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Profile', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alex Morgan', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Uploaded Documents', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Saved Answers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved Answers', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Color theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'System activity', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'System activity', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({ path: 'output/playwright/settings-activity-dark.png', fullPage: true });
});
test('document selection, TXT preview, zoom and close', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
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
  await page.getByRole('button', { name: 'Jobs', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'output/playwright/jobs-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await expect(page.getByText('Software Engineering Intern', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/applications-board-light.png', fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem('jobee.theme', 'dark');
  });
  await page.reload();
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await expect(page.getByText('Software Engineering Intern', { exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Jobs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: 'output/playwright/jobs-mobile.png', fullPage: true });
});

async function openDocuments(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
  await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Master Student CV', exact: true })).toBeVisible();
}
async function openApplication(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
  await page.getByText('Frontend Developer Intern', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
  ).toBeVisible();
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
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
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
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Color theme').selectOption('dark');
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
        await page.getByRole('button', { name, exact: true }).click();
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
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
  await page.getByRole('tab', { name: 'Your details', exact: true }).click();
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
test('Studio tabs retain editing, readiness blockers and job navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await page.getByRole('tab', { name: 'Prepared materials', exact: true }).click();
  await page
    .getByRole('button', { name: /Open Application Studio/ })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Readiness Inspection', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/required application question\(s\) are unresolved/)).toBeVisible();
  for (const name of [
    /^CV$/,
    /^Cover letter$/,
    /^Questions \(/,
    /^Approvals \(/,
    /^Sources & changes$/,
    /^Overview$/,
  ]) {
    await page.getByRole('tab', { name }).click();
    await expect(page.locator('#studio-panel')).toBeVisible();
  }
  await page.screenshot({ path: 'output/playwright/studio-light.png', fullPage: true });
  await page.getByRole('button', { name: 'View Job & Requirements', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: /^Requirements/ }).click();
  await expect(page.getByRole('heading', { name: /Extracted Requirements/ })).toBeVisible();
  await page.screenshot({ path: 'output/playwright/job-detail-light.png', fullPage: true });
});
test('cancelled answer editing preserves independent authorization blockers', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Approvals', exact: true }).click();
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
  await page
    .getByRole('button', { name: /Open Studio/ })
    .first()
    .click();
  await expect(page.getByText(/pending approval request\(s\) require human review/)).toBeVisible();
});
test('interview dialogs and calendar tabs remain accessible without external connections', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Interviews', exact: true }).click();
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
  await page.goto('/');
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
    await page.getByRole('button', { name: 'Applications', exact: true }).click();
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
    await page.getByRole('button', { name: 'My Profile', exact: true }).click();
    await page.getByRole('tab', { name: 'CV & Documents', exact: true }).click();
    await page.getByRole('button', { name: 'Smart Import & Extract', exact: true }).click();
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
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
  await page.getByRole('tab', { name: 'Your details', exact: true }).click();
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
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
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
  await page.getByRole('tab', { name: 'Review & suggestions', exact: true }).click();
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
  await page.getByRole('button', { name: 'Jobs', exact: true }).click();
  await page.getByRole('button', { name: 'Add job', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Job Posting Public URL')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .locator('.job-card')
    .filter({ has: page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }) })
    .getByRole('button', { name: 'View job', exact: true })
    .click();
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
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
    pending.clear();
    await shot('home', theme);
    await page.getByRole('button', { name: 'Progress & activity', exact: true }).click();
    await shot('home-progress', theme);
    await page.getByRole('button', { name: 'My Profile', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Alex Morgan', exact: true })).toBeVisible();
    await shot('profile-overview', theme);
    await page.getByRole('tab', { name: 'Your details', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your details', exact: true })).toBeVisible();
    await shot('profile', theme);
    await page.getByRole('tab', { name: 'Review & suggestions', exact: true }).click();
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
    await page.getByRole('button', { name: 'Jobs', exact: true }).click();
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
    await expect(page.getByRole('tab', { name: /^Requirements/ })).toBeVisible();
    await shot('job-detail', theme);
    await page.getByRole('button', { name: 'Applications', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible();
    await expect(page.getByText('Frontend Developer Intern', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await shot('applications-board', theme);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('table')).toBeVisible();
    await shot('applications-list', theme);
    await page.getByText('Frontend Developer Intern', { exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Frontend Developer Intern', exact: true }),
    ).toBeVisible();
    await shot('application-detail', theme);
    await page.getByRole('button', { name: 'Applications', exact: true }).click();
    await page.getByRole('tab', { name: 'Prepared materials', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /Open Application Studio/ }).first(),
    ).toBeVisible();
    await shot('prepared-materials', theme);
    await page
      .getByRole('button', { name: /Open Application Studio/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Readiness Inspection', exact: true }),
    ).toBeVisible();
    await shot('studio', theme);
    await page.getByRole('button', { name: 'Approvals', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Approvals', exact: true })).toBeVisible();
    await shot('approvals', theme);
    await page.getByRole('button', { name: 'Messages', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Messages', exact: true })).toBeVisible();
    await shot('messages', theme);
    await page.getByRole('button', { name: 'Interviews', exact: true }).click();
    await expect(page.getByText('Panel conversation', { exact: true })).toBeVisible();
    await shot('interviews', theme);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByLabel('Color theme')).toBeVisible();
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
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
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

test('Home visual regression reference in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await page.evaluate((theme) => localStorage.setItem('jobee.theme', theme), theme);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome back, Alex' })).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Home overview' })
        .getByRole('button', { name: 'Open', exact: true }),
    ).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Retry profile suggestions' })).toHaveCount(0);
    await expect(page.getByText('Checking your next steps…')).toHaveCount(0);
    await expect(page.getByText('3 application items to review', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('home-' + theme + '.png', {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  }
});

test('student defaults reduce empty work without changing review permissions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Board', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Messages', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^Messages \(/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'My Profile', exact: true }).click();
  await page.getByRole('tab', { name: 'Review & suggestions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Needs verification', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unverify', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^All \(/ }).click();
  await expect(page.getByRole('button', { name: 'Unverify', exact: true }).first()).toBeVisible();
});
