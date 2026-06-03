import { AppShell, SectionHeader } from "@/components/app-shell";
import { SeriesBrowser } from "@/components/series-browser";
import { listSeries } from "@/lib/data";

export default async function SeriesPage() {
  const series = await listSeries();

  return (
    <AppShell active="/series">
      <SectionHeader eyebrow="内容浏览" title="剧集列表" />
      <SeriesBrowser items={series} />
    </AppShell>
  );
}
