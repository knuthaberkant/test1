import { cookies } from "next/headers";
import { login, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || !password) return Response.json({ error: "E-Mail und Passwort angeben" }, { status: 400 });
  const result = login(email, password);
  if (!result) return Response.json({ error: "E-Mail oder Passwort ist falsch" }, { status: 401 });
  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return Response.json({ role: result.user.role });
}
