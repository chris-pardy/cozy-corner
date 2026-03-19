import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "../theme";
import { getSession } from "~/lib/at-protocol";

/**
 * Shared navigation header used across all routes.
 * Reads session from localStorage to conditionally show the Avatar link.
 */
export function NavHeader() {
  const [did, setDid] = useState<string | null>(null);
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const session = getSession();
    setDid(session?.did ?? null);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleLogout() {
    localStorage.removeItem("session");
    setDid(null);
    setMenuOpen(false);
    navigate({ to: "/" });
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b-2 border-border bg-bg-panel">
      <Link
        to="/"
        className="font-heading text-base text-accent-primary hover:text-accent-primary/80 transition-colors"
      >
        cozy-corner.at
      </Link>
      <nav className="flex items-center gap-4">
        {did ? (
          <>
            <Link
              to="/create/$actor/$nsid/$tid"
              params={{
                actor: did,
                nsid: "at.cozy-corner.house",
                tid: "self",
              }}
              className="font-heading text-xs text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
            >
              My House
            </Link>
            <Link
              to="/create/$actor/$nsid/$tid"
              params={{
                actor: did,
                nsid: "at.cozy-corner.avatar",
                tid: "self",
              }}
              className="font-heading text-xs text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
            >
              Avatar
            </Link>
            <Link
              to="/inventory"
              className="font-heading text-xs text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
            >
              Inventory
            </Link>
            <Link
              to="/create"
              className="font-heading text-xs text-text-muted uppercase tracking-wide hover:text-accent-primary transition-colors"
            >
              Create
            </Link>

            {/* Settings dropdown */}
            <div className="relative flex items-center" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="font-heading text-xs text-text-muted hover:text-accent-primary transition-colors bg-transparent border-none cursor-pointer uppercase tracking-wide p-0 leading-none"
              >
                Settings
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[140px] bg-bg-panel border-2 border-border rounded-sm z-50 flex flex-col overflow-hidden">
                  <button
                    onClick={() => { toggle(); setMenuOpen(false); }}
                    className="font-heading text-[10px] text-text-muted hover:text-accent-primary hover:bg-bg-surface transition-colors bg-transparent border-none cursor-pointer text-left px-4 py-3 uppercase tracking-wide"
                  >
                    {theme === "dark" ? "\u2600\uFE0F Light Mode" : "\uD83C\uDF19 Dark Mode"}
                  </button>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="font-heading text-[10px] text-text-muted hover:text-accent-primary hover:bg-bg-surface transition-colors no-underline block px-4 py-3 border-t-2 border-t-border uppercase tracking-wide"
                  >
                    Service Handlers
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="font-heading text-[10px] text-text-muted hover:text-error hover:bg-bg-surface transition-colors bg-transparent border-none cursor-pointer text-left px-4 py-3 border-t-2 border-t-border uppercase tracking-wide"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={toggle}
            className="font-heading text-xs text-text-muted hover:text-accent-primary transition-colors bg-transparent border-none cursor-pointer uppercase tracking-wide p-0 leading-none"
          >
            {theme === "dark" ? "\u2600\uFE0F Light" : "\uD83C\uDF19 Dark"}
          </button>
        )}
      </nav>
    </header>
  );
}
