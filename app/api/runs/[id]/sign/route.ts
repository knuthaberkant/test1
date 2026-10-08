import { apiUser, handle, HttpError } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { buildSnapshot, canAccessRun, getRun } from "@/lib/data";

type Body = {
  summary?: string;
  summarySource?: "ai" | "template" | "manual";
  summaryOriginal?: string | null;
  signature?: string;
  location?: { lat: number; lng: number; accuracy: number | null; label: string | null } | null;
};

export const POST = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const run = getRun(Number((await ctx.params).id));
  if (!run || !canAccessRun(user, run)) throw new HttpError(404, "Durchlauf nicht gefunden");
  if (run.status !== "completed") throw new HttpError(409, "Der Report kann in diesem Zustand nicht unterschrieben werden");
  if (run.user_id !== user.id) throw new HttpError(403, "Nur die ausfüllende Person kann unterschreiben");
  const b = (await request.json()) as Body;
  const summary = b.summary?.trim();
  if (!summary) throw new HttpError(400, "Zusammenfassung fehlt");
  if (!b.signature?.startsWith("data:image/png;base64,") || b.signature.length > 2_000_000)
    throw new HttpError(400, "Unterschrift fehlt");

  // Provenance: AI/template text counts as edited once it differs from what was generated.
  let source: string = "manual";
  const original = b.summaryOriginal?.trim() || null;
  if ((b.summarySource === "ai" || b.summarySource === "template") && original) {
    source = original === summary ? b.summarySource : `${b.summarySource}_edited`;
  }

  const loc = b.location;
  const hasLoc = loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
  const now = nowIso();
  const snapshot = buildSnapshot(run);
  getDb()
    .prepare(
      `UPDATE runs SET status = 'signed', summary = ?, summary_source = ?, summary_original = ?, signature = ?,
         signed_at = ?, signer_name = ?, location_lat = ?, location_lng = ?, location_accuracy = ?, location_label = ?,
         location_status = ?, report_json = ?, last_activity_at = ? WHERE id = ?`,
    )
    .run(
      summary, source, original, b.signature, now, user.name,
      hasLoc ? loc!.lat : null, hasLoc ? loc!.lng : null, hasLoc ? loc!.accuracy : null,
      hasLoc ? loc!.label : null, hasLoc ? "auto_confirmed" : "unavailable",
      JSON.stringify(snapshot), now, run.id,
    );
  return Response.json({ ok: true });
});
