import crypto from 'node:crypto';
import { eq, and, asc } from 'drizzle-orm';
import {
  getDb,
  applications,
  jobs,
  applicationPackages,
  applicationPackageVersions,
  applicationArtifacts,
  applicationQuestions,
  approvalRequests,
  type Database,
} from '@job-agent/database';
import { AppError, type SubmissionAuthorizationTicketDto } from '@job-agent/shared';
import { getConfig } from '@job-agent/config';

export interface SubmissionManifest {
  applicationId: string;
  packageId: string;
  packageVersionId: string;
  jobId: string;
  userId: string;
  artifacts: {
    cvArtifactId?: string;
    cvChecksum?: string;
    coverLetterArtifactId?: string;
    coverLetterChecksum?: string;
  };
  answers: Array<{
    questionId: string;
    questionText: string;
    finalAnswer: string | null;
  }>;
  manifestChecksum: string;
}

export interface SubmissionTokenPayload {
  v: 1;
  sub: string;
  appId: string;
  pkgVerId: string;
  mHash: string;
  iat: number;
  exp: number;
}

export class SubmissionAuthorizationService {
  private static getSigningKey(): Buffer {
    const config = getConfig();
    const secret =
      process.env.SUBMISSION_SIGNING_SECRET ||
      config.EMAIL_TOKEN_ENCRYPTION_KEY ||
      'jobee-secure-submission-manifest-secret-key-32chars';
    return crypto.createHash('sha256').update(secret, 'utf8').digest();
  }

  /**
   * Deterministically calculates SHA-256 manifest checksum over package version, artifacts, and approved answers.
   */
  public static computeManifestChecksum(data: {
    packageVersionId: string;
    cvChecksum?: string;
    coverLetterChecksum?: string;
    answers: Array<{ questionId: string; finalAnswer: string | null }>;
  }): string {
    const normalized = {
      packageVersionId: data.packageVersionId,
      cvChecksum: data.cvChecksum ?? 'none',
      coverLetterChecksum: data.coverLetterChecksum ?? 'none',
      answers: data.answers
        .slice()
        .sort((a, b) => a.questionId.localeCompare(b.questionId))
        .map((a) => ({
          id: a.questionId,
          ans: a.finalAnswer ?? '',
        })),
    };
    return crypto.createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
  }

  /**
   * Constructs the current live submission manifest from verified database entities.
   */
  public static async buildManifest(
    userId: string,
    applicationId: string,
    dbInstance?: Database,
  ): Promise<{ manifest: SubmissionManifest; pkg: any; version: any; appRecord: any }> {
    const db = dbInstance || getDb();

    // 1. Verify Application exists and belongs to candidate
    const [appRecord] = await db
      .select({
        application: applications,
        job: jobs,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1);

    if (!appRecord) {
      throw AppError.notFound(`Application ${applicationId} not found`);
    }

    // 2. Verify linked Application Package
    const packageId = appRecord.application.currentPackageId;
    if (!packageId) {
      throw AppError.badRequest(
        'Cannot generate submission authorization: Application has no associated application package.',
      );
    }

    const [pkg] = await db
      .select()
      .from(applicationPackages)
      .where(and(eq(applicationPackages.id, packageId), eq(applicationPackages.userId, userId)))
      .limit(1);

    if (!pkg || pkg.status !== 'READY') {
      throw AppError.badRequest(
        `Cannot generate submission authorization: Application package is not in READY status (current status: ${pkg?.status ?? 'MISSING'}). Human preparation and review required.`,
      );
    }

    if (pkg.hasPolicyBlocker && !pkg.blockerOverridden) {
      throw AppError.badRequest(
        'Cannot generate submission authorization: Matching has active hard policy blocker not overridden by candidate.',
      );
    }

    // 3. Verify all package approvals are explicitly resolved by the human candidate
    const pkgApprovals = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.packageId, pkg.id));

    const unverifiedApprovals = pkgApprovals.filter(
      (a) =>
        a.status === 'PENDING' ||
        a.status === 'NEEDS_USER_RECONFIRMATION' ||
        ((a.status === 'APPROVED' || a.status === 'RESOLVED') && a.resolvedBy !== 'USER'),
    );

    if (unverifiedApprovals.length > 0) {
      throw AppError.badRequest(
        `Cannot generate submission authorization: ${unverifiedApprovals.length} approval request(s) require human authorization or reconfirmation.`,
      );
    }

    // 4. Retrieve active Package Version
    const [version] = await db
      .select()
      .from(applicationPackageVersions)
      .where(
        and(
          eq(applicationPackageVersions.packageId, pkg.id),
          eq(applicationPackageVersions.versionNumber, pkg.currentVersionNumber),
        ),
      )
      .limit(1);

    if (!version) {
      throw AppError.notFound(
        `Active version (${pkg.currentVersionNumber}) for application package ${pkg.id} not found`,
      );
    }

    // 5. Retrieve tailored artifacts and checksums
    const artifacts = await db
      .select()
      .from(applicationArtifacts)
      .where(eq(applicationArtifacts.versionId, version.id));

    const cvArtifact = artifacts.find((a) => a.artifactType === 'TAILORED_CV');
    const clArtifact = artifacts.find((a) => a.artifactType === 'COVER_LETTER');

    // 6. Retrieve all approved questions and answers
    const questions = await db
      .select()
      .from(applicationQuestions)
      .where(eq(applicationQuestions.versionId, version.id))
      .orderBy(asc(applicationQuestions.id));

    const answers = questions.map((q) => ({
      questionId: q.id,
      questionText: q.questionText,
      finalAnswer: q.finalAnswer ?? q.humanEditedAnswer ?? q.proposedAnswer ?? null,
    }));

    // 7. Calculate cryptographic manifest checksum
    const manifestChecksum = this.computeManifestChecksum({
      packageVersionId: version.id,
      cvChecksum: cvArtifact?.sha256Checksum,
      coverLetterChecksum: version.coverLetterEnabled ? clArtifact?.sha256Checksum : undefined,
      answers,
    });

    const manifest: SubmissionManifest = {
      applicationId,
      packageId: pkg.id,
      packageVersionId: version.id,
      jobId: appRecord.job.id,
      userId,
      artifacts: {
        cvArtifactId: cvArtifact?.id,
        cvChecksum: cvArtifact?.sha256Checksum,
        coverLetterArtifactId: clArtifact?.id,
        coverLetterChecksum: clArtifact?.sha256Checksum,
      },
      answers,
      manifestChecksum,
    };

    return { manifest, pkg, version, appRecord };
  }

  /**
   * Generates a tamper-proof cryptographic submission authorization ticket for the candidate.
   * Valid for 15 minutes and bound strictly to the current package version and artifact checksums.
   */
  public static async createSubmissionAuthorizationTicket(
    userId: string,
    applicationId: string,
    dbInstance?: Database,
  ): Promise<SubmissionAuthorizationTicketDto> {
    const { manifest, version, appRecord } = await this.buildManifest(
      userId,
      applicationId,
      dbInstance,
    );

    const iat = Date.now();
    const exp = iat + 15 * 60 * 1000; // 15 minutes TTL

    const payload: SubmissionTokenPayload = {
      v: 1,
      sub: userId,
      appId: applicationId,
      pkgVerId: version.id,
      mHash: manifest.manifestChecksum,
      iat,
      exp,
    };

    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const key = this.getSigningKey();
    const signature = crypto.createHmac('sha256', key).update(payloadStr).digest('base64url');
    const submissionToken = `${payloadStr}.${signature}`;

    return {
      submissionToken,
      manifestChecksum: manifest.manifestChecksum,
      packageVersionId: version.id,
      expiresAt: new Date(exp).toISOString(),
      applicationId,
      jobTitle: appRecord.job.title,
      company: appRecord.job.company,
      artifacts: manifest.artifacts,
      answersCount: manifest.answers.length,
    };
  }

  /**
   * Verifies the authenticity and validity of a candidate submission authorization token.
   * Ensures the token was signed by the server, has not expired, matches the authenticated candidate,
   * and that package artifacts and answers have not been altered since authorization.
   */
  public static async verifySubmissionAuthorization(
    userId: string,
    applicationId: string,
    token: string,
    dbInstance?: Database,
  ): Promise<SubmissionManifest> {
    if (!token || typeof token !== 'string') {
      throw AppError.forbidden('Submission authorization token is missing or invalid');
    }

    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw AppError.forbidden(
        'Invalid submission authorization token format. Security boundary violated.',
      );
    }

    const payloadStr = parts[0];
    const signature = parts[1];
    const key = this.getSigningKey();
    const expectedSig = crypto.createHmac('sha256', key).update(payloadStr).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw AppError.forbidden(
        'Invalid submission authorization signature. Security violation: Tampering detected.',
      );
    }

    let payload: SubmissionTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    } catch {
      throw AppError.forbidden('Corrupted submission authorization payload');
    }

    if (Date.now() > payload.exp) {
      throw AppError.forbidden(
        'Submission authorization ticket has expired. Please reconfirm and authorize submission again.',
      );
    }

    if (payload.sub !== userId) {
      throw AppError.forbidden('Submission token was issued for a different candidate identity.');
    }

    if (payload.appId !== applicationId) {
      throw AppError.forbidden('Submission token was issued for a different application.');
    }

    // Rebuild and verify live manifest checksum
    const { manifest } = await this.buildManifest(userId, applicationId, dbInstance);

    if (manifest.packageVersionId !== payload.pkgVerId) {
      throw AppError.forbidden(
        'Submission authorization version mismatch. The application package version has been regenerated since authorization.',
      );
    }

    if (manifest.manifestChecksum !== payload.mHash) {
      throw AppError.forbidden(
        'Submission authorization manifest mismatch. Application package materials, answers, or documents were modified after authorization was granted. Reauthorization is required.',
      );
    }

    return manifest;
  }
}
