import { apiUser, handle, HttpError } from "@/lib/auth";
import { resolveDescription } from "@/lib/descriptions";

export const GET = handle(async (request: Request) => {
  await apiUser();
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = Number(url.searchParams.get("id"));
  if ((kind !== "item" && kind !== "section") || !id) throw new HttpError(400, "Ungültige Anfrage");
  return Response.json(await resolveDescription(kind, id));
});
