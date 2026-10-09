import { CompletionDonut, ProgressTimeline } from "@/components/Charts";
import type { ReportSnapshot, Run } from "@/lib/data";
import { formatDateTime, formatDuration, SOURCE_LABELS } from "@/lib/format";

// Print-only layout of a signed report (A4 portrait, ~186 mm content width ≈ 700 px), styled like a
// paper inspection log ("Kladde"): squared paper, form boxes, a rubber stamp for the result.
// Values the system recorded are set in a typewriter face, what a person wrote (comments,
// signature) in handwriting with blue pen, so the provenance is visible at a glance.
// Page 1 is a one-page dashboard; the item log follows on page 2 and later, broken only
// between items.

export type Provenance = { field: string; how: string; auto: boolean };

const INK = "#1b1b1b";
const PEN = "#1d3f91";
const RED = "#c8102e";
const GREEN = "#1f7a35";

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
  const openItems = snap.sections.flatMap((s, si) =>
    s.items.map((i, ii) => ({ ...i, no: `${si + 1}.${ii + 1}`, section: s.title })).filter((i) => !i.checked),
  );
  const checkTimes = items.map((i) => i.checkedAt).filter((t): t is string => Boolean(t));
  const place =
    run.location_label ??
    (run.location_lat != null ? `${run.location_lat.toFixed(5)}, ${run.location_lng?.toFixed(5)}` : "nicht ermittelbar");
  const footer = `Prüfprotokoll Nr. ${run.id} · ${snap.checklistName}`;
  const MAX_OPEN = 4;
  // Keeps page 1 on one sheet; a long summary is shown in full at the start of the log.
  const longSummary = (run.summary ?? "").length > 340;

  return (
    <div className="print-report hidden text-[12px] leading-snug print:block" style={{ color: INK }}>
      {/* Handwriting face for human input; falls back to a system cursive when offline. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Courier+Prime:wght@400;700&display=swap" />
      {/* Paper color on every sheet (a background image on @page breaks Chromium's PDF output, so the grid sits on the item table), running footer with page numbers (Chromium/Edge print). */}
      <style>{`@page {
          background-color: #fffdf6;
          @bottom-left { content: ${JSON.stringify(footer)}; font: 9px "Courier New", monospace; color: #6b6b6b; }
          @bottom-right { content: "Blatt " counter(page) " von " counter(pages); font: 9px "Courier New", monospace; color: #6b6b6b; }
        }
        @media print { body { background: transparent !important; }
          .print-report table { background-image: linear-gradient(rgba(70,110,170,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(70,110,170,.13) 1px, transparent 1px); background-size: 5mm 5mm; } }`}</style>

      {/* ---------- Page 1: dashboard ---------- */}
      <section className="print-page-1">
        <header className="relative shrink-0 border-2 bg-paper" style={{ borderColor: INK }}>
          <div className="flex items-stretch border-b" style={{ borderColor: INK }}>
            <div className="min-w-0 flex-1 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em]">Prüfprotokoll</p>
              <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">{snap.checklistName}</h1>
            </div>
            <div className="flex w-[92px] shrink-0 flex-col items-center justify-center border-l" style={{ borderColor: INK }}>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Nr.</span>
              <span className="type text-[26px] font-bold leading-none">{String(run.id).padStart(4, "0")}</span>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1.3fr] divide-x" style={{ borderColor: INK }}>
            <FormField label="Prüfer/in" value={snap.userName} />
            <FormField label="Datum" value={formatDateTime(run.signed_at)} />
            <FormField label="Ort" value={place} />
          </div>
          <Stamp open={open} />
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mt-3 grid shrink-0 grid-cols-4 gap-2">
            <Kpi label="Erfüllung" value={`${pct} %`} sub={`${done} von ${items.length} Punkten`} bar={pct} />
            <Kpi label="Offen" value={String(open)} sub={open ? "siehe Liste" : "keine"} tone={open ? "bad" : "good"} />
            <Kpi label="Dauer" value={formatDuration(snap.durationMs)} sub={`${formatTime(snap.startedAt)} – ${formatTime(snap.completedAt)} Uhr`} />
            <Kpi label="Bemerkungen" value={String(comments)} sub={`zu ${comments} von ${items.length} Punkten`} />
          </div>

          <div className="mt-2 grid shrink-0 grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-2">
            <Box no="1" title="Ergebnis">
              <CompletionDonut done={done} open={open} size={112} />
            </Box>
            <Box no="2" title="Erfüllung je Abschnitt">
              <SectionBars sections={snap.sections} />
            </Box>
          </div>

          {checkTimes.length > 0 && (
            <Box no="3" title="Zeitverlauf" sub="Abgehakte Punkte über die Bearbeitungszeit" className="mt-2 shrink-0">
              <ProgressTimeline start={snap.startedAt} end={snap.completedAt} times={checkTimes} total={items.length} height={120} />
            </Box>
          )}

          <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2">
            <Box no="4" title="Zusammenfassung" className="overflow-hidden">
              <p className={`whitespace-pre-line text-[11.5px] leading-[1.55] ${longSummary ? "line-clamp-[10]" : ""}`}>{run.summary}</p>
              {longSummary && <p className="mt-1 text-[10px] text-[#6b6b6b]">Vollständiger Text im Protokollteil.</p>}
            </Box>
            <Box no="5" title={open ? `Offene Punkte (${open})` : "Offene Punkte"} className="overflow-hidden">
              {open === 0 ? (
                <p className="flex items-center gap-2 text-[12px]">
                  <CheckBox mark="check" /> Alle Punkte wurden erledigt.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {openItems.slice(0, MAX_OPEN).map((i) => (
                    <li key={i.no} className="flex gap-2">
                      <CheckBox mark="cross" />
                      <span className="min-w-0">
                        <span className="type mr-1 text-[10.5px]">{i.no}</span>
                        {i.title} <span className="text-[#6b6b6b]">· {i.section}</span>
                      </span>
                    </li>
                  ))}
                  {openItems.length > MAX_OPEN && (
                    <li className="pl-6 text-[#6b6b6b]">+ {openItems.length - MAX_OPEN} weitere, siehe Protokollteil</li>
                  )}
                </ul>
              )}
            </Box>
          </div>
        </div>

        <SignatureBlock run={run} place={place} className="mt-2 shrink-0" />
      </section>

      {/* ---------- Page 2+: item log ---------- */}
      <section className="print-details">
        <div className="flex items-baseline justify-between border-b-2 pb-1" style={{ borderColor: INK }}>
          <h2 className="text-[18px] font-bold tracking-tight">Prüfpunkte</h2>
          <span className="type text-[10.5px]">
            {snap.sections.length} Abschnitte · {items.length} Punkte · {done} i. O. · {open} offen
          </span>
        </div>

        {longSummary && (
          <Box title="Zusammenfassung" className="print-avoid mt-3">
            <p className="whitespace-pre-line text-[11.5px] leading-[1.55]">{run.summary}</p>
          </Box>
        )}

        <table className="mt-3 w-full border-collapse text-left">
          <thead className="print-thead">
            <tr className="text-[9px] font-bold uppercase tracking-[0.12em]">
              <th className="w-9 border-b py-1.5 pl-1" style={{ borderColor: INK }}>Nr.</th>
              <th className="border-b py-1.5" style={{ borderColor: INK }}>Prüfpunkt</th>
              <th className="w-9 border-b py-1.5 text-center" style={{ borderColor: INK }}>i. O.</th>
              <th className="w-9 border-b py-1.5 text-center" style={{ borderColor: INK }}>offen</th>
              <th className="w-[38%] border-b py-1.5 pl-3" style={{ borderColor: INK }}>Bemerkung</th>
            </tr>
          </thead>
          {snap.sections.map((s, si) => {
            const d = s.items.filter((i) => i.checked).length;
            return (
              <tbody key={si} className="print-section">
                <tr className="print-keep-with-next">
                  <td colSpan={5} className="border-b pt-3 pb-1" style={{ borderColor: INK }}>
                    <div className="flex items-baseline gap-2">
                      <span className="type text-[12px] font-bold">{si + 1}.</span>
                      <span className="flex-1 text-[13px] font-bold uppercase tracking-wide">{s.title}</span>
                      <span className="type text-[10.5px]">
                        {d}/{s.items.length} · {s.items.length ? Math.round((d / s.items.length) * 100) : 0} %
                      </span>
                    </div>
                  </td>
                </tr>
                {s.items.map((i, ii) => (
                  <tr key={ii} className="align-top">
                    <td className="type border-b border-[#b9c3d3] py-2 pl-1 text-[10.5px]">
                      {si + 1}.{ii + 1}
                    </td>
                    <td className="border-b border-[#b9c3d3] py-2 pr-2">
                      <div className="text-[12px] font-medium">{i.title}</div>
                      <div className="type mt-0.5 text-[9.5px] text-[#6b6b6b]">
                        {i.checkedAt ? `erledigt ${formatDateTime(i.checkedAt)}` : "nicht erledigt"}
                      </div>
                    </td>
                    <td className="border-b border-[#b9c3d3] py-2">
                      <div className="flex justify-center">
                        <CheckBox mark={i.checked ? "check" : null} />
                      </div>
                    </td>
                    <td className="border-b border-[#b9c3d3] py-2">
                      <div className="flex justify-center">
                        <CheckBox mark={i.checked ? null : "cross"} />
                      </div>
                    </td>
                    <td className="border-b border-l border-[#b9c3d3] py-1.5 pl-3">
                      {i.comment ? (
                        <>
                          <div className="hand whitespace-pre-line text-[16px] leading-[1.15]" style={{ color: PEN }}>
                            {i.comment}
                          </div>
                          <div className="mt-0.5 text-[9px] text-[#6b6b6b]">{SOURCE_LABELS[i.commentSource ?? ""] ?? ""}</div>
                        </>
                      ) : (
                        <span className="text-[#b9c3d3]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>

        <div className="print-avoid mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
          <Box title="Herkunft der Angaben">
            <p className="mb-1.5 text-[9.5px] text-[#6b6b6b]">
              <span className="type">Maschinenschrift</span> = automatisch erfasst,{" "}
              <span className="hand text-[13px]" style={{ color: PEN }}>Handschrift</span> = von Hand eingegeben
            </p>
            <ul>
              {provenance.map((p) => (
                <li key={p.field} className="flex items-baseline gap-2 border-b border-[#d5dbe5] py-1 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium">{p.field}</span>
                    <span className="block text-[9.5px] text-[#6b6b6b]">{p.how}</span>
                  </span>
                  {p.auto ? (
                    <span className="type shrink-0 text-[10px]">automatisch</span>
                  ) : (
                    <span className="hand shrink-0 text-[15px] leading-none" style={{ color: PEN }}>
                      manuell
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Box>
          <SignatureBlock run={run} place={place} stacked />
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
                <span className="min-w-0 truncate">
                  <span className="type mr-1">{i + 1}.</span>
                  {s.title}
                </span>
                <span className="type shrink-0 text-[10.5px] font-bold">
                  {d}/{s.items.length} · {v} %
                </span>
              </div>
              <div className="mt-1 h-2 border border-[#9aa6ba] bg-white">
                <div className="h-full" style={{ width: `${v}%`, background: v === 100 ? "var(--viz-good)" : "var(--viz-1)" }} />
              </div>
            </li>
          );
        })}
      </ul>
      {sections.length > MAX && <p className="mt-2 text-[10px] text-[#6b6b6b]">+ {sections.length - MAX} weitere Abschnitte im Protokollteil</p>}
    </>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
}

function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-2" style={{ borderColor: INK }}>
      <div className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#555]">{label}</div>
      <div className="type mt-0.5 truncate text-[12px]">{value}</div>
    </div>
  );
}

/** Rubber stamp with the overall result. */
function Stamp({ open }: { open: number }) {
  const color = open ? RED : GREEN;
  return (
    <div
      className="pointer-events-none absolute right-[110px] top-[10px] rotate-[-7deg] rounded-[6px] border-[3px] px-3 py-1 text-center opacity-85"
      style={{ borderColor: color, color, boxShadow: `inset 0 0 0 2px #fffdf6, inset 0 0 0 3.5px ${color}` }}
    >
      <div className="text-[15px] font-black uppercase leading-none tracking-[0.12em]">
        {open ? `${open} Punkt${open === 1 ? "" : "e"} offen` : "Erledigt"}
      </div>
      <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.3em]">{open ? "Nacharbeit nötig" : "Vollständig geprüft"}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone, bar }: { label: string; value: string; sub: string; tone?: "good" | "bad"; bar?: number }) {
  return (
    <div className="border-[1.5px] bg-paper px-3 py-2.5" style={{ borderColor: INK }}>
      <div className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#555]">{label}</div>
      <div
        className="type mt-1 text-[22px] font-bold leading-none"
        style={{ color: tone === "bad" ? RED : tone === "good" ? GREEN : INK }}
      >
        {value}
      </div>
      {bar != null && (
        <div className="mt-1.5 h-1.5 border border-[#9aa6ba] bg-white">
          <div className="h-full bg-[var(--viz-good)]" style={{ width: `${bar}%` }} />
        </div>
      )}
      <div className="mt-1 text-[9.5px] text-[#6b6b6b]">{sub}</div>
    </div>
  );
}

function Box({
  no,
  title,
  sub,
  className = "",
  children,
}: {
  no?: string;
  title: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`border-[1.5px] bg-paper ${className}`} style={{ borderColor: INK }}>
      <div className="flex items-baseline gap-2 border-b px-3 py-1.5" style={{ borderColor: INK }}>
        {no && <span className="type text-[11px] font-bold">{no}.</span>}
        <h2 className="text-[10.5px] font-bold uppercase tracking-[0.14em]">{title}</h2>
        {sub && <span className="ml-auto truncate text-[9px] text-[#6b6b6b]">{sub}</span>}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}

function SignatureBlock({ run, place, stacked = false, className = "" }: { run: Run; place: string; stacked?: boolean; className?: string }) {
  return (
    <div className={`border-[1.5px] bg-paper px-4 pb-2.5 pt-2 ${className}`} style={{ borderColor: INK }}>
      {stacked && <p className="mb-1 text-[10.5px]">Die Prüfung wurde wie in diesem Protokoll dokumentiert durchgeführt.</p>}
      <div className={stacked ? "" : "flex items-end gap-6"}>
        <div className={stacked ? "" : "flex-1"}>
          <div className="relative h-14">
            {run.signature && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={run.signature} alt={`Unterschrift ${run.signer_name}`} className="absolute bottom-0 left-2 h-14 w-48 object-contain object-left-bottom" />
            )}
          </div>
          <div className="border-t" style={{ borderColor: INK }} />
          <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#555]">Unterschrift {run.signer_name}</div>
        </div>
        <div className={`grid grid-cols-2 gap-6 ${stacked ? "mt-3" : "w-[46%]"}`}>
          <div>
            <div className="type border-b pb-0.5 text-[11.5px]" style={{ borderColor: INK }}>{formatDateTime(run.signed_at)}</div>
            <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#555]">Datum</div>
          </div>
          <div className="min-w-0">
            <div className="type truncate border-b pb-0.5 text-[11.5px]" style={{ borderColor: INK }}>{place}</div>
            <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#555]">Ort</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Square tick box, filled in with a pen stroke. */
function CheckBox({ mark }: { mark: "check" | "cross" | null }) {
  return (
    <span className="relative inline-block size-[15px] shrink-0 border-[1.5px] bg-white" style={{ borderColor: INK }}>
      {mark && (
        <svg viewBox="0 0 20 20" className="absolute -left-[3px] -top-[5px] size-[22px] overflow-visible" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {mark === "check" ? (
            <path d="M3.5 10.5c1.6 1.4 3 3.2 4.2 5.3C10.6 9.6 14 5.2 18.5 1.8" stroke={PEN} strokeWidth="2.4" />
          ) : (
            <path d="M4.5 5.2c3.4 3.6 7 7.6 10.6 11.3M15.4 4.6C11.6 8.1 8 12 4.8 16" stroke={RED} strokeWidth="2.2" />
          )}
        </svg>
      )}
    </span>
  );
}
