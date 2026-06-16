import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { scanLocalImportDirectory, AutoImportError, type AutoImportDraft, type AutoImportSeriesDraft } from "@/lib/admin-import/auto";
import { requireAdminRequest } from "@/lib/auth/api";
import type { AppDb } from "@/lib/db/client";
import { adminImportJobs, episodes, series as seriesTable, subtitleLines } from "@/lib/db/schema";
import { resolveLocalMediaPath } from "@/lib/media/local";
import { parseSubtitleText } from "@/lib/subtitles/parser";
import type { AdminImportJob, Episode } from "@/lib/types";

export const runtime = "nodejs";

type ImportBatchInput = {
  action?: "scan" | "import";
  directory?: string;
  series?: Partial<AutoImportSeriesDraft>;
};

type TransactionDb = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const input = (await request.json().catch(() => ({}))) as ImportBatchInput;

  if (!input.directory) {
    return NextResponse.json({ error: "Missing directory" }, { status: 400 });
  }

  try {
    const scannedDraft = await scanLocalImportDirectory(input.directory);
    const draft = input.action === "import" ? applySeriesOverrides(scannedDraft, input.series) : scannedDraft;

    if (input.action !== "import") {
      return NextResponse.json({ data: draft });
    }

    if (draft.episodes.length === 0) {
      return NextResponse.json({ error: "No episodes to import" }, { status: 400 });
    }

    const imported = await admin.db.transaction(async (tx) => {
      // 智能合并：检查 series 是否已存在
      const [existingSeries] = await tx
        .select()
        .from(seriesTable)
        .where(eq(seriesTable.title, draft.series.title))
        .limit(1);

      let targetSeries;

      if (existingSeries) {
        // 使用已存在的 series，更新其元信息
        const [updatedSeries] = await tx
          .update(seriesTable)
          .set({
            originalTitle: draft.series.originalTitle,
            description: draft.series.description,
            coverUrl: draft.series.coverUrl,
            difficulty: draft.series.difficulty,
            genre: draft.series.genre,
            status: draft.series.status,
            updatedAt: new Date()
          })
          .where(eq(seriesTable.id, existingSeries.id))
          .returning();

        targetSeries = updatedSeries;
      } else {
        // 创建新 series
        const [createdSeries] = await tx
          .insert(seriesTable)
          .values({
            title: draft.series.title,
            originalTitle: draft.series.originalTitle,
            description: draft.series.description,
            coverUrl: draft.series.coverUrl,
            difficulty: draft.series.difficulty,
            genre: draft.series.genre,
            status: draft.series.status,
            createdBy: admin.user.id
          })
          .returning();

        targetSeries = createdSeries;
      }

      if (!targetSeries) {
        throw new Error("Failed to create or update series");
      }

      const importedEpisodes: Episode[] = [];
      const importedJobs: AdminImportJob[] = [];

      for (const episodeDraft of draft.episodes) {
        // 智能合并：检查 episode 是否已存在
        const [existingEpisode] = await tx
          .select()
          .from(episodes)
          .where(
            sql`${episodes.seriesId} = ${targetSeries.id} AND ${episodes.seasonNumber} = ${episodeDraft.seasonNumber} AND ${episodes.episodeNumber} = ${episodeDraft.episodeNumber}`
          )
          .limit(1);

        let targetEpisode;

        if (existingEpisode) {
          // 更新已存在的 episode
          const [updatedEpisode] = await tx
            .update(episodes)
            .set({
              title: episodeDraft.title,
              description: episodeDraft.description,
              mediaUrl: episodeDraft.mediaUrl,
              durationSeconds: episodeDraft.durationSeconds,
              status: draft.series.status,
              updatedAt: new Date()
            })
            .where(eq(episodes.id, existingEpisode.id))
            .returning();

          targetEpisode = updatedEpisode;
        } else {
          // 创建新 episode
          const [createdEpisode] = await tx
            .insert(episodes)
            .values({
              seriesId: targetSeries.id,
              seasonNumber: episodeDraft.seasonNumber,
              episodeNumber: episodeDraft.episodeNumber,
              title: episodeDraft.title,
              description: episodeDraft.description,
              mediaUrl: episodeDraft.mediaUrl,
              durationSeconds: episodeDraft.durationSeconds,
              status: draft.series.status
            })
            .returning();

          targetEpisode = createdEpisode;
        }

        if (!targetEpisode) {
          throw new Error(`Failed to create or update episode ${episodeDraft.title}`);
        }

        importedEpisodes.push({
          id: targetEpisode.id,
          seriesId: targetEpisode.seriesId,
          seasonNumber: targetEpisode.seasonNumber,
          episodeNumber: targetEpisode.episodeNumber,
          title: targetEpisode.title,
          description: targetEpisode.description ?? "",
          durationSeconds: targetEpisode.durationSeconds ?? episodeDraft.durationSeconds,
          mediaUrl: targetEpisode.mediaUrl ?? episodeDraft.mediaUrl,
          progress: 0
        });

        if (!episodeDraft.subtitlePath || !episodeDraft.subtitleFilename) {
          continue;
        }

        const job = await importEpisodeSubtitles({
          tx,
          adminId: admin.user.id,
          episodeId: targetEpisode.id,
          sourceFilename: episodeDraft.subtitleFilename,
          subtitlePath: episodeDraft.subtitlePath
        });

        importedJobs.push(job);
      }

      return {
        series: {
          id: targetSeries.id,
          title: targetSeries.title,
          originalTitle: targetSeries.originalTitle ?? "",
          description: targetSeries.description ?? "",
          coverUrl: targetSeries.coverUrl ?? "",
          difficulty: targetSeries.difficulty,
          genre: targetSeries.genre ?? "",
          progress: 0,
          episodes: importedEpisodes
        },
        jobs: importedJobs
      };
    });

    return NextResponse.json({ data: imported }, { status: 201 });
  } catch (error) {
    if (error instanceof AutoImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Batch import failed" }, { status: 500 });
  }
}

function applySeriesOverrides(draft: AutoImportDraft, overrides?: Partial<AutoImportSeriesDraft>): AutoImportDraft {
  if (!overrides || typeof overrides !== "object") {
    return draft;
  }

  return {
    ...draft,
    series: {
      ...draft.series,
      title: readOverrideString(overrides.title, draft.series.title, 120),
      originalTitle: readOverrideString(overrides.originalTitle, draft.series.originalTitle, 160),
      description: readOverrideString(overrides.description, draft.series.description, 2000),
      coverUrl: readOverrideString(overrides.coverUrl, draft.series.coverUrl, 1000),
      difficulty: readOverrideString(overrides.difficulty, draft.series.difficulty, 20),
      genre: readOverrideString(overrides.genre, draft.series.genre, 60),
      status: overrides.status === "draft" || overrides.status === "published" ? overrides.status : draft.series.status
    }
  };
}

function readOverrideString(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

async function importEpisodeSubtitles({
  tx,
  adminId,
  episodeId,
  sourceFilename,
  subtitlePath
}: {
  tx: TransactionDb;
  adminId: string;
  episodeId: string;
  sourceFilename: string;
  subtitlePath: string;
}) {
  const resolved = resolveLocalMediaPath(subtitlePath.split("/"));

  if (!resolved) {
    throw new Error("Invalid subtitle path");
  }

  const subtitleText = await readFile(/*turbopackIgnore: true*/ resolved.filePath, "utf8");
  const parsedLines = parseSubtitleText(subtitleText);
  const [job] = await tx
    .insert(adminImportJobs)
    .values({
      adminId,
      episodeId,
      sourceFilename,
      status: "processing",
      parsedLines: 0
    })
    .returning({ id: adminImportJobs.id });

  if (!job) {
    throw new Error("Failed to create import job");
  }

  let lineError: Error | null = null;

  if (parsedLines.length === 0) {
    lineError = new Error("No subtitle cues parsed");
  } else {
    try {
      await tx
        .insert(subtitleLines)
        .values(
          parsedLines.map((line) => ({
            episodeId,
            lineIndex: line.lineIndex,
            startMs: line.startMs,
            endMs: line.endMs,
            englishText: line.englishText,
            chineseText: line.chineseText,
            keywords: line.keywords
          }))
        )
        .onConflictDoUpdate({
          target: [subtitleLines.episodeId, subtitleLines.lineIndex],
          set: {
            startMs: sqlExcluded("start_ms"),
            endMs: sqlExcluded("end_ms"),
            englishText: sqlExcluded("english_text"),
            chineseText: sqlExcluded("chinese_text"),
            keywords: sqlExcluded("keywords"),
            updatedAt: new Date()
          }
        });
    } catch (error) {
      lineError = error instanceof Error ? error : new Error("Failed to import subtitle lines");
    }
  }

  const [updatedJob] = await tx
    .update(adminImportJobs)
    .set({
      status: lineError ? "failed" : "completed",
      parsedLines: lineError ? 0 : parsedLines.length,
      errorMessage: lineError?.message,
      updatedAt: new Date()
    })
    .where(eq(adminImportJobs.id, job.id))
    .returning({
      id: adminImportJobs.id,
      sourceFilename: adminImportJobs.sourceFilename,
      status: adminImportJobs.status,
      parsedLines: adminImportJobs.parsedLines,
      errorMessage: adminImportJobs.errorMessage,
      createdAt: adminImportJobs.createdAt
    });

  if (!updatedJob) {
    throw new Error("Failed to update import job");
  }

  return {
    id: updatedJob.id,
    title: updatedJob.sourceFilename ?? sourceFilename,
    status: updatedJob.status === "pending" ? "queued" : (updatedJob.status as "queued" | "processing" | "completed" | "failed"),
    result: updatedJob.errorMessage ?? `解析 ${updatedJob.parsedLines} 行字幕`,
    createdAt: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(updatedJob.createdAt)
  };
}
