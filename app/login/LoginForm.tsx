"use client";

import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Anmeldung fehlgeschlagen");
      setBusy(false);
      return;
    }
    window.location.href = data.role === "admin" ? "/admin" : "/app";
  }

  return (
    <form onSubmit={submit} className="card mt-10 w-full max-w-sm space-y-4 p-6">
      <div>
        <label className="label" htmlFor="email">E-Mail</label>
        <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Passwort</label>
        <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Anmelden …" : "Anmelden"}</button>
    </form>
  );
}
