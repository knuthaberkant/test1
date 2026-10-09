import Link from "next/link";
import { BarList, ColumnChart, CompletionDonut, StatTile } from "@/components/Charts";
import Chevron from "@/components/Chevron";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatDuration, listChecklists, type ReportSnapshot } from "@/lib/data";
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
  report_json: string | null;
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
      `SELECT r.id, r.status, r.started_at, r.completed_at, r.signed_at, r.location_label, r.summary, r.report_json,
         c.name AS checklist, u.name AS user
       FROM runs r JOIN checklists c ON c.id = r.checklist_id JOIN users u ON u.id = r.user_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY COALESCE(r.signed_at, r.last_activity_at) DESC LIMIT 500`,
    )
    .all(...args) as Row[];
  const filtered = Boolean(sp.q || sp.from || sp.to || sp.user || sp.checklist);
  const stats = computeStats(rows, fromIso, toIso);
  const openRuns = (db.prepare("SELECT COUNT(*) AS n FROM runs WHERE status != 'signed'").get() as { n: number }).n;
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) q.set(k, v);
    const str = q.toString();
    return `/admin/reports${str ? `?${str}` : ""}`;
  };
  const today = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n + 1);
    return d.toISOString().slice(0, 10);
  };
  const ranges = [
    { label: "7 Tage", from: daysAgo(7) },
    { label: "30 Tage", from: daysAgo(30) },
    { label: "90 Tage", from: daysAgo(90) },
    { label: "Gesamt", from: "" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <p className="eyebrow">Verwaltung</p>
      <h1 className="headline mt-1">Dashboard.</h1>
      <p className="mt-3 text-[19px] text-muted">Alle Reports auf einen Blick. Die Filter unten wirken auch auf die Auswertung.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {ranges.map((r) => {
          const active = (sp.from ?? "") === r.from && !sp.to;
          return (
            <Link
              key={r.label}
              href={keep({ from: r.from, to: "" })}
              className={`rounded-full px-4 py-2 text-[14px] font-medium ${active ? "bg-ink text-canvas" : "bg-card text-ink hover:bg-chip"}`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Reports" value={stats.count} sub={stats.count ? `${stats.withOpen} mit offenen Punkten` : "im Zeitraum"} />
        <StatTile label="Ø Erfüllung" value={stats.count ? `${stats.avgPct}%` : "–"} tone={stats.count && stats.avgPct === 100 ? "good" : undefined} sub={`${stats.done} von ${stats.total} Punkten`} />
        <StatTile label="Ø Dauer" value={stats.count ? formatDuration(stats.avgMs) : "–"} sub="Start bis Abschluss" />
        <StatTile label="Offene Durchläufe" value={openRuns} sub={<Link className="link" href="/admin/reports?status=open">anzeigen</Link>} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="card p-6">
          <h2 className="text-[19px] font-semibold tracking-tight">Reports pro Tag</h2>
          <p className="mb-3 text-[13px] text-muted">{stats.rangeLabel}</p>
          <ColumnChart points={stats.perDay} unit=" Reports" />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-[19px] font-semibold tracking-tight">Erledigte Punkte gesamt</h2>
          <CompletionDonut done={stats.done} open={stats.total - stats.done} size={150} />
        </section>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <section className="card p-6">
          <h2 className="mb-4 text-[19px] font-semibold tracking-tight">Ø Erfüllung je Checkliste</h2>
          <BarList max={100} format={(v) => `${v}%`} rows={stats.byChecklist} />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 text-[19px] font-semibold tracking-tight">Reports je Nutzer</h2>
          <BarList rows={stats.byUser} />
        </section>
        <section className="card p-6">
          <h2 className="mb-1 text-[19px] font-semibold tracking-tight">Häufig offene Punkte</h2>
          <p className="mb-4 text-[13px] text-muted">So oft nicht abgehakt</p>
          <BarList rows={stats.topOpen} />
        </section>
      </div>

      <h2 className="mt-12 text-[24px] font-semibold tracking-tight">Reports</h2>

      <form className="card mt-4 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6" method="get">
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

type Stats = {
  count: number;
  withOpen: number;
  done: number;
  total: number;
  avgPct: number;
  avgMs: number;
  rangeLabel: string;
  perDay: { label: string; value: number; tick?: boolean }[];
  byChecklist: { label: string; value: number; hint: string; tone?: "good" }[];
  byUser: { label: string; value: number }[];
  topOpen: { label: React.ReactNode; value: number; tone: "bad" }[];
};

function computeStats(rows: Row[], fromIso: string | null, toIso: string | null): Stats {
  const signed = rows.filter((r) => r.status === "signed" && r.report_json);
  const snaps = signed.map((r) => ({ row: r, snap: JSON.parse(r.report_json!) as ReportSnapshot }));
  let done = 0;
  let total = 0;
  let withOpen = 0;
  let pctSum = 0;
  let msSum = 0;
  const byChecklist = new Map<string, { pct: number; n: number }>();
  const byUser = new Map<string, number>();
  const openCount = new Map<string, { title: string; checklist: string; n: number }>();
  for (const { row, snap } of snaps) {
    const items = snap.sections.flatMap((s) => s.items);
    const d = items.filter((i) => i.checked).length;
    const pct = items.length ? (d / items.length) * 100 : 0;
    done += d;
    total += items.length;
    pctSum += pct;
    msSum += snap.durationMs;
    if (d < items.length) withOpen++;
    const c = byChecklist.get(row.checklist) ?? { pct: 0, n: 0 };
    byChecklist.set(row.checklist, { pct: c.pct + pct, n: c.n + 1 });
    byUser.set(row.user, (byUser.get(row.user) ?? 0) + 1);
    for (const i of items) {
      if (i.checked) continue;
      const key = `${row.checklist}\u0000${i.title}`;
      const o = openCount.get(key) ?? { title: i.title, checklist: row.checklist, n: 0 };
      o.n++;
      openCount.set(key, o);
    }
  }

  // Day buckets in the app time zone: the filter range, else the last 30 days (max. 92 columns).
  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Berlin" }).format(new Date(iso));
  const end = toIso ? new Date(new Date(toIso).getTime() - 1) : new Date();
  let start = fromIso ? new Date(fromIso) : new Date(end.getTime() - 29 * 864e5);
  if (!fromIso && snaps.length && toIso) start = new Date(end.getTime() - 29 * 864e5);
  if ((end.getTime() - start.getTime()) / 864e5 > 91) start = new Date(end.getTime() - 91 * 864e5);
  const counts = new Map<string, number>();
  for (const { row } of snaps) counts.set(dayKey(row.signed_at!), (counts.get(dayKey(row.signed_at!)) ?? 0) + 1);
  const perDay: Stats["perDay"] = [];
  for (let t = start.getTime(); t <= end.getTime() + 1; t += 864e5) {
    const key = dayKey(new Date(t).toISOString());
    if (perDay.length && perDay[perDay.length - 1].label === key.slice(8, 10) + "." + key.slice(5, 7) + ".") continue;
    perDay.push({ label: `${key.slice(8, 10)}.${key.slice(5, 7)}.`, value: counts.get(key) ?? 0 });
  }
  const step = Math.max(1, Math.ceil(perDay.length / 6));
  perDay.forEach((p, i) => (p.tick = i % step === 0 || i === perDay.length - 1));

  const fmt = (d: Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(d);
  return {
    count: snaps.length,
    withOpen,
    done,
    total,
    avgPct: snaps.length ? Math.round(pctSum / snaps.length) : 0,
    avgMs: snaps.length ? msSum / snaps.length : 0,
    rangeLabel: `${fmt(start)} bis ${fmt(end)}`,
    perDay,
    byChecklist: [...byChecklist.entries()]
      .map(([label, v]) => {
        const value = Math.round(v.pct / v.n);
        return { label, value, hint: `${v.n} Reports`, tone: value === 100 ? ("good" as const) : undefined };
      })
      .sort((a, b) => a.value - b.value)
      .slice(0, 8),
    byUser: [...byUser.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    topOpen: [...openCount.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
      .map((o) => ({
        label: (
          <>
            {o.title} <span className="text-muted">· {o.checklist}</span>
          </>
        ),
        value: o.n,
        tone: "bad" as const,
      })),
  };
}
