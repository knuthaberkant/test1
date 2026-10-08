import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/app");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="mb-8 grid size-16 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
        <svg viewBox="0 0 16 16" className="size-8" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="headline text-center">Checklisten.</h1>
      <p className="mt-3 text-center text-[19px] text-muted">Melde dich an, um loszulegen.</p>
      <LoginForm />
    </main>
  );
}
