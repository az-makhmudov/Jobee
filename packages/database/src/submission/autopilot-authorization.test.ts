import { it, expect } from 'vitest';
import { autopilotJobInScope } from './autopilot-authorization.js';
import type { AutopilotGrant } from '@job-agent/shared';
import type { Job } from '../schema/jobs.js';
const grant: AutopilotGrant = {
  version: 1,
  termsVersion: 'jobee-autopilot-v1',
  acceptedAt: '2026-10-21',
  candidateFingerprint: 'fixture',
  intervalHours: 24,
  maxPerDay: 2,
  minScore: 90,
  reviewMode: 'PAUSE',
  preferences: {
    targetTitles: ['Software Engineer'],
    preferredLocations: ['Berlin'],
    workModes: ['remote'],
    employmentTypes: ['full-time'],
    minSalary: 50000,
    currency: 'EUR',
    salaryPayPeriod: 'YEAR',
    excludedCompanies: ['Excluded'],
    excludedKeywords: ['clearance'],
    needsSponsorship: false,
    workAuthorizationCountries: ['Germany'],
    internshipEligible: false,
    acceptUnpaid: false,
  },
};
const job = {
  title: 'Software Engineer',
  company: 'Fixture',
  description: 'Build services',
  locationText: 'Berlin, Germany',
  workplaceType: 'REMOTE',
  employmentType: 'FULL_TIME',
  minSalary: 60000,
  currency: 'EUR',
  payPeriod: 'YEAR',
  state: 'INGESTED',
  isDuplicate: false,
  expirationDate: null,
} as Job;
it('accepts only the explicit saved role/location/type/salary scope', () => {
  expect(autopilotJobInScope(grant, job)).toBe(true);
});
it.each([
  { title: 'Accountant' },
  { locationText: 'Paris' },
  { workplaceType: 'UNKNOWN' },
  { employmentType: 'UNKNOWN' },
  { minSalary: null },
  { payPeriod: 'MONTH' },
  { currency: 'USD' },
  { company: 'Excluded' },
  { description: 'Requires clearance' },
  { employmentType: 'INTERNSHIP' },
  { state: 'ARCHIVED' },
  { isDuplicate: true },
  { description: 'unpaid role' },
])('rejects missing or out-of-scope evidence %j', (patch) => {
  expect(autopilotJobInScope(grant, { ...job, ...patch })).toBe(false);
});
