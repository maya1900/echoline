import { notFound } from "next/navigation";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { LearningStudio } from "@/components/learning-studio";
import { getEpisode, getSeriesForEpisode, getSubtitlesForEpisode } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default function LearningStudioSmokePage() {
  const episode = getEpisode("campus-beyond-s1e1-00");
  const parentSeries = getSeriesForEpisode("campus-beyond-s1e1-00");
  const lines = getSubtitlesForEpisode("campus-beyond-s1e1-00");

  if (!episode || !parentSeries || lines.length === 0) {
    notFound();
  }

  return (
    <AppShell active="/series">
      <SectionHeader eyebrow="Smoke" title={`${parentSeries.title} · ${episode.title}`} />
      <LearningStudio episode={episode} parentSeries={parentSeries} lines={lines} initialLineId={lines[0]?.id} />
    </AppShell>
  );
}
