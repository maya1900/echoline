import { relations, sql } from "drizzle-orm";
import { boolean, check, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, time, unique, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published", "archived"]);
export const learningModeEnum = pgEnum("learning_mode", ["rough", "intensive", "loop", "repeat", "call_response"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state")
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] })
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull()
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull()
  },
  (verificationToken) => ({
    pk: primaryKey({ columns: [verificationToken.identifier, verificationToken.token] })
  })
);

export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("user"),
  subtitleLanguage: text("subtitle_language").notNull().default("both"),
  defaultPlaybackRate: numeric("default_playback_rate", { precision: 3, scale: 2 }).notNull().default("1.00"),
  autoLoop: boolean("auto_loop").notNull().default(true),
  aiScoringEnabled: boolean("ai_scoring_enabled").notNull().default(true),
  asrProvider: text("asr_provider").notNull().default("openai"),
  asrModel: text("asr_model").notNull().default("gpt-4o-mini-transcribe"),
  asrApiKey: text("asr_api_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  description: text("description"),
  coverUrl: text("cover_url"),
  difficulty: text("difficulty").notNull().default("B1"),
  genre: text("genre"),
  status: contentStatusEnum("status").notNull().default("draft"),
  createdBy: text("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    seasonNumber: integer("season_number").notNull().default(1),
    episodeNumber: integer("episode_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    mediaUrl: text("media_url"),
    durationSeconds: integer("duration_seconds"),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (episode) => ({
    episodeNumberUnique: unique("episodes_series_season_episode_unique").on(episode.seriesId, episode.seasonNumber, episode.episodeNumber)
  })
);

export const subtitleLines = pgTable(
  "subtitle_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    lineIndex: integer("line_index").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    englishText: text("english_text").notNull(),
    chineseText: text("chinese_text"),
    difficulty: text("difficulty"),
    keywords: text("keywords").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (line) => ({
    lineIndexUnique: unique("subtitle_lines_episode_line_unique").on(line.episodeId, line.lineIndex),
    startNonNegative: check("subtitle_lines_start_non_negative", sql`${line.startMs} >= 0`),
    endAfterStart: check("subtitle_lines_end_after_start", sql`${line.endMs} > ${line.startMs}`)
  })
);

export const learningProgress = pgTable(
  "learning_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id").references(() => series.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    subtitleLineId: uuid("subtitle_line_id").references(() => subtitleLines.id, { onDelete: "cascade" }),
    mode: learningModeEnum("mode").notNull(),
    playbackPositionMs: integer("playback_position_ms").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    repeatCount: integer("repeat_count").notNull().default(0),
    bestScore: integer("best_score"),
    lastStudiedAt: timestamp("last_studied_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (progress) => ({
    progressUnique: unique("learning_progress_user_episode_line_mode_unique").on(progress.userId, progress.episodeId, progress.subtitleLineId, progress.mode)
  })
);

export const studyPlans = pgTable(
  "study_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    dailyMinutes: integer("daily_minutes").notNull().default(25),
    dailyLines: integer("daily_lines").notNull().default(18),
    dailyRepeats: integer("daily_repeats").notNull().default(8),
    reminderEnabled: boolean("reminder_enabled").notNull().default(false),
    reminderTime: time("reminder_time"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (plan) => ({
    userUnique: unique("study_plans_user_unique").on(plan.userId)
  })
);

export const repeatAttempts = pgTable("repeat_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  subtitleLineId: uuid("subtitle_line_id")
    .notNull()
    .references(() => subtitleLines.id, { onDelete: "cascade" }),
  mode: learningModeEnum("mode").notNull(),
  targetText: text("target_text").notNull(),
  transcript: text("transcript"),
  audioUrl: text("audio_url"),
  accuracy: integer("accuracy"),
  completeness: integer("completeness"),
  fluency: integer("fluency"),
  overall: integer("overall"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const dictionaryEntries = pgTable("dictionary_entries", {
  word: text("word").primaryKey(),
  phonetic: text("phonetic"),
  translation: text("translation"),
  definition: text("definition"),
  pos: text("pos"),
  exchange: text("exchange"),
  frq: integer("frq"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const vocabItems = pgTable(
  "vocab_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    word: text("word").notNull(),
    phonetic: text("phonetic"),
    contextSentence: text("context_sentence"),
    translation: text("translation"),
    note: text("note"),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "set null" }),
    subtitleLineId: uuid("subtitle_line_id").references(() => subtitleLines.id, { onDelete: "set null" }),
    status: text("status").notNull().default("new"),
    reviewCount: integer("review_count").notNull().default(0),
    ease: numeric("ease", { precision: 4, scale: 2 }).notNull().default("2.50"),
    intervalDays: integer("interval_days").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (item) => ({
    userWordUnique: unique("vocab_items_user_word_unique").on(item.userId, item.word)
  })
);

export const adminImportJobs = pgTable("admin_import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: text("admin_id").references(() => profiles.id),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
  sourceFilename: text("source_filename"),
  status: text("status").notNull().default("pending"),
  parsedLines: integer("parsed_lines").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedBy: text("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles),
  accounts: many(accounts),
  sessions: many(sessions)
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.id],
    references: [users.id]
  })
}));

export const seriesRelations = relations(series, ({ many }) => ({
  episodes: many(episodes)
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  series: one(series, {
    fields: [episodes.seriesId],
    references: [series.id]
  }),
  subtitleLines: many(subtitleLines)
}));

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type SeriesRow = typeof series.$inferSelect;
export type EpisodeRow = typeof episodes.$inferSelect;
export type SubtitleLineRow = typeof subtitleLines.$inferSelect;
export type VocabItemRow = typeof vocabItems.$inferSelect;
