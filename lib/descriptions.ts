import { getDb } from "./db";
import { generateDescription } from "./ai";

export type DescriptionResult = { text: string | null; source: "custom" | "ai" | null };

type Row = { id: number; title: string; description: string | null; ai_description: string | null };

/** Returns the custom description, else the cached AI one, else generates and caches a new AI description. */
export async function resolveDescription(
  kind: "item" | "section",
  id: number,
  opts: { force?: boolean } = {},
): Promise<DescriptionResult> {
  const db = getDb();
  const table = kind === "item" ? "items" : "sections";
  const row = db.prepare(`SELECT id, title, description, ai_description FROM ${table} WHERE id = ?`).get(id) as
    | Row
    | undefined;
  if (!row) return { text: null, source: null };
  if (row.description && !opts.force) return { text: row.description, source: "custom" };
  if (row.ai_description && !opts.force) return { text: row.ai_description, source: "ai" };

  let text: string | null;
  if (kind === "item") {
    const ctx = db
      .prepare(
        `SELECT s.id AS section_id, s.title AS section_title, c.name AS checklist_name
         FROM items i JOIN sections s ON s.id = i.section_id JOIN checklists c ON c.id = s.checklist_id WHERE i.id = ?`,
      )
      .get(id) as { section_id: number; section_title: string; checklist_name: string };
    const siblings = (
      db.prepare("SELECT title FROM items WHERE section_id = ? AND id != ? AND deleted_at IS NULL").all(ctx.section_id, id) as {
        title: string;
      }[]
    ).map((r) => r.title);
    text = await generateDescription({
      kind,
      title: row.title,
      checklistName: ctx.checklist_name,
      sectionTitle: ctx.section_title,
      siblings,
    });
  } else {
    const ctx = db
      .prepare("SELECT c.name AS checklist_name FROM sections s JOIN checklists c ON c.id = s.checklist_id WHERE s.id = ?")
      .get(id) as { checklist_name: string };
    const siblings = (
      db.prepare("SELECT title FROM items WHERE section_id = ? AND deleted_at IS NULL ORDER BY position").all(id) as {
        title: string;
      }[]
    ).map((r) => r.title);
    text = await generateDescription({ kind, title: row.title, checklistName: ctx.checklist_name, siblings });
  }
  if (!text) return row.description ? { text: row.description, source: "custom" } : { text: null, source: null };
  db.prepare(`UPDATE ${table} SET ai_description = ? WHERE id = ?`).run(text, id);
  return opts.force && row.description ? { text: row.description, source: "custom" } : { text, source: "ai" };
}
