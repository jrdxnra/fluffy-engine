"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

const themeStorageKey = "sbdoh:theme";

export function ThemeToggleButton() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";

    const storedTheme = window.localStorage.getItem(themeStorageKey);
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    return systemPrefersDark ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: "light" | "dark" = theme === "dark" ? "light" : "dark";
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      window.localStorage.setItem(themeStorageKey, nextTheme);
    }
    setTheme(nextTheme);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-2"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>Theme: {theme === "dark" ? "Dark" : "Light"}</span>
    </Button>
  );
}
