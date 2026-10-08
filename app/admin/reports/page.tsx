import Link from "next/link";
import Chevron from "@/components/Chevron";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatDuration, listChecklists } from "@/lib/data";
import { getDb } from "@/lib/db";
import { zonedMidnightUtc } from "@/lib/format";

type Row = {
  id: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  signed_at: string | null;
  location_label: string | null;
  summary: string | null;
  checklist: string;
  user: string;
};

type Search = { q?: string; from?: string; to?: string; user?: string; checklist?: string; status?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status === "open" || sp.status === "all" ? sp.status : "signed";
  const db = getDb();
  const users = db.prepare("SELECT id, name FROM users ORDER BY name COLLATE NOCASE").all() as { id: number; name: string }[];
  const checklists = listChecklists();

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (status === "signed") where.push("r.status = 'signed'");
  if (status === "open") where.push("r.status != 'signed'");
  const fromIso = sp.from ? zonedMidnightUtc(sp.from) : null;
  const toIso = sp.to ? zonedMidnightUtc(sp.to, 1) : null;
  if (fromIso) { where.push("COALESCE(r.signed_at, r.started_at) >= ?"); args.push(fromIso); }
  if (toIso) { where.push("COALESCE(r.signed_at, r.started_at) < ?"); args.push(toIso); }
  if (sp.user) { where.push("r.user_id = ?"); args.push(Number(sp.user)); }
  if (sp.checklist) { where.push("r.checklist_id = ?"); args.push(Number(sp.checklist)); }
  if (sp.q?.trim()) {
    where.push("(c.name LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR r.summary LIKE ? OR r.location_label LIKE ? OR CAST(r.id AS TEXT) = ?)");
    const like = `%${sp.q.trim()}%`;
    args.push(like, like, like, like, like, sp.q.trim());
  }
  const rows = db
    .prepare(
      `SELECT r.id, r.status, r.started_at, r.completed_at, r.signed_at, r.location_label, r.summary,
         c.name AS checklist, u.name AS user
       FROM runs r JOIN checklists c ON c.id = r.checklist_id JOIN users u ON u.id = r.user_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY COALESCE(r.signed_at, r.last_activity_at) DESC LIMIT 500`,
    )
    .all(...args) as Row[];
  const filtered = Boolean(sp.q || sp.from || sp.to || sp.user || sp.checklist);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <p className="eyebrow">Verwaltung</p>
      <h1 className="headline mt-1">Reports.</h1>

      <form className="card mt-8 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <div className="sm:col-span-2 lg:col-span-6">
          <label className="label" htmlFor="q">Suche</label>
          <input id="q" name="q" className="input" placeholder="Name, Checkliste, Ort, Zusammenfassung oder Report-Nr." defaultValue={sp.q ?? ""} />
        </div>
        <div className="lg:col-span-1">
          <label className="label" htmlFor="from">Von</label>
          <input id="from" name="from" type="date" className="input" defaultValue={sp.from ?? ""} />
        </div>
        <div className="lg:col-span-1">
          <label className="label" htmlFor="to">Bis</label>
          <input id="to" name="to" type="date" className="input" defaultValue={sp.to ?? ""} />
        </div>
        <div className="lg:col-span-1">
          <label className="label" htmlFor="user">Nutzer</label>
          <select id="user" name="user" className="input" defaultValue={sp.user ?? ""}>
            <option value="">Alle</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="lg:col-span-1">
          <label className="label" htmlFor="checklist">Checkliste</label>
          <select id="checklist" name="checklist" className="input" defaultValue={sp.checklist ?? ""}>
            <option value="">Alle</option>
            {checklists.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="input" defaultValue={status}>
            <option value="signed">Unterschrieben</option>
            <option value="open">In Bearbeitung</option>
            <option value="all">Alle</option>
          </select>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-6">
          <button className="btn-primary">Filtern</button>
          {filtered && <Link href={`/admin/reports${status !== "signed" ? `?status=${status}` : ""}`} className="link text-[15px]">Filter zurücksetzen</Link>}
          <span className="ml-auto text-[14px] text-muted">{rows.length} Einträge</span>
        </div>
      </form>

      <div className="card mt-6 divide-y divide-line">
        {rows.map((r) => {
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.checklist}</span>
                  <span className="text-[13px] text-muted">Nr. {r.id}</span>
                  {r.status !== "signed" && (
                    <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] text-warn">
                      {r.status === "completed" ? "wartet auf Unterschrift" : "in Bearbeitung"}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-muted">
                  {r.user} · {formatDateTime(r.signed_at ?? r.started_at)}
                  {r.completed_at && ` · Dauer ${formatDuration(new Date(r.completed_at).getTime() - new Date(r.started_at).getTime())}`}
                  {r.location_label && ` · ${r.location_label}`}
                </div>
                {r.summary && <p className="mt-1 line-clamp-2 text-[14px] text-ink/80">{r.summary}</p>}
              </div>
              {r.status === "signed" && <Chevron className="size-4 shrink-0 text-muted" />}
            </>
          );
          return r.status === "signed" ? (
            <Link key={r.id} href={`/reports/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-chip/50">{content}</Link>
          ) : (
            <div key={r.id} className="flex items-center gap-4 px-5 py-4">{content}</div>
          );
        })}
        {rows.length === 0 && <p className="p-8 text-center text-muted">Keine Reports gefunden.</p>}
      </div>
    </main>
  );
}
