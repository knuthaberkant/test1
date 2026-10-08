import Link from "next/link";
import Chevron from "@/components/Chevron";
import { requireAdmin } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { formatDate, listChecklists } from "@/lib/data";
import { getDb } from "@/lib/db";
import NewChecklist from "./NewChecklist";

export default async function AdminHome() {
  await requireAdmin();
  const checklists = listChecklists();
  const db = getDb();
  const defaults = db
    .prepare("SELECT default_checklist_id AS id, COUNT(*) AS n FROM users WHERE default_checklist_id IS NOT NULL AND active = 1 GROUP BY default_checklist_id")
    .all() as { id: number; n: number }[];
  const stats = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM runs WHERE status = 'signed') AS signed,
         (SELECT COUNT(*) FROM runs WHERE status != 'signed') AS open,
         (SELECT COUNT(*) FROM users WHERE active = 1) AS users`,
    )
    .get() as { signed: number; open: number; users: number };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <p className="eyebrow">Verwaltung</p>
      <h1 className="headline mt-1">Checklisten.</h1>
      <p className="mt-3 max-w-xl text-[19px] text-muted">Pro Anwendungsfall eine Checkliste, gegliedert in Abschnitte oder Arbeitsphasen.</p>

      {!aiEnabled() && (
        <div className="mt-6 rounded-2xl bg-warn/10 p-4 text-[14px]">
          KI ist nicht konfiguriert. Setze <code className="rounded bg-chip px-1">ANTHROPIC_API_KEY</code>, damit Beschreibungen,
          Kommentare und Zusammenfassungen per KI erstellt werden. Bis dahin läuft alles ohne KI weiter.
        </div>
      )}

      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          { label: "Reports", value: stats.signed, href: "/admin/reports" },
          { label: "Offene Durchläufe", value: stats.open, href: "/admin/reports?status=open" },
          { label: "Aktive Nutzer", value: stats.users, href: "/admin/users" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:scale-[1.01]">
            <div className="text-[28px] font-semibold tracking-tight md:text-[40px]">{s.value}</div>
            <div className="text-[13px] text-muted">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h2 className="text-[24px] font-semibold tracking-tight">Alle Checklisten</h2>
      </div>
      <div className="card mt-4 divide-y divide-line">
        {checklists.map((c) => {
          const n = defaults.find((d) => d.id === c.id)?.n ?? 0;
          return (
            <Link key={c.id} href={`/admin/checklists/${c.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-chip/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[17px] font-semibold">{c.name}</span>
                  {!c.active && <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] text-muted">inaktiv</span>}
                </div>
                <div className="text-[13px] text-muted">
                  {c.section_count} Abschnitte · {c.item_count} Punkte
                  {n > 0 && ` · Standard für ${n} Nutzer`} · geändert {formatDate(c.updated_at)}
                </div>
              </div>
              <Chevron className="size-4 text-muted" />
            </Link>
          );
        })}
        {checklists.length === 0 && <p className="p-6 text-muted">Noch keine Checklisten.</p>}
      </div>
      <NewChecklist />
    </main>
  );
}
