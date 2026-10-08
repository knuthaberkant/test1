import { apiAdmin, handle, HttpError } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const POST = handle(async (request: Request) => {
  await apiAdmin();
  const b = (await request.json()) as {
    name?: string; email?: string; password?: string; role?: string;
    default_checklist_id?: number | null; locked_to_default?: boolean;
  };
  if (!b.name?.trim() || !b.email?.trim() || !b.password) throw new HttpError(400, "Name, E-Mail und Passwort angeben");
  try {
    const id = getDb()
      .prepare(
        "INSERT INTO users (name, email, password_hash, role, default_checklist_id, locked_to_default) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        b.name.trim(), b.email.trim(), hashPassword(b.password), b.role === "admin" ? "admin" : "user",
        b.default_checklist_id || null, b.locked_to_default ? 1 : 0,
      ).lastInsertRowid;
    return Response.json({ id: Number(id) });
  } catch {
    throw new HttpError(409, "Diese E-Mail-Adresse ist bereits vergeben");
  }
});
