"use client";

import { useState } from "react";
import Sheet from "./Sheet";

type Info = { text: string | null; source: "custom" | "ai" | null };

export default function InfoButton({
  kind,
  id,
  title,
  initial,
}: {
  kind: "item" | "section";
  id: number;
  title: string;
  initial?: Info;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Info | null>(initial?.text ? initial : null);
  const [loading, setLoading] = useState(false);

  async function show(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen(true);
    if (info) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/info?kind=${kind}&id=${id}`);
      setInfo(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={`Erklärung zu ${title}`}
        className="grid size-7 shrink-0 place-items-center rounded-full text-accent hover:bg-accent/10"
      >
        <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="8.25" />
          <path d="M10 9v5" strokeLinecap="round" />
          <circle cx="10" cy="6.25" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {loading && (
          <div className="flex items-center gap-3 py-6 text-muted">
            <Spinner /> Erklärung wird erstellt …
          </div>
        )}
        {!loading && info?.text && (
          <>
            <p className="whitespace-pre-line text-[17px] leading-relaxed">{info.text}</p>
            {info.source === "ai" && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-[12px] text-muted">
                <Sparkle /> KI-generierte Erklärung
              </p>
            )}
          </>
        )}
        {!loading && !info?.text && <p className="py-6 text-muted">Für diesen Punkt ist keine Erklärung hinterlegt.</p>}
      </Sheet>
    </>
  );
}

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin`} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor">
      <path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" />
    </svg>
  );
}
