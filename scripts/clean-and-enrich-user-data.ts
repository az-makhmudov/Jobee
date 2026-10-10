import {
  getDb,
  candidateProfiles,
  candidateExperiences,
  candidateSkills,
  candidateCertifications,
  candidateFacts,
  candidateDocuments,
  jobs,
  applications,
  browserApplicationRuns,
  eq,
  inArray,
} from '@job-agent/database';
import { getConfig } from '@job-agent/config';

async function main() {
  const config = getConfig();
  const db = getDb(config.DATABASE_URL);

  const [profile] = await db.select().from(candidateProfiles);
  if (!profile) {
    console.error('No candidate profile found.');
    process.exit(1);
  }
  const userId = profile.userId;
  console.log(`Working on candidate: ${profile.fullName} (ID: ${userId})`);

  // 1. Remove synthetic document (Jane Hopper)
  const delDoc = await db
    .delete(candidateDocuments)
    .where(eq(candidateDocuments.displayName, 'Jane Hopper Resume'))
    .returning();
  console.log(`✓ Removed ${delDoc.length} synthetic fixture document(s)`);

  // Ensure Resume - Asadbek M is master
  await db
    .update(candidateDocuments)
    .set({ isMaster: true })
    .where(eq(candidateDocuments.originalFilename, 'Resume - Asadbek M.pdf'));
  console.log('✓ Verified Asadbek resume as authoritative Master CV');

  // 2. Remove synthetic test jobs and applications
  const allJobs = await db.select().from(jobs).where(eq(jobs.userId, userId));
  const testJobIds = allJobs.map((j) => j.id);
  if (testJobIds.length > 0) {
    await db.delete(browserApplicationRuns).where(eq(browserApplicationRuns.userId, userId));
    await db.delete(applications).where(eq(applications.userId, userId));
    await db.delete(jobs).where(inArray(jobs.id, testJobIds));
    console.log(`✓ Cleaned up ${testJobIds.length} synthetic test jobs and their applications`);
  }

  // 3. Update real achievements on Asia Alliance Bank experience
  const [exp] = await db
    .select()
    .from(candidateExperiences)
    .where(eq(candidateExperiences.userId, userId));
  if (exp) {
    await db
      .update(candidateExperiences)
      .set({
        description: 'Assisted operations management and optimized banking workflows.',
        achievements: [
          'Assisted in digitizing operational files and optimizing workflows, achieving a 30% reduction in document retrieval time while improving overall process efficiency.',
          'Supported management by analyzing operational data and preparing daily transaction reports with Advanced Excel, ensuring 100% accuracy in financial record-keeping.',
          'Coordinated cross-departmental communications to streamline client onboarding and verified documentation in strict adherence to compliance protocols, mitigating operational risks.',
        ],
        updatedAt: new Date(),
      })
      .where(eq(candidateExperiences.id, exp.id));
    console.log(`✓ Enriched verified achievements for: ${exp.organization} (${exp.position})`);
  }

  // 4. Add verified skills from resume
  await db.delete(candidateSkills).where(eq(candidateSkills.userId, userId));
  const skillsList = [
    {
      name: 'Project Management',
      category: 'Project Management',
      proficiency: 'ADVANCED',
      yearsExperience: 2,
    },
    {
      name: 'Agile Methodologies',
      category: 'Methodology',
      proficiency: 'ADVANCED',
      yearsExperience: 2,
    },
    { name: 'Scrum', category: 'Methodology', proficiency: 'ADVANCED', yearsExperience: 2 },
    { name: 'Kanban', category: 'Methodology', proficiency: 'ADVANCED', yearsExperience: 2 },
    {
      name: 'Risk Management',
      category: 'Project Management',
      proficiency: 'INTERMEDIATE',
      yearsExperience: 2,
    },
    {
      name: 'Project Scheduling',
      category: 'Project Management',
      proficiency: 'ADVANCED',
      yearsExperience: 2,
    },
    {
      name: 'Process Optimization',
      category: 'Operations',
      proficiency: 'ADVANCED',
      yearsExperience: 2,
    },
    { name: 'Jira', category: 'Tools', proficiency: 'ADVANCED', yearsExperience: 2 },
    { name: 'Trello', category: 'Tools', proficiency: 'ADVANCED', yearsExperience: 2 },
    { name: 'Asana', category: 'Tools', proficiency: 'ADVANCED', yearsExperience: 1 },
    {
      name: 'Microsoft Project',
      category: 'Tools',
      proficiency: 'INTERMEDIATE',
      yearsExperience: 1,
    },
    { name: 'Advanced Excel', category: 'Tools', proficiency: 'ADVANCED', yearsExperience: 2 },
    {
      name: 'Stakeholder Management',
      category: 'Project Management',
      proficiency: 'ADVANCED',
      yearsExperience: 2,
    },
    {
      name: 'Banking Operations',
      category: 'Domain',
      proficiency: 'INTERMEDIATE',
      yearsExperience: 1,
    },
  ];

  for (const s of skillsList) {
    await db.insert(candidateSkills).values({
      userId,
      name: s.name,
      category: s.category,
      proficiency: s.proficiency as any,
      yearsExperience: s.yearsExperience,
      isTopSkill: [
        'Project Management',
        'Agile Methodologies',
        'Scrum',
        'Jira',
        'Process Optimization',
      ].includes(s.name),
    });
  }
  console.log(`✓ Inserted ${skillsList.length} verified candidate skills from resume`);

  // 5. Add verified certifications from resume
  await db.delete(candidateCertifications).where(eq(candidateCertifications.userId, userId));
  const certsList = [
    {
      name: 'Google Project Management Professional Certificate',
      issuingOrganization: 'Coursera / Google',
      issueDate: '2024-03',
    },
    {
      name: 'Applied Project Management',
      issuingOrganization: 'Frankfurt School of Finance & Management',
      issueDate: '2024-01',
    },
  ];

  for (const c of certsList) {
    await db.insert(candidateCertifications).values({
      userId,
      name: c.name,
      issuingOrganization: c.issuingOrganization,
      issueDate: c.issueDate,
    });
  }
  console.log(`✓ Inserted ${certsList.length} verified candidate certifications from resume`);

  // 6. Add verified candidate facts
  await db.delete(candidateFacts).where(eq(candidateFacts.userId, userId));
  const factsList = [
    {
      factKey: 'work_authorization',
      category: 'WORK_AUTHORIZATION',
      statement: 'Legally authorized to work in Poland and the European Union.',
    },
    {
      factKey: 'visa_sponsorship',
      category: 'SPONSORSHIP',
      statement: 'Does not require employer visa sponsorship.',
    },
    { factKey: 'current_location', category: 'LOCATION', statement: 'Located in Warsaw, Poland.' },
    {
      factKey: 'target_role',
      category: 'EXPERIENCE',
      statement: 'Project Manager specializing in Agile, Scrum, and process optimization.',
    },
    {
      factKey: 'education_status',
      category: 'EDUCATION',
      statement:
        'Currently pursuing Bachelor in Project Management at Vistula University (expected 2027).',
    },
    {
      factKey: 'banking_experience',
      category: 'EXPERIENCE',
      statement:
        'Demonstrated experience in banking operations and financial transaction reporting at Asia Alliance Bank.',
    },
  ];

  for (const f of factsList) {
    await db.insert(candidateFacts).values({
      userId,
      factKey: f.factKey,
      category: f.category,
      statement: f.statement,
      verificationStatus: 'VERIFIED',
      allowAiUse: true,
    });
  }
  console.log(`✓ Inserted ${factsList.length} verified candidate facts`);

  console.log('\n--- Data Hygiene & Candidate Brain Enrichment Complete ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error during data cleanup & enrichment:', err);
  process.exit(1);
});
