import { apiAdmin, handle, HttpError } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { getChecklist } from "@/lib/data";
import { resolveDescription } from "@/lib/descriptions";

/**
 * Body { kind, targetId } regenerates one AI description.
 * Empty body fills every missing AI description of the checklist.
 */
export const POST = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  if (!aiEnabled()) throw new HttpError(503, "KI ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt).");
  const id = Number((await ctx.params).id);
  const body = (await request.json().catch(() => ({}))) as { kind?: "item" | "section"; targetId?: number };
  if (body.kind && body.targetId) {
    await resolveDescription(body.kind, body.targetId, { force: true });
  } else {
    const checklist = getChecklist(id);
    if (!checklist) throw new HttpError(404, "Checkliste nicht gefunden");
    const jobs: Promise<unknown>[] = [];
    for (const s of checklist.sections) {
      if (!s.ai_description) jobs.push(resolveDescription("section", s.id, { force: true }));
      for (const i of s.items) if (!i.ai_description) jobs.push(resolveDescription("item", i.id, { force: true }));
    }
    // Limit parallelism a little to stay friendly to rate limits.
    for (let k = 0; k < jobs.length; k += 6) await Promise.all(jobs.slice(k, k + 6));
  }
  return Response.json(getChecklist(id));
});
