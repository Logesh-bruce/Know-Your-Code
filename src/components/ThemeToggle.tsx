"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "kyc-theme";

type Theme = "dark" | "light";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable */
  }
  return "dark";
}

export function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = initialTheme();
    setTheme(current);
    applyTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-text-secondary transition-colors duration-150 ease-in-out hover:bg-bg-tertiary hover:text-text-primary"
    >
      {theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="4" stroke="currentColor" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M12.9 3.1l-1.4 1.4M4.5 11.5l-1.4 1.4" stroke="currentColor" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M14 9.5A6 6 0 0 1 6.5 2 6 6 0 1 0 14 9.5Z" stroke="currentColor" strokeLinejoin="round" />
        </svg>
      )}
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
