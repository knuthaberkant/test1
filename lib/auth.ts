import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { verifyPassword } from "./password";

export const SESSION_COOKIE = "cb_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  default_checklist_id: number | null;
  locked_to_default: number;
};

export function login(email: string, password: string): { token: string; user: SessionUser } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM users WHERE email = ? AND active = 1")
    .get(email.trim()) as (SessionUser & { password_hash: string }) | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, row.id, expires);
  const { password_hash: _ignored, ...user } = row;
  return { token, user };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.default_checklist_id, u.locked_to_default
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .get(token, new Date().toISOString()) as SessionUser | undefined;
  return row ?? null;
}

export function logout(token: string | undefined) {
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** For pages: redirects to login when not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/app");
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** For route handlers: throws HttpError instead of redirecting. */
export async function apiUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Nicht angemeldet");
  return user;
}

export async function apiAdmin(): Promise<SessionUser> {
  const user = await apiUser();
  if (user.role !== "admin") throw new HttpError(403, "Keine Berechtigung");
  return user;
}

export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
      console.error(err);
      return Response.json({ error: "Interner Fehler" }, { status: 500 });
    }
  };
}
