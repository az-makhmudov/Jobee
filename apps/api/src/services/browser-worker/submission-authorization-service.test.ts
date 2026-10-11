import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  SubmissionAuthorizationService,
  type SubmissionTokenPayload,
} from './submission-authorization-service.js';

describe('SubmissionAuthorizationService & Submission Binding Invariants', () => {
  const dummyAnswers = [
    { questionId: 'q-1', finalAnswer: 'Yes' },
    { questionId: 'q-2', finalAnswer: 'No' },
  ];

  it('computes deterministic manifest checksums and detects changes in artifacts or answers', () => {
    const baseChecksum = SubmissionAuthorizationService.computeManifestChecksum({
      packageVersionId: 'ver-100',
      cvChecksum: 'sha256-cv-aaa',
      coverLetterChecksum: 'sha256-cl-bbb',
      answers: dummyAnswers,
    });

    // 1. Identical inputs produce identical checksum
    const sameChecksum = SubmissionAuthorizationService.computeManifestChecksum({
      packageVersionId: 'ver-100',
      cvChecksum: 'sha256-cv-aaa',
      coverLetterChecksum: 'sha256-cl-bbb',
      answers: [
        { questionId: 'q-2', finalAnswer: 'No' },
        { questionId: 'q-1', finalAnswer: 'Yes' },
      ], // order swapped
    });
    expect(sameChecksum).toBe(baseChecksum);

    // 2. Modifying CV checksum alters manifest
    const alteredCv = SubmissionAuthorizationService.computeManifestChecksum({
      packageVersionId: 'ver-100',
      cvChecksum: 'sha256-cv-MODIFIED',
      coverLetterChecksum: 'sha256-cl-bbb',
      answers: dummyAnswers,
    });
    expect(alteredCv).not.toBe(baseChecksum);

    // 3. Modifying an answer alters manifest
    const alteredAnswer = SubmissionAuthorizationService.computeManifestChecksum({
      packageVersionId: 'ver-100',
      cvChecksum: 'sha256-cv-aaa',
      coverLetterChecksum: 'sha256-cl-bbb',
      answers: [
        { questionId: 'q-1', finalAnswer: 'Yes' },
        { questionId: 'q-2', finalAnswer: 'Maybe' }, // changed
      ],
    });
    expect(alteredAnswer).not.toBe(baseChecksum);
  });

  it('rejects malformed, tampered, or expired submission authorization tokens', async () => {
    const userId = 'user-001';
    const appId = 'app-001';

    // Malformed token
    await expect(
      SubmissionAuthorizationService.verifySubmissionAuthorization(userId, appId, 'invalid-token'),
    ).rejects.toThrow(/Invalid submission authorization token format/);

    // Tampered signature
    const validPayload: SubmissionTokenPayload = {
      v: 1,
      sub: userId,
      appId,
      pkgVerId: 'ver-1',
      mHash: 'somehash',
      iat: Date.now(),
      exp: Date.now() + 60000,
    };
    const payloadStr = Buffer.from(JSON.stringify(validPayload)).toString('base64url');
    const forgedToken = `${payloadStr}.invalidSignature1234567890abcdef`;

    await expect(
      SubmissionAuthorizationService.verifySubmissionAuthorization(userId, appId, forgedToken),
    ).rejects.toThrow(/Security violation: Tampering detected/);

    // Expired token (simulate expired payload with correct HMAC)
    const secret =
      process.env.SUBMISSION_SIGNING_SECRET ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const key = crypto.createHash('sha256').update(secret, 'utf8').digest();

    const expiredPayload: SubmissionTokenPayload = {
      v: 1,
      sub: userId,
      appId,
      pkgVerId: 'ver-1',
      mHash: 'somehash',
      iat: Date.now() - 3600000,
      exp: Date.now() - 1800000, // expired 30 mins ago
    };
    const expiredPayloadStr = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const expiredSig = crypto
      .createHmac('sha256', key)
      .update(expiredPayloadStr)
      .digest('base64url');
    const expiredToken = `${expiredPayloadStr}.${expiredSig}`;

    await expect(
      SubmissionAuthorizationService.verifySubmissionAuthorization(userId, appId, expiredToken),
    ).rejects.toThrow(/expired/);
  });

  it('rejects token issued for a different candidate identity', async () => {
    const secret =
      process.env.SUBMISSION_SIGNING_SECRET ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const key = crypto.createHash('sha256').update(secret, 'utf8').digest();

    const payload: SubmissionTokenPayload = {
      v: 1,
      sub: 'attacker-user-id',
      appId: 'app-001',
      pkgVerId: 'ver-1',
      mHash: 'somehash',
      iat: Date.now(),
      exp: Date.now() + 60000,
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', key).update(payloadStr).digest('base64url');
    const token = `${payloadStr}.${sig}`;

    await expect(
      SubmissionAuthorizationService.verifySubmissionAuthorization(
        'victim-user-id',
        'app-001',
        token,
      ),
    ).rejects.toThrow(/different candidate identity/);
  });
});
