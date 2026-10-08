"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import CommentSheet, { type CommentResult } from "@/components/CommentSheet";
import InfoButton from "@/components/InfoButton";
import type { RunItem, Section } from "@/lib/data";

type ItemState = { checked: boolean; comment: string | null; comment_source: string | null };

export default function RunView({
  runId,
  checklistName,
  sections,
  initialState,
  startedAt,
}: {
  runId: number;
  checklistName: string;
  sections: Section[];
  initialState: RunItem[];
  startedAt: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<number, ItemState>>(() =>
    Object.fromEntries(
      initialState.map((r) => [r.item_id, { checked: Boolean(r.checked), comment: r.comment, comment_source: r.comment_source }]),
    ),
  );
  const [open, setOpen] = useState<Set<number>>(() => {
    // Fresh start: first section open. Resume: open the section where work continues.
    const resumeAt = initialState.some((r) => r.checked)
      ? sections.find((s) => s.items.some((i) => !initialState.find((r) => r.item_id === i.id)?.checked))
      : undefined;
    const first = resumeAt ?? sections[0];
    return new Set(first ? [first.id] : []);
  });
  const [commentFor, setCommentFor] = useState<{ id: number; title: string } | null>(null);
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const done = allItems.filter((i) => state[i.id]?.checked).length;
  const total = allItems.length;

  async function persist(itemId: number, body: object) {
    setSaving((n) => n + 1);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = await res.json();
      setState((s) => ({
        ...s,
        [itemId]: { checked: Boolean(saved.checked), comment: saved.comment, comment_source: saved.comment_source },
      }));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Speichern fehlgeschlagen. Bitte Verbindung prüfen.");
    } finally {
      setSaving((n) => n - 1);
    }
  }

  function toggle(section: Section, itemId: number) {
    const next = !state[itemId]?.checked;
    const newState = { ...state, [itemId]: { ...(state[itemId] ?? { comment: null, comment_source: null }), checked: next } };
    setState(newState);
    void persist(itemId, { checked: next });
    // When a section is complete, move on to the next open one.
    if (next && section.items.every((i) => newState[i.id]?.checked)) {
      const idx = sections.indexOf(section);
      const following = sections.slice(idx + 1).find((s) => s.items.some((i) => !newState[i.id]?.checked));
      if (following) {
        setTimeout(() => {
          setOpen((o) => {
            const n = new Set(o);
            n.delete(section.id);
            n.add(following.id);
            return n;
          });
          document.getElementById(`section-${following.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 450);
      }
    }
  }

  async function saveComment(itemId: number, r: CommentResult) {
    await persist(itemId, { comment: r.comment, commentSource: r.source, commentOriginal: r.original });
  }

  async function finish() {
    const open = total - done;
    if (open > 0 && !confirm(`${open} Punkt${open === 1 ? " ist" : "e sind"} noch offen. Trotzdem abschließen?`)) return;
    setFinishing(true);
    const res = await fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (!res.ok) {
      setFinishing(false);
      setError((await res.json()).error ?? "Abschließen fehlgeschlagen");
      return;
    }
    router.push(`/app/run/${runId}/report`);
  }

  async function discard() {
    if (!confirm("Diesen Durchlauf verwerfen? Alle Eingaben gehen verloren.")) return;
    await fetch(`/api/runs/${runId}`, { method: "DELETE" });
    router.push("/app");
  }

  const startedText = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(startedAt));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-8 md:px-6 md:pt-12">
      <Link href="/app" className="link text-[15px]">‹ Übersicht</Link>
      <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight md:text-[44px]">{checklistName}</h1>
      <p className="mt-1 text-[15px] text-muted">Gestartet {startedText} · Fortschritt wird automatisch gespeichert</p>

      <div className="mt-8 space-y-3">
        {sections.map((section, idx) => {
          const isOpen = open.has(section.id);
          const sDone = section.items.filter((i) => state[i.id]?.checked).length;
          const complete = sDone === section.items.length && section.items.length > 0;
          return (
            <section key={section.id} id={`section-${section.id}`} className="card scroll-mt-16 overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((o) => {
                    const n = new Set(o);
                    if (n.has(section.id)) n.delete(section.id);
                    else n.add(section.id);
                    return n;
                  })
                }
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLElement).click()}
                className="flex min-h-16 cursor-pointer select-none items-center gap-3 px-5 py-4"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
                    complete ? "bg-ok text-white" : "bg-chip text-muted"
                  }`}
                >
                  {complete ? <CheckIcon className="size-4" /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[19px] font-semibold tracking-tight">{section.title}</h2>
                  <p className="text-[13px] text-muted">
                    {sDone} von {section.items.length} erledigt
                  </p>
                </div>
                <InfoButton
                  kind="section"
                  id={section.id}
                  title={section.title}
                  initial={{
                    text: section.description || section.ai_description,
                    source: section.description ? "custom" : section.ai_description ? "ai" : null,
                  }}
                />
                <svg
                  viewBox="0 0 16 16"
                  className={`size-4 shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {isOpen && (
                <ul className="border-t border-line">
                  {section.items.map((item) => {
                    const st = state[item.id];
                    const checked = Boolean(st?.checked);
                    return (
                      <li key={item.id} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-b-0">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={item.title}
                          onClick={() => toggle(section, item.id)}
                          className="-m-1.5 grid size-11 shrink-0 place-items-center"
                        >
                          <span
                            className={`grid size-7 place-items-center rounded-full border-2 transition-all duration-200 ${
                              checked ? "scale-100 border-accent bg-accent text-white" : "border-muted/40 text-transparent"
                            }`}
                          >
                            <CheckIcon className="size-4" />
                          </span>
                        </button>
                        <div className="min-w-0 flex-1 pt-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(section, item.id)}
                            className={`text-left text-[17px] leading-snug transition-colors ${checked ? "text-muted line-through decoration-muted/50" : ""}`}
                          >
                            {item.title}
                          </button>
                          {st?.comment && (
                            <button
                              type="button"
                              onClick={() => setCommentFor({ id: item.id, title: item.title })}
                              className="mt-1 block w-full rounded-xl bg-chip px-3 py-2 text-left text-[14px] text-ink/80"
                            >
                              {st.comment}
                            </button>
                          )}
                          {checked && !st?.comment && (
                            <button
                              type="button"
                              onClick={() => setCommentFor({ id: item.id, title: item.title })}
                              className="mt-1 text-[14px] text-link"
                            >
                              + Kommentar hinzufügen
                            </button>
                          )}
                        </div>
                        <div className="flex items-center pt-1">
                          <InfoButton
                            kind="item"
                            id={item.id}
                            title={item.title}
                            initial={{
                              text: item.description || item.ai_description,
                              source: item.description ? "custom" : item.ai_description ? "ai" : null,
                            }}
                          />
                          <button
                            type="button"
                            aria-label="Kommentar"
                            onClick={() => setCommentFor({ id: item.id, title: item.title })}
                            className={`grid size-9 place-items-center rounded-full hover:bg-chip ${st?.comment ? "text-accent" : "text-muted"}`}
                          >
                            <svg viewBox="0 0 20 20" className="size-[18px]" fill={st?.comment ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                              <path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3H4A1.5 1.5 0 0 1 2.5 13V6A1.5 1.5 0 0 1 4 4.5z" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {section.items.length === 0 && <li className="px-5 py-4 text-muted">Keine Punkte in diesem Abschnitt.</li>}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <button onClick={discard} className="text-[14px] text-danger hover:underline">Durchlauf verwerfen</button>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-nav backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{done} von {total} erledigt</span>
              <span className="text-muted">{saving > 0 ? "Speichert …" : error ? "" : "Gespeichert"}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
            {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
          </div>
          <Link href="/app" className="btn-secondary hidden sm:inline-flex">Später fortsetzen</Link>
          <button onClick={finish} disabled={finishing || saving > 0} className="btn-primary">
            Abschließen
          </button>
        </div>
      </div>

      {commentFor && (
        <CommentSheet
          open
          onClose={() => setCommentFor(null)}
          itemId={commentFor.id}
          itemTitle={commentFor.title}
          initialComment={state[commentFor.id]?.comment ?? null}
          initialSource={state[commentFor.id]?.comment_source ?? null}
          onSave={(r) => saveComment(commentFor.id, r)}
        />
      )}
    </main>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
