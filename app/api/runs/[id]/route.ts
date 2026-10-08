import { apiUser, handle, HttpError } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { canAccessRun, getRun } from "@/lib/data";

/** { action: "complete" } ends the filling phase; { action: "reopen" } goes back to editing. */
export const POST = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const run = getRun(Number((await ctx.params).id));
  if (!run || !canAccessRun(user, run)) throw new HttpError(404, "Durchlauf nicht gefunden");
  if (run.status === "signed") throw new HttpError(409, "Der Report ist bereits unterschrieben");
  const { action } = (await request.json()) as { action?: string };
  const db = getDb();
  const now = nowIso();
  if (action === "complete") {
    db.prepare("UPDATE runs SET status = 'completed', completed_at = ?, last_activity_at = ? WHERE id = ?").run(now, now, run.id);
  } else if (action === "reopen") {
    db.prepare(
      "UPDATE runs SET status = 'in_progress', completed_at = NULL, summary = NULL, summary_source = NULL, summary_original = NULL, last_activity_at = ? WHERE id = ?",
    ).run(now, run.id);
  } else {
    throw new HttpError(400, "Unbekannte Aktion");
  }
  return Response.json(getRun(run.id));
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const run = getRun(Number((await ctx.params).id));
  if (!run || !canAccessRun(user, run)) throw new HttpError(404, "Durchlauf nicht gefunden");
  if (run.status === "signed") throw new HttpError(409, "Unterschriebene Reports können nicht verworfen werden");
  getDb().prepare("DELETE FROM runs WHERE id = ?").run(run.id);
  return Response.json({ ok: true });
});
