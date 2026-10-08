"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import CommentSheet, { CommentEditor, type CommentResult } from "@/components/CommentSheet";
import InfoButton, { Sparkle, Spinner } from "@/components/InfoButton";
import type { Item, RunItem, Section } from "@/lib/data";

type ItemState = { checked: boolean; comment: string | null; comment_source: string | null };
type Mode = "list" | "interview";
type Info = { text: string | null; source: "custom" | "ai" | null };

const MODE_KEY = "runMode";

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
  const [mode, setMode] = useState<Mode>("list");
  const [state, setState] = useState<Record<number, ItemState>>(() =>
    Object.fromEntries(
      initialState.map((r) => [r.item_id, { checked: Boolean(r.checked), comment: r.comment, comment_source: r.comment_source }]),
    ),
  );
  const [saving, setSaving] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "list" || saved === "interview") setMode(saved);
    } catch {
      /* default mode */
    }
  }, []);

  function switchMode(m: Mode) {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* not remembered */
    }
    window.scrollTo({ top: 0 });
  }

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

  function setChecked(itemId: number, checked: boolean) {
    setState((s) => ({ ...s, [itemId]: { ...(s[itemId] ?? { comment: null, comment_source: null }), checked } }));
    void persist(itemId, { checked });
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
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-44 pt-6 md:px-6 md:pt-10">
      <Link href="/app" className="link inline-flex min-h-11 items-center text-[18px]">‹ Übersicht</Link>
      <div className="mt-2 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[34px] font-bold leading-[1.05] tracking-tight md:text-[48px]">{checklistName}</h1>
          <p className="mt-2 text-[16px] text-muted">Gestartet {startedText} · wird automatisch gespeichert</p>
        </div>
        <ProgressRing pct={pct} />
      </div>

      <div role="tablist" aria-label="Ansicht" className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-chip p-1.5">
        {(
          [
            ["list", "Liste", "M4 6h12M4 10h12M4 14h12"],
            ["interview", "Interview", "M4 5h12v8H9l-4 3v-3H4z"],
          ] as const
        ).map(([m, label, icon]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl text-[18px] font-semibold transition ${
              mode === m ? "bg-card text-ink shadow-sm" : "text-muted"
            }`}
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
              <path d={icon} />
            </svg>
            {label}
          </button>
        ))}
      </div>

      {mode === "list" ? (
        <ListMode sections={sections} state={state} initialState={initialState} onToggle={setChecked} onSaveComment={saveComment} />
      ) : (
        <InterviewMode
          sections={sections}
          state={state}
          onCheck={setChecked}
          onSaveComment={saveComment}
          onFinish={finish}
          finishing={finishing}
        />
      )}

      <div className="mt-10 text-center">
        <button onClick={discard} className="min-h-11 text-[16px] text-danger hover:underline">Durchlauf verwerfen</button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-nav backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[18px] font-semibold">{done} von {total} erledigt</span>
              <span className="text-[14px] text-muted">{saving > 0 ? "Speichert …" : error ? "" : "Gespeichert"}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-ok transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            {error && <p className="mt-1 text-[14px] text-danger">{error}</p>}
          </div>
          <button onClick={finish} disabled={finishing || saving > 0} className="btn-primary min-h-14 px-7 text-[18px]">
            Abschließen
          </button>
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- list mode */

function ListMode({
  sections,
  state,
  initialState,
  onToggle,
  onSaveComment,
}: {
  sections: Section[];
  state: Record<number, ItemState>;
  initialState: RunItem[];
  onToggle: (itemId: number, checked: boolean) => void;
  onSaveComment: (itemId: number, r: CommentResult) => Promise<void>;
}) {
  const [open, setOpen] = useState<Set<number>>(() => {
    // Fresh start: first section open. Resume: open the section where work continues.
    const resumeAt = initialState.some((r) => r.checked)
      ? sections.find((s) => s.items.some((i) => !initialState.find((r) => r.item_id === i.id)?.checked))
      : undefined;
    const first = resumeAt ?? sections[0];
    return new Set(first ? [first.id] : []);
  });
  const [commentFor, setCommentFor] = useState<Item | null>(null);

  function toggle(section: Section, item: Item) {
    const next = !state[item.id]?.checked;
    onToggle(item.id, next);
    const after = { ...state, [item.id]: { ...state[item.id], checked: next } };
    // When a section is complete, move on to the next open one.
    if (next && section.items.every((i) => after[i.id]?.checked)) {
      const idx = sections.indexOf(section);
      const following = sections.slice(idx + 1).find((s) => s.items.some((i) => !after[i.id]?.checked));
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

  return (
    <div className="mt-6 space-y-4">
      {sections.map((section, idx) => {
        const isOpen = open.has(section.id);
        const sDone = section.items.filter((i) => state[i.id]?.checked).length;
        const complete = sDone === section.items.length && section.items.length > 0;
        return (
          <section key={section.id} id={`section-${section.id}`} className="card scroll-mt-20 overflow-hidden">
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
              className="flex min-h-20 cursor-pointer select-none items-center gap-4 px-5 py-4"
            >
              <span
                className={`grid size-11 shrink-0 place-items-center rounded-full text-[18px] font-bold ${
                  complete ? "bg-ok text-white" : "bg-chip text-muted"
                }`}
              >
                {complete ? <CheckIcon className="size-6" /> : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[23px] font-bold leading-tight tracking-tight">{section.title}</h2>
                <p className="text-[16px] text-muted">{sDone} von {section.items.length} erledigt</p>
              </div>
              <InfoButton kind="section" id={section.id} title={section.title} initial={initialInfo(section)} large />
              <svg
                viewBox="0 0 16 16"
                className={`size-5 shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
                    <li key={item.id} className={`border-b border-line px-4 py-3 transition-colors last:border-b-0 ${checked ? "bg-ok/5" : ""}`}>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={item.title}
                          onClick={() => toggle(section, item)}
                          className="flex min-h-16 min-w-0 flex-1 items-center gap-4 text-left"
                        >
                          <span
                            className={`grid size-12 shrink-0 place-items-center rounded-full border-[3px] transition-all duration-200 ${
                              checked ? "border-ok bg-ok text-white" : "border-muted/40 text-transparent"
                            }`}
                          >
                            <CheckIcon className="size-7" />
                          </span>
                          <span className={`text-[20px] font-medium leading-snug ${checked ? "text-muted" : ""}`}>{item.title}</span>
                        </button>
                        <InfoButton kind="item" id={item.id} title={item.title} initial={initialInfo(item)} large />
                        <button
                          type="button"
                          aria-label="Kommentar"
                          onClick={() => setCommentFor(item)}
                          className={`grid size-12 shrink-0 place-items-center rounded-full ${st?.comment ? "bg-accent/15 text-accent" : "bg-chip text-muted"}`}
                        >
                          <svg viewBox="0 0 20 20" className="size-6" fill={st?.comment ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
                            <path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3H4A1.5 1.5 0 0 1 2.5 13V6A1.5 1.5 0 0 1 4 4.5z" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                      {st?.comment && (
                        <button
                          type="button"
                          onClick={() => setCommentFor(item)}
                          className="mb-1 ml-16 mt-1 block w-[calc(100%-4rem)] rounded-2xl bg-chip px-4 py-3 text-left text-[17px] text-ink/85"
                        >
                          {st.comment}
                        </button>
                      )}
                    </li>
                  );
                })}
                {section.items.length === 0 && <li className="px-5 py-4 text-muted">Keine Punkte in diesem Abschnitt.</li>}
              </ul>
            )}
          </section>
        );
      })}

      {commentFor && (
        <CommentSheet
          open
          onClose={() => setCommentFor(null)}
          itemId={commentFor.id}
          itemTitle={commentFor.title}
          initialComment={state[commentFor.id]?.comment ?? null}
          initialSource={state[commentFor.id]?.comment_source ?? null}
          onSave={(r) => onSaveComment(commentFor.id, r)}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------- interview mode */

function InterviewMode({
  sections,
  state,
  onCheck,
  onSaveComment,
  onFinish,
  finishing,
}: {
  sections: Section[];
  state: Record<number, ItemState>;
  onCheck: (itemId: number, checked: boolean) => void;
  onSaveComment: (itemId: number, r: CommentResult) => Promise<void>;
  onFinish: () => void;
  finishing: boolean;
}) {
  const flat = useMemo(
    () => sections.flatMap((s, si) => s.items.map((item, ii) => ({ item, section: s, sectionIndex: si, indexInSection: ii }))),
    [sections],
  );
  const [idx, setIdx] = useState(() => {
    const firstOpen = flat.findIndex((f) => !state[f.item.id]?.checked);
    return firstOpen === -1 ? flat.length : firstOpen;
  });
  const [infos, setInfos] = useState<Record<number, Info | "loading">>({});
  const [busy, setBusy] = useState(false);
  const draft = useRef<{ itemId: number; result: CommentResult } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const current = flat[idx];

  // Load the explanation for the current item and prefetch the next one.
  useEffect(() => {
    for (const f of [flat[idx], flat[idx + 1]]) {
      if (!f || infos[f.item.id]) continue;
      const initial = initialInfo(f.item);
      if (initial.text) {
        setInfos((m) => ({ ...m, [f.item.id]: initial }));
        continue;
      }
      setInfos((m) => ({ ...m, [f.item.id]: "loading" }));
      fetch(`/api/info?kind=item&id=${f.item.id}`)
        .then((r) => r.json())
        .then((info: Info) => setInfos((m) => ({ ...m, [f.item.id]: info })))
        .catch(() => setInfos((m) => ({ ...m, [f.item.id]: { text: null, source: null } })));
    }
  }, [idx, flat, infos]);

  async function flushComment() {
    const d = draft.current;
    draft.current = null;
    if (!d) return;
    const saved = state[d.itemId]?.comment ?? "";
    if (d.result.comment !== saved) await onSaveComment(d.itemId, d.result);
  }

  function go(next: number, check?: boolean) {
    if (current && check !== undefined && Boolean(state[current.item.id]?.checked) !== check) onCheck(current.item.id, check);
    void flushComment();
    setIdx(Math.max(0, Math.min(flat.length, next)));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (flat.length === 0) return <p className="card mt-6 p-8 text-center text-[18px] text-muted">Diese Checkliste hat noch keine Punkte.</p>;

  if (!current) {
    const open = flat.filter((f) => !state[f.item.id]?.checked);
    return (
      <div ref={topRef} className="card mt-6 scroll-mt-20 p-6 text-center md:p-10">
        <div className={`mx-auto grid size-20 place-items-center rounded-full ${open.length ? "bg-warn/15 text-warn" : "bg-ok text-white"}`}>
          {open.length ? <span className="text-[36px] font-bold">{open.length}</span> : <CheckIcon className="size-10" />}
        </div>
        <h2 className="mt-5 text-[28px] font-bold tracking-tight">
          {open.length ? `${open.length} Punkt${open.length === 1 ? "" : "e"} noch offen` : "Alles erledigt"}
        </h2>
        <p className="mt-2 text-[18px] text-muted">Du bist alle Punkte durchgegangen.</p>
        {open.length > 0 && (
          <ul className="mt-6 space-y-2 text-left">
            {open.map((f) => (
              <li key={f.item.id}>
                <button onClick={() => go(flat.indexOf(f))} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-chip px-4 text-left text-[18px]">
                  <span className="size-3 shrink-0 rounded-full bg-warn" />
                  <span className="flex-1">{f.item.title}</span>
                  <span className="text-link">Öffnen</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button className="btn-secondary min-h-14 px-6 text-[18px]" onClick={() => go(flat.length - 1)}>‹ Zurück</button>
          <button className="btn-primary min-h-14 px-8 text-[18px]" disabled={finishing} onClick={onFinish}>Checkliste abschließen</button>
        </div>
      </div>
    );
  }

  const { item, section, sectionIndex } = current;
  const st = state[item.id];
  const checked = Boolean(st?.checked);
  const info = infos[item.id];

  return (
    <div ref={topRef} className="mt-6 scroll-mt-20">
      {/* Step dots */}
      <div className="flex gap-1" aria-hidden>
        {flat.map((f, i) => (
          <span
            key={f.item.id}
            className={`h-2 flex-1 rounded-full ${i === idx ? "bg-accent" : state[f.item.id]?.checked ? "bg-ok" : "bg-line"}`}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[16px] text-muted">
        <span className="rounded-full bg-chip px-3 py-1 font-semibold text-ink">
          {sectionIndex + 1}. {section.title}
        </span>
        <InfoButton kind="section" id={section.id} title={section.title} initial={initialInfo(section)} large />
        <span className="ml-auto whitespace-nowrap">Punkt {idx + 1} von {flat.length}</span>
      </div>

      <article className="card mt-3 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-3">
            <h2 className="flex-1 text-[30px] font-bold leading-[1.15] tracking-tight md:text-[38px]">{item.title}</h2>
            {checked && (
              <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ok px-3 py-1.5 text-[15px] font-semibold text-white">
                <CheckIcon className="size-4" /> Erledigt
              </span>
            )}
          </div>

          <div className="mt-5 rounded-2xl bg-chip p-5">
            <p className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-wide text-muted">
              Erklärung
              {info && info !== "loading" && info.source === "ai" && (
                <span className="inline-flex items-center gap-1 normal-case tracking-normal"><Sparkle /> KI</span>
              )}
            </p>
            {info === "loading" || !info ? (
              <p className="mt-2 flex items-center gap-2 text-[18px] text-muted"><Spinner /> Wird geladen …</p>
            ) : (
              <p className="mt-2 text-[19px] leading-relaxed">{info.text ?? "Keine Erklärung hinterlegt."}</p>
            )}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[14px] font-semibold uppercase tracking-wide text-muted">Kommentar (optional)</p>
            <CommentEditor
              key={item.id}
              itemId={item.id}
              initialComment={st?.comment ?? null}
              initialSource={st?.comment_source ?? null}
              onChange={(result) => (draft.current = { itemId: item.id, result })}
              onBusyChange={setBusy}
              large
            />
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-3 border-t border-line bg-card-2 p-4 md:p-5">
          <button
            className="btn-secondary min-h-16 px-5 text-[18px]"
            disabled={busy || idx === 0}
            onClick={() => go(idx - 1)}
            aria-label="Vorheriger Punkt"
          >
            ‹
          </button>
          {checked ? (
            <button className="btn min-h-16 bg-ok text-[20px] font-semibold text-white" disabled={busy} onClick={() => go(idx + 1, true)}>
              Weiter ›
            </button>
          ) : (
            <button className="btn min-h-16 bg-ok text-[20px] font-semibold text-white" disabled={busy} onClick={() => go(idx + 1, true)}>
              <CheckIcon className="size-6" /> Erledigt
            </button>
          )}
          <span />
          <button className="min-h-12 text-[17px] text-link disabled:opacity-40" disabled={busy} onClick={() => go(idx + 1, checked ? false : undefined)}>
            {checked ? "Doch nicht erledigt, als offen markieren" : "Überspringen, bleibt offen"}
          </button>
        </div>
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function initialInfo(x: { description: string | null; ai_description: string | null }): Info {
  return {
    text: x.description || x.ai_description,
    source: x.description ? "custom" : x.ai_description ? "ai" : null,
  };
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[72px] shrink-0 place-items-center" role="img" aria-label={`${pct} Prozent erledigt`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--viz-track)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ok)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} className="transition-all duration-500" />
      </svg>
      <span className="text-[17px] font-bold">{pct}%</span>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
