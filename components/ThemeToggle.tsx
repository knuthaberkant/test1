"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function effectiveTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Switches between light and dark mode; the choice is remembered on this device. */
export default function ThemeToggle({ large = false }: { large?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(effectiveTheme()), []);

  function toggle() {
    const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: the switch still works for this visit */
    }
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Hellen Modus einschalten" : "Dunklen Modus einschalten"}
      title={dark ? "Heller Modus" : "Dunkler Modus"}
      onClick={toggle}
      className={`relative inline-flex shrink-0 items-center rounded-full bg-chip p-1 transition-colors ${large ? "h-11 w-[76px]" : "h-8 w-[56px]"}`}
    >
      <span
        className={`grid place-items-center rounded-full bg-card shadow-sm transition-transform duration-200 ${
          large ? "size-9" : "size-6"
        } ${dark ? (large ? "translate-x-8" : "translate-x-6") : "translate-x-0"}`}
      >
        {dark ? (
          <svg viewBox="0 0 20 20" className={large ? "size-5" : "size-4"} fill="currentColor">
            <path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className={`${large ? "size-5" : "size-4"} text-warn`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="10" cy="10" r="3.6" fill="currentColor" />
            <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
