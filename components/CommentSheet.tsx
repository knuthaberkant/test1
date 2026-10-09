"use client";

import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import { Sparkle, Spinner } from "./InfoButton";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export type CommentResult = { comment: string; source: string; original: string | null };

/**
 * Comment text field with voice input. Spoken notes are cleaned up by the AI and land in the
 * text field for review; the reported source records whether the text was typed, dictated or edited.
 */
export function CommentEditor({
  itemId,
  initialComment,
  initialSource,
  onChange,
  onBusyChange,
  large = false,
  autoFocus = false,
}: {
  itemId: number;
  initialComment: string | null;
  initialSource: string | null;
  onChange: (r: CommentResult) => void;
  onBusyChange?: (busy: boolean) => void;
  large?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(initialComment ?? "");
  // Text as produced by speech/AI, to detect manual edits before saving.
  const [generated, setGenerated] = useState<{ text: string; source: string } | null>(
    initialComment && initialSource?.startsWith("voice") && !initialSource.endsWith("_edited")
      ? { text: initialComment, source: initialSource }
      : null,
  );
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => setSupported(Boolean(createRecognition())), []);
  useEffect(() => () => recRef.current?.abort(), []);
  useEffect(() => onBusyChange?.(recording || processing), [recording, processing, onBusyChange]);

  function emit(nextText: string, gen: typeof generated, spoken: string) {
    const comment = nextText.trim();
    let source = "manual";
    if (gen) source = gen.text.trim() === comment ? gen.source : `${gen.source}_edited`;
    onChange({ comment, source, original: spoken || null });
  }

  function startRecording() {
    const rec = createRecognition();
    if (!rec) {
      setSupported(false);
      return;
    }
    setError(null);
    finalRef.current = "";
    setInterim("");
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript + " ";
        else live += r[0].transcript;
      }
      setInterim((finalRef.current + live).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        setError("Kein Zugriff auf das Mikrofon. Bitte in den Browser-Einstellungen erlauben.");
      else if (e.error !== "aborted" && e.error !== "no-speech") setError("Spracherkennung fehlgeschlagen.");
    };
    rec.onend = () => {
      setRecording(false);
      const spoken = finalRef.current.trim();
      recRef.current = null;
      if (spoken) void processTranscript(spoken);
      else setInterim("");
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }

  async function processTranscript(spoken: string) {
    setTranscript(spoken);
    setProcessing(true);
    const before = textRef.current.trim();
    let gen: { text: string; source: string };
    try {
      const res = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: spoken, itemId }),
      });
      const data = (await res.json()) as { text?: string; source?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error);
      gen = { text: before ? `${before}\n${data.text}` : data.text, source: data.source ?? "voice_ai" };
    } catch {
      setError("Der Text konnte nicht aufbereitet werden. Das Transkript wurde übernommen.");
      gen = { text: before ? `${before}\n${spoken}` : spoken, source: "voice_raw" };
    }
    setText(gen.text);
    setGenerated(gen);
    emit(gen.text, gen, spoken);
    setProcessing(false);
    setInterim("");
  }

  const isAi = generated?.source === "voice_ai";

  return (
    <div>
      <div className="relative">
        <textarea
          className={`input comment-field resize-none ${large ? "min-h-36" : "min-h-40"}`}
          placeholder="Kommentar eingeben oder einsprechen …"
          value={recording ? interim || text : text}
          readOnly={recording || processing}
          autoFocus={autoFocus}
          onChange={(e) => {
            setText(e.target.value);
            emit(e.target.value, generated, transcript);
          }}
        />
        {processing && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-card/85 text-[15px] text-muted">
            <span className="flex items-center gap-2">
              <Spinner /> KI formuliert deinen Kommentar …
            </span>
          </div>
        )}
      </div>

      {generated && !processing && (
        <div className="mt-3 rounded-2xl bg-accent/10 p-3 text-[14px] text-ink">
          <p className="flex items-center gap-1.5 font-medium text-accent">
            <Sparkle /> {isAi ? "Per KI aus deiner Sprachnotiz formuliert" : "Aus deiner Sprachnotiz übernommen"}
          </p>
          <p className="mt-1 text-muted">Bitte prüfe den Text und korrigiere ihn bei Bedarf.</p>
          {transcript && (
            <details className="mt-2">
              <summary className="cursor-pointer text-link">Original-Transkript</summary>
              <p className="mt-1 italic text-muted">„{transcript}“</p>
            </details>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}

      <div className="mt-4 flex items-center gap-4">
        {supported ? (
          <>
            <button
              type="button"
              onClick={recording ? () => recRef.current?.stop() : startRecording}
              disabled={processing}
              aria-label={recording ? "Aufnahme beenden" : "Kommentar einsprechen"}
              className={`relative grid shrink-0 place-items-center rounded-full text-white shadow-lg transition ${
                large ? "size-[72px]" : "size-16"
              } ${recording ? "bg-danger shadow-danger/30" : "bg-accent shadow-accent/30 hover:bg-accent-hover"} disabled:opacity-40`}
            >
              {recording && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
              {recording ? (
                <span className="relative size-6 rounded-[6px] bg-white" />
              ) : (
                <svg viewBox="0 0 24 24" className="relative size-8" fill="currentColor">
                  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
                </svg>
              )}
            </button>
            <span className={`text-muted ${large ? "text-[17px]" : "text-[14px]"}`}>
              {recording ? "Aufnahme läuft – tippen zum Beenden" : "Tippen und sprechen"}
            </span>
          </>
        ) : (
          <p className="text-[14px] text-muted">
            Dieser Browser unterstützt keine Spracheingabe. Nutze die Diktierfunktion deiner Tastatur.
          </p>
        )}
      </div>
    </div>
  );
}

export default function CommentSheet({
  open,
  onClose,
  itemId,
  itemTitle,
  initialComment,
  initialSource,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  itemId: number;
  itemTitle: string;
  initialComment: string | null;
  initialSource: string | null;
  onSave: (r: CommentResult) => Promise<void> | void;
}) {
  const [result, setResult] = useState<CommentResult>({
    comment: initialComment ?? "",
    source: initialSource ?? "manual",
    original: null,
  });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(r: CommentResult) {
    setSaving(true);
    try {
      await onSave(r);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <>
          <span className="block text-[13px] font-medium text-muted">Kommentar</span>
          {itemTitle}
        </>
      }
      footer={
        <div className="flex gap-3">
          {initialComment && (
            <button className="btn-danger" disabled={saving || busy} onClick={() => save({ comment: "", source: "manual", original: null })}>
              Löschen
            </button>
          )}
          <button className="btn-primary flex-1" disabled={saving || busy || !result.comment} onClick={() => save(result)}>
            Speichern
          </button>
        </div>
      }
    >
      <CommentEditor
        key={itemId}
        itemId={itemId}
        initialComment={initialComment}
        initialSource={initialSource}
        onChange={setResult}
        onBusyChange={setBusy}
      />
    </Sheet>
  );
}
