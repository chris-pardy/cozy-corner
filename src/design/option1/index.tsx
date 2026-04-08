import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/* ─────────────────────────────────────────────
 * Warm Hearth — Design System Showcase
 * Option 1 of 5 — Dark & Light
 *
 * Amber/orange warm tones. Fireplace comfort.
 * Animal Crossing meets Roblox: cozy exploration,
 * discovery, collection/curation, and building.
 * ───────────────────────────────────────────── */

type Theme = "dark" | "light";

// ── Theme-aware color sets ───────────────────

const DARK_COLORS = {
  deep: "#0f0b07",
  surface: "#1c1610",
  muted: "#2a2018",
  border: "#3d2e1e",
  text: "#faf0e6",
  textMuted: "#a08c76",
  amber: "#f6ad55",
  ember: "#e07832",
  warmRed: "#c44d2a",
  destructive: "#dc2626",
  green: "#5cb85c",
  purple: "#a855f7",
  blue: "#6bb5e0",
  wood: "#8b6c42",
  scroll: "#d4a574",
  leaf: "#4ade80",
  gold: "#fbbf67",
  ice: "#6bb5e0",
  fireTip: "#faf0e6",
  darkGreen: "#357a35",
  darkPurple: "#7c3aed",
} as const;

const LIGHT_COLORS = {
  deep: "#faf5ee",
  surface: "#fff8f0",
  muted: "#f0e6d8",
  border: "#d4c4a8",
  text: "#2e1f0e",
  textMuted: "#8a7560",
  amber: "#c97b1a",
  ember: "#b85c14",
  warmRed: "#a83820",
  destructive: "#dc2626",
  green: "#3d8c3d",
  purple: "#8b3dd4",
  blue: "#4a90b8",
  wood: "#7a5c35",
  scroll: "#b09070",
  leaf: "#2d9a50",
  gold: "#d98a2a",
  ice: "#4a90b8",
  fireTip: "#e8b860",
  darkGreen: "#1f521f",
  darkPurple: "#6b21a8",
} as const;

function themeColors(theme: Theme) {
  return theme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

// ── Palette data ──────────────────────────────

function getPalette(theme: Theme) {
  const c = themeColors(theme);
  return [
    { name: "Deep",        hex: c.deep,        textLight: theme === "dark" },
    { name: "Surface",     hex: c.surface,     textLight: theme === "dark" },
    { name: "Muted BG",    hex: c.muted,       textLight: theme === "dark" },
    { name: "Border",      hex: c.border,      textLight: theme === "dark" },
    { name: "Text",        hex: c.text,        textLight: theme !== "dark" },
    { name: "Text Muted",  hex: c.textMuted,   textLight: theme !== "dark" },
    { name: "Amber",       hex: c.amber,       textLight: theme !== "dark" },
    { name: "Ember",       hex: c.ember,       textLight: theme !== "dark" },
    { name: "Warm Red",    hex: c.warmRed,     textLight: true },
    { name: "Destructive", hex: c.destructive, textLight: true },
  ];
}

// ── Inventory grid data ───────────────────────

type SlotState = "empty" | "filled" | "selected";

interface InventorySlot {
  state: SlotState;
  colorKey?: keyof typeof DARK_COLORS;
  label?: string;
}

const INITIAL_INVENTORY: InventorySlot[] = [
  { state: "selected", colorKey: "amber",  label: "Lantern" },
  { state: "filled",   colorKey: "ember",  label: "Ember" },
  { state: "filled",   colorKey: "green",  label: "Herb" },
  { state: "filled",   colorKey: "purple", label: "Crystal" },
  { state: "filled",   colorKey: "ice",    label: "Ice" },
  { state: "empty" },
  { state: "filled",   colorKey: "warmRed", label: "Ruby" },
  { state: "filled",   colorKey: "wood",    label: "Wood" },
  { state: "empty" },
  { state: "filled",   colorKey: "amber", label: "Key" },
  { state: "empty" },
  { state: "empty" },
  { state: "filled",   colorKey: "scroll", label: "Scroll" },
  { state: "empty" },
  { state: "filled",   colorKey: "leaf",  label: "Leaf" },
  { state: "empty" },
  { state: "empty" },
  { state: "filled",   colorKey: "gold",  label: "Gold" },
  { state: "empty" },
  { state: "empty" },
  { state: "empty" },
  { state: "empty" },
  { state: "empty" },
  { state: "empty" },
];

// ── Tool bar data ─────────────────────────────

function getTools(theme: Theme) {
  const c = themeColors(theme);
  return [
    { name: "Move",   color: c.amber },
    { name: "Place",  color: c.green },
    { name: "Erase",  color: c.destructive },
    { name: "Paint",  color: c.blue },
    { name: "Select", color: c.purple },
  ];
}

// ── Fire pixel component (CSS-only) ──────────

function FireDecoration({ theme }: { theme: Theme }) {
  const c = themeColors(theme);
  return (
    <div className="flex items-end gap-[2px] h-5" aria-hidden="true">
      {/* 5-column pixel fire */}
      <div className="flex flex-col gap-[1px] items-center">
        <div className="fire-pixel" style={{ background: c.warmRed, animationDelay: "0.1s" }} />
        <div className="fire-pixel" style={{ background: c.ember }} />
        <div className="fire-pixel" style={{ background: c.amber, animationDelay: "0.2s" }} />
      </div>
      <div className="flex flex-col gap-[1px] items-center">
        <div className="fire-pixel" style={{ background: c.ember, animationDelay: "0.05s" }} />
        <div className="fire-pixel" style={{ background: c.amber, animationDelay: "0.15s" }} />
        <div className="fire-pixel" style={{ background: c.gold }} />
        <div className="fire-pixel" style={{ background: c.fireTip, animationDelay: "0.25s" }} />
      </div>
      <div className="flex flex-col gap-[1px] items-center">
        <div className="fire-pixel" style={{ background: c.warmRed, animationDelay: "0.2s" }} />
        <div className="fire-pixel" style={{ background: c.ember, animationDelay: "0.1s" }} />
        <div className="fire-pixel" style={{ background: c.amber }} />
        <div className="fire-pixel" style={{ background: c.gold, animationDelay: "0.3s" }} />
        <div className="fire-pixel" style={{ background: c.fireTip, animationDelay: "0.05s" }} />
      </div>
      <div className="flex flex-col gap-[1px] items-center">
        <div className="fire-pixel" style={{ background: c.ember, animationDelay: "0.15s" }} />
        <div className="fire-pixel" style={{ background: c.amber, animationDelay: "0.25s" }} />
        <div className="fire-pixel" style={{ background: c.gold, animationDelay: "0.05s" }} />
        <div className="fire-pixel" style={{ background: c.fireTip }} />
      </div>
      <div className="flex flex-col gap-[1px] items-center">
        <div className="fire-pixel" style={{ background: c.warmRed }} />
        <div className="fire-pixel" style={{ background: c.ember, animationDelay: "0.2s" }} />
        <div className="fire-pixel" style={{ background: c.amber, animationDelay: "0.1s" }} />
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────

function Section({
  title,
  subtitle,
  children,
  theme,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  const c = themeColors(theme);
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl tracking-wide" style={{ color: c.amber }}>{title}</h2>
        {subtitle && (
          <p className="text-sm mt-1 font-body" style={{ color: c.textMuted }}>{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// ── Theme toggle button ──────────────────────

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full border-2 cursor-pointer"
      style={{
        fontFamily: '"Pixelify Sans", cursive',
        fontSize: "14px",
        fontWeight: 600,
        backgroundColor: isDark ? "#1c1610" : "#fff8f0",
        borderColor: isDark ? "#3d2e1e" : "#d4c4a8",
        color: isDark ? "#faf0e6" : "#2e1f0e",
        transition: "background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease",
        boxShadow: isDark
          ? "0 2px 8px rgba(0,0,0,0.4)"
          : "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <span style={{ fontSize: "18px" }}>{isDark ? "\u263E" : "\u2600"}</span>
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}

// ── Main showcase ─────────────────────────────

function WarmHearthShowcase() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [selectedTool, setSelectedTool] = useState(0);
  const [gridSnap, setGridSnap] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [autoSave, setAutoSave] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const c = themeColors(theme);
  const palette = getPalette(theme);
  const tools = getTools(theme);

  // Resolve inventory slot color for current theme
  const slotColor = (slot: InventorySlot) =>
    slot.colorKey ? c[slot.colorKey as keyof typeof c] : undefined;

  return (
    <div className="ambient-glow grain scanlines relative min-h-screen">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 space-y-16">

        {/* ════════════════════════════════════
            HEADER
            ════════════════════════════════════ */}
        <header className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <FireDecoration theme={theme} />
            <h1 className="font-heading text-5xl tracking-wide" style={{ color: c.text }}>
              Warm Hearth
            </h1>
            <FireDecoration theme={theme} />
          </div>
          <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: c.textMuted }}>
            Amber glow and crackling embers. A design system that feels like
            settling into your favorite chair beside a roaring fireplace on a
            cold evening.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="inline-block w-8 h-[2px]" style={{ backgroundColor: c.border }} />
            <span className="uppercase tracking-[0.2em]" style={{ color: c.textMuted }}>
              Option 1 &mdash; Dark & Light
            </span>
            <span className="inline-block w-8 h-[2px]" style={{ backgroundColor: c.border }} />
          </div>
        </header>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            COLOR PALETTE
            ════════════════════════════════════ */}
        <Section theme={theme} title="Color Palette" subtitle="The warmth of a well-tended fire">
          <div className="grid grid-cols-5 gap-4">
            {palette.map((p) => (
              <div key={p.name} className="flex flex-col items-center gap-2">
                <div
                  className="color-swatch w-16 h-16"
                  style={{ backgroundColor: p.hex }}
                />
                <span className="text-xs font-heading" style={{ color: c.text }}>
                  {p.name}
                </span>
                <span className="text-[10px] font-mono uppercase" style={{ color: c.textMuted }}>
                  {p.hex}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            TYPOGRAPHY
            ════════════════════════════════════ */}
        <Section theme={theme} title="Typography" subtitle="Pixelify Sans for headings, JetBrains Mono for body">
          <div className="space-y-6">
            {/* Heading levels */}
            <div className="space-y-3">
              <h1 className="font-heading text-4xl" style={{ color: c.text }}>
                H1 - Welcome to Cozy Corner
              </h1>
              <h2 className="font-heading text-3xl" style={{ color: c.text }}>
                H2 - Your Room Awaits
              </h2>
              <h3 className="font-heading text-2xl" style={{ color: c.text }}>
                H3 - Inventory & Items
              </h3>
              <h4 className="font-heading text-xl" style={{ color: c.text }}>
                H4 - Collection Details
              </h4>
            </div>

            {/* Body text */}
            <div className="space-y-3 max-w-2xl">
              <p className="text-sm leading-relaxed" style={{ color: c.text }}>
                <span className="text-xs uppercase tracking-wider block mb-1" style={{ color: c.textMuted }}>
                  Body text (primary)
                </span>
                Explore your cozy corner of the world. Place items, design rooms,
                visit friends, and discover hidden treasures scattered across the
                neighborhood. Every room tells a story.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: c.textMuted }}>
                <span className="text-xs uppercase tracking-wider block mb-1" style={{ color: c.textMuted }}>
                  Body text (muted)
                </span>
                Items can be collected from various sources including the daily
                shop, friend trades, seasonal events, and rare exploration finds.
              </p>
              <p className="text-sm leading-relaxed">
                <span className="text-xs uppercase tracking-wider block mb-1" style={{ color: c.textMuted }}>
                  Accent text colors
                </span>
                <span style={{ color: c.amber }}>Amber accent</span>
                {" / "}
                <span style={{ color: c.ember }}>Ember accent</span>
                {" / "}
                <span style={{ color: c.warmRed }}>Warm red accent</span>
              </p>
            </div>

            {/* Labels and captions */}
            <div className="flex gap-8 items-baseline">
              <div>
                <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: c.textMuted }}>
                  Label
                </span>
                <span className="text-xs font-medium" style={{ color: c.text }}>
                  Item Name
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: c.textMuted }}>
                  Caption
                </span>
                <span className="text-[10px]" style={{ color: c.textMuted }}>
                  Last edited 2 hours ago
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: c.textMuted }}>
                  Stat
                </span>
                <span className="text-lg font-heading" style={{ color: c.amber }}>
                  247
                </span>
              </div>
            </div>
          </div>
        </Section>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            BUTTONS
            ════════════════════════════════════ */}
        <Section theme={theme} title="Buttons" subtitle="Actions and interactions">
          {/* Variant row */}
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase tracking-wider block mb-3" style={{ color: c.textMuted }}>
                Variants
              </span>
              <div className="flex flex-wrap gap-3 items-center">
                <Button variant="default">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>

            {/* Size row */}
            <div>
              <span className="text-xs uppercase tracking-wider block mb-3" style={{ color: c.textMuted }}>
                Sizes
              </span>
              <div className="flex flex-wrap gap-3 items-center">
                <Button size="xs">Extra Small</Button>
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            {/* Pixel button */}
            <div>
              <span className="text-xs uppercase tracking-wider block mb-3" style={{ color: c.textMuted }}>
                Pixel-Art Style
              </span>
              <div className="flex flex-wrap gap-3 items-center">
                <button className="pixel-btn text-sm">Place Item</button>
                <button className="pixel-btn text-sm" style={{
                  backgroundColor: c.ember,
                  borderColor: theme === "dark" ? "#b05a1e" : "#8a4510",
                  boxShadow: theme === "dark"
                    ? "0 2px 0 #8a4516, 0 3px 0 rgba(0,0,0,0.3)"
                    : "0 2px 0 #6e370c, 0 3px 0 rgba(0,0,0,0.12)",
                }}>
                  Build Room
                </button>
                <button className="pixel-btn text-sm" style={{
                  backgroundColor: c.green,
                  borderColor: theme === "dark" ? "#449944" : "#2d6e2d",
                  boxShadow: theme === "dark"
                    ? "0 2px 0 #357a35, 0 3px 0 rgba(0,0,0,0.3)"
                    : "0 2px 0 #1f521f, 0 3px 0 rgba(0,0,0,0.12)",
                }}>
                  Save
                </button>
                <button className="pixel-btn text-sm" style={{
                  backgroundColor: c.warmRed,
                  borderColor: theme === "dark" ? "#9e3a1e" : "#862c18",
                  color: theme === "dark" ? "#faf0e6" : "#faf5ee",
                  boxShadow: theme === "dark"
                    ? "0 2px 0 #7a2d16, 0 3px 0 rgba(0,0,0,0.3)"
                    : "0 2px 0 #6a2212, 0 3px 0 rgba(0,0,0,0.12)",
                }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </Section>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            CARDS — GAME CONTENT
            ════════════════════════════════════ */}
        <Section theme={theme} title="Cards" subtitle="Game content and player info">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Inventory Item Card */}
            <Card className="border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="font-heading text-lg" style={{ color: c.text }}>
                    Enchanted Lantern
                  </CardTitle>
                  <Badge style={{
                    backgroundColor: c.amber + (theme === "dark" ? "26" : "1f"),
                    color: c.amber,
                    borderColor: c.amber + "4d",
                    fontSize: "10px",
                  }}>
                    Rare
                  </Badge>
                </div>
                <CardDescription style={{ color: c.textMuted }}>
                  Illumination item
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Item sprite placeholder */}
                <div className="flex justify-center mb-4">
                  <div
                    className="w-16 h-16 pixelated item-glow"
                    style={{
                      borderRadius: "3px",
                      background: `linear-gradient(135deg, ${c.amber}, ${c.ember})`,
                      boxShadow: theme === "dark"
                        ? "inset -2px -2px 0 rgba(0,0,0,0.2), inset 2px 2px 0 rgba(255,255,255,0.1)"
                        : "inset -2px -2px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.2)",
                    }}
                  />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: c.textMuted }}>
                  A warm lantern that casts a gentle amber glow. Lights up a
                  3-tile radius and attracts fireflies at night.
                </p>
              </CardContent>
              <CardFooter style={{
                borderColor: c.border + "80",
                backgroundColor: c.muted + "80",
              }}>
                <div className="flex w-full items-center justify-between">
                  <span className="text-[10px]" style={{ color: c.textMuted }}>1 of 1 owned</span>
                  <Button size="sm" className="font-heading">
                    Place
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Player Profile Card */}
            <Card className="border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="font-heading text-lg" style={{ color: c.text }}>
                    cozy-wanderer
                  </CardTitle>
                  <Badge style={{
                    backgroundColor: c.ember + (theme === "dark" ? "26" : "1f"),
                    color: c.ember,
                    borderColor: c.ember + "4d",
                    fontSize: "10px",
                  }}>
                    Lv. 24
                  </Badge>
                </div>
                <CardDescription style={{ color: c.textMuted }}>
                  Joined 3 months ago
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Avatar placeholder */}
                <div className="flex justify-center mb-4">
                  <div
                    className="w-16 h-16 pixelated"
                    style={{
                      borderRadius: "3px",
                      background: `linear-gradient(180deg, ${c.ember} 0%, ${c.warmRed} 50%, ${c.wood} 100%)`,
                      boxShadow: theme === "dark"
                        ? "inset -2px -2px 0 rgba(0,0,0,0.2), inset 2px 2px 0 rgba(255,255,255,0.1)"
                        : "inset -2px -2px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.2)",
                    }}
                  />
                </div>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-heading" style={{ color: c.amber }}>142</div>
                    <div className="text-[10px]" style={{ color: c.textMuted }}>Items</div>
                  </div>
                  <div>
                    <div className="text-lg font-heading" style={{ color: c.amber }}>8</div>
                    <div className="text-[10px]" style={{ color: c.textMuted }}>Rooms</div>
                  </div>
                  <div>
                    <div className="text-lg font-heading" style={{ color: c.amber }}>23</div>
                    <div className="text-[10px]" style={{ color: c.textMuted }}>Friends</div>
                  </div>
                </div>
              </CardContent>
              <CardFooter style={{
                borderColor: c.border + "80",
                backgroundColor: c.muted + "80",
              }}>
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.green }} />
                    <span className="text-[10px]" style={{ color: c.green }}>Online</span>
                  </div>
                  <Button variant="outline" size="sm" className="font-heading">
                    Visit
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Building Block Card */}
            <Card className="border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="font-heading text-lg" style={{ color: c.text }}>
                    Oak Planks
                  </CardTitle>
                  <Badge style={{
                    backgroundColor: c.green + (theme === "dark" ? "26" : "1f"),
                    color: c.green,
                    borderColor: c.green + "4d",
                    fontSize: "10px",
                  }}>
                    Natural
                  </Badge>
                </div>
                <CardDescription style={{ color: c.textMuted }}>
                  Building material
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Tile preview */}
                <div className="flex justify-center mb-4">
                  <div
                    className="w-16 h-16 pixelated"
                    style={{
                      borderRadius: "3px",
                      background: `
                        repeating-linear-gradient(
                          0deg,
                          #8b6c42 0px,
                          #8b6c42 7px,
                          #7a5c35 7px,
                          #7a5c35 8px,
                          #9a7c52 8px,
                          #9a7c52 15px,
                          #7a5c35 15px,
                          #7a5c35 16px
                        )
                      `,
                      boxShadow: theme === "dark"
                        ? "inset -2px -2px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.08)"
                        : "inset -2px -2px 0 rgba(0,0,0,0.1), inset 2px 2px 0 rgba(255,255,255,0.15)",
                    }}
                  />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: c.textMuted }}>
                  Sturdy oak planks with a warm grain pattern. A staple
                  building material for cozy interiors.
                </p>
              </CardContent>
              <CardFooter style={{
                borderColor: c.border + "80",
                backgroundColor: c.muted + "80",
              }}>
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-heading" style={{ color: c.amber }}>x64</span>
                  <Button size="sm" className="font-heading">
                    Build
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </Section>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            FORM ELEMENTS
            ════════════════════════════════════ */}
        <Section theme={theme} title="Form Elements" subtitle="Inputs, toggles, and settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input fields */}
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-wider block" style={{ color: c.textMuted }}>
                Text Inputs
              </span>

              <div className="space-y-1.5">
                <label className="text-xs font-medium block" style={{ color: c.text }}>
                  Search items
                </label>
                <Input
                  placeholder="Enchanted lantern..."
                  style={{
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  }}
                  className="placeholder:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium block" style={{ color: c.text }}>
                  Room name
                </label>
                <Input
                  defaultValue="My Cozy Parlor"
                  style={{
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium block" style={{ color: c.text }}>
                  Invite code
                </label>
                <Input
                  placeholder="XXXX-XXXX"
                  className="font-mono tracking-widest placeholder:opacity-50"
                  style={{
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    color: c.text,
                  }}
                />
              </div>
            </div>

            {/* Switch toggles */}
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-wider block" style={{ color: c.textMuted }}>
                Settings
              </span>

              <Card className="border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium" style={{ color: c.text }}>
                        Grid snap
                      </div>
                      <div className="text-[10px]" style={{ color: c.textMuted }}>
                        Snap items to tile grid
                      </div>
                    </div>
                    <Switch
                      checked={gridSnap}
                      onCheckedChange={setGridSnap}
                    />
                  </div>

                  <div className="h-px" style={{ backgroundColor: c.border + "80" }} />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium" style={{ color: c.text }}>
                        Show guides
                      </div>
                      <div className="text-[10px]" style={{ color: c.textMuted }}>
                        Display alignment guides
                      </div>
                    </div>
                    <Switch
                      checked={showGuides}
                      onCheckedChange={setShowGuides}
                    />
                  </div>

                  <div className="h-px" style={{ backgroundColor: c.border + "80" }} />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium" style={{ color: c.text }}>
                        Auto-save
                      </div>
                      <div className="text-[10px]" style={{ color: c.textMuted }}>
                        Save changes every 30 seconds
                      </div>
                    </div>
                    <Switch
                      checked={autoSave}
                      onCheckedChange={setAutoSave}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </Section>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            INVENTORY GRID
            ════════════════════════════════════ */}
        <Section theme={theme} title="Inventory Grid" subtitle="Tactile item management">
          <div
            className="p-4 rounded-sm border-2"
            style={{
              borderColor: c.border,
              backgroundColor: c.surface,
              boxShadow: theme === "dark"
                ? "inset 0 2px 8px rgba(0,0,0,0.3)"
                : "inset 0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            {/* Grid -- 6 columns x 4 rows */}
            <div className="grid grid-cols-6 gap-2 mb-4">
              {INITIAL_INVENTORY.map((slot, i) => {
                const isSelected = i === selectedSlot;
                const color = slotColor(slot);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedSlot(i)}
                    className={[
                      "inventory-slot w-12 h-12 flex items-center justify-center cursor-pointer",
                      isSelected ? "selected" : "",
                      slot.state === "empty" && !isSelected ? "empty" : "",
                    ].join(" ")}
                    title={slot.label ?? `Empty slot ${i + 1}`}
                  >
                    {slot.state !== "empty" && (
                      <div
                        className={`w-8 h-8 pixelated ${isSelected ? "item-glow" : ""}`}
                        style={{
                          backgroundColor: color,
                          borderRadius: "2px",
                          boxShadow: theme === "dark"
                            ? "inset -1px -1px 0 rgba(0,0,0,0.25), inset 1px 1px 0 rgba(255,255,255,0.15)"
                            : "inset -1px -1px 0 rgba(0,0,0,0.15), inset 1px 1px 0 rgba(255,255,255,0.25)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected item info */}
            <div className="flex items-center gap-3 mb-4 px-1">
              {INITIAL_INVENTORY[selectedSlot]?.state !== "empty" ? (
                <>
                  <div
                    className="w-6 h-6 item-glow pixelated flex-shrink-0"
                    style={{
                      backgroundColor: slotColor(INITIAL_INVENTORY[selectedSlot]!),
                      borderRadius: "2px",
                      boxShadow: theme === "dark"
                        ? "inset -1px -1px 0 rgba(0,0,0,0.25), inset 1px 1px 0 rgba(255,255,255,0.15)"
                        : "inset -1px -1px 0 rgba(0,0,0,0.15), inset 1px 1px 0 rgba(255,255,255,0.25)",
                    }}
                  />
                  <span className="text-xs font-heading" style={{ color: c.text }}>
                    {INITIAL_INVENTORY[selectedSlot]?.label}
                  </span>
                  <span className="text-[10px]" style={{ color: c.textMuted }}>
                    Slot {selectedSlot + 1}
                  </span>
                </>
              ) : (
                <span className="text-[10px]" style={{ color: c.textMuted }}>
                  Empty slot {selectedSlot + 1}
                </span>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex gap-2 pt-3 border-t-2" style={{ borderColor: c.border }}>
              {tools.map((tool, i) => (
                <button
                  key={tool.name}
                  onClick={() => setSelectedTool(i)}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-sm transition-colors cursor-pointer border"
                  style={{
                    backgroundColor: i === selectedTool ? c.muted : "transparent",
                    borderColor: i === selectedTool ? c.amber + "66" : "transparent",
                  }}
                >
                  <div
                    className="w-5 h-5"
                    style={{
                      backgroundColor: tool.color,
                      borderRadius: "2px",
                      opacity: i === selectedTool ? 1 : 0.6,
                      boxShadow:
                        i === selectedTool
                          ? `0 0 6px ${tool.color}40`
                          : "none",
                    }}
                  />
                  <span
                    className="text-[10px]"
                    style={{
                      color: i === selectedTool ? c.text : c.textMuted,
                    }}
                  >
                    {tool.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            RARITY BADGES
            ════════════════════════════════════ */}
        <Section theme={theme} title="Rarity System" subtitle="Item tiers and collectibility">
          {(() => {
            const uncommonColor = theme === "dark" ? "#5cb85c" : "#3d8c3d";
            const rareColor = c.amber;
            const epicColor = theme === "dark" ? "#a855f7" : "#8b3dd4";
            const legendaryColor = c.ember;
            const opSuffix = theme === "dark" ? "/10" : "/8";
            return (
              <>
                <div className="flex flex-wrap gap-3 items-center">
                  <Badge
                    variant="outline"
                    className={`border-[#8a8a8a]/40 text-[#8a8a8a] bg-[#8a8a8a]${opSuffix} text-xs px-3 py-1 h-auto`}
                  >
                    Common
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs px-3 py-1 h-auto"
                    style={{
                      borderColor: uncommonColor + "66",
                      color: uncommonColor,
                      backgroundColor: uncommonColor + "1a",
                    }}
                  >
                    Uncommon
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs px-3 py-1 h-auto"
                    style={{
                      borderColor: rareColor + "66",
                      color: rareColor,
                      backgroundColor: rareColor + "1a",
                    }}
                  >
                    Rare
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs px-3 py-1 h-auto"
                    style={{
                      borderColor: epicColor + "66",
                      color: epicColor,
                      backgroundColor: epicColor + "1a",
                    }}
                  >
                    Epic
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs px-3 py-1 h-auto rarity-legendary"
                    style={{
                      borderColor: legendaryColor + "66",
                      backgroundColor: legendaryColor + "1a",
                    }}
                  >
                    Legendary
                  </Badge>
                </div>

                {/* Rarity breakdown grid */}
                <div className="grid grid-cols-5 gap-3 mt-4">
                  {[
                    { tier: "Common",    color: "#8a8a8a", drop: "60%",  glow: false },
                    { tier: "Uncommon",  color: uncommonColor, drop: "25%",  glow: false },
                    { tier: "Rare",      color: rareColor, drop: "10%",  glow: true  },
                    { tier: "Epic",      color: epicColor, drop: "4%",   glow: true  },
                    { tier: "Legendary", color: legendaryColor, drop: "1%",   glow: true  },
                  ].map((r) => (
                    <div
                      key={r.tier}
                      className="text-center p-3 rounded-sm border"
                      style={{ borderColor: c.border, backgroundColor: c.surface }}
                    >
                      <div
                        className="w-8 h-8 mx-auto mb-2 pixelated"
                        style={{
                          backgroundColor: r.color,
                          borderRadius: "2px",
                          boxShadow: r.glow
                            ? `0 0 8px ${r.color}${theme === "dark" ? "40" : "30"}, inset -1px -1px 0 rgba(0,0,0,${theme === "dark" ? "0.25" : "0.15"}), inset 1px 1px 0 rgba(255,255,255,${theme === "dark" ? "0.15" : "0.25"})`
                            : `inset -1px -1px 0 rgba(0,0,0,${theme === "dark" ? "0.25" : "0.15"}), inset 1px 1px 0 rgba(255,255,255,${theme === "dark" ? "0.15" : "0.25"})`,
                        }}
                      />
                      <div
                        className="text-[10px] font-heading mb-0.5"
                        style={{ color: r.color }}
                      >
                        {r.tier}
                      </div>
                      <div className="text-[10px]" style={{ color: c.textMuted }}>
                        {r.drop} drop
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </Section>

        <div className="section-divider" />

        {/* ════════════════════════════════════
            COMPOSITE MOCKUP
            ════════════════════════════════════ */}
        <Section theme={theme} title="Game UI Composition" subtitle="How elements come together">
          <div className="border-2 rounded-sm overflow-hidden" style={{
            borderColor: c.border,
            backgroundColor: c.deep,
          }}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b-2" style={{
              borderColor: c.border,
              backgroundColor: c.surface,
            }}>
              <div className="flex items-center gap-3">
                <FireDecoration theme={theme} />
                <span className="font-heading text-sm" style={{ color: c.text }}>
                  Cozy Corner
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.green }} />
                  <span className="text-[10px]" style={{ color: c.textMuted }}>3 online</span>
                </div>
                <Badge style={{
                  backgroundColor: c.amber + (theme === "dark" ? "26" : "1f"),
                  color: c.amber,
                  borderColor: c.amber + "4d",
                  fontSize: "10px",
                }}>
                  Lv. 24
                </Badge>
              </div>
            </div>

            {/* Main area with "room" preview */}
            <div className="relative h-64 flex items-center justify-center">
              {/* Fake room grid background */}
              <div
                className="absolute inset-0"
                style={{
                  opacity: theme === "dark" ? 0.1 : 0.15,
                  backgroundImage: `
                    linear-gradient(${c.border} 1px, transparent 1px),
                    linear-gradient(90deg, ${c.border} 1px, transparent 1px)
                  `,
                  backgroundSize: "32px 32px",
                }}
              />

              {/* Floor tiles */}
              <div className="absolute inset-4 opacity-20 rounded-sm" style={{
                background: `linear-gradient(135deg, ${c.muted} 25%, ${c.surface} 50%, ${c.muted} 75%)`,
              }} />

              {/* Center avatar placeholder */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className="w-10 h-14 pixelated"
                  style={{
                    background: `linear-gradient(180deg, ${c.ember} 0%, ${c.warmRed} 40%, ${c.border} 100%)`,
                    borderRadius: "2px 2px 0 0",
                    boxShadow: theme === "dark"
                      ? "0 2px 8px rgba(0,0,0,0.5)"
                      : "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                />
                <div className="px-2 py-0.5 rounded-sm border" style={{
                  backgroundColor: c.surface + "e6",
                  borderColor: c.border,
                }}>
                  <span className="text-[10px] font-heading" style={{ color: c.text }}>
                    cozy-wanderer
                  </span>
                </div>
              </div>

              {/* Placed items in the "room" */}
              <div
                className="absolute top-8 left-12 w-8 h-8 pixelated item-glow"
                style={{
                  background: `linear-gradient(135deg, ${c.amber}, ${c.ember})`,
                  borderRadius: "2px",
                  boxShadow: theme === "dark"
                    ? "0 0 12px rgba(246,173,85,0.2)"
                    : "0 0 12px rgba(201,123,26,0.15)",
                }}
              />
              <div
                className="absolute bottom-12 right-16 w-10 h-10 pixelated"
                style={{
                  background: `linear-gradient(135deg, ${c.green}, ${c.darkGreen})`,
                  borderRadius: "2px",
                }}
              />
              <div
                className="absolute top-16 right-24 w-6 h-6 pixelated"
                style={{
                  background: `linear-gradient(135deg, ${c.purple}, ${c.darkPurple})`,
                  borderRadius: "2px",
                  boxShadow: theme === "dark"
                    ? "0 0 8px rgba(168,85,247,0.3)"
                    : "0 0 8px rgba(139,61,212,0.2)",
                }}
              />
            </div>

            {/* Bottom HUD */}
            <div className="flex items-center gap-2 px-4 py-2 border-t-2" style={{
              borderColor: c.border,
              backgroundColor: c.surface,
            }}>
              {/* Mini inventory slots */}
              {[
                { color: c.amber, active: true },
                { color: c.ember, active: false },
                { color: c.green, active: false },
                { color: c.purple, active: false },
                { color: undefined, active: false },
                { color: undefined, active: false },
                { color: undefined, active: false },
                { color: undefined, active: false },
              ].map((s, i) => (
                <div
                  key={i}
                  className="w-8 h-8 flex items-center justify-center rounded-sm"
                  style={{
                    border: s.active
                      ? `1px solid ${c.amber}`
                      : s.color
                        ? `1px solid ${c.border}`
                        : `1px dashed ${c.border}80`,
                    backgroundColor: s.active
                      ? c.muted
                      : s.color
                        ? c.muted + "80"
                        : "transparent",
                    boxShadow: s.active
                      ? theme === "dark"
                        ? "0 0 6px rgba(246,173,85,0.2)"
                        : "0 0 6px rgba(201,123,26,0.15)"
                      : undefined,
                  }}
                >
                  {s.color && (
                    <div
                      className="w-5 h-5 pixelated"
                      style={{
                        backgroundColor: s.color,
                        borderRadius: "1px",
                      }}
                    />
                  )}
                </div>
              ))}

              <div className="flex-1" />

              <button className="pixel-btn text-[10px] py-1 px-2">
                Edit Mode
              </button>
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════
            FOOTER
            ════════════════════════════════════ */}
        <footer className="pt-8 pb-12 text-center space-y-3">
          <div className="section-divider mb-8" />
          <div className="flex items-center justify-center gap-3">
            <FireDecoration theme={theme} />
            <span className="font-heading text-lg" style={{ color: c.textMuted }}>
              Cozy Corner
            </span>
            <FireDecoration theme={theme} />
          </div>
          <p className="text-[10px]" style={{ color: c.border }}>
            Warm Hearth Design System &mdash; Option 1 &mdash; Dark & Light
          </p>
        </footer>
      </div>
    </div>
  );
}

// ── Mount ─────────────────────────────────────

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<WarmHearthShowcase />);
}
