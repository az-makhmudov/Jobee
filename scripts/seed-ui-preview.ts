import { seedUiMatches } from './ui-preview-matches.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:3000';
const email = 'alex.morgan@example.test',
  password = 'JobeePreview123!';
let cookie = '';
async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: 'http://127.0.0.1:5179',
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const set = response.headers.getSetCookie();
  if (set.length) cookie = set.map((v) => v.split(';')[0]).join('; ');
  const value = await response.json();
  if (!response.ok) throw new Error(path + ': ' + response.status + ' ' + JSON.stringify(value));
  return value;
}
async function run() {
  if (process.env.JOBEE_UI_PREVIEW_FIXTURES !== 'local-only')
    throw new Error(
      'Set JOBEE_UI_PREVIEW_FIXTURES=local-only to seed synthetic local preview fixtures.',
    );
  const session = await request('/api/auth/sign-in/email', 'POST', { email, password }).catch(() =>
    request('/api/auth/sign-up/email', 'POST', { email, password, name: 'Alex Morgan' }),
  );
  if (!session.user?.id) throw new Error('Local synthetic account could not be created');
  await request('/api/candidate/profile', 'PUT', {
    fullName: 'Alex Morgan',
    headline: 'Computer Science student · Frontend development',
    email,
    city: 'Warsaw',
    country: 'Poland',
    summary: 'Synthetic preview profile. Learning through coursework and personal projects.',
  });
  const skills = (await request('/api/candidate/skills')).data;
  for (const name of ['React', 'JavaScript', 'HTML & CSS'])
    if (!skills.some((s: { name: string }) => s.name === name))
      await request('/api/candidate/skills', 'POST', {
        name,
        category: 'Frontend',
        proficiency: 'Intermediate',
        verificationStatus: 'VERIFIED',
      });
  const education = (await request('/api/candidate/education')).data;
  if (!education.length)
    await request('/api/candidate/education', 'POST', {
      institution: 'Warsaw University of Technology',
      degree: 'B.Sc.',
      fieldOfStudy: 'Computer Science',
      startDate: '2024-10',
      endDate: '2027-06',
    });
  await request('/api/candidate/preferences', 'PUT', {
    targetTitles: ['Frontend Developer Intern', 'Software Engineering Intern'],
    preferredLocations: ['Warsaw', 'Remote'],
    workModes: ['REMOTE', 'HYBRID'],
    employmentTypes: ['INTERNSHIP'],
    seniorityLevels: ['ENTRY', 'INTERNSHIP'],
    preferredLanguages: ['English'],
    excludedCompanies: [],
    excludedKeywords: [],
    acceptUnpaid: false,
    willingToRelocate: false,
    needsSponsorship: false,
  });
  const existing = (await request('/api/jobs')).data.items;
  const seedJobs = [
    ['Frontend Developer Intern', 'Northstar'],
    ['Software Engineering Intern', 'Forma'],
    ['Junior Frontend Developer', 'Studio One'],
  ];
  const jobIds: string[] = [];
  for (const [title, company] of seedJobs) {
    const found = existing?.find((j: { company: string }) => j.company === company);
    if (found) {
      jobIds.push(found.id);
      continue;
    }
    const created = await request('/api/jobs/text', 'POST', {
      title,
      company,
      text:
        title +
        ' at ' +
        company +
        '. Join a supportive team building accessible web applications. Student or entry-level candidate. Learn React, JavaScript, semantic HTML and CSS. Remote or hybrid in Warsaw. Paid internship. English communication required.',
      url: 'https://example.test/' + company.toLowerCase(),
    });
    jobIds.push(created.data.job.id);
  }
  for (const id of jobIds)
    await request(`/api/jobs/${id}`, 'PUT', {
      city: 'Warsaw',
      country: 'Poland',
      locationText: 'Warsaw, Poland',
      workplaceType: 'HYBRID',
    });
  const apps = (await request('/api/applications')).data;
  for (let i = 0; i < jobIds.length; i++)
    if (!apps.some((a: { jobId: string }) => a.jobId === jobIds[i]))
      await request('/api/applications', 'POST', {
        jobId: jobIds[i],
        status: i === 0 ? 'INTERVIEW' : i === 1 ? 'APPLIED' : 'NEEDS_REVIEW',
        source: 'MANUAL',
        nextAction:
          i === 0 ? 'Prepare for your conversation' : i === 1 ? 'Follow up' : 'Review materials',
      });
  const docs = (await request('/api/candidate/documents')).data;
  if (!docs.some((d: { originalFilename: string }) => d.originalFilename === 'preview-cv.txt')) {
    const form = new FormData();
    form.append(
      'file',
      new Blob(
        [
          'ALEX MORGAN\nComputer Science student · Frontend development\n\nEDUCATION\nB.Sc. Computer Science, 2024–2027\n\nSKILLS\nReact · JavaScript · Accessible HTML & CSS\n\nSynthetic preview document.',
        ],
        { type: 'text/plain' },
      ),
      'preview-cv.txt',
    );
    form.append('documentType', 'MASTER_CV');
    form.append('displayName', 'Master Student CV');
    form.append('version', '1.0');
    form.append('isMaster', 'true');
    await request('/api/candidate/documents', 'POST', form);
  }
  const uploadFixture = async (name: string, type: string, bytes: Uint8Array) => {
    if (docs.some((d: { originalFilename: string }) => d.originalFilename === name)) return;
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type }), name);
    form.append('documentType', 'ROLE_CV');
    form.append(
      'displayName',
      name === 'preview-cv.pdf' ? 'PDF preview example' : 'DOCX preview example',
    );
    form.append('isMaster', 'false');
    form.append('version', '1.0');
    await request('/api/candidate/documents', 'POST', form);
  };
  const pdfObjects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream =
    'BT /F1 22 Tf 60 770 Td (ALEX MORGAN - PREVIEW CV) Tj 0 -40 Td /F1 12 Tf (Synthetic PDF for local UI validation.) Tj ET';
  pdfObjects.push('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  pdfObjects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += index + 1 + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = Buffer.byteLength(pdf);
  pdf +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' +
    xref +
    '\n%%EOF';
  await uploadFixture('preview-cv.pdf', 'application/pdf', new Uint8Array(Buffer.from(pdf)));
  const docx = await Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'ALEX MORGAN', bold: true, size: 40 })],
            }),
            new Paragraph('Synthetic DOCX preview for local UI validation.'),
            new Paragraph('Computer Science student - Frontend development'),
            new Paragraph('React, JavaScript, accessible HTML and CSS.'),
          ],
        },
      ],
    }),
  );
  await uploadFixture(
    'preview-cv.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    new Uint8Array(docx),
  );
  const latestApps = (await request('/api/applications')).data;
  const northstar = latestApps.find((app: { jobId: string }) => app.jobId === jobIds[0]);
  if (northstar) {
    const detail = (await request('/api/applications/' + northstar.id)).data;
    if (!detail.interviews?.length)
      await request('/api/applications/' + northstar.id + '/interviews', 'POST', {
        roundTitle: 'Panel conversation',
        interviewType: 'VIDEO',
        scheduledAt: '2026-11-04T13:00:00.000Z',
        durationMinutes: 30,
        timezone: 'Europe/Warsaw',
        interviewerName: 'Preview recruiter',
        notes: 'Synthetic local interview. No calendar provider is contacted.',
      });
  }
  const packages = (await request('/api/application-packages')).data;
  if (!packages.some((pkg: { jobId: string }) => pkg.jobId === jobIds[0]))
    await request('/api/jobs/' + jobIds[0] + '/application-package', 'POST', {});
  await seedUiMatches(process.env.DATABASE_URL!, session.user.id, jobIds);
  await writeFile(
    '/tmp/jobee-ui-preview-seed.json',
    JSON.stringify({ email, userId: session.user.id, jobIds }),
  );
  console.log(
    'Synthetic preview account, profile, jobs, applications and document are ready. No external providers were called.',
  );
}
run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
