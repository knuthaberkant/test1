import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { AutoBadge, ManualBadge, ResultList, sourceBadge, TimeFacts } from "@/components/ReportBody";
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

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-6 md:pt-12">
      {isNew && (
        <div className="no-print card mb-6 flex items-center gap-3 p-4 text-[15px]">
          <span className="grid size-8 place-items-center rounded-full bg-ok text-white">✓</span>
          Report unterschrieben und gespeichert.
        </div>
      )}
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={user.role === "admin" ? "/admin/reports" : "/app"} className="link text-[15px]">
          ‹ {user.role === "admin" ? "Alle Reports" : "Übersicht"}
        </Link>
        <PrintButton />
      </div>

      <p className="eyebrow mt-6">Report Nr. {run.id}</p>
      <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight md:text-[44px]">{snap.checklistName}</h1>
      <p className="mt-1 text-[15px] text-muted">
        {snap.userName} · {snap.userEmail} · {done} von {items.length} Punkten erledigt
      </p>

      <div className="mt-6">
        <TimeFacts snapshot={snap} durationText={formatDuration(snap.durationMs)} />
      </div>

      <section className="card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[21px] font-semibold tracking-tight">Zusammenfassung</h2>
          {sourceBadge(run.summary_source)}
        </div>
        <p className="mt-3 whitespace-pre-line text-[17px] leading-relaxed">{run.summary}</p>
        {run.summary_original && run.summary_original !== run.summary && (
          <details className="mt-3 text-[14px]">
            <summary className="cursor-pointer text-link">Ursprünglicher Vorschlag</summary>
            <p className="mt-2 whitespace-pre-line text-muted">{run.summary_original}</p>
          </details>
        )}
      </section>

      <section className="card mt-6 p-6">
        <h2 className="mb-4 text-[21px] font-semibold tracking-tight">Ergebnis</h2>
        <ResultList snapshot={snap} />
      </section>

      <section className="card mt-6 p-6">
        <h2 className="text-[21px] font-semibold tracking-tight">Unterschrift</h2>
        {run.signature && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={run.signature} alt={`Unterschrift ${run.signer_name}`} className="mt-4 h-36 w-full max-w-md rounded-2xl border border-line bg-white object-contain" />
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

      <section className="card mt-6 p-6">
        <h2 className="text-[21px] font-semibold tracking-tight">Herkunft der Angaben</h2>
        <p className="mt-1 text-[14px] text-muted">Welche Angaben automatisch erkannt und welche manuell eingegeben oder geändert wurden.</p>
        <ul className="mt-4 divide-y divide-line">
          {provenance.map((p) => (
            <li key={p.field} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="w-48 shrink-0 font-medium">{p.field}</div>
              <div className="flex-1 text-[14px] text-muted">{p.how}</div>
              <div>{p.auto ? <AutoBadge /> : <ManualBadge />}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
