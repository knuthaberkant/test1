import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

/** Single text completion. Returns null when AI is not configured or the request fails. */
async function complete(system: string, prompt: string, maxTokens = 4000): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("Claude API Fehler:", err);
    return null;
  }
}

export async function generateDescription(input: {
  kind: "item" | "section";
  title: string;
  checklistName: string;
  sectionTitle?: string;
  siblings?: string[];
}): Promise<string | null> {
  const where =
    input.kind === "item"
      ? `Checkpunkt „${input.title}“ im Abschnitt „${input.sectionTitle ?? ""}“ der Checkliste „${input.checklistName}“.`
      : `Abschnitt bzw. Arbeitsphase „${input.title}“ der Checkliste „${input.checklistName}“.`;
  const context = input.siblings?.length
    ? `\n\nWeitere Punkte in diesem Bereich: ${input.siblings.map((s) => `„${s}“`).join(", ")}.`
    : "";
  return complete(
    "Du schreibst kurze, praxisnahe Erklärungen für Checklisten, die Teams im Arbeitsalltag auf dem Smartphone ausfüllen. " +
      "Schreibe auf Deutsch, in 2 bis 4 Sätzen, sachlich und konkret: worum es geht, worauf man achten sollte und wann der Punkt als erledigt gilt. " +
      "Keine Überschrift, keine Aufzählung, kein Markdown.",
    `Erkläre diesen ${input.kind === "item" ? "Checkpunkt" : "Abschnitt"}: ${where}${context}`,
    800,
  );
}

export async function formatComment(input: {
  transcript: string;
  itemTitle: string;
  checklistName: string;
}): Promise<string | null> {
  return complete(
    "Du bereitest gesprochene Notizen zu einem Checklisten-Punkt auf. Die Eingabe ist eine automatische Spracherkennung und kann Füllwörter, Wiederholungen und Erkennungsfehler enthalten. " +
      "Formuliere daraus einen sauberen, knappen deutschen Kommentar in vollständigen Sätzen. Fasse zusammen, erfinde aber nichts hinzu und lass keine Fakten (Zahlen, Orte, Mängel, Namen) weg. " +
      "Antworte nur mit dem fertigen Kommentartext, ohne Anführungszeichen, Einleitung oder Markdown.",
    `Checkliste: ${input.checklistName}\nCheckpunkt: ${input.itemTitle}\n\nGesprochene Notiz:\n${input.transcript}`,
    1000,
  );
}

export type SummaryInput = {
  checklistName: string;
  userName: string;
  startedAt: string;
  completedAt: string;
  durationText: string;
  sections: {
    title: string;
    items: { title: string; checked: boolean; comment: string | null }[];
  }[];
};

export async function summarizeRun(input: SummaryInput): Promise<string | null> {
  const lines = input.sections
    .map(
      (s) =>
        `## ${s.title}\n` +
        s.items
          .map((i) => `- [${i.checked ? "x" : " "}] ${i.title}${i.comment ? ` — Kommentar: ${i.comment}` : ""}`)
          .join("\n"),
    )
    .join("\n\n");
  return complete(
    "Du schreibst die Zusammenfassung für einen Prüfbericht zu einer ausgefüllten Checkliste. " +
      "Schreibe auf Deutsch 3 bis 6 Sätze Fließtext ohne Markdown: Gesamtergebnis, offene (nicht abgehakte) Punkte und alle Auffälligkeiten aus den Kommentaren. " +
      "Bleibe streng bei den Fakten aus den Daten und bewerte nichts, was nicht dort steht.",
    `Checkliste: ${input.checklistName}\nAusgefüllt von: ${input.userName}\nDauer: ${input.durationText}\n\n${lines}`,
    1500,
  );
}

/** Plain fallback used when no AI is configured, so the flow still works. */
export function templateSummary(input: SummaryInput): string {
  const all = input.sections.flatMap((s) => s.items);
  const done = all.filter((i) => i.checked).length;
  const open = all.filter((i) => !i.checked).map((i) => `„${i.title}“`);
  const comments = all.filter((i) => i.comment).length;
  let text = `Die Checkliste „${input.checklistName}“ wurde von ${input.userName} in ${input.durationText} bearbeitet. ${done} von ${all.length} Punkten wurden abgehakt.`;
  if (open.length) text += ` Offen geblieben: ${open.join(", ")}.`;
  if (comments) text += ` Zu ${comments} Punkt${comments === 1 ? "" : "en"} wurden Kommentare hinterlegt.`;
  return text;
}
