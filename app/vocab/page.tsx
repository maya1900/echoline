import { AppShell, SectionHeader } from "@/components/app-shell";
import { VocabWorkbench } from "@/components/workbenches/vocab-workbench";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { listVocabItems } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function VocabPage() {
  await requireCurrentUser("/vocab");

  const vocabItems = await listVocabItems();

  return (
    <AppShell active="/vocab">
      <SectionHeader eyebrow="生词本" title="到期词和语境复习" />
      <VocabWorkbench items={vocabItems} />
    </AppShell>
  );
}
