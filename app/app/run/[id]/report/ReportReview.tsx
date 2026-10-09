"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Sparkle, Spinner } from "@/components/InfoButton";
import { AutoBadge, ManualBadge, ResultList, TimeFacts } from "@/components/ReportBody";
import SignaturePad from "@/components/SignaturePad";
import type { ReportSnapshot } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

type Loc =
  | { state: "locating" }
  | { state: "found"; lat: number; lng: number; accuracy: number | null; label: string | null }
  | { state: "error"; message: string };

export default function ReportReview({
  runId,
  snapshot,
  durationText,
  signerName,
  canSign,
}: {
  runId: number;
  snapshot: ReportSnapshot;
  durationText: string;
  signerName: string;
  canSign: boolean;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [generated, setGenerated] = useState<{ text: string; source: "ai" | "template" } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [loc, setLoc] = useState<Loc>({ state: "locating" });
  const [locConfirmed, setLocConfirmed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date().toISOString());

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/runs/${runId}/summary`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data.summary);
      setGenerated({ text: data.summary, source: data.source });
    } catch {
      setGenerated(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [runId]);

  const locate = useCallback(() => {
    setLoc({ state: "locating" });
    setLocConfirmed(false);
    if (!("geolocation" in navigator)) {
      setLoc({ state: "error", message: "Dieses Gerät kann den Standort nicht ermitteln." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        let label: string | null = null;
        try {
          const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
          label = (await res.json()).label ?? null;
        } catch {
          /* coordinates alone are still a valid location */
        }
        setLoc({ state: "found", lat, lng, accuracy: Math.round(accuracy), label });
      },
      (err) =>
        setLoc({
          state: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Standortzugriff wurde verweigert. Bitte in den Einstellungen erlauben und erneut versuchen."
              : "Der Standort konnte nicht ermittelt werden.",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    void loadSummary();
    locate();
    const t = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(t);
  }, [loadSummary, locate]);

  const summaryEdited = generated && generated.text.trim() !== summary.trim();
  const locOk = (loc.state === "found" && locConfirmed) || loc.state === "error";
  const ready = canSign && summary.trim() && signature && locOk && !summaryLoading;

  async function reopen() {
    await fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    router.push(`/app/run/${runId}`);
  }

  async function submit() {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/runs/${runId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        summarySource: generated ? generated.source : "manual",
        summaryOriginal: generated?.text ?? null,
        signature,
        location: loc.state === "found" ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, label: loc.label } : null,
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Speichern fehlgeschlagen");
      setSubmitting(false);
      return;
    }
    router.push(`/reports/${runId}?neu=1`);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:px-6 md:pt-12">
      <button onClick={reopen} className="link inline-flex min-h-11 items-center text-[18px]">‹ Zurück zur Checkliste</button>
      <p className="eyebrow mt-6">Report</p>
      <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight md:text-[44px]">{snapshot.checklistName}</h1>
      <p className="mt-1 text-[15px] text-muted">{snapshot.userName}</p>

      <div className="mt-6">
        <TimeFacts snapshot={snapshot} durationText={durationText} />
      </div>

      {/* Summary */}
      <section className="card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[24px] font-bold tracking-tight">Zusammenfassung</h2>
          {!summaryLoading && generated && (summaryEdited ? <ManualBadge>manuell geändert</ManualBadge> : <AutoBadge>{generated.source === "ai" ? "KI-Vorschlag" : "automatisch erstellt"}</AutoBadge>)}
          {!summaryLoading && !generated && summary && <ManualBadge />}
        </div>
        {summaryLoading ? (
          <div className="flex items-center gap-3 py-8 text-muted">
            <Spinner /> Zusammenfassung wird erstellt …
          </div>
        ) : (
          <>
            <textarea
              className="input mt-4 min-h-40 text-[18px] leading-relaxed"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Kurze Zusammenfassung des Ergebnisses"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
              <span className="flex items-center gap-1.5">
                <Sparkle /> Bitte prüfen und bei Bedarf korrigieren, bevor du unterschreibst.
              </span>
              <button className="text-link" onClick={() => void loadSummary()}>Neu erstellen</button>
            </div>
          </>
        )}
      </section>

      {/* Results */}
      <section className="card mt-6 p-6">
        <h2 className="mb-4 text-[24px] font-bold tracking-tight">Ergebnis</h2>
        <ResultList snapshot={snapshot} />
      </section>

      {/* Location */}
      <section className="card mt-6 p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[24px] font-bold tracking-tight">Ort</h2>
          <AutoBadge>automatisch ermittelt</AutoBadge>
        </div>
        {loc.state === "locating" && (
          <div className="flex items-center gap-3 py-6 text-muted">
            <Spinner /> Standort wird ermittelt …
          </div>
        )}
        {loc.state === "found" && (
          <div className="mt-4">
            <div className="flex items-start gap-3 rounded-2xl bg-chip p-4">
              <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-accent" fill="currentColor">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
              <div className="min-w-0">
                <div className="text-[17px] font-medium">{loc.label ?? "Adresse nicht auflösbar"}</div>
                <div className="text-[13px] text-muted">
                  {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                  {loc.accuracy != null && ` · Genauigkeit ±${loc.accuracy} m`}
                </div>
              </div>
            </div>
            <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 text-[18px]">
              <input type="checkbox" className="size-7 accent-[var(--accent)]" checked={locConfirmed} onChange={(e) => setLocConfirmed(e.target.checked)} />
              Ich bestätige diesen Ort.
            </label>
            <p className="mt-1 text-[12px] text-muted">Der Ort wird automatisch ermittelt und kann nicht geändert werden.</p>
          </div>
        )}
        {loc.state === "error" && (
          <div className="mt-4 rounded-2xl bg-warn/10 p-4 text-[14px]">
            <p>{loc.message}</p>
            <p className="mt-1 text-muted">Ohne Standort wird im Report „nicht ermittelbar“ vermerkt.</p>
            <button className="mt-2 text-link" onClick={locate}>Erneut versuchen</button>
          </div>
        )}
      </section>

      {/* Signature */}
      <section className="card mt-6 p-6">
        <h2 className="text-[24px] font-bold tracking-tight">Unterschrift</h2>
        <p className="mt-1 text-[14px] text-muted">
          {signerName} · {formatDateTime(now)} {loc.state === "found" && loc.label ? `· ${loc.label}` : ""}
        </p>
        {canSign ? (
          <div className="mt-4">
            <SignaturePad onChange={setSignature} />
          </div>
        ) : (
          <p className="mt-4 text-muted">Nur die Person, die die Checkliste ausgefüllt hat, kann unterschreiben.</p>
        )}
      </section>

      {error && <p className="mt-4 text-center text-danger">{error}</p>}

      <div className="mt-8 flex flex-col items-center gap-3">
        <button className="btn-primary min-h-16 w-full max-w-md text-[20px]" disabled={!ready || submitting} onClick={submit}>
          {submitting ? "Wird gespeichert …" : "Unterschreiben & Report speichern"}
        </button>
        {!ready && !summaryLoading && canSign && (
          <p className="text-center text-[13px] text-muted">
            {!summary.trim() ? "Zusammenfassung fehlt. " : ""}
            {loc.state === "found" && !locConfirmed ? "Bitte den Ort bestätigen. " : ""}
            {loc.state === "locating" ? "Standort wird noch ermittelt. " : ""}
            {!signature ? "Bitte unterschreiben." : ""}
          </p>
        )}
      </div>
    </main>
  );
}
