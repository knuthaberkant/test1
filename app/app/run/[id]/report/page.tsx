import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { buildSnapshot, canAccessRun, formatDuration, getRun } from "@/lib/data";
import ReportReview from "./ReportReview";

export default async function ReportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const run = getRun(Number((await params).id));
  if (!run || !canAccessRun(user, run)) notFound();
  if (run.status === "in_progress") redirect(`/app/run/${run.id}`);
  if (run.status === "signed") redirect(`/reports/${run.id}`);
  const snapshot = buildSnapshot(run);
  return (
    <ReportReview
      runId={run.id}
      snapshot={snapshot}
      durationText={formatDuration(snapshot.durationMs)}
      signerName={user.name}
      canSign={run.user_id === user.id}
    />
  );
}
