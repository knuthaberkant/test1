"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewChecklist() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 flex gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        const res = await fetch("/api/admin/checklists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        router.push(`/admin/checklists/${data.id}`);
      }}
    >
      <input className="input flex-1" placeholder="Name der neuen Checkliste, z. B. Fahrzeugübergabe" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn-primary" disabled={busy || !name.trim()}>Anlegen</button>
    </form>
  );
}
