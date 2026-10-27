import { it, expect } from 'vitest';
import {
  matchesDiscoveryRole,
  discoveryCountry,
  matchesDiscoveryExperience,
} from './discovery-role-matching.js';
it('finds related entry-level titles without an exact preferred-title phrase', () => {
  expect(
    matchesDiscoveryRole('Płatny staż w dziale IT - Project Management (k/m)', [
      'Junior Project Manager',
    ]),
  ).toBe(true);
  expect(matchesDiscoveryRole('Project Coordinator Intern', ['Junior Project Manager'])).toBe(true);
  expect(matchesDiscoveryRole('Junior Operations Client Partner', ['Operations Manager'])).toBe(
    true,
  );
  expect(matchesDiscoveryRole('Projection Technician', ['Project Manager'])).toBe(false);
  expect(matchesDiscoveryRole('Senior Surgeon', ['Junior Project Manager'])).toBe(false);
  expect(matchesDiscoveryRole('Product Designer', ['Product Operations Specialist'])).toBe(false);
  expect(matchesDiscoveryRole('Developer', ['Junior'])).toBe(false);
});
it('uses Poland as a query hint only for explicit Polish targets', () => {
  expect(discoveryCountry(['Warsaw'])).toBe('pl');
  expect(discoveryCountry(['Warszawa, Poland'])).toBe('pl');
  expect(discoveryCountry(['Berlin'])).toBeUndefined();
  expect(discoveryCountry(['Warsaw', 'Berlin'])).toBeUndefined();
  expect(discoveryCountry([])).toBeUndefined();
});

it('excludes explicit experienced metadata for early-career targets without inventing missing levels', () => {
  expect(matchesDiscoveryExperience('mid_senior_level', ['ENTRY', 'INTERNSHIP'])).toBe(false);
  expect(matchesDiscoveryExperience('director', ['ENTRY'])).toBe(false);
  expect(matchesDiscoveryExperience('entry_level', ['ENTRY'])).toBe(true);
  expect(matchesDiscoveryExperience(undefined, ['ENTRY'])).toBe(true);
  expect(matchesDiscoveryExperience('mid_senior_level', ['SENIOR'])).toBe(true);
});
