import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeName = "0x" | "cyberpunk" | "midnight" | "lavender" | "obsidian" | "ember" | "matrix" | "arctic" | "phantom" | "aurora";

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "0xleverage-theme";

const VALID_THEMES: ThemeName[] = ["0x", "cyberpunk", "midnight", "lavender", "obsidian", "ember", "matrix", "arctic", "phantom", "aurora"];

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
}

export function ThemeProvider({
  children,
  defaultTheme = "0x",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_THEMES.includes(stored as ThemeName)) {
        return stored as ThemeName;
      }
    } catch {}
    return defaultTheme;
  });

  const isDark = theme !== "lavender";

  useEffect(() => {
    const root = document.documentElement;

    // Set data-theme attribute for CSS variable switching
    root.setAttribute("data-theme", theme);

    // Set color-scheme for native elements
    root.style.colorScheme = isDark ? "dark" : "light";

    // Add/remove dark class for any components that check it
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme, isDark]);

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
  };

  const value = useMemo(() => ({ theme, setTheme, isDark }), [theme, setTheme, isDark]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
