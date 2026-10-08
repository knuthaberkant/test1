import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canAccessRun, getChecklist, getRun, getRunItems } from "@/lib/data";
import RunView from "./RunView";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const run = getRun(Number((await params).id));
  if (!run || !canAccessRun(user, run)) notFound();
  if (run.status === "completed") redirect(`/app/run/${run.id}/report`);
  if (run.status === "signed") redirect(`/reports/${run.id}`);
  const checklist = getChecklist(run.checklist_id);
  if (!checklist) notFound();
  return (
    <RunView
      runId={run.id}
      checklistName={checklist.name}
      sections={checklist.sections}
      initialState={getRunItems(run.id)}
      startedAt={run.started_at}
    />
  );
}
