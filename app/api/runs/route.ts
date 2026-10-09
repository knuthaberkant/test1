import { apiUser, handle, HttpError } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { checklistsForUser } from "@/lib/data";

/** Starts a run, or returns the user's open run of that checklist so it can be resumed. */
export const POST = handle(async (request: Request) => {
  const user = await apiUser();
  const checklistId = Number(((await request.json()) as { checklistId?: number }).checklistId);
  if (!checklistsForUser(user).some((c) => c.id === checklistId))
    throw new HttpError(403, "Diese Checkliste ist für dich nicht freigegeben");
  const db = getDb();
  const open = db
    .prepare("SELECT id FROM runs WHERE user_id = ? AND checklist_id = ? AND status != 'signed' ORDER BY id DESC LIMIT 1")
    .get(user.id, checklistId) as { id: number } | undefined;
  if (open) return Response.json({ id: open.id, resumed: true });
  const now = nowIso();
  const id = db
    .prepare("INSERT INTO runs (checklist_id, user_id, started_at, last_activity_at) VALUES (?, ?, ?, ?)")
    .run(checklistId, user.id, now, now).lastInsertRowid;
  return Response.json({ id: Number(id), resumed: false });
});
