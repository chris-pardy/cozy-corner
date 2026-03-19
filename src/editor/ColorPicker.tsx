import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "cozy-corner:recent-colors";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveRecent(colors: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch { /* ignore */ }
}

function addToRecent(color: string): string[] {
  const recent = loadRecent();
  if (recent[0] === color) return recent;
  const filtered = recent.filter((c) => c !== color);
  filtered.unshift(color);
  const trimmed = filtered.slice(0, MAX_RECENT);
  saveRecent(trimmed);
  return trimmed;
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prevColorRef = useRef(value);
  const [recent, setRecent] = useState(loadRecent);

  // Snapshot the current color before the picker opens
  const openPicker = useCallback(() => {
    prevColorRef.current = value;
    inputRef.current?.click();
  }, [value]);

  // When the picker closes, save the previous color to history
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const handler = () => {
      const prev = prevColorRef.current;
      if (prev) setRecent(addToRecent(prev));
    };
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <button
        onClick={openPicker}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          border: "2px solid var(--border-color)",
          borderRadius: 2,
          cursor: "pointer",
          background: value,
          flexShrink: 0,
        }}
        title="Pick color"
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
      {recent.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 20,
            height: 20,
            padding: 0,
            border: c === value ? "2px solid var(--accent-primary)" : "2px solid var(--border-color)",
            borderRadius: 2,
            cursor: "pointer",
            background: c,
            flexShrink: 0,
          }}
          title={c}
        />
      ))}
    </div>
  );
}
