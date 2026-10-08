import type { ReportSnapshot } from "@/lib/data";
import { formatDateTime, SOURCE_LABELS } from "@/lib/format";

export function AutoBadge({ children = "automatisch" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] font-medium text-ok">
      <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor"><circle cx="6" cy="6" r="4" /></svg>
      {children}
    </span>
  );
}

export function ManualBadge({ children = "manuell" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">
      <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="2" /></svg>
      {children}
    </span>
  );
}

export function sourceBadge(source: string | null) {
  if (!source) return null;
  const label = SOURCE_LABELS[source] ?? source;
  const isAuto = source === "ai" || source === "template" || source === "voice_ai" || source === "voice_raw";
  return isAuto ? <AutoBadge>{label}</AutoBadge> : <ManualBadge>{label}</ManualBadge>;
}

export function TimeFacts({ snapshot, durationText }: { snapshot: ReportSnapshot; durationText: string }) {
  const facts = [
    { label: "Start", value: formatDateTime(snapshot.startedAt) },
    { label: "Ende", value: formatDateTime(snapshot.completedAt) },
    { label: "Dauer", value: durationText },
  ];
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-line">
      {facts.map((f) => (
        <div key={f.label} className="bg-card p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
            {f.label} <AutoBadge />
          </div>
          <div className="mt-1 text-[15px] font-semibold md:text-[17px]">{f.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ResultList({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <div className="space-y-6">
      {snapshot.sections.map((s, si) => {
        const done = s.items.filter((i) => i.checked).length;
        return (
          <div key={si}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[17px] font-semibold">{s.title}</h3>
              <span className="text-[13px] text-muted">{done}/{s.items.length}</span>
            </div>
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
              {s.items.map((i, ii) => (
                <li key={ii} className="flex gap-3 px-4 py-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                      i.checked ? "bg-ok text-white" : "border-2 border-danger/60"
                    }`}
                  >
                    {i.checked && (
                      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.6">
                        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[15px] ${i.checked ? "" : "text-danger"}`}>
                      {i.title}
                      {!i.checked && <span className="ml-2 text-[12px]">(offen)</span>}
                    </div>
                    {i.checkedAt && <div className="text-[12px] text-muted">abgehakt {formatDateTime(i.checkedAt)}</div>}
                    {i.comment && (
                      <div className="mt-1.5 rounded-xl bg-chip px-3 py-2 text-[14px]">
                        <p className="whitespace-pre-line">{i.comment}</p>
                        <div className="mt-1.5">{sourceBadge(i.commentSource)}</div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
