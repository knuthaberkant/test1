import { apiAdmin, handle, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const PUT = handle(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await apiAdmin();
  const id = Number((await ctx.params).id);
  const b = (await request.json()) as {
    name?: string; email?: string; password?: string; role?: string;
    default_checklist_id?: number | null; locked_to_default?: boolean; active?: boolean;
  };
  if (!b.name?.trim() || !b.email?.trim()) throw new HttpError(400, "Name und E-Mail angeben");
  if (id === me.id && (b.role !== "admin" || b.active === false))
    throw new HttpError(400, "Das eigene Admin-Konto kann nicht herabgestuft oder deaktiviert werden");
  const db = getDb();
  try {
    db.prepare(
      "UPDATE users SET name = ?, email = ?, role = ?, default_checklist_id = ?, locked_to_default = ?, active = ? WHERE id = ?",
    ).run(
      b.name.trim(), b.email.trim(), b.role === "admin" ? "admin" : "user", b.default_checklist_id || null,
      b.locked_to_default ? 1 : 0, b.active === false ? 0 : 1, id,
    );
  } catch {
    throw new HttpError(409, "Diese E-Mail-Adresse ist bereits vergeben");
  }
  if (b.password) db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(b.password), id);
  if (b.active === false) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  return Response.json({ ok: true });
});
