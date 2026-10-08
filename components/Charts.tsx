// Dependency-free SVG charts. Colors come from the --viz-* tokens in globals.css (light and dark).
// Hover detail uses native <title> tooltips so the charts also work in server components and print.

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "good" | "bad";
}) {
  return (
    <div className="card break-inside-avoid p-5">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div
        className={`mt-1 text-[32px] font-bold leading-none tracking-tight md:text-[40px] ${
          tone === "good" ? "text-ok" : tone === "bad" ? "text-danger" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-[13px] text-muted">{sub}</div>}
    </div>
  );
}

/** Done vs. open as a donut with the completion rate in the middle. */
export function CompletionDonut({ done, open, size = 180 }: { done: number; open: number; size?: number }) {
  const total = done + open;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const r = 70;
  const c = 2 * Math.PI * r;
  const gap = total && done && open ? 4 : 0; // 2px surface gap on each side between segments
  const doneLen = total ? (c * done) / total : 0;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 180 180" width={size} height={size} role="img" aria-label={`${pct} Prozent erledigt, ${done} erledigt, ${open} offen`}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--viz-track)" strokeWidth="22" />
        {open > 0 && (
          <circle
            cx="90" cy="90" r={r} fill="none" stroke="var(--viz-bad)" strokeWidth="22"
            strokeDasharray={`${Math.max(0, c - doneLen - gap)} ${c}`}
            strokeDashoffset={-(doneLen + gap / 2)}
            transform="rotate(-90 90 90)"
          >
            <title>{`Offen: ${open}`}</title>
          </circle>
        )}
        {done > 0 && (
          <circle
            cx="90" cy="90" r={r} fill="none" stroke="var(--viz-good)" strokeWidth="22"
            strokeDasharray={`${Math.max(0, doneLen - gap)} ${c}`}
            strokeDashoffset={-gap / 2}
            transform="rotate(-90 90 90)"
          >
            <title>{`Erledigt: ${done}`}</title>
          </circle>
        )}
        <text x="90" y="88" textAnchor="middle" fontSize="40" fontWeight="700" fill="var(--ink)">{pct}%</text>
        <text x="90" y="114" textAnchor="middle" fontSize="15" fill="var(--muted)">erledigt</text>
      </svg>
      <ul className="space-y-3 text-[15px]">
        <LegendRow color="var(--viz-good)" icon="✓" label="Erledigt" value={done} />
        <LegendRow color="var(--viz-bad)" icon="!" label="Offen" value={open} />
      </ul>
    </div>
  );
}

function LegendRow({ color, icon, label, value }: { color: string; icon: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="grid size-5 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
        {icon}
      </span>
      <span className="text-muted">{label}</span>
      <span className="ml-auto pl-3 font-semibold tabular-nums">{value}</span>
    </li>
  );
}

/** Horizontal bars, one hue; value printed at the end of each bar. */
export function BarList({
  rows,
  max,
  format = (v) => String(v),
}: {
  rows: { label: React.ReactNode; value: number; hint?: string; tone?: "good" | "bad" }[];
  max?: number;
  format?: (v: number) => string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-4 text-[14px] text-muted">Keine Daten im gewählten Zeitraum.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={i} className="group break-inside-avoid" title={r.hint}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{format(r.value)}</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--viz-track)]">
            <div
              className="h-full rounded-full transition-opacity group-hover:opacity-80"
              style={{
                width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%`,
                background: r.tone === "good" ? "var(--viz-good)" : r.tone === "bad" ? "var(--viz-bad)" : "var(--viz-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns over time (e.g. reports per day). */
export function ColumnChart({ points, unit = "" }: { points: { label: string; value: number; tick?: boolean }[]; unit?: string }) {
  const W = 640;
  const H = 180;
  const padL = 28;
  const padB = 24;
  const top = Math.max(1, ...points.map((p) => p.value));
  const niceTop = top <= 4 ? top : Math.ceil(top / 2) * 2;
  const bw = (W - padL) / Math.max(points.length, 1);
  const barW = Math.max(2, bw - 2); // 2px surface gap between adjacent bars
  const padT = 10;
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / niceTop);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Säulendiagramm">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W} y1={y(niceTop * f)} y2={y(niceTop * f)} stroke="var(--viz-grid)" />
          <text x={padL - 6} y={y(niceTop * f) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {Math.round(niceTop * f)}
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const x = padL + i * bw + 1;
        const h = (H - padB) - y(p.value);
        return (
          <g key={i}>
            {p.value > 0 && (
              <path
                d={`M${x},${H - padB} v${-(h - Math.min(4, h))} q0,${-Math.min(4, h)} ${Math.min(4, barW / 2)},${-Math.min(4, h)} h${barW - 2 * Math.min(4, barW / 2)} q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, h)} V${H - padB} z`}
                fill="var(--viz-1)"
              />
            )}
            <rect x={x - 1} y={0} width={bw} height={H - padB} fill="transparent">
              <title>{`${p.label}: ${p.value}${unit}`}</title>
            </rect>
            {p.tick && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {p.label}
              </text>
            )}
          </g>
        );
      })}
      <line x1={padL} x2={W} y1={H - padB} y2={H - padB} stroke="var(--line)" />
    </svg>
  );
}

/** Cumulative checked items over the duration of a run. */
export function ProgressTimeline({
  start,
  end,
  times,
  total,
}: {
  start: string;
  end: string;
  times: string[];
  total: number;
}) {
  const W = 640;
  const H = 170;
  const padL = 28;
  const padB = 24;
  const t0 = new Date(start).getTime();
  const t1 = Math.max(new Date(end).getTime(), t0 + 1);
  const sorted = times.map((t) => new Date(t).getTime()).filter((t) => t >= t0).sort((a, b) => a - b);
  const x = (t: number) => padL + ((W - padL) * (Math.min(t, t1) - t0)) / (t1 - t0);
  const padT = 10;
  const y = (n: number) => padT + (H - padB - padT) * (1 - n / Math.max(total, 1));
  let d = `M${x(t0)},${y(0)}`;
  sorted.forEach((t, i) => {
    d += ` H${x(t)} V${y(i + 1)}`;
  });
  d += ` H${x(t1)}`;
  const fmt = (t: number) => new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Fortschritt: ${sorted.length} von ${total} Punkten über die Bearbeitungszeit`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W} y1={y(total * f)} y2={y(total * f)} stroke="var(--viz-grid)" />
          <text x={padL - 6} y={y(total * f) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(total * f)}</text>
        </g>
      ))}
      <path d={`${d} V${y(0)} H${x(t0)} Z`} fill="var(--viz-1)" opacity="0.12" />
      <path d={d} fill="none" stroke="var(--viz-1)" strokeWidth="2" strokeLinejoin="round" />
      {sorted.map((t, i) => (
        <circle key={i} cx={x(t)} cy={y(i + 1)} r="4" fill="var(--viz-1)" stroke="var(--card)" strokeWidth="2">
          <title>{`${fmt(t)}: ${i + 1} von ${total} erledigt`}</title>
        </circle>
      ))}
      <line x1={padL} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" />
      <text x={padL} y={H - 6} fontSize="11" fill="var(--muted)">{fmt(t0)}</text>
      <text x={W} y={H - 6} textAnchor="end" fontSize="11" fill="var(--muted)">{fmt(t1)}</text>
    </svg>
  );
}
