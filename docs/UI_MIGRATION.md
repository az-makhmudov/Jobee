# JOB-UI-MIGRATION-01 — Jobee design system migration

Status: **RELEASE AUTHORIZED / DEPLOYMENT IN PROGRESS**. Lead implementation: Codex, explicitly assigned by the product owner. The owner approved applying the migration to the main checkout and deploying live on 18 October 2026.

Implementation checkpoint: `675ec5c06b5e6a572ea5b8ae23803516a7dc904e`; main checkout fast-forwarded through `27627be`.

Baseline: `9c1b206debf25be97cb16b832daf09e287a32803`. Isolated branch: `codex/jobee-design-system-migration`.

## Delivered interfaces

All 25 mapped UI components, including 17 main views, use the shared Jobee presentation foundation. Eight destinations replace the crowded sidebar: Home, Jobs, Applications, Approvals, Interviews, Messages, My Profile and Settings. The original sections remain accessible through grouped tabs. Home and Profile overview use live application data and keep the original detailed tools available.

The foundation includes Figma-derived semantic colors in both themes, locally hosted Google Sans Flex, a central 51-name icon registry, content-driven cards, shared native fields/buttons, keyboard tabs, labelled controls, focus-managed dialogs and device-following appearance with remembered override. Detail views load on demand. Obsolete global presentation rules and hardcoded component palettes have been replaced.

Profile verification, AI permission, Smart Import acceptance, material approval, policy override and browser submission authorization remain separate decisions. All 17 lifecycle statuses and eight browser-run statuses are retained. `scripts/audit-ui-contracts.mjs` verifies **184 existing API calls and payloads across all 25 components** against the audited baseline. Backend, shared domain types, database and worker source have no migration changes.

[Source-to-Figma mapping and all 18 closure groups](UI_MIGRATION_MAP.md) document component destinations, implementation and verification evidence.

## Inline document preview

Uploaded documents now support selection and inline PDF, DOCX and TXT preview, pagination where applicable, zoom, close, loading, error/retry and original download. Unsupported files retain download fallback. Requests use the existing authenticated download endpoint and owner checks. Selection cancels old retrieval and remounts rendering; PDF tasks are destroyed on cleanup. DOCX uses a sandbox without scripts and a persistent CSP blocking external resources. PDF fonts, character maps, worker and WASM are packaged locally. Document paper retains its intended light appearance.

## Local preview and review

Current preview: **http://127.0.0.1:5179**. It connects only to the disposable local API/database, with no background worker or live provider credentials.

Synthetic local account: `alex.morgan@example.test` / `JobeePreview123!`. These are test fixtures, never production credentials. The seeder is guarded by `JOBEE_UI_PREVIEW_FIXTURES=local-only` and targets loopback port 3000.

To reproduce after installing dependencies:

1. Create a disposable PostgreSQL database on loopback; the database name must end with `isolated` or `ci_test`.
2. Set `DATABASE_URL` and `UI_TEST_DATABASE_URL` to that database. Build internal packages, then run `npm run db:migrate`.
3. Install Chromium with `npx playwright install chromium`, then run `npm run test:ui`. The harness starts the local API/web servers and seeds synthetic records. Existing local servers are reused outside CI; ensure they belong to this isolated preview.
4. Run `node scripts/generate-ui-review.mjs` after the complete render inventory. Open `output/playwright/design-review.html` for Light/Dark screenshots. Cached Figma references are included in the current local review artifacts; a fresh checkout can open the linked Figma sources directly.

The preview CI job runs on main pushes and pull requests. It provisions disposable PostgreSQL, builds shared packages and the deployment container builder, applies existing migrations, runs the browser suite and uploads the report. Railway retains its existing main-branch deployment process.

## Verification

Baseline before changes: lint passed with 705 existing warnings; typecheck/build passed; **579 tests across 63 files passed** against disposable PostgreSQL. No production data or credentials were copied.

Final gates passed on 18 October 2026:

| Check                                       | Result                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Formatting / lint                           | Pass; 0 lint errors, 701 existing warnings (baseline 705)                                 |
| Typecheck / production build                | Pass                                                                                      |
| Unit and integration tests                  | **586 / 586**, 64 files                                                                   |
| Browser regressions                         | **25 / 25**, Chromium, with both Home visual baselines matching                           |
| Database connectivity / existing migrations | Pass, isolated local database only                                                        |
| Source contract reconciliation              | **184 / 184** baseline calls/payloads, all **25** mapped components                       |
| Desktop capture inventory                   | **40** captures: 20 views/states × Light/Dark at 1440px; supporting dialogs also captured |
| Responsive checks                           | 1280px, 1920px and 393px navigation/feature access                                        |

The initial application JavaScript bundle decreased from 754.67 kB (175.99 kB gzip) to 428.15 kB (116.61 kB gzip); feature views and document renderers load separately. The local build no longer emits the baseline large-chunk warning.

Evidence includes the full unit/integration suite, browser regression flows, two Home visual baselines, 40 desktop renders at 1440px in both themes, supporting dialogs/document previews, 1280px/1920px layout checks and the existing narrow-screen navigation.

## Review limits and release

Screenshots use synthetic API data. Counts, dates, readiness and document contents therefore differ from Figma examples; screenshots are not claims of pixel identity with fictional design records. The Home Light/Dark baselines provide automated visual regression checks, while the local comparison gallery supports design review across the full inventory.

Live ATS submission, real recruiter email, calendar mutations and paid AI providers are excluded from preview testing. Their existing authorization and fixture-provider integration tests remain in the suite. The dependency audit still reports the same nine baseline advisories (five moderate, four critical), with no advisories attributed to the newly added PDF.js or docx-preview packages. This UI milestone does not change the affected existing dependencies; dependency remediation remains a separate release consideration.

Chromium is the automated browser target. The authorized release adds the document-preview resource setup script to the Docker builder context; no production configuration or database schema changes are required.

The migration is applied to the main local checkout. Deployment and live verification are in progress. Retained rollback deployments at baseline `9c1b206`: API `93b7ca5f-e9de-402e-96b7-0c5814aff0bd`, worker `0c576a10-ee9c-4c37-8d63-ab7b5ab067d6`. No production database migration or external provider action is part of this UI release.
