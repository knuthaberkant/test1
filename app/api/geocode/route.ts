import { apiUser, handle, HttpError } from "@/lib/auth";

/** Reverse geocoding through OpenStreetMap Nominatim, proxied so the browser needs no third-party access. */
export const GET = handle(async (request: Request) => {
  await apiUser();
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "Koordinaten fehlen");
  const endpoint = process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org/reverse";
  try {
    const res = await fetch(`${endpoint}?format=jsonv2&accept-language=de&zoom=18&lat=${lat}&lon=${lng}`, {
      headers: { "User-Agent": process.env.GEOCODER_USER_AGENT || "Checklisten-Board/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ label: null });
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const street = [a.road, a.house_number].filter(Boolean).join(" ");
    const city = [a.postcode, a.city || a.town || a.village || a.municipality].filter(Boolean).join(" ");
    const label = [street, city].filter(Boolean).join(", ") || data.display_name || null;
    return Response.json({ label });
  } catch {
    return Response.json({ label: null });
  }
});
