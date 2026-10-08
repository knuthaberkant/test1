// Pure helpers, safe to import from client components.

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} Min.`;
  return `${h} Std. ${m} Min.`;
}

const TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Berlin";

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: TZ }).format(new Date(iso));
}

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuell eingegeben",
  voice_ai: "Gesprochen, per KI aufbereitet",
  voice_ai_edited: "Gesprochen, per KI aufbereitet, manuell geändert",
  voice_raw: "Gesprochen (Spracherkennung), unverändert",
  voice_raw_edited: "Gesprochen (Spracherkennung), manuell geändert",
  ai: "KI-generiert, unverändert übernommen",
  ai_edited: "KI-generiert, manuell geändert",
  template: "Automatisch erstellt, unverändert übernommen",
  template_edited: "Automatisch erstellt, manuell geändert",
};

/** Converts a YYYY-MM-DD calendar date in the app time zone to the UTC instant of its midnight. */
export function zonedMidnightUtc(date: string, addDays = 0): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const guess = new Date(`${date}T00:00:00Z`);
  guess.setUTCDate(guess.getUTCDate() + addDays);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (asLocal - guess.getTime())).toISOString();
}
