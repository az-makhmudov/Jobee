import { describe, it, expect, beforeEach } from 'vitest';
import { FixtureBrowserController } from '../browser/fixture-browser-controller.js';
import { GreenhouseAdapter } from './greenhouse-adapter.js';
import { LeverAdapter } from './lever-adapter.js';
import { AshbyAdapter } from './ashby-adapter.js';
import { AtsAdapterRegistry } from './ats-adapter-registry.js';
import {
  AtsProviderType,
  AtsFormFieldType,
  type ApplicationSubmissionPayload,
} from '@job-agent/shared';

describe('ATS Adapters & Form Extraction (JOB-P5-T01)', () => {
  let controller: FixtureBrowserController;
  let registry: AtsAdapterRegistry;

  const samplePayload: ApplicationSubmissionPayload = {
    firstName: 'Alex',
    lastName: 'Morgan',
    fullName: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    phone: '+1 555-0199',
    location: 'San Francisco, CA',
    urls: {
      linkedin: 'https://linkedin.com/in/alexmorgan',
      github: 'https://github.com/alexmorgan',
    },
    resumeFileName: 'alex-morgan-resume.pdf',
    coverLetterText: 'I am excited to apply for this engineering role.',
    answers: {
      work_authorization: {
        answerText: 'Yes',
        isSensitive: false,
        verificationStatus: 'VERIFIED',
      },
      sponsorship: {
        answerText: 'No',
        isSensitive: false,
        verificationStatus: 'VERIFIED',
      },
    },
  };

  beforeEach(() => {
    controller = new FixtureBrowserController();
    registry = new AtsAdapterRegistry();
  });

  describe('GreenhouseAdapter', () => {
    it('matches Greenhouse URLs correctly', () => {
      const adapter = new GreenhouseAdapter();
      expect(adapter.matches('https://boards.greenhouse.io/acme/jobs/12345')).toBe(true);
      expect(adapter.matches('https://jobs.lever.co/acme')).toBe(false);
    });

    it('extracts structured form schema from Greenhouse fixture', async () => {
      const page = await controller.newPage();
      await page.goto('https://boards.greenhouse.io/acme/jobs/12345');

      const adapter = new GreenhouseAdapter();
      const schema = await adapter.extractForm(page);

      expect(schema.provider).toBe(AtsProviderType.GREENHOUSE);
      expect(schema.hasResumeUpload).toBe(true);
      expect(schema.hasCaptcha).toBe(false);
      expect(schema.fields.length).toBeGreaterThanOrEqual(7);

      const fieldNames = schema.fields.map((f) => f.name);
      expect(fieldNames).toContain('first_name');
      expect(fieldNames).toContain('last_name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('phone');
      expect(fieldNames).toContain('resume');

      // Verify required fields
      const firstNameField = schema.fields.find((f) => f.name === 'first_name');
      expect(firstNameField?.required).toBe(true);
      expect(firstNameField?.mappedConcept).toBe('firstName');

      await page.close();
    });

    it('resolves candidate payload facts accurately without guessing', () => {
      const adapter = new GreenhouseAdapter();
      const fnField = {
        id: 'first_name',
        name: 'first_name',
        label: 'First Name',
        type: AtsFormFieldType.TEXT,
        required: true,
        selector: '#first_name',
        mappedConcept: 'firstName',
      };

      const resolvedName = adapter.resolveFieldValue(fnField, samplePayload);
      expect(resolvedName).toBe('Alex');

      const emailField = {
        id: 'email',
        name: 'email',
        label: 'Email',
        type: AtsFormFieldType.EMAIL,
        required: true,
        selector: '#email',
        mappedConcept: 'email',
      };
      expect(adapter.resolveFieldValue(emailField, samplePayload)).toBe('alex.morgan@example.com');

      const unknownField = {
        id: 'favorite_food',
        name: 'favorite_food',
        label: 'What is your favorite dish?',
        type: AtsFormFieldType.TEXT,
        required: true,
        selector: '#favorite_food',
      };
      expect(adapter.resolveFieldValue(unknownField, samplePayload)).toBeUndefined();
    });
  });

  describe('LeverAdapter', () => {
    it('matches Lever URLs correctly', () => {
      const adapter = new LeverAdapter();
      expect(adapter.matches('https://jobs.lever.co/acme/67890')).toBe(true);
      expect(adapter.matches('https://boards.greenhouse.io/acme')).toBe(false);
    });

    it('extracts structured form schema from Lever fixture', async () => {
      const page = await controller.newPage();
      await page.goto('https://jobs.lever.co/acme/67890');

      const adapter = new LeverAdapter();
      const schema = await adapter.extractForm(page);

      expect(schema.provider).toBe(AtsProviderType.LEVER);
      expect(schema.hasResumeUpload).toBe(true);
      expect(schema.hasCaptcha).toBe(false);

      const fieldNames = schema.fields.map((f) => f.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('phone');
      expect(fieldNames).toContain('resume');
      expect(fieldNames).toContain('urls[LinkedIn]');
      expect(fieldNames).toContain('cards[sponsorship][field0]');

      await page.close();
    });
  });

  describe('AshbyAdapter', () => {
    it('matches Ashby URLs correctly', () => {
      const adapter = new AshbyAdapter();
      expect(adapter.matches('https://jobs.ashbyhq.com/novatech/abcde')).toBe(true);
    });

    it('extracts structured form schema from Ashby fixture', async () => {
      const page = await controller.newPage();
      await page.goto('https://jobs.ashbyhq.com/novatech/abcde');

      const adapter = new AshbyAdapter();
      const schema = await adapter.extractForm(page);

      expect(schema.provider).toBe(AtsProviderType.ASHBY);
      expect(schema.hasResumeUpload).toBe(true);

      const fieldNames = schema.fields.map((f) => f.name);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('email');
      expect(fieldNames).toContain('phoneNumber');
      expect(fieldNames).toContain('resume');
      expect(fieldNames).toContain('workAuthorization');

      await page.close();
    });
  });

  describe('Bot Challenge / CAPTCHA Detection', () => {
    it('detects reCAPTCHA challenge and identifies selector', async () => {
      const page = await controller.newPage();
      await page.goto('https://example.com/captcha-test');

      const adapter = new GreenhouseAdapter();
      const challenge = await adapter.detectChallenge(page);

      expect(challenge.detected).toBe(true);
      expect(challenge.type).toBe('RECAPTCHA');

      await page.close();
    });
  });

  describe('AtsAdapterRegistry', () => {
    it('resolves correct adapter by URL', () => {
      expect(registry.resolveAdapter('https://boards.greenhouse.io/test').provider).toBe(
        AtsProviderType.GREENHOUSE,
      );
      expect(registry.resolveAdapter('https://jobs.lever.co/test').provider).toBe(
        AtsProviderType.LEVER,
      );
      expect(registry.resolveAdapter('https://jobs.ashbyhq.com/test').provider).toBe(
        AtsProviderType.ASHBY,
      );
      expect(registry.resolveAdapter('https://unknown-job-site.com').provider).toBe(
        AtsProviderType.OTHER,
      );
    });
  });
});
