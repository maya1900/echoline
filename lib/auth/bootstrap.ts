import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { cache } from "react";
import { authOptions, getProfileRole } from "@/lib/auth/config";
import { bootstrapUserProfile, type CurrentUser } from "@/lib/auth/profile";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";

export { bootstrapUserProfile };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;

  if (!sessionUser?.id) {
    return null;
  }

  const user = {
    id: sessionUser.id,
    email: sessionUser.email ?? null,
    name: sessionUser.name,
    image: sessionUser.image
  };

  const db = getDb();

  if (db) {
    const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, user.id)).limit(1);

    if (!profile) {
      await bootstrapUserProfile(user);
    }
  }

  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  const db = getDb();

  if (!user || !db) {
    return null;
  }

  const [profile] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      display_name: profiles.displayName,
      role: profiles.role
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return profile ?? null;
});

export const isCurrentUserAdmin = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  return (await getProfileRole(user.id)) === "admin";
});
