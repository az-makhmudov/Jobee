import crypto from 'node:crypto';
import { betterAuth, APIError, type Auth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import type { Database } from '@job-agent/database';
import {
  users,
  sessions,
  accounts,
  verifications,
  candidateProfiles,
  candidateExperiences,
  candidateEducation,
  candidateProjects,
  candidateSkills,
  candidateLanguages,
  candidateCertifications,
  candidateLinks,
  candidateFacts,
  candidateDocuments,
  answerLibrary,
  jobPreferences,
  applicationPolicy,
  jobs,
  applications,
  systemNotifications,
  eq,
} from '@job-agent/database';
import type { AppConfig } from '@job-agent/config';
import { TransactionalEmailService } from '../services/email/transactional-email-service.js';
import { PilotInvitationService } from '../services/auth/pilot-invitation-service.js';
import { createLogger } from '@job-agent/shared';

const logger = createLogger({ service: 'api' });

export type BetterAuthInstance = Auth<any>;

export function createBetterAuthInstance(
  db: Database,
  config: AppConfig,
  emailService?: TransactionalEmailService,
  invitationService?: PilotInvitationService,
): BetterAuthInstance {
  const mailer = emailService ?? new TransactionalEmailService(config);
  const invites = invitationService ?? new PilotInvitationService(db);

  const trustedOrigins = config.BETTER_AUTH_TRUSTED_ORIGINS
    ? config.BETTER_AUTH_TRUSTED_ORIGINS.split(',').map((o) => o.trim())
    : [config.WEB_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'];

  if (!trustedOrigins.includes(config.WEB_ORIGIN)) {
    trustedOrigins.push(config.WEB_ORIGIN);
  }
  if (config.BETTER_AUTH_URL && !trustedOrigins.includes(config.BETTER_AUTH_URL)) {
    trustedOrigins.push(config.BETTER_AUTH_URL);
  }

  // Social providers configuration (Google)
  const socialProviders: Record<string, any> = {};
  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    user: {
      additionalFields: {
        invitationCode: {
          type: 'string',
          required: false,
          input: true,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async (data: { user: { email: string }; url: string }) => {
        try {
          await mailer.sendPasswordResetEmail(data.user.email, data.url);
        } catch (err) {
          logger.error('Failed to send password reset email via mailer', {
            error: err,
            email: data.user.email,
          });
        }
      },
    },
    emailVerification: {
      sendVerificationEmail: async (data: { user: { email: string }; url: string }) => {
        try {
          await mailer.sendVerificationEmail(data.user.email, data.url);
        } catch (err) {
          logger.error('Failed to send verification email via mailer', {
            error: err,
            email: data.user.email,
          });
        }
      },
    },
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },
    plugins: [admin()],
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    databaseHooks: {
      verification: {
        create: {
          before: async (verification: any) => {
            return {
              data: {
                ...verification,
                id: verification.id || crypto.randomUUID(),
              },
            };
          },
        },
      },
      user: {
        create: {
          before: async (user: any) => {
            // Check Private Pilot invitation requirement
            const ownerEmail = (config.OWNER_EMAIL || 'owner@example.test').trim().toLowerCase();
            const userEmail = (user.email || '').trim().toLowerCase();
            const isOwnerEmail = Boolean(userEmail && userEmail === ownerEmail);

            if (config.INVITE_ONLY_REGISTRATION && !isOwnerEmail) {
              let code = user.invitationCode;
              if (!code && user.email) {
                // Check if user.email was explicitly invited in pilot_invitations (e.g. Google Sign-In onboarding)
                const matchedInvite = await invites.findValidInvitationByEmail(user.email);
                if (matchedInvite) {
                  code = matchedInvite.code;
                  user.invitationCode = matchedInvite.code;
                }
              }

              if (!code) {
                throw new APIError('FORBIDDEN', {
                  message:
                    'Jobee private pilot registration is by invitation only. Please provide a valid invitation code or request an invite for your email address.',
                });
              }

              try {
                await invites.verifyInvitation(code, user.email);
              } catch (err: any) {
                throw new APIError('FORBIDDEN', {
                  message: err.message || 'Invalid or expired invitation code',
                });
              }
            }

            // Assign initial role
            if (isOwnerEmail) {
              user.role = 'admin';
            }
          },
          after: async (user: any) => {
            try {
              const ownerEmail = (config.OWNER_EMAIL || 'owner@example.test').trim().toLowerCase();
              const userEmail = (user.email || '').trim().toLowerCase();
              const isOwnerEmail = Boolean(userEmail && userEmail === ownerEmail);

              // 1. Redeem invitation code if provided
              const code = (user as any).invitationCode;
              if (code) {
                await invites.redeemInvitation(code, user.id);
              }

              // 2. Initialize or re-link candidate workspace for the new user
              let existingProfile = await db.query.candidateProfiles.findFirst({
                where: (cp, { eq }) => eq(cp.userId, user.id),
              });

              if (!existingProfile && user.email) {
                // Check if a pre-existing profile was migrated for this email address
                const profileByEmail = await db.query.candidateProfiles.findFirst({
                  where: (cp, { eq }) => eq(cp.email, userEmail),
                });

                if (profileByEmail && profileByEmail.userId !== user.id) {
                  const oldUserId = profileByEmail.userId;
                  const isSeedUser = oldUserId === '00000000-0000-0000-0000-000000000001';

                  // Security guard: Only allow re-linking if it is the verified owner or the unauthenticated seed user
                  if (isOwnerEmail || isSeedUser) {
                    logger.info(
                      `Re-linking pre-existing candidate data (${profileByEmail.id}) from ${oldUserId} to authenticated user ${user.id}`,
                    );

                    // Re-link all tables with userId
                    const tablesToRelink = [
                      candidateProfiles,
                      candidateExperiences,
                      candidateEducation,
                      candidateProjects,
                      candidateSkills,
                      candidateLanguages,
                      candidateCertifications,
                      candidateLinks,
                      candidateFacts,
                      candidateDocuments,
                      answerLibrary,
                      jobPreferences,
                      applicationPolicy,
                      jobs,
                      applications,
                      systemNotifications,
                    ];

                    for (const table of tablesToRelink) {
                      try {
                        await db
                          .update(table)
                          .set({ userId: user.id })
                          .where(eq(table.userId, oldUserId));
                      } catch (relinkErr: any) {
                        logger.warn(
                          `Could not re-link table for user ${user.id}: ${relinkErr.message}`,
                        );
                      }
                    }

                    existingProfile = { ...profileByEmail, userId: user.id };
                  } else {
                    logger.warn(
                      `Security: Refused to re-link candidate profile for email ${user.email} from non-seed user ${oldUserId} to ${user.id}`,
                    );
                  }
                }
              }

              if (!existingProfile) {
                await db.insert(candidateProfiles).values({
                  userId: user.id,
                  fullName: user.name || (isOwnerEmail ? 'Asadbek Makhmudov' : 'Candidate'),
                  email: user.email,
                  preferredName: user.name
                    ? user.name.split(' ')[0]
                    : isOwnerEmail
                      ? 'Asadbek'
                      : 'Candidate',
                });
              }

              const existingPrefs = await db.query.jobPreferences.findFirst({
                where: (jp, { eq }) => eq(jp.userId, user.id),
              });

              if (!existingPrefs) {
                await db.insert(jobPreferences).values({
                  userId: user.id,
                  targetTitles: [],
                  excludedCompanies: [],
                  excludedKeywords: [],
                });
              }

              const existingPolicy = await db.query.applicationPolicy.findFirst({
                where: (ap, { eq }) => eq(ap.userId, user.id),
              });

              if (!existingPolicy) {
                await db.insert(applicationPolicy).values({
                  userId: user.id,
                  autoApplyEnabled: false,
                  maxApplicationsPerDay: 5,
                });
              }
            } catch (err) {
              logger.error('Failed to initialize candidate workspace in user post-create hook', {
                userId: user.id,
                error: err,
              });
            }
          },
        },
      },
    },
  });
}
