"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Assumptions, DEFAULT_ASSUMPTIONS } from "../lib/recommend";

type Theme = "light" | "dark";
type WorkspaceContextValue = {
  assumptions: Assumptions;
  updateAssumption: <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => void;
  resetAssumptions: () => void;
  theme: Theme;
  toggleTheme: () => void;
  assumptionsOpen: boolean;
  setAssumptionsOpen: (open: boolean) => void;
};
const Context = createContext<WorkspaceContextValue | null>(null);

export function AssumptionsProvider({ children }: { children: React.ReactNode }) {
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [theme, setTheme] = useState<Theme>("light");
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("daywell-assumptions");
      if (saved) setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...JSON.parse(saved) });
      const savedTheme = localStorage.getItem("daywell-theme");
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    } catch {
      localStorage.removeItem("daywell-assumptions");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("daywell-assumptions", JSON.stringify(assumptions));
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("daywell-theme", theme);
  }, [assumptions, theme]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    assumptions,
    updateAssumption: (key, next) => setAssumptions((current) => ({ ...current, [key]: next })),
    resetAssumptions: () => setAssumptions(DEFAULT_ASSUMPTIONS),
    theme,
    toggleTheme: () => setTheme((current) => current === "light" ? "dark" : "light"),
    assumptionsOpen,
    setAssumptionsOpen,
  }), [assumptions, theme, assumptionsOpen]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("useWorkspace must be used inside AssumptionsProvider.");
  return context;
}
