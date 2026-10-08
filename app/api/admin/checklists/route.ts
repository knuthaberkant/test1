import { apiAdmin, handle, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const POST = handle(async (request: Request) => {
  await apiAdmin();
  const { name } = (await request.json()) as { name?: string };
  if (!name?.trim()) throw new HttpError(400, "Name fehlt");
  const db = getDb();
  const id = Number(db.prepare("INSERT INTO checklists (name) VALUES (?)").run(name.trim()).lastInsertRowid);
  db.prepare("INSERT INTO sections (checklist_id, title, position) VALUES (?, ?, 0)").run(id, "Allgemein");
  return Response.json({ id });
});
