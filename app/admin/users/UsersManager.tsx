"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Chevron from "@/components/Chevron";
import Sheet from "@/components/Sheet";
import Toggle from "@/components/Toggle";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  default_checklist_id: number | null;
  locked_to_default: number;
  active: number;
  reports: number;
};

type Form = {
  id?: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  default_checklist_id: number | null;
  locked_to_default: boolean;
  active: boolean;
};

const empty: Form = { name: "", email: "", password: "", role: "user", default_checklist_id: null, locked_to_default: false, active: true };

export default function UsersManager({
  users,
  checklists,
  meId,
}: {
  users: UserRow[];
  checklists: { id: number; name: string }[];
  meId: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (id: number | null) => checklists.find((c) => c.id === id)?.name;

  async function submit() {
    if (!form) return;
    setBusy(true);
    setError(null);
    const res = await fetch(form.id ? `/api/admin/users/${form.id}` : "/api/admin/users", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Speichern fehlgeschlagen");
      return;
    }
    setForm(null);
    router.refresh();
  }

  return (
    <>
      <div className="mt-8 flex justify-end">
        <button className="btn-primary" onClick={() => { setError(null); setForm({ ...empty }); }}>Neuer Nutzer</button>
      </div>
      <div className="card mt-4 divide-y divide-line">
        {users.map((u) => (
          <button
            key={u.id}
            className={`flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-chip/50 ${u.active ? "" : "opacity-50"}`}
            onClick={() => {
              setError(null);
              setForm({
                id: u.id, name: u.name, email: u.email, password: "", role: u.role,
                default_checklist_id: u.default_checklist_id, locked_to_default: Boolean(u.locked_to_default), active: Boolean(u.active),
              });
            }}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/80 to-accent text-[15px] font-semibold text-white">
              {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{u.name}</span>
                {u.role === "admin" && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">Admin</span>}
                {!u.active && <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] text-muted">deaktiviert</span>}
              </div>
              <div className="truncate text-[13px] text-muted">
                {u.email}
                {u.default_checklist_id ? ` · Standard: ${name(u.default_checklist_id)}` : ""}
                {u.locked_to_default ? " (nur diese)" : ""} · {u.reports} Reports
              </div>
            </div>
            <Chevron className="size-4 text-muted" />
          </button>
        ))}
      </div>

      <Sheet
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? "Nutzer bearbeiten" : "Neuer Nutzer"}
        footer={
          <div className="flex items-center gap-3">
            {error && <span className="flex-1 text-[14px] text-danger">{error}</span>}
            <button className="btn-primary ml-auto" disabled={busy} onClick={submit}>{busy ? "Speichert …" : "Speichern"}</button>
          </div>
        }
      >
        {form && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">{form.id ? "Neues Passwort (leer lassen = unverändert)" : "Passwort"}</label>
              <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="label">Rolle</label>
              <select className="input" value={form.role} disabled={form.id === meId} onChange={(e) => setForm({ ...form, role: e.target.value as Form["role"] })}>
                <option value="user">Nutzer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="label">Standard-Checkliste</label>
              <select
                className="input"
                value={form.default_checklist_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  setForm({ ...form, default_checklist_id: v, locked_to_default: v ? form.locked_to_default : false });
                }}
              >
                <option value="">Keine</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <Toggle
              checked={form.locked_to_default}
              onChange={(v) => form.default_checklist_id && setForm({ ...form, locked_to_default: v })}
              label="Nur diese Checkliste erlauben"
              hint={form.default_checklist_id ? "Der Nutzer sieht ausschließlich seine Standard-Checkliste." : "Zuerst eine Standard-Checkliste wählen."}
            />
            {form.id && form.id !== meId && (
              <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Konto aktiv" hint="Deaktivierte Nutzer können sich nicht mehr anmelden." />
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
