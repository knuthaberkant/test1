import { requireAdmin } from "@/lib/auth";
import { listChecklists } from "@/lib/data";
import { getDb } from "@/lib/db";
import UsersManager, { type UserRow } from "./UsersManager";

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.default_checklist_id, u.locked_to_default, u.active,
         (SELECT COUNT(*) FROM runs r WHERE r.user_id = u.id AND r.status = 'signed') AS reports
       FROM users u ORDER BY u.active DESC, u.name COLLATE NOCASE`,
    )
    .all() as UserRow[];
  const checklists = listChecklists().map((c) => ({ id: c.id, name: c.name }));
  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <p className="eyebrow">Verwaltung</p>
      <h1 className="headline mt-1">Nutzer.</h1>
      <p className="mt-3 max-w-xl text-[19px] text-muted">Standard-Checkliste vorwählen und Nutzer bei Bedarf auf genau diese eine Checkliste beschränken.</p>
      <UsersManager users={users} checklists={checklists} meId={me.id} />
    </main>
  );
}
