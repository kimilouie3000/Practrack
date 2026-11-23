import { createContext, useContext, useLayoutEffect, useMemo } from "react";

const ThemeContext = createContext(null);

/** PracTrack's dashboard uses a permanent dark theme. */
export function ThemeProvider({ children }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    root.dataset.theme = "dark";
    // Replace any old saved preference so users never reopen in light mode.
    try {
      localStorage.setItem("practrack_theme", "dark");
    } catch {
      // Storage may be unavailable; the stylesheet still uses dark colors.
    }
  }, []);

  // Preserve the old context API for other components. Switching is intentionally disabled.
  const value = useMemo(() => ({
    theme: "dark",
    setTheme: () => {},
    toggleTheme: () => {}
  }), []);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return context;
}
