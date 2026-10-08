import { apiUser, handle, HttpError } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { canAccessRun, getRun } from "@/lib/data";

const SOURCES = new Set(["manual", "voice_ai", "voice_ai_edited", "voice_raw", "voice_raw_edited"]);

export const PUT = handle(async (request: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) => {
  const user = await apiUser();
  const p = await ctx.params;
  const run = getRun(Number(p.id));
  const itemId = Number(p.itemId);
  if (!run || !canAccessRun(user, run)) throw new HttpError(404, "Durchlauf nicht gefunden");
  if (run.status !== "in_progress") throw new HttpError(409, "Die Checkliste ist bereits abgeschlossen");
  const db = getDb();
  const belongs = db
    .prepare("SELECT 1 FROM items i JOIN sections s ON s.id = i.section_id WHERE i.id = ? AND s.checklist_id = ?")
    .get(itemId, run.checklist_id);
  if (!belongs) throw new HttpError(404, "Checkpunkt nicht gefunden");

  const b = (await request.json()) as {
    checked?: boolean; comment?: string | null; commentSource?: string; commentOriginal?: string | null;
  };
  const now = nowIso();
  const current = db.prepare("SELECT * FROM run_items WHERE run_id = ? AND item_id = ?").get(run.id, itemId) as
    | { checked: number; checked_at: string | null; comment: string | null; comment_source: string | null; comment_original: string | null }
    | undefined;
  const checked = b.checked ?? Boolean(current?.checked);
  const checkedAt = checked ? (current?.checked ? current.checked_at : now) : null;
  let comment = current?.comment ?? null;
  let source = current?.comment_source ?? null;
  let original = current?.comment_original ?? null;
  if (b.comment !== undefined) {
    comment = b.comment?.trim() ? b.comment.trim() : null;
    source = comment ? (SOURCES.has(b.commentSource ?? "") ? b.commentSource! : "manual") : null;
    original = comment ? (b.commentOriginal ?? null) : null;
  }
  db.prepare(
    `INSERT INTO run_items (run_id, item_id, checked, checked_at, comment, comment_source, comment_original)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(run_id, item_id) DO UPDATE SET checked = excluded.checked, checked_at = excluded.checked_at,
       comment = excluded.comment, comment_source = excluded.comment_source, comment_original = excluded.comment_original`,
  ).run(run.id, itemId, checked ? 1 : 0, checkedAt, comment, source, original);
  db.prepare("UPDATE runs SET last_activity_at = ? WHERE id = ?").run(now, run.id);
  return Response.json({ item_id: itemId, checked: checked ? 1 : 0, checked_at: checkedAt, comment, comment_source: source });
});
