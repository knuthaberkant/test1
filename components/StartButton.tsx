"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StartButton({
  checklistId,
  label = "Starten",
  className = "btn-primary",
}: {
  checklistId: number;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checklistId }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error ?? "Konnte nicht gestartet werden");
          setBusy(false);
          return;
        }
        router.push(`/app/run/${data.id}`);
      }}
    >
      {busy ? "Einen Moment …" : label}
    </button>
  );
}
