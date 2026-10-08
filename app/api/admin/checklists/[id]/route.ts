import { apiAdmin, handle, HttpError } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { getChecklist } from "@/lib/data";

type ItemInput = { id?: number | string; title: string; description?: string | null };
type SectionInput = { id?: number | string; title: string; description?: string | null; items: ItemInput[] };
type Payload = { name: string; description?: string | null; active: boolean; sections: SectionInput[] };

const realId = (id: unknown) => (typeof id === "number" && id > 0 ? id : null);
const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const checklist = getChecklist(Number((await ctx.params).id));
  if (!checklist) throw new HttpError(404, "Checkliste nicht gefunden");
  return Response.json(checklist);
});

/** Saves the whole checklist structure. Removed sections/items are soft-deleted so past runs stay intact. */
export const PUT = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const id = Number((await ctx.params).id);
  const body = (await request.json()) as Payload;
  if (!body.name?.trim()) throw new HttpError(400, "Name fehlt");
  const db = getDb();
  const existing = getChecklist(id);
  if (!existing) throw new HttpError(404, "Checkliste nicht gefunden");
  const now = nowIso();

  const oldSections = new Map(existing.sections.map((s) => [s.id, s]));
  const oldItems = new Map(existing.sections.flatMap((s) => s.items).map((i) => [i.id, i]));
  const keptSections = new Set<number>();
  const keptItems = new Set<number>();

  db.transaction(() => {
    db.prepare("UPDATE checklists SET name = ?, description = ?, active = ?, updated_at = ? WHERE id = ?").run(
      body.name.trim(),
      clean(body.description),
      body.active ? 1 : 0,
      now,
      id,
    );
    body.sections.forEach((s, si) => {
      const title = s.title?.trim() || `Abschnitt ${si + 1}`;
      let sid = realId(s.id);
      const old = sid ? oldSections.get(sid) : undefined;
      if (sid && old) {
        // A new title makes a cached AI explanation stale.
        const aiDesc = old.title === title ? old.ai_description : null;
        db.prepare("UPDATE sections SET title = ?, description = ?, ai_description = ?, position = ? WHERE id = ?").run(
          title, clean(s.description), aiDesc, si, sid,
        );
      } else {
        sid = Number(
          db.prepare("INSERT INTO sections (checklist_id, title, description, position) VALUES (?, ?, ?, ?)")
            .run(id, title, clean(s.description), si).lastInsertRowid,
        );
      }
      keptSections.add(sid);
      (s.items ?? []).forEach((it, ii) => {
        const ititle = it.title?.trim();
        if (!ititle) return;
        const iid = realId(it.id);
        const oldItem = iid ? oldItems.get(iid) : undefined;
        if (iid && oldItem) {
          const aiDesc = oldItem.title === ititle ? oldItem.ai_description : null;
          db.prepare(
            "UPDATE items SET section_id = ?, title = ?, description = ?, ai_description = ?, position = ? WHERE id = ?",
          ).run(sid, ititle, clean(it.description), aiDesc, ii, iid);
          keptItems.add(iid);
        } else {
          db.prepare("INSERT INTO items (section_id, title, description, position) VALUES (?, ?, ?, ?)").run(
            sid, ititle, clean(it.description), ii,
          );
        }
      });
    });
    for (const sid of oldSections.keys())
      if (!keptSections.has(sid)) db.prepare("UPDATE sections SET deleted_at = ? WHERE id = ?").run(now, sid);
    for (const iid of oldItems.keys())
      if (!keptItems.has(iid)) db.prepare("UPDATE items SET deleted_at = ? WHERE id = ?").run(now, iid);
  })();

  return Response.json(getChecklist(id));
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const id = Number((await ctx.params).id);
  const db = getDb();
  db.prepare("UPDATE checklists SET deleted_at = ? WHERE id = ?").run(nowIso(), id);
  db.prepare("UPDATE users SET default_checklist_id = NULL WHERE default_checklist_id = ?").run(id);
  return Response.json({ ok: true });
});
