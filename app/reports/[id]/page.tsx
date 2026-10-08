import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { CompletionDonut, BarList, ProgressTimeline, StatTile } from "@/components/Charts";
import { AutoBadge, ManualBadge, ResultList, sourceBadge } from "@/components/ReportBody";
import { requireUser } from "@/lib/auth";
import { canAccessRun, formatDateTime, formatDuration, getRun, snapshotFor, SOURCE_LABELS } from "@/lib/data";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  const user = await requireUser();
  const run = getRun(Number((await params).id));
  if (!run || !canAccessRun(user, run)) notFound();
  if (run.status !== "signed") {
    if (run.user_id === user.id) redirect(`/app/run/${run.id}`);
    notFound();
  }
  const isNew = (await searchParams).neu === "1";
  const snap = snapshotFor(run);
  const items = snap.sections.flatMap((s) => s.items);
  const done = items.filter((i) => i.checked).length;
  const commentSources = items.reduce<Record<string, number>>((acc, i) => {
    if (i.comment && i.commentSource) acc[i.commentSource] = (acc[i.commentSource] ?? 0) + 1;
    return acc;
  }, {});

  const provenance: { field: string; value: React.ReactNode; auto: boolean; how: string }[] = [
    { field: "Start", value: formatDateTime(snap.startedAt), auto: true, how: "Systemzeit beim Start der Checkliste" },
    { field: "Ende", value: formatDateTime(snap.completedAt), auto: true, how: "Systemzeit beim Abschließen" },
    { field: "Dauer", value: formatDuration(snap.durationMs), auto: true, how: "Berechnet aus Start und Ende" },
    {
      field: "Zusammenfassung",
      value: "",
      auto: run.summary_source === "ai" || run.summary_source === "template",
      how: SOURCE_LABELS[run.summary_source ?? ""] ?? "Manuell eingegeben",
    },
    {
      field: "Ort",
      value: run.location_label ?? (run.location_lat != null ? `${run.location_lat.toFixed(5)}, ${run.location_lng?.toFixed(5)}` : "nicht ermittelbar"),
      auto: true,
      how:
        run.location_status === "auto_confirmed"
          ? "Automatisch per Gerätestandort ermittelt, vom Nutzer bestätigt"
          : "Automatische Ermittlung nicht möglich",
    },
    { field: "Datum der Unterschrift", value: formatDateTime(run.signed_at), auto: true, how: "Systemzeit beim Unterschreiben" },
    { field: "Unterschrift", value: run.signer_name, auto: false, how: "Handschriftlich auf dem Gerät geleistet" },
    ...Object.entries(commentSources).map(([src, n]) => ({
      field: `Kommentare (${n})`,
      value: "",
      auto: src === "voice_ai" || src === "voice_raw",
      how: SOURCE_LABELS[src] ?? src,
    })),
  ];

  const open = items.length - done;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const commentCount = items.filter((i) => i.comment).length;
  const openItems = snap.sections.flatMap((s) => s.items.filter((i) => !i.checked).map((i) => ({ ...i, section: s.title })));
  const checkTimes = items.map((i) => i.checkedAt).filter((t): t is string => Boolean(t));

  return (
    <main className="report mx-auto max-w-5xl px-4 pb-24 pt-8 md:px-6 md:pt-12">
      {isNew && (
        <div className="no-print card mb-6 flex items-center gap-3 p-4 text-[15px]">
          <span className="grid size-8 place-items-center rounded-full bg-ok text-white">✓</span>
          Report unterschrieben und gespeichert.
        </div>
      )}
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={user.role === "admin" ? "/admin/reports" : "/app"} className="link text-[15px]">
          ‹ {user.role === "admin" ? "Dashboard" : "Übersicht"}
        </Link>
        <PrintButton />
      </div>

      {/* Header */}
      <header className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow">Prüfbericht Nr. {run.id}</p>
          <h1 className="mt-1 text-[34px] font-bold leading-tight tracking-tight md:text-[48px]">{snap.checklistName}</h1>
          <p className="mt-1 text-[16px] text-muted">
            {snap.userName} · {formatDateTime(run.signed_at)}
            {run.location_label ? ` · ${run.location_label}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold ${
            open === 0 ? "bg-ok/15 text-ok" : "bg-danger/10 text-danger"
          }`}
        >
          {open === 0 ? "✓ Vollständig erledigt" : `! ${open} Punkt${open === 1 ? "" : "e"} offen`}
        </span>
      </header>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Erfüllung" value={`${pct}%`} sub={`${done} von ${items.length} Punkten`} tone={open === 0 ? "good" : undefined} />
        <StatTile label="Offene Punkte" value={open} tone={open ? "bad" : "good"} sub={open ? "siehe Liste unten" : "keine"} />
        <StatTile label="Dauer" value={formatDuration(snap.durationMs)} sub={`${formatDateTime(snap.startedAt)} – ${formatDateTime(snap.completedAt).split(", ").pop()}`} />
        <StatTile label="Kommentare" value={commentCount} sub={`zu ${commentCount} von ${items.length} Punkten`} />
      </div>

      {/* Charts */}
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="card break-inside-avoid p-6">
          <h2 className="mb-4 text-[19px] font-semibold tracking-tight">Ergebnis</h2>
          <CompletionDonut done={done} open={open} size={160} />
        </section>
        <section className="card break-inside-avoid p-6">
          <h2 className="mb-4 text-[19px] font-semibold tracking-tight">Erfüllung je Abschnitt</h2>
          <BarList
            max={100}
            format={(v) => `${v}%`}
            rows={snap.sections.map((s) => {
              const d = s.items.filter((i) => i.checked).length;
              const v = s.items.length ? Math.round((d / s.items.length) * 100) : 0;
              return { label: s.title, value: v, hint: `${d} von ${s.items.length} erledigt`, tone: v === 100 ? "good" : undefined };
            })}
          />
        </section>
      </div>

      {checkTimes.length > 0 && (
        <section className="card mt-3 break-inside-avoid p-6">
          <h2 className="mb-1 text-[19px] font-semibold tracking-tight">Zeitverlauf</h2>
          <p className="mb-3 text-[13px] text-muted">Abgehakte Punkte über die Bearbeitungszeit</p>
          <ProgressTimeline start={snap.startedAt} end={snap.completedAt} times={checkTimes} total={items.length} />
        </section>
      )}

      <section className="card mt-3 break-inside-avoid p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[19px] font-semibold tracking-tight">Zusammenfassung</h2>
          {sourceBadge(run.summary_source)}
        </div>
        <p className="mt-3 whitespace-pre-line text-[17px] leading-relaxed">{run.summary}</p>
        {run.summary_original && run.summary_original !== run.summary && (
          <details className="no-print mt-3 text-[14px]">
            <summary className="cursor-pointer text-link">Ursprünglicher Vorschlag</summary>
            <p className="mt-2 whitespace-pre-line text-muted">{run.summary_original}</p>
          </details>
        )}
      </section>

      {openItems.length > 0 && (
        <section className="card mt-3 break-inside-avoid border-l-4 border-danger p-6">
          <h2 className="text-[19px] font-semibold tracking-tight">Offene Punkte</h2>
          <ul className="mt-3 space-y-2">
            {openItems.map((i, k) => (
              <li key={k} className="flex gap-3 text-[15px]">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--viz-bad)] text-[11px] font-bold text-white">!</span>
                <span>
                  {i.title} <span className="text-muted">· {i.section}</span>
                  {i.comment && <span className="block text-[14px] text-muted">„{i.comment}“</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-3 p-6">
        <h2 className="mb-4 text-[19px] font-semibold tracking-tight">Alle Punkte im Detail</h2>
        <ResultList snapshot={snap} />
      </section>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
      <section className="card break-inside-avoid p-6">
        <h2 className="text-[19px] font-semibold tracking-tight">Unterschrift</h2>
        {run.signature && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={run.signature} alt={`Unterschrift ${run.signer_name}`} className="mt-4 h-32 w-full rounded-2xl border border-line bg-white object-contain" />
        )}
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">Name</dt>
          <dd>{run.signer_name}</dd>
          <dt className="text-muted">Datum</dt>
          <dd>{formatDateTime(run.signed_at)}</dd>
          <dt className="text-muted">Ort</dt>
          <dd>
            {run.location_label ?? "–"}
            {run.location_lat != null && (
              <span className="block text-[13px] text-muted">
                {run.location_lat.toFixed(5)}, {run.location_lng?.toFixed(5)}
                {run.location_accuracy != null && ` · ±${Math.round(run.location_accuracy)} m`}
              </span>
            )}
            {run.location_status !== "auto_confirmed" && <span className="text-muted">nicht ermittelbar</span>}
          </dd>
        </dl>
      </section>

      <section className="card break-inside-avoid p-6">
        <h2 className="text-[19px] font-semibold tracking-tight">Herkunft der Angaben</h2>
        <p className="mt-1 text-[13px] text-muted">Automatisch ermittelt oder manuell eingegeben bzw. geändert.</p>
        <ul className="mt-3 divide-y divide-line">
          {provenance.map((p) => (
            <li key={p.field} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{p.field}</div>
                <div className="text-[12px] text-muted">{p.how}</div>
              </div>
              <div className="shrink-0">{p.auto ? <AutoBadge /> : <ManualBadge />}</div>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </main>
  );
}
