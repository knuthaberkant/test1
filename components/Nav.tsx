import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";

export default function Nav({ user, area }: { user: SessionUser; area: "app" | "admin" }) {
  const big = area === "app";
  const links =
    area === "admin"
      ? [
          { href: "/admin", label: "Checklisten" },
          { href: "/admin/reports", label: "Dashboard" },
          { href: "/admin/users", label: "Nutzer" },
        ]
      : [];
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-nav pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <nav className={`mx-auto flex max-w-5xl items-center gap-4 px-4 md:px-6 ${big ? "h-16 text-[16px]" : "h-12 text-[13px]"}`}>
        <Link href={area === "admin" ? "/admin" : "/app"} className="flex items-center gap-2.5 font-semibold text-ink">
          <span className={`grid place-items-center rounded-lg bg-accent text-white ${big ? "size-9" : "size-6"}`}>
            <svg viewBox="0 0 16 16" className={big ? "size-5" : "size-3.5"} fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className={big ? "text-[19px]" : "hidden sm:inline"}>Checklisten</span>
        </Link>
        <div className="flex flex-1 items-center gap-4 overflow-x-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap text-ink/80 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
        {user.role === "admin" && (
          <Link href={area === "admin" ? "/app" : "/admin"} className="hidden whitespace-nowrap text-link sm:inline">
            {area === "admin" ? "Nutzersicht" : "Verwaltung"}
          </Link>
        )}
        <ThemeToggle large={big} />
        <LogoutButton />
      </nav>
    </header>
  );
}
