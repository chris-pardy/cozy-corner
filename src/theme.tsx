import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as Theme) ?? "dark";
  });
  const isFirstRender = useRef(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = document.documentElement;

    if (theme === "light") {
      el.setAttribute("data-theme", "light");
    } else {
      el.removeAttribute("data-theme");
    }
    localStorage.setItem("theme", theme);

    // Skip transition on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Enable color transitions
    el.classList.add("theme-transitioning");

    // Animate the overlay
    const overlay = overlayRef.current;
    if (overlay) {
      const isSunrise = theme === "light";
      overlay.animate(
        [
          { opacity: 0 },
          { opacity: isSunrise ? 0.18 : 0.12, offset: 0.35 },
          { opacity: 0 },
        ],
        { duration: 900, easing: "ease-in-out", fill: "forwards" }
      );
      // Shift overlay color: golden for sunrise, deep amber for sunset
      overlay.style.background = isSunrise
        ? "radial-gradient(ellipse at 50% 0%, #f6ad55, #ed8936 60%, transparent)"
        : "radial-gradient(ellipse at 50% 0%, #5c3d1a, #12100e 60%, transparent)";
    }

    const timer = setTimeout(() => {
      el.classList.remove("theme-transitioning");
    }, 900);
    return () => clearTimeout(timer);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext value={{ theme, toggle }}>
      {children}
      <div
        ref={overlayRef}
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 9999,
          opacity: 0,
        }}
      />
    </ThemeContext>
  );
}
