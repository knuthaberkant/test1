import { CompletionDonut, ProgressTimeline } from "@/components/Charts";
import { AutoBadge, ManualBadge } from "@/components/ReportBody";
import type { ReportSnapshot, Run } from "@/lib/data";
import { formatDateTime, formatDuration, SOURCE_LABELS } from "@/lib/format";

// Print-only layout of a signed report (A4 portrait, ~186 mm content width ≈ 700 px).
// Page 1 is a one-page dashboard; the item details follow on page 2 and later, broken only
// between items so no card or section is cut through.

export type Provenance = { field: string; how: string; auto: boolean };

export default function PrintReport({
  run,
  snap,
  provenance,
}: {
  run: Run;
  snap: ReportSnapshot;
  provenance: Provenance[];
}) {
  const items = snap.sections.flatMap((s) => s.items);
  const done = items.filter((i) => i.checked).length;
  const open = items.length - done;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const comments = items.filter((i) => i.comment).length;
  const openItems = snap.sections.flatMap((s) => s.items.filter((i) => !i.checked).map((i) => ({ ...i, section: s.title })));
  const checkTimes = items.map((i) => i.checkedAt).filter((t): t is string => Boolean(t));
  const place =
    run.location_label ??
    (run.location_lat != null ? `${run.location_lat.toFixed(5)}, ${run.location_lng?.toFixed(5)}` : "nicht ermittelbar");
  const footer = `Prüfbericht Nr. ${run.id} · ${snap.checklistName} · ${formatDateTime(run.signed_at)}`;
  const MAX_OPEN = 4;
  // Keeps page 1 on one sheet; a long summary is shown in full at the start of the details.
  const longSummary = (run.summary ?? "").length > 340;

  return (
    <div className="print-report hidden text-[12px] leading-snug text-ink print:block">
      {/* Running footer with page numbers (Chromium/Edge print). */}
      <style>{`@page { @bottom-left { content: ${JSON.stringify(footer)}; font: 9px system-ui, sans-serif; color: #86868b; }
        @bottom-right { content: "Seite " counter(page) " von " counter(pages); font: 9px system-ui, sans-serif; color: #86868b; } }`}</style>

      {/* ---------- Page 1: dashboard ---------- */}
      <section className="print-page-1">
        <header className="flex shrink-0 items-stretch overflow-hidden rounded-[14px] bg-[#1d1d1f] text-white">
          <div className="min-w-0 flex-1 px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60">Prüfbericht Nr. {run.id}</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">{snap.checklistName}</h1>
            <dl className="mt-3 grid grid-cols-3 gap-4 text-[11px]">
              <HeaderFact label="Geprüft von" value={snap.userName} />
              <HeaderFact label="Unterschrieben" value={formatDateTime(run.signed_at)} />
              <HeaderFact label="Ort" value={place} />
            </dl>
          </div>
          <div
            className={`flex w-[150px] shrink-0 flex-col items-center justify-center gap-1 px-4 text-center ${
              open === 0 ? "bg-[#1f9d3a]" : "bg-[#d70015]"
            }`}
          >
            <span className="text-[30px] font-bold leading-none">{open === 0 ? "✓" : open}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide">
              {open === 0 ? "Vollständig erledigt" : `Punkt${open === 1 ? "" : "e"} offen`}
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
        <div className="mt-3 grid shrink-0 grid-cols-4 gap-2.5">
          <Kpi label="Erfüllung" value={`${pct}%`} sub={`${done} von ${items.length} Punkten`} bar={pct} />
          <Kpi label="Offene Punkte" value={String(open)} sub={open ? "siehe Liste" : "keine"} tone={open ? "bad" : "good"} />
          <Kpi label="Dauer" value={formatDuration(snap.durationMs)} sub={`${formatTime(snap.startedAt)} – ${formatTime(snap.completedAt)} Uhr`} />
          <Kpi label="Kommentare" value={String(comments)} sub={`zu ${comments} von ${items.length} Punkten`} />
        </div>

        <div className="mt-2.5 grid shrink-0 grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-2.5">
          <Panel title="Ergebnis">
            <CompletionDonut done={done} open={open} size={115} />
          </Panel>
          <Panel title="Erfüllung je Abschnitt">
            <SectionBars sections={snap.sections} />
          </Panel>
        </div>

        {checkTimes.length > 0 && (
          <Panel title="Zeitverlauf" sub="Abgehakte Punkte über die Bearbeitungszeit" className="mt-2.5 shrink-0">
            <ProgressTimeline start={snap.startedAt} end={snap.completedAt} times={checkTimes} total={items.length} height={125} />
          </Panel>
        )}

        <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-2 gap-2.5">
          <Panel title="Zusammenfassung" className="overflow-hidden">
            <p className={`whitespace-pre-line text-[11.5px] leading-relaxed ${longSummary ? "line-clamp-[10]" : ""}`}>{run.summary}</p>
            {longSummary && <p className="mt-1 text-[10px] text-muted">Vollständiger Text im Detailteil.</p>}
          </Panel>
          <Panel title={open ? `Offene Punkte (${open})` : "Offene Punkte"} accent={open ? "bad" : "good"} className="overflow-hidden">
            {open === 0 ? (
              <p className="flex items-center gap-2 text-[12px]">
                <Dot tone="good">✓</Dot> Alle Punkte wurden erledigt.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {openItems.slice(0, MAX_OPEN).map((i, k) => (
                  <li key={k} className="flex gap-2">
                    <Dot tone="bad">!</Dot>
                    <span className="min-w-0">
                      {i.title} <span className="text-muted">· {i.section}</span>
                    </span>
                  </li>
                ))}
                {openItems.length > MAX_OPEN && (
                  <li className="pl-6 text-muted">+ {openItems.length - MAX_OPEN} weitere, siehe Detailteil</li>
                )}
              </ul>
            )}
          </Panel>
        </div>

        </div>

        <div className="mt-2.5 flex shrink-0 items-center gap-5 rounded-[12px] border border-[#e3e3e8] px-5 py-3">
          {run.signature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={run.signature} alt={`Unterschrift ${run.signer_name}`} className="h-14 w-44 object-contain" />
          )}
          <div className="grid flex-1 grid-cols-3 gap-4 text-[11px]">
            <Fact label="Unterschrift" value={run.signer_name ?? "–"} />
            <Fact label="Datum" value={formatDateTime(run.signed_at)} />
            <Fact label="Ort" value={place} />
          </div>
        </div>
      </section>

      {/* ---------- Page 2+: details ---------- */}
      <section className="print-details">
        <h2 className="text-[20px] font-bold tracking-tight">Alle Prüfpunkte im Detail</h2>
        <p className="mt-0.5 text-[11px] text-muted">
          {snap.checklistName} · {snap.sections.length} Abschnitte · {items.length} Punkte
        </p>

        {longSummary && (
          <div className="print-avoid mt-4 rounded-[12px] border border-[#e3e3e8] px-4 py-3.5">
            <h3 className="text-[13px] font-semibold">Zusammenfassung</h3>
            <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-relaxed">{run.summary}</p>
          </div>
        )}

        {snap.sections.map((s, si) => {
          const d = s.items.filter((i) => i.checked).length;
          const v = s.items.length ? Math.round((d / s.items.length) * 100) : 0;
          return (
            <div key={si} className="mt-5">
              <div className="print-keep-with-next flex items-center gap-3 border-b-2 border-[#1d1d1f] pb-1.5">
                <span className="grid size-6 place-items-center rounded-full bg-[#1d1d1f] text-[11px] font-bold text-white">{si + 1}</span>
                <h3 className="flex-1 text-[14px] font-semibold">{s.title}</h3>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--viz-track)]">
                  <div className="h-full rounded-full" style={{ width: `${v}%`, background: v === 100 ? "var(--viz-good)" : "var(--viz-1)" }} />
                </div>
                <span className="w-16 text-right text-[11px] font-semibold tabular-nums">
                  {d}/{s.items.length} · {v}%
                </span>
              </div>
              <ul>
                {s.items.map((i, ii) => (
                  <li key={ii} className="flex gap-3 border-b border-[#e8e8ed] py-2">
                    <Dot tone={i.checked ? "good" : "bad"}>{i.checked ? "✓" : "!"}</Dot>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className={`flex-1 text-[12px] font-medium ${i.checked ? "" : "text-[#d70015]"}`}>{i.title}</span>
                        <span className="shrink-0 text-[10.5px] text-muted">
                          {i.checkedAt ? `erledigt ${formatDateTime(i.checkedAt)}` : "offen"}
                        </span>
                      </div>
                      {i.comment && (
                        <div className="mt-1 flex items-start gap-2 rounded-md bg-[#f5f5f7] px-2.5 py-1.5 text-[11px]">
                          <span className="flex-1 whitespace-pre-line">„{i.comment}“</span>
                          <span className="shrink-0 text-[9.5px] text-muted">{SOURCE_LABELS[i.commentSource ?? ""] ?? ""}</span>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="print-avoid mt-6 rounded-[12px] border border-[#e3e3e8] p-4">
          <h2 className="text-[14px] font-semibold">Herkunft der Angaben</h2>
          <p className="text-[10.5px] text-muted">Automatisch ermittelt oder manuell eingegeben bzw. geändert.</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-6">
            {provenance.map((p) => (
              <li key={p.field} className="flex items-start gap-2 border-b border-[#e8e8ed] py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium">{p.field}</div>
                  <div className="text-[10px] text-muted">{p.how}</div>
                </div>
                {p.auto ? <AutoBadge /> : <ManualBadge />}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/** Compact completion bars per section; two columns when there are many sections. */
function SectionBars({ sections }: { sections: ReportSnapshot["sections"] }) {
  const MAX = 12;
  const shown = sections.slice(0, MAX);
  const twoCols = sections.length > 5;
  return (
    <>
      <ul className={`grid gap-x-5 ${twoCols ? "grid-cols-2 gap-y-2" : "grid-cols-1 gap-y-3"}`}>
        {shown.map((s, i) => {
          const d = s.items.filter((x) => x.checked).length;
          const v = s.items.length ? Math.round((d / s.items.length) * 100) : 0;
          return (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate">{s.title}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {d}/{s.items.length} · {v}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--viz-track)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(v ? 2 : 0, v)}%`, background: v === 100 ? "var(--viz-good)" : "var(--viz-1)" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {sections.length > MAX && <p className="mt-2 text-[10px] text-muted">+ {sections.length - MAX} weitere Abschnitte im Detailteil</p>}
    </>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-white/55">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, bar }: { label: string; value: string; sub: string; tone?: "good" | "bad"; bar?: number }) {
  return (
    <div className="rounded-[12px] border border-[#e3e3e8] px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div
        className={`mt-1 text-[24px] font-bold leading-none tracking-tight ${
          tone === "bad" ? "text-[#d70015]" : tone === "good" ? "text-[#1f9d3a]" : ""
        }`}
      >
        {value}
      </div>
      {bar != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--viz-track)]">
          <div className="h-full rounded-full bg-[var(--viz-good)]" style={{ width: `${bar}%` }} />
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-muted">{sub}</div>
    </div>
  );
}

function Panel({
  title,
  sub,
  accent,
  className = "",
  children,
}: {
  title: string;
  sub?: string;
  accent?: "good" | "bad";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[12px] border border-[#e3e3e8] px-4 py-3.5 ${
        accent === "bad" ? "border-l-4 border-l-[#d70015]" : accent === "good" ? "border-l-4 border-l-[#1f9d3a]" : ""
      } ${className}`}
    >
      <h2 className="text-[13px] font-semibold">{title}</h2>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Dot({ tone, children }: { tone: "good" | "bad"; children: React.ReactNode }) {
  return (
    <span
      className={`mt-px grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${
        tone === "good" ? "bg-[var(--viz-good)]" : "bg-[var(--viz-bad)]"
      }`}
    >
      {children}
    </span>
  );
}
