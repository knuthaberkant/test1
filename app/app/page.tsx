import Link from "next/link";
import Chevron from "@/components/Chevron";
import StartButton from "@/components/StartButton";
import { requireUser } from "@/lib/auth";
import { checklistsForUser, formatDateTime } from "@/lib/data";
import { getDb } from "@/lib/db";

type OpenRun = { id: number; checklist_id: number; name: string; status: string; started_at: string; last_activity_at: string; done: number; total: number };
type DoneRun = { id: number; name: string; signed_at: string; location_label: string | null };

export default async function UserHome() {
  const user = await requireUser();
  const db = getDb();
  const checklists = checklistsForUser(user);
  const openRuns = db
    .prepare(
      `SELECT r.id, r.checklist_id, c.name, r.status, r.started_at, r.last_activity_at,
         (SELECT COUNT(*) FROM run_items ri JOIN items i ON i.id = ri.item_id
            WHERE ri.run_id = r.id AND ri.checked = 1 AND i.deleted_at IS NULL) AS done,
         (SELECT COUNT(*) FROM items i JOIN sections s ON s.id = i.section_id
            WHERE s.checklist_id = r.checklist_id AND i.deleted_at IS NULL AND s.deleted_at IS NULL) AS total
       FROM runs r JOIN checklists c ON c.id = r.checklist_id
       WHERE r.user_id = ? AND r.status != 'signed' ORDER BY r.last_activity_at DESC`,
    )
    .all(user.id) as OpenRun[];
  const reports = db
    .prepare(
      `SELECT r.id, c.name, r.signed_at, r.location_label FROM runs r JOIN checklists c ON c.id = r.checklist_id
       WHERE r.user_id = ? AND r.status = 'signed' ORDER BY r.signed_at DESC LIMIT 10`,
    )
    .all(user.id) as DoneRun[];
  const def = checklists.find((c) => c.id === user.default_checklist_id);
  const defOpen = def && openRuns.find((r) => r.checklist_id === def.id);
  const others = checklists.filter((c) => c.id !== def?.id);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <p className="eyebrow">{new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" }).format(new Date())}</p>
      <h1 className="headline mt-1">Hallo, {user.name.split(" ")[0]}.</h1>

      {def && (
        <section className="card mt-8 overflow-hidden p-7 md:p-10">
          <p className="eyebrow text-accent">Deine Checkliste</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight md:text-[40px]">{def.name}</h2>
          {def.description && <p className="mt-2 max-w-xl text-[17px] text-muted">{def.description}</p>}
          <p className="mt-2 text-[14px] text-muted">
            {def.section_count} Abschnitte · {def.item_count} Punkte
          </p>
          <div className="mt-6">
            {defOpen ? (
              <Link className="btn-primary" href={`/app/run/${defOpen.id}`}>
                Fortsetzen · {defOpen.done}/{defOpen.total}
              </Link>
            ) : (
              <StartButton checklistId={def.id} label="Jetzt starten" />
            )}
          </div>
        </section>
      )}

      {openRuns.filter((r) => r !== defOpen).length > 0 && (
        <section className="mt-12">
          <h2 className="text-[24px] font-semibold tracking-tight">In Bearbeitung</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {openRuns
              .filter((r) => r !== defOpen)
              .map((r) => (
                <Link key={r.id} href={`/app/run/${r.id}`} className="card group flex items-center gap-4 p-5 transition hover:scale-[1.01]">
                  <Progress done={r.done} total={r.total} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[17px] font-semibold">{r.name}</div>
                    <div className="text-[13px] text-muted">
                      {r.status === "completed" ? "Wartet auf Unterschrift" : `Zuletzt bearbeitet ${formatDateTime(r.last_activity_at)}`}
                    </div>
                  </div>
                  <Chevron className="size-4 text-muted" />
                </Link>
              ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[24px] font-semibold tracking-tight">{def ? "Weitere Checklisten" : "Checklisten"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((c) => (
              <div key={c.id} className="card flex flex-col p-6">
                <div className="text-[19px] font-semibold tracking-tight">{c.name}</div>
                {c.description && <p className="mt-1 line-clamp-3 text-[15px] text-muted">{c.description}</p>}
                <p className="mt-2 text-[13px] text-muted">{c.item_count} Punkte</p>
                <div className="mt-auto pt-5">
                  {openRuns.some((r) => r.checklist_id === c.id) ? (
                    <Link className="btn-secondary" href={`/app/run/${openRuns.find((r) => r.checklist_id === c.id)!.id}`}>
                      Fortsetzen
                    </Link>
                  ) : (
                    <StartButton checklistId={c.id} className="btn-secondary" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {checklists.length === 0 && (
        <p className="card mt-8 p-8 text-center text-muted">Für dich ist noch keine Checkliste freigegeben.</p>
      )}

      {reports.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[24px] font-semibold tracking-tight">Meine Reports</h2>
          <div className="card mt-4 divide-y divide-line">
            {reports.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-chip/50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-[13px] text-muted">
                    {formatDateTime(r.signed_at)}
                    {r.location_label ? ` · ${r.location_label}` : ""}
                  </div>
                </div>
                <Chevron className="size-4 text-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? done / total : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <span className="text-[11px] font-semibold">{Math.round(pct * 100)}%</span>
    </div>
  );
}
