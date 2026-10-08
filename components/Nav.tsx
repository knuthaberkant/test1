import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default function Nav({ user, area }: { user: SessionUser; area: "app" | "admin" }) {
  const links =
    area === "admin"
      ? [
          { href: "/admin", label: "Checklisten" },
          { href: "/admin/reports", label: "Reports" },
          { href: "/admin/users", label: "Nutzer" },
        ]
      : [{ href: "/app", label: "Meine Checklisten" }];
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-nav backdrop-blur-xl backdrop-saturate-150 pt-[env(safe-area-inset-top)]">
      <nav className="mx-auto flex h-12 max-w-5xl items-center gap-5 px-4 text-[13px] md:px-6">
        <Link href={area === "admin" ? "/admin" : "/app"} className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid size-6 place-items-center rounded-md bg-accent text-white">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="hidden sm:inline">Checklisten</span>
        </Link>
        <div className="flex flex-1 items-center gap-4 overflow-x-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap text-ink/80 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
        {user.role === "admin" && (
          <Link href={area === "admin" ? "/app" : "/admin"} className="whitespace-nowrap text-link">
            {area === "admin" ? "Nutzersicht" : "Verwaltung"}
          </Link>
        )}
        <LogoutButton />
      </nav>
    </header>
  );
}
