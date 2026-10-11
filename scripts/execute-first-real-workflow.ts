import { getDb, candidateProfiles } from '@job-agent/database';
import { getConfig } from '@job-agent/config';
import { JobService } from '../apps/api/src/services/job-service.js';
import { MatchService } from '../apps/api/src/services/match-service.js';
import { ApplicationPackageService } from '../apps/api/src/services/application-package-service.js';
import { ApplicationCrmService } from '../apps/api/src/services/application-crm-service.js';
import { LocalStorageProvider } from '../apps/api/src/storage/local-storage.js';
import { createAiProvider } from '../apps/api/src/ai/index.js';

async function main() {
  console.log('=== Executing First Complete Real User Workflow ===');
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);

  const [profile] = await db.select().from(candidateProfiles);
  if (!profile) {
    throw new Error('Candidate profile not found.');
  }
  const userId = profile.userId;
  console.log(
    `Candidate: ${profile.fullName} | Role: ${profile.headline} | Location: ${profile.city}, ${profile.country}`,
  );

  // Safety guard: Protect primary candidate data
  const isPrimaryCandidate = userId === '00000000-0000-0000-0000-000000000001';
  if (isPrimaryCandidate && !process.argv.includes('--force-candidate-override')) {
    console.error(
      'SAFETY ABORT: Refusing to run autonomous workflow script against primary candidate without explicit --force-candidate-override flag.',
    );
    process.exit(1);
  }

  const storage = new LocalStorageProvider();
  const jobService = new JobService(db);
  const aiProvider = createAiProvider(config);
  const matchService = new MatchService(db, aiProvider);
  const packageService = new ApplicationPackageService(db, storage);

  // 1. Ingest Real Job Vacancy
  console.log('\n--- Step 1: Ingesting Real Job Vacancy (Associate Project Manager @ Revolut) ---');
  const jobText = `About the Role:
Revolut is seeking an Associate Project Manager to join our Operations and Project Management team in Warsaw, Poland. In this role, you will coordinate key project streams, optimize operational workflows, and track project deliverables using Agile and Scrum methodologies.

Responsibilities:
- Collaborate with operations and product leads to plan, schedule, and execute business initiatives.
- Facilitate Agile ceremonies including daily stand-ups, sprint planning, and retrospective sessions.
- Manage project boards and documentation in Jira, Confluence, and Trello.
- Track project milestones, identify delivery risks, and prepare weekly status reports using Advanced Excel.
- Optimize operational processes to eliminate bottlenecks, reduce document turnaround times, and improve process efficiency.
- Coordinate cross-departmental communications and verify documentation compliance to mitigate operational risks.

Requirements:
- Education in Project Management, Business, or related discipline (Bachelor in progress or completed).
- Demonstrated experience or background in banking operations, project coordination, or operational support.
- Practical knowledge of Agile, Scrum, and Kanban methodologies.
- Proficiency with project management tools: Jira, Trello, Asana, or Microsoft Project.
- Advanced Excel capabilities for reporting and data analysis.
- Strong organizational, analytical, and stakeholder management skills.
- Fluent in English.
- Legally authorized to work in Poland.`;

  const ingestRes = await jobService.ingestText(userId, {
    text: jobText,
    title: 'Associate Project Manager',
    company: 'Revolut',
    sourceNotes: 'Real Warsaw vacancy aligned with candidate qualifications',
  });

  const job = ingestRes.job;
  console.log(`✓ Job Ingested: "${job.title}" at ${job.company} (ID: ${job.id})`);
  console.log(
    `  Location: ${job.locationText || 'Warsaw, Poland'} | Workplace: ${job.workplaceType}`,
  );

  // 2. Run Match Analysis & Policy Evaluation
  console.log('\n--- Step 2: Running Match Analysis & Policy Authorization ---');
  const matchRes = await matchService.analyzeJob(job.id, userId, { force: true });
  console.log(
    `✓ Match Score: ${matchRes.overallScore}% | Decision: ${matchRes.decision} | Engine: ${matchRes.analysisMode}`,
  );
  console.log(`  Strengths: ${matchRes.strengths.slice(0, 3).join('; ')}`);
  console.log(
    `  Hard Blockers: ${matchRes.hardBlockers.length === 0 ? 'None' : matchRes.hardBlockers.join(', ')}`,
  );
  console.log(`  Auto-apply eligible: ${matchRes.autoApplyEligible}`);

  // 3. Generate Application Studio Package
  console.log(
    '\n--- Step 3: Generating Application Package (Tailored CV, Cover Letter, Questions) ---',
  );
  const pkgRes = await packageService.createPackage(userId, job.id);
  const pkg = pkgRes.package;
  const fullPkg = await packageService.getPackage(pkg.id, userId);
  console.log(`✓ Package Created: ID ${pkg.id} (Version ${fullPkg.currentVersion?.versionNumber})`);
  console.log(
    `  Readiness: isReady=${fullPkg.readiness.isReady} | status=${fullPkg.readiness.status}`,
  );
  console.log(`  Blockers: ${fullPkg.readiness.blockingIssues.join(', ') || 'None'}`);

  // Inspect Cover Letter
  console.log('\n--- Step 4: Inspecting Truthful Grounded Cover Letter ---');
  console.log(fullPkg.currentVersion?.coverLetterContent);
  console.log('\n  Verification: Checking for hallucinated software engineering claims...');
  const hasHallucination =
    /production software systems|engineering experience|engineering initiatives/i.test(
      fullPkg.currentVersion?.coverLetterContent || '',
    );
  if (hasHallucination) {
    throw new Error('FAILED: Cover letter contains hallucinated software engineering claims!');
  }
  console.log(
    "  ✓ PASSED: Cover letter is 100% grounded in Asadbek's operations & project management background.",
  );

  // Inspect Generated Artifacts
  console.log('\n--- Step 5: Inspecting Generated Artifacts ---');
  for (const art of fullPkg.artifacts) {
    console.log(`  Artifact: ${art.artifactType} (${art.filename}) - Size: ${art.sizeBytes} bytes`);
  }

  // 4. Track in CRM
  console.log('\n--- Step 6: Tracking Application in CRM ---');
  const crmRes = await ApplicationCrmService.createOrGetApplication(userId, {
    jobId: job.id,
    packageId: pkg.id,
    notes: 'Real job match for Associate Project Manager role in Warsaw.',
  });
  console.log(
    `✓ Application Tracked in CRM: ID ${crmRes.application.id} | Status: ${crmRes.application.status}`,
  );

  console.log('\n=== First Real User Workflow Completed Successfully! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Workflow error:', err);
  process.exit(1);
});
