"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

export function ThemeToggle(): React.ReactElement {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      setTheme("dark");
    }
  }, []);

  function applyTheme(next: Theme): void {
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", next);
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={theme === "light" ? "default" : "outline"}
        size="sm"
        onClick={() => applyTheme("light")}
      >
        Light
      </Button>
      <Button
        type="button"
        variant={theme === "dark" ? "default" : "outline"}
        size="sm"
        onClick={() => applyTheme("dark")}
      >
        Dark
      </Button>
    </div>
  );
}
