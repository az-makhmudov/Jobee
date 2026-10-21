import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { users, type User } from './schema/users.js';
import { candidateProfiles } from './schema/candidate-profiles.js';

export const PRIMARY_USER_SYSTEM_KEY = 'default_primary_candidate';
export const PRIMARY_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Deterministically resolves or creates the primary local application user.
 * Avoids arbitrary queries like "pick first row in users table" while remaining
 * fully migration-friendly and ready for multi-user authentication later.
 */
export async function getOrCreatePrimaryUser(db: Database): Promise<User> {
  let user: User | undefined = await db.query.users.findFirst({
    where: eq(users.systemKey, PRIMARY_USER_SYSTEM_KEY),
  });

  if (!user) {
    const existingById = await db.query.users.findFirst({
      where: eq(users.id, PRIMARY_USER_ID),
    });

    if (existingById) {
      if (!existingById.systemKey) {
        const [updated] = await db
          .update(users)
          .set({ systemKey: PRIMARY_USER_SYSTEM_KEY })
          .where(eq(users.id, PRIMARY_USER_ID))
          .returning();
        user = updated;
      } else {
        user = existingById;
      }
    } else {
      const [created] = await db
        .insert(users)
        .values({
          id: PRIMARY_USER_ID,
          systemKey: PRIMARY_USER_SYSTEM_KEY,
          name: 'Local Candidate',
          email: 'candidate@example.test',
          emailVerified: true,
          role: 'admin',
        })
        .onConflictDoNothing()
        .returning();

      user =
        created ??
        (await db.query.users.findFirst({
          where: eq(users.systemKey, PRIMARY_USER_SYSTEM_KEY),
        }));
    }
  }

  // Ensure deterministic candidate profile exists for primary user
  const existingProfile = await db.query.candidateProfiles.findFirst({
    where: eq(candidateProfiles.userId, PRIMARY_USER_ID),
  });
  if (!existingProfile) {
    await db
      .insert(candidateProfiles)
      .values({
        userId: PRIMARY_USER_ID,
        fullName: 'Local Candidate',
        preferredName: 'Candidate',
        email: 'candidate@example.test',
        headline: null,
        summary: null,
        city: null,
        country: null,
        availability: null,
      })
      .onConflictDoNothing();
  }

  return user!;
}
