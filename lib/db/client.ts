import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

function createDb() {
  cachedSql = postgres(process.env.DATABASE_URL!, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    prepare: false
  });

  return drizzle(cachedSql, { schema });
}

type Database = ReturnType<typeof createDb>;

let cachedDb: Database | null | undefined;
let cachedSql: postgres.Sql | null | undefined;

export function hasDatabaseEnv() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDb() {
  if (!hasDatabaseEnv()) {
    return null;
  }

  if (cachedDb !== undefined) {
    return cachedDb;
  }

  cachedDb = createDb();

  return cachedDb;
}

export async function closeDb() {
  await cachedSql?.end();
  cachedSql = undefined;
  cachedDb = undefined;
}

export type AppDb = NonNullable<ReturnType<typeof getDb>>;
