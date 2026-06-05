import { notFound } from "next/navigation";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { LearningStudio } from "@/components/learning-studio";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { getEpisode, getResumeSubtitleLineId, getSeriesForEpisode, getSubtitlesForEpisode } from "@/lib/data";

export default async function LearnPage({
  params
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  await requireCurrentUser(`/learn/${episodeId}`);

  const episode = await getEpisode(episodeId);
  const parentSeries = await getSeriesForEpisode(episodeId);
  const lines = await getSubtitlesForEpisode(episodeId);

  if (!episode || !parentSeries || lines.length === 0) {
    notFound();
  }

  const resumeLineId = await getResumeSubtitleLineId(episodeId, lines);

  return (
    <AppShell active="/series">
      <SectionHeader eyebrow="学习页" title={`${parentSeries.title} · ${episode.title}`} />
      <LearningStudio episode={episode} parentSeries={parentSeries} lines={lines} initialLineId={resumeLineId} />
    </AppShell>
  );
}
