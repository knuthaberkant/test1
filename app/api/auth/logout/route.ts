import { cookies } from "next/headers";
import { logout, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const store = await cookies();
  logout(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
