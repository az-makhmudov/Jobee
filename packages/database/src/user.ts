import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { users, type User } from './schema/users.js';

export const PRIMARY_USER_SYSTEM_KEY = 'default_primary_candidate';
export const PRIMARY_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Deterministically resolves or creates the primary local application user.
 * Avoids arbitrary queries like "pick first row in users table" while remaining
 * fully migration-friendly and ready for multi-user authentication later.
 */
export async function getOrCreatePrimaryUser(db: Database): Promise<User> {
  const existing = await db.query.users.findFirst({
    where: eq(users.systemKey, PRIMARY_USER_SYSTEM_KEY),
  });

  if (existing) {
    return existing;
  }

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
      return updated!;
    }
    return existingById;
  }

  const [created] = await db
    .insert(users)
    .values({
      id: PRIMARY_USER_ID,
      systemKey: PRIMARY_USER_SYSTEM_KEY,
      name: 'Asadbek Makhmudov',
      email: 'asadbek.mzw@gmail.com',
      emailVerified: true,
      role: 'admin',
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const fallback = await db.query.users.findFirst({
    where: eq(users.systemKey, PRIMARY_USER_SYSTEM_KEY),
  });
  return fallback!;
}
