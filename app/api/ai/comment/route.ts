import { apiUser, handle, HttpError } from "@/lib/auth";
import { formatComment } from "@/lib/ai";
import { getDb } from "@/lib/db";

export const POST = handle(async (request: Request) => {
  await apiUser();
  const { transcript, itemId } = (await request.json()) as { transcript?: string; itemId?: number };
  if (!transcript?.trim()) throw new HttpError(400, "Kein Text erkannt");
  const ctx = getDb()
    .prepare(
      "SELECT i.title AS item, c.name AS checklist FROM items i JOIN sections s ON s.id = i.section_id JOIN checklists c ON c.id = s.checklist_id WHERE i.id = ?",
    )
    .get(itemId ?? 0) as { item: string; checklist: string } | undefined;
  const text = await formatComment({
    transcript: transcript.trim(),
    itemTitle: ctx?.item ?? "",
    checklistName: ctx?.checklist ?? "",
  });
  if (!text) return Response.json({ text: transcript.trim(), source: "voice_raw" });
  return Response.json({ text, source: "voice_ai" });
});
