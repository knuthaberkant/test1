import { apiUser, handle, HttpError } from "@/lib/auth";
import { summarizeRun, templateSummary, type SummaryInput } from "@/lib/ai";
import { buildSnapshot, canAccessRun, formatDuration, getRun } from "@/lib/data";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const run = getRun(Number((await ctx.params).id));
  if (!run || !canAccessRun(user, run)) throw new HttpError(404, "Durchlauf nicht gefunden");
  if (run.status !== "completed") throw new HttpError(409, "Die Checkliste muss zuerst abgeschlossen werden");
  const snap = buildSnapshot(run);
  const input: SummaryInput = {
    checklistName: snap.checklistName,
    userName: snap.userName,
    startedAt: snap.startedAt,
    completedAt: snap.completedAt,
    durationText: formatDuration(snap.durationMs),
    sections: snap.sections.map((s) => ({
      title: s.title,
      items: s.items.map((i) => ({ title: i.title, checked: i.checked, comment: i.comment })),
    })),
  };
  const ai = await summarizeRun(input);
  if (ai) return Response.json({ summary: ai, source: "ai" });
  return Response.json({ summary: templateSummary(input), source: "template" });
});
