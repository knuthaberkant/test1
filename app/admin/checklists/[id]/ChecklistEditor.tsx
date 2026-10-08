"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sparkle, Spinner } from "@/components/InfoButton";
import Toggle from "@/components/Toggle";
import type { ChecklistFull } from "@/lib/data";

type EItem = { id: number; title: string; description: string | null; ai_description: string | null };
type ESection = EItem & { items: EItem[] };
type Draft = { name: string; description: string | null; active: boolean; sections: ESection[] };

let tempId = -1;
const nextTemp = () => tempId--;

function fromServer(c: ChecklistFull): Draft {
  return {
    name: c.name,
    description: c.description,
    active: Boolean(c.active),
    sections: c.sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      ai_description: s.ai_description,
      items: s.items.map((i) => ({ id: i.id, title: i.title, description: i.description, ai_description: i.ai_description })),
    })),
  };
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
}

export default function ChecklistEditor({ initial, aiEnabled }: { initial: ChecklistFull; aiEnabled: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => fromServer(initial));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(fn: (d: Draft) => Draft) {
    setDraft((d) => fn(structuredClone(d)));
    setDirty(true);
    setMessage(null);
  }

  async function save(): Promise<Draft | null> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/checklists/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftRef.current),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const saved = fromServer(data);
      setDraft(saved);
      draftRef.current = saved;
      setDirty(false);
      setMessage({ type: "ok", text: "Gespeichert" });
      router.refresh();
      return saved;
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error && e.message ? e.message : "Speichern fehlgeschlagen" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generate(target?: { kind: "item" | "section"; index: [number, number?] }) {
    let current = draftRef.current;
    if (dirty) {
      const saved = await save();
      if (!saved) return;
      current = saved;
    }
    const key = target ? `${target.kind}:${target.index.join(".")}` : "all";
    setGenerating(key);
    setMessage(null);
    try {
      let body = {};
      if (target) {
        const s = current.sections[target.index[0]];
        const targetId = target.kind === "section" ? s.id : s.items[target.index[1]!].id;
        body = { kind: target.kind, targetId };
      }
      const res = await fetch(`/api/admin/checklists/${initial.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(fromServer(data));
      setMessage({ type: "ok", text: "KI-Beschreibungen erstellt" });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error && e.message ? e.message : "KI-Beschreibung fehlgeschlagen" });
    } finally {
      setGenerating(null);
    }
  }

  async function remove() {
    if (!confirm(`Checkliste „${draft.name}“ löschen? Bestehende Reports bleiben erhalten.`)) return;
    await fetch(`/api/admin/checklists/${initial.id}`, { method: "DELETE" });
    router.push("/admin");
    router.refresh();
  }

  const missing = draft.sections.reduce(
    (n, s) => n + (s.ai_description ? 0 : 1) + s.items.filter((i) => !i.ai_description).length,
    0,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-8 md:px-6 md:pt-12">
      <Link href="/admin" className="link text-[15px]">‹ Alle Checklisten</Link>

      <section className="card mt-4 space-y-4 p-6">
        <input
          className="w-full bg-transparent text-[28px] font-semibold tracking-tight outline-none placeholder:text-muted/50 md:text-[36px]"
          value={draft.name}
          placeholder="Name der Checkliste"
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
        />
        <textarea
          className="input min-h-20"
          placeholder="Kurzbeschreibung des Anwendungsfalls (optional)"
          value={draft.description ?? ""}
          onChange={(e) => update((d) => ({ ...d, description: e.target.value }))}
        />
        <Toggle
          checked={draft.active}
          onChange={(v) => update((d) => ({ ...d, active: v }))}
          label="Aktiv"
          hint="Nur aktive Checklisten können von Nutzern gestartet werden."
        />
      </section>

      {aiEnabled && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-accent/10 px-5 py-4 text-[14px]">
          <Sparkle className="size-4 text-accent" />
          <span className="flex-1">
            Punkte ohne eigene Beschreibung zeigen eine KI-Erklärung.{" "}
            {missing > 0 ? `${missing} fehlen noch und werden sonst beim ersten Antippen erzeugt.` : "Alle sind vorhanden."}
          </span>
          {missing > 0 && (
            <button className="btn-primary min-h-9 px-4 text-[14px]" disabled={generating !== null} onClick={() => generate()}>
              {generating === "all" ? <><Spinner className="size-4" /> Erzeuge …</> : "Jetzt erzeugen"}
            </button>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {draft.sections.map((s, si) => (
          <section key={s.id} className="card p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-chip text-[13px] font-semibold text-muted">{si + 1}</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-[19px] font-semibold tracking-tight outline-none"
                value={s.title}
                placeholder="Abschnitt / Arbeitsphase"
                onChange={(e) => update((d) => { d.sections[si].title = e.target.value; return d; })}
              />
              <IconButton label="Nach oben" disabled={si === 0} onClick={() => update((d) => ({ ...d, sections: move(d.sections, si, si - 1) }))}>↑</IconButton>
              <IconButton label="Nach unten" disabled={si === draft.sections.length - 1} onClick={() => update((d) => ({ ...d, sections: move(d.sections, si, si + 1) }))}>↓</IconButton>
              <IconButton
                label="Abschnitt löschen"
                danger
                onClick={() => {
                  if (s.items.length && !confirm(`Abschnitt „${s.title}“ mit ${s.items.length} Punkten löschen?`)) return;
                  update((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== si) }));
                }}
              >
                ✕
              </IconButton>
            </div>
            <DescriptionField
              value={s.description}
              ai={s.ai_description}
              aiEnabled={aiEnabled}
              busy={generating === `section:${si}`}
              disabled={generating !== null}
              onChange={(v) => update((d) => { d.sections[si].description = v; return d; })}
              onGenerate={() => generate({ kind: "section", index: [si] })}
            />

            <ul className="mt-4 space-y-2">
              {s.items.map((it, ii) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  first={ii === 0}
                  last={ii === s.items.length - 1}
                  aiEnabled={aiEnabled}
                  busy={generating === `item:${si}.${ii}`}
                  disabled={generating !== null}
                  onTitle={(v) => update((d) => { d.sections[si].items[ii].title = v; return d; })}
                  onDescription={(v) => update((d) => { d.sections[si].items[ii].description = v; return d; })}
                  onMove={(dir) => update((d) => { d.sections[si].items = move(d.sections[si].items, ii, ii + dir); return d; })}
                  onDelete={() => update((d) => { d.sections[si].items.splice(ii, 1); return d; })}
                  onGenerate={() => generate({ kind: "item", index: [si, ii] })}
                />
              ))}
            </ul>
            <button
              className="mt-3 text-[15px] text-link"
              onClick={() =>
                update((d) => {
                  d.sections[si].items.push({ id: nextTemp(), title: "", description: null, ai_description: null });
                  return d;
                })
              }
            >
              + Punkt hinzufügen
            </button>
          </section>
        ))}
      </div>

      <button
        className="btn-secondary mt-4 w-full"
        onClick={() =>
          update((d) => {
            d.sections.push({ id: nextTemp(), title: `Abschnitt ${d.sections.length + 1}`, description: null, ai_description: null, items: [] });
            return d;
          })
        }
      >
        + Abschnitt hinzufügen
      </button>

      <div className="mt-10 text-center">
        <button className="text-[14px] text-danger hover:underline" onClick={remove}>Checkliste löschen</button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-nav backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <span className={`flex-1 text-[14px] ${message?.type === "error" ? "text-danger" : "text-muted"}`}>
            {message?.text ?? (dirty ? "Ungespeicherte Änderungen" : "Alle Änderungen gespeichert")}
          </span>
          <button className="btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>
    </main>
  );
}

function ItemRow(props: {
  item: EItem;
  first: boolean;
  last: boolean;
  aiEnabled: boolean;
  busy: boolean;
  disabled: boolean;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onGenerate: () => void;
}) {
  const { item } = props;
  const [expanded, setExpanded] = useState(false);
  const hasDesc = Boolean(item.description);
  return (
    <li className="rounded-2xl border border-line">
      <div className="flex items-center gap-1 py-1 pl-4 pr-1">
        <input
          className="min-h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted/60"
          placeholder="Neuer Checkpunkt"
          value={item.title}
          autoFocus={item.id < 0 && !item.title}
          onChange={(e) => props.onTitle(e.target.value)}
        />
        <button
          className={`rounded-full px-2.5 py-1 text-[12px] ${hasDesc ? "bg-accent/10 text-accent" : item.ai_description ? "bg-chip text-muted" : "text-muted"}`}
          onClick={() => setExpanded((x) => !x)}
          title="Beschreibung"
        >
          {hasDesc ? "Eigene Info" : item.ai_description ? "KI-Info" : "Info"}
        </button>
        <IconButton label="Nach oben" disabled={props.first} onClick={() => props.onMove(-1)}>↑</IconButton>
        <IconButton label="Nach unten" disabled={props.last} onClick={() => props.onMove(1)}>↓</IconButton>
        <IconButton label="Punkt löschen" danger onClick={props.onDelete}>✕</IconButton>
      </div>
      {expanded && (
        <div className="border-t border-line px-4 pb-3">
          <DescriptionField
            value={item.description}
            ai={item.ai_description}
            aiEnabled={props.aiEnabled}
            busy={props.busy}
            disabled={props.disabled || !item.title.trim()}
            onChange={props.onDescription}
            onGenerate={props.onGenerate}
          />
        </div>
      )}
    </li>
  );
}

function DescriptionField(props: {
  value: string | null;
  ai: string | null;
  aiEnabled: boolean;
  busy: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
  onGenerate: () => void;
}) {
  const custom = Boolean(props.value?.trim());
  return (
    <div className="mt-3">
      <textarea
        className="input min-h-16 text-[15px]"
        placeholder="Eigene Beschreibung (optional). Ohne eigene Beschreibung wird die KI-Erklärung angezeigt."
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {(props.ai || props.aiEnabled) && (
        <div className={`mt-2 rounded-xl bg-chip px-3 py-2 text-[13px] ${custom ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-2 font-medium text-muted">
            <Sparkle /> KI-Erklärung {custom && "(wird nicht angezeigt, da eigene Beschreibung vorhanden)"}
            {props.aiEnabled && (
              <button className="ml-auto text-link disabled:opacity-40" disabled={props.disabled} onClick={props.onGenerate}>
                {props.busy ? "Erzeuge …" : props.ai ? "Neu erzeugen" : "Erzeugen"}
              </button>
            )}
          </div>
          <p className="mt-1 text-ink/80">{props.ai ?? "Noch keine KI-Erklärung vorhanden."}</p>
        </div>
      )}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-9 shrink-0 place-items-center rounded-full text-[15px] hover:bg-chip disabled:opacity-25 ${danger ? "text-danger" : "text-muted"}`}
    >
      {children}
    </button>
  );
}
