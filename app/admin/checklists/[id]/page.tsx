import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { getChecklist } from "@/lib/data";
import ChecklistEditor from "./ChecklistEditor";

export default async function EditChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const checklist = getChecklist(Number((await params).id));
  if (!checklist) notFound();
  return <ChecklistEditor initial={checklist} aiEnabled={aiEnabled()} />;
}
