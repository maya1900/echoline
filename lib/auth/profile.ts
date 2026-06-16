import { eq } from "drizzle-orm";
import { getSiteSettings } from "@/lib/admin-data";
import { getDb } from "@/lib/db/client";
import { profiles, studyPlans, users } from "@/lib/db/schema";

export type CurrentUser = {
  id: string;
  email: string | null;
  name?: string | null;
  image?: string | null;
};

function displayNameForUser(user: CurrentUser) {
  return user.name ?? user.email?.split("@")[0] ?? "Learner";
}

export async function bootstrapUserProfile(user: CurrentUser) {
  const db = getDb();

  if (!db) {
    return;
  }

  const siteSettings = await getSiteSettings();
  const now = new Date();

  await db
    .insert(users)
    .values({
      id: user.id,
      email: user.email,
      name: displayNameForUser(user),
      image: user.image ?? null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        name: displayNameForUser(user),
        image: user.image ?? null,
        updatedAt: now
      }
    });

  await db
    .insert(profiles)
    .values({
      id: user.id,
      email: user.email,
      displayName: displayNameForUser(user),
      avatarUrl: user.image ?? null,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: user.email,
        displayName: displayNameForUser(user),
        avatarUrl: user.image ?? null,
        updatedAt: now
      }
    });

  await db
    .insert(studyPlans)
    .values({
      userId: user.id,
      dailyMinutes: siteSettings.defaultDailyMinutes,
      dailyLines: siteSettings.defaultDailyLines,
      dailyRepeats: siteSettings.defaultDailyRepeats,
      active: true
    })
    .onConflictDoNothing({ target: studyPlans.userId });
}

export async function touchUserSignIn(userId: string) {
  const db = getDb();

  if (!db) {
    return;
  }

  const now = new Date();
  await db.update(users).set({ lastSignInAt: now, updatedAt: now }).where(eq(users.id, userId));
}
