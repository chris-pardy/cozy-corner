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

/* ─── Theme colors object ─── */

type Theme = "dark" | "light";

const themeColors = {
  dark: {
    gold: "#fbbf24",
    goldWarm: "#f59e0b",
    starlight: "#60a5fa",
    starlightGlow: "0 0 4px rgba(96,165,250,0.6)",
    deep: "#08081a",
    surface: "#10102a",
    muted: "#1a1a3e",
    border: "#2a2a5e",
    lavender: "#e8e0f8",
    textMuted: "#7878a8",
    destructive: "#ef4444",
    epic: "#c084fc",
    epicDark: "#8b5cf6",
    epicBg: "#2a1a3e",
    rareBg: "#2a1a0e",
    commonBg: "#3a3a5e",
    commonBorder: "#4a4a6e",
    uncommonBg: "#1a2a4e",
    legendaryBg: "#2a1a0e",
    profileGradientTo: "#2a1a5e",
    marbleBase: "#1a1a4e",
    marbleTo: "#2a2a6e",
    green: "#3a5a3e",
    commonSwatch: "#3a3a5e",
    craftDefault: "#2a2a5e",
  },
  light: {
    gold: "#b8860b",
    goldWarm: "#d4960c",
    starlight: "#3b6ec7",
    starlightGlow: "0 0 4px rgba(59,110,199,0.5)",
    deep: "#f0f0fa",
    surface: "#f8f8ff",
    muted: "#e4e4f0",
    border: "#c0c0d8",
    lavender: "#1a1a3e",
    textMuted: "#6868a0",
    destructive: "#dc2626",
    epic: "#7c3aed",
    epicDark: "#6d28d9",
    epicBg: "#f0e0fa",
    rareBg: "#f8eedc",
    commonBg: "#d8d8e8",
    commonBorder: "#c0c0d0",
    uncommonBg: "#dce8f8",
    legendaryBg: "#f8eedc",
    profileGradientTo: "#d0d0e8",
    marbleBase: "#d8d8f0",
    marbleTo: "#c8c8e8",
    green: "#4a8a4e",
    commonSwatch: "#d8d8e8",
    craftDefault: "#c0c0d8",
  },
} as const;

/* ─── Decorative Star ─── */

function Star({
  size = 4,
  x,
  y,
  className = "",
}: {
  size?: number;
  x: number;
  y: number;
  className?: string;
}) {
  return (
    <span
      className={`absolute star-dot ${className}`}
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
      }}
    />
  );
}

/* ─── Section Wrapper ─── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="star-dot-sm twinkle" />
        <h2 className="font-heading text-2xl text-gold">{title}</h2>
        <div className="constellation-line flex-1" />
      </div>
      {children}
    </section>
  );
}

/* ─── Color Swatch ─── */

function Swatch({
  color,
  name,
  hex,
}: {
  color: string;
  name: string;
  hex: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-16 h-16 border-2 border-indigo-border rounded-sm"
        style={{ background: color }}
      />
      <span className="font-heading text-xs text-lavender">{name}</span>
      <span className="font-body text-[10px] text-text-muted">{hex}</span>
    </div>
  );
}

/* ─── Crafting Slot ─── */

function CraftSlot({
  filled,
  color,
  c,
}: {
  filled?: boolean;
  color?: string;
  c: (typeof themeColors)["dark"];
}) {
  return (
    <div className={`craft-slot ${filled ? "craft-slot-filled" : ""}`}>
      {filled && (
        <div
          className="w-8 h-8 rounded-sm"
          style={{ background: color || c.craftDefault }}
        />
      )}
    </div>
  );
}

/* ─── Rarity Badge ─── */

function RarityBadge({
  rarity,
  c,
}: {
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  c: (typeof themeColors)["dark"];
}) {
  const styles: Record<string, string> = {
    Common: `bg-[${c.commonBg}] text-text-muted border border-[${c.commonBorder}]`,
    Uncommon: `bg-[${c.uncommonBg}] text-starlight border border-starlight/30`,
    Rare: `bg-[${c.rareBg}] text-gold border border-gold/40`,
    Epic: `bg-[${c.epicBg}] text-[${c.epic}] border border-[${c.epic}]/40`,
    Legendary: "",
  };

  if (rarity === "Legendary") {
    return (
      <span
        className="inline-flex h-5 items-center px-2 rounded-sm text-xs font-heading border border-gold/50 gold-shimmer"
        style={{ background: c.legendaryBg }}
      >
        {rarity}
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-5 items-center px-2 rounded-sm text-xs font-heading border"
      style={{
        background: rarity === "Common" ? c.commonBg
          : rarity === "Uncommon" ? c.uncommonBg
          : rarity === "Rare" ? c.rareBg
          : c.epicBg,
        borderColor: rarity === "Common" ? c.commonBorder
          : rarity === "Uncommon" ? `${c.starlight}4d`
          : rarity === "Rare" ? `${c.gold}66`
          : `${c.epic}66`,
        color: rarity === "Common" ? c.textMuted
          : rarity === "Uncommon" ? c.starlight
          : rarity === "Rare" ? c.gold
          : c.epic,
      }}
    >
      {rarity}
    </span>
  );
}

/* ─── Recipe Row ─── */

function RecipeRow({
  name,
  ingredients,
  rarity,
  c,
}: {
  name: string;
  ingredients: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  c: (typeof themeColors)["dark"];
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-indigo-border/50 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 bg-indigo-muted border border-indigo-border rounded-sm" />
        <div>
          <span className="font-heading text-sm text-lavender">{name}</span>
          <span className="font-body text-[10px] text-text-muted ml-2">
            {ingredients}
          </span>
        </div>
      </div>
      <RarityBadge rarity={rarity} c={c} />
    </div>
  );
}

/* ─── Theme Toggle Button ─── */

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 font-heading text-sm transition-all duration-300"
      style={{
        background: theme === "dark" ? "#10102a" : "#f8f8ff",
        borderColor: theme === "dark" ? "#2a2a5e" : "#c0c0d8",
        color: theme === "dark" ? "#fbbf24" : "#b8860b",
      }}
    >
      {theme === "dark" ? (
        <>
          <span style={{ fontSize: 16 }}>&#9788;</span>
          Light
        </>
      ) : (
        <>
          <span style={{ fontSize: 16 }}>&#9790;</span>
          Dark
        </>
      )}
    </button>
  );
}

/* ─── Main App ─── */

function App() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [highPrecision, setHighPrecision] = useState(false);

  const c = themeColors[theme];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto space-y-0">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />

      {/* ─── Header ─── */}
      <header className="relative py-16 text-center overflow-hidden">
        {/* Scattered stars */}
        <Star x={8} y={15} size={3} className="twinkle" />
        <Star x={18} y={60} size={2} className="twinkle-slow twinkle-delay-1" />
        <Star x={32} y={20} size={4} className="twinkle twinkle-delay-2" />
        <Star x={72} y={25} size={3} className="twinkle-slow" />
        <Star x={85} y={55} size={2} className="twinkle twinkle-delay-3" />
        <Star x={92} y={15} size={4} className="twinkle twinkle-delay-1" />
        <Star x={55} y={70} size={2} className="twinkle-slow twinkle-delay-2" />
        <Star x={42} y={80} size={3} className="twinkle twinkle-delay-3" />

        <div className="relative z-10 space-y-4">
          <h1 className="font-heading text-6xl text-gold tracking-wide">
            Starlit Workshop
          </h1>
          <p className="font-body text-lg text-text-muted">
            Design System &middot; Dark &amp; Light &middot; Option 3 of 5
          </p>
          <p className="font-heading text-xl text-starlight">
            Where constellations guide the craft
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="star-dot-sm twinkle" />
            <span className="constellation-line w-16 inline-block" />
            <span className="star-dot twinkle twinkle-delay-1" />
            <span className="constellation-line w-24 inline-block" />
            <span className="star-dot-sm twinkle twinkle-delay-2" />
            <span className="constellation-line w-16 inline-block" />
            <span className="star-dot-sm twinkle twinkle-delay-3" />
          </div>
        </div>
      </header>

      <div className="section-divider" />

      {/* ─── Color Palette ─── */}
      <Section title="Color Palette">
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-4">
          <Swatch color={c.deep} name="Deep" hex={c.deep} />
          <Swatch color={c.surface} name="Surface" hex={c.surface} />
          <Swatch color={c.muted} name="Muted" hex={c.muted} />
          <Swatch color={c.border} name="Border" hex={c.border} />
          <Swatch color={c.lavender} name={theme === "dark" ? "Lavender" : "Text"} hex={c.lavender} />
          <Swatch color={c.textMuted} name="Text Dim" hex={c.textMuted} />
          <Swatch color={c.gold} name="Gold" hex={c.gold} />
          <Swatch color={c.goldWarm} name="Warm Gold" hex={c.goldWarm} />
          <Swatch color={c.starlight} name={theme === "dark" ? "Starlight" : "Blueprint"} hex={c.starlight} />
          <Swatch color={c.destructive} name="Destructive" hex={c.destructive} />
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Typography ─── */}
      <Section title="Typography">
        <div className="space-y-6 bg-indigo-surface border border-indigo-border rounded-sm p-6 blueprint-grid">
          <div className="space-y-3">
            <h1 className="font-heading text-5xl text-gold">
              Heading 1 &mdash; Pixelify Sans
            </h1>
            <h2 className="font-heading text-4xl text-lavender">
              Heading 2 &mdash; Constellations
            </h2>
            <h3 className="font-heading text-3xl text-starlight">
              Heading 3 &mdash; {theme === "dark" ? "Starlight Blue" : "Blueprint Blue"}
            </h3>
            <h4 className="font-heading text-2xl text-gold-warm">
              Heading 4 &mdash; Warm Gold
            </h4>
          </div>

          <div className="constellation-line" />

          <div className="space-y-2">
            <p className="font-body text-base text-lavender">
              Body text in JetBrains Mono &mdash; clear, precise, crafted for
              readability in {theme === "dark" ? "dark indigo" : "bright parchment"} environments.
            </p>
            <p className="font-body text-sm text-text-muted">
              Secondary text &mdash; muted {theme === "dark" ? "lavender" : "indigo"} for supplementary
              information and workshop notes.
            </p>
            <p className="font-body text-xs text-gold">
              Accent text &mdash; gold highlights for important values, stats,
              and celestial markers.
            </p>
          </div>
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Buttons ─── */}
      <Section title="Buttons">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button className="inline-flex items-center gap-2 px-4 py-2 font-heading text-sm text-gold border-2 border-gold/50 bg-gold/5 rounded-sm pulse-glow hover:bg-gold/10 transition-colors">
              <span className="star-dot" style={{ width: 6, height: 6 }} />
              Star Action
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 font-heading text-sm text-starlight border-2 border-starlight/30 bg-starlight/5 rounded-sm hover:bg-starlight/10 transition-colors">
              <span
                className="star-dot"
                style={{
                  width: 6,
                  height: 6,
                  background: c.starlight,
                  boxShadow: c.starlightGlow,
                }}
              />
              Celestial
            </button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Cards — Game Content ─── */}
      <Section title="Game Content Cards">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Inventory Item Card */}
          <Card className="card-blueprint">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="font-heading text-gold">
                    Celestial Compass
                  </CardTitle>
                  <CardDescription className="text-text-muted">
                    Navigation Tool
                  </CardDescription>
                </div>
                <RarityBadge rarity="Legendary" c={c} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-indigo-muted border-2 border-gold/30 rounded-sm flex items-center justify-center relative float-gentle">
                  <div className="w-12 h-12 bg-gradient-to-br from-gold to-gold-warm rounded-sm" />
                  <div className="absolute -top-1 -right-1 star-dot twinkle" />
                </div>
                <p className="text-xs text-text-muted text-center">
                  Forged from starlight fragments, this compass always points
                  toward undiscovered constellations. A true crafter's
                  treasure.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between text-xs text-text-muted">
              <span>Qty: 1</span>
              <span className="text-gold">+15 Navigation</span>
            </CardFooter>
          </Card>

          {/* Player Profile Card */}
          <Card className="card-blueprint">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-sm bg-gradient-to-br from-indigo-muted border-2 border-gold/40 flex items-center justify-center"
                  style={{ backgroundImage: `linear-gradient(to bottom right, ${c.muted}, ${c.profileGradientTo})` }}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-gold to-starlight rounded-sm" />
                </div>
                <div>
                  <CardTitle className="font-heading text-lavender">
                    Stargazer
                  </CardTitle>
                  <CardDescription className="text-text-muted flex items-center gap-2">
                    <Badge variant="outline" className="text-starlight border-starlight/30 text-[10px] rounded-sm">
                      Lv. 42
                    </Badge>
                    <span>Constellation III</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-indigo-muted border border-indigo-border rounded-sm p-2">
                  <div className="font-heading text-lg text-gold">847</div>
                  <div className="text-[10px] text-text-muted">Items</div>
                </div>
                <div className="bg-indigo-muted border border-indigo-border rounded-sm p-2">
                  <div className="font-heading text-lg text-starlight">23</div>
                  <div className="text-[10px] text-text-muted">Rooms</div>
                </div>
                <div className="bg-indigo-muted border border-indigo-border rounded-sm p-2">
                  <div className="font-heading text-lg text-gold-warm">
                    156
                  </div>
                  <div className="text-[10px] text-text-muted">Friends</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="text-xs text-text-muted">
              <span>Member since the First Star</span>
            </CardFooter>
          </Card>

          {/* Building Block Card */}
          <Card className="card-blueprint">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="font-heading text-starlight">
                    Astral Marble
                  </CardTitle>
                  <CardDescription className="text-text-muted">
                    Building Material
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-sm text-[10px]">
                  Celestial
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-sm border border-indigo-border"
                      style={{
                        background: `linear-gradient(135deg, ${c.marbleBase} ${40 + i * 5}%, ${c.marbleTo})`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-text-muted text-center">
                  Polished deep-space marble infused with ambient starlight.
                  Perfect for workshop floors and observatory walls.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between text-xs text-text-muted">
              <span>Stack: 64</span>
              <span className="text-starlight">Tier 3 Crafting</span>
            </CardFooter>
          </Card>
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Form Elements ─── */}
      <Section title="Form Elements">
        <div className="bg-indigo-surface border border-indigo-border rounded-sm p-6 space-y-6">
          <h3 className="font-heading text-lg text-gold">
            Workshop Settings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="font-heading text-sm text-lavender">
                Project Name
              </label>
              <Input
                placeholder="My Starlit Creation..."
                className="bg-indigo-muted border-indigo-border text-lavender placeholder:text-text-muted rounded-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="font-heading text-sm text-lavender">
                Grid Size
              </label>
              <Input
                type="number"
                defaultValue={16}
                className="bg-indigo-muted border-indigo-border text-lavender rounded-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="font-heading text-sm text-lavender">
                Blueprint ID
              </label>
              <Input
                placeholder="at://did:plc:.../blueprint"
                className="bg-indigo-muted border-indigo-border text-lavender placeholder:text-text-muted rounded-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="font-heading text-sm text-lavender">
                Precision (px)
              </label>
              <Input
                type="number"
                defaultValue={1}
                className="bg-indigo-muted border-indigo-border text-lavender rounded-sm"
              />
            </div>
          </div>

          <div className="constellation-line" />

          <div className="space-y-4">
            <h4 className="font-heading text-sm text-starlight">
              Toggle Settings
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-heading text-sm text-lavender">
                    Snap to Grid
                  </span>
                  <p className="text-[10px] text-text-muted">
                    Align placements to grid intersections
                  </p>
                </div>
                <Switch
                  checked={snapToGrid}
                  onCheckedChange={setSnapToGrid}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-heading text-sm text-lavender">
                    Show Grid Overlay
                  </span>
                  <p className="text-[10px] text-text-muted">
                    Display construction grid lines
                  </p>
                </div>
                <Switch
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-heading text-sm text-lavender">
                    High Precision Mode
                  </span>
                  <p className="text-[10px] text-text-muted">
                    Sub-pixel accuracy for detailed work
                  </p>
                </div>
                <Switch
                  checked={highPrecision}
                  onCheckedChange={setHighPrecision}
                />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Crafting Workshop ─── */}
      <Section title="Crafting Workshop">
        <div className="bg-indigo-surface border border-indigo-border rounded-sm p-6 blueprint-grid space-y-6">
          <div className="flex items-center gap-2">
            <span className="star-dot-sm" />
            <h3 className="font-heading text-lg text-lavender">
              Astral Workbench
            </h3>
          </div>

          {/* Crafting Grid */}
          <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">
            {/* 3x3 Input Grid */}
            <div className="space-y-1">
              <div className="text-[10px] text-text-muted font-heading mb-2 text-center">
                INGREDIENTS
              </div>
              <div className="grid grid-cols-3 gap-1">
                <CraftSlot c={c} />
                <CraftSlot filled color={c.starlight} c={c} />
                <CraftSlot c={c} />
                <CraftSlot filled color={c.gold} c={c} />
                <CraftSlot filled color={c.epic} c={c} />
                <CraftSlot filled color={c.gold} c={c} />
                <CraftSlot c={c} />
                <CraftSlot filled color={c.starlight} c={c} />
                <CraftSlot c={c} />
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-text-muted text-2xl font-heading sm:rotate-0 rotate-90">
                &raquo;
              </div>
              <div className="text-[10px] text-text-muted font-heading">
                CRAFT
              </div>
            </div>

            {/* Output Slot */}
            <div className="space-y-1">
              <div className="text-[10px] text-text-muted font-heading mb-2 text-center">
                RESULT
              </div>
              <div className="craft-output">
                <div className="w-10 h-10 bg-gradient-to-br from-gold via-gold-warm to-gold rounded-sm relative">
                  <div className="absolute -top-1 -right-1 star-dot twinkle" style={{ width: 3, height: 3 }} />
                  <div className="absolute -bottom-1 -left-1 star-dot twinkle twinkle-delay-2" style={{ width: 2, height: 2 }} />
                </div>
              </div>
            </div>
          </div>

          <div className="constellation-line" />

          {/* Recipe List */}
          <div>
            <div className="text-[10px] text-text-muted font-heading mb-2">
              KNOWN RECIPES
            </div>
            <div className="bg-indigo-deep border border-indigo-border rounded-sm">
              <RecipeRow
                name="Starlight Lantern"
                ingredients="2x Glass + 1x Star Shard"
                rarity="Common"
                c={c}
              />
              <RecipeRow
                name="Constellation Map"
                ingredients="3x Parchment + 1x Astral Ink"
                rarity="Uncommon"
                c={c}
              />
              <RecipeRow
                name="Nebula Prism"
                ingredients="2x Crystal + 2x Starlight + 1x Gold"
                rarity="Rare"
                c={c}
              />
              <RecipeRow
                name="Celestial Compass"
                ingredients="1x Nebula Prism + 2x Gold + 4x Star Shard"
                rarity="Legendary"
                c={c}
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Rarity Badges ─── */}
      <Section title="Rarity System">
        <div className="flex flex-wrap gap-4 items-center">
          <RarityBadge rarity="Common" c={c} />
          <RarityBadge rarity="Uncommon" c={c} />
          <RarityBadge rarity="Rare" c={c} />
          <RarityBadge rarity="Epic" c={c} />
          <RarityBadge rarity="Legendary" c={c} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-4">
          {(
            [
              {
                rarity: "Common",
                color: c.commonSwatch,
                desc: "Everyday finds",
                pct: "45%",
              },
              {
                rarity: "Uncommon",
                color: c.starlight,
                desc: "Notable discoveries",
                pct: "30%",
              },
              {
                rarity: "Rare",
                color: c.gold,
                desc: "Prized treasures",
                pct: "15%",
              },
              {
                rarity: "Epic",
                color: c.epic,
                desc: "Mythical artifacts",
                pct: "8%",
              },
              {
                rarity: "Legendary",
                color: c.gold,
                desc: "One of a kind",
                pct: "2%",
              },
            ] as const
          ).map((item) => (
            <div
              key={item.rarity}
              className="bg-indigo-surface border border-indigo-border rounded-sm p-3 text-center space-y-2"
            >
              <div
                className="w-8 h-8 rounded-sm mx-auto border"
                style={{
                  background: item.color,
                  borderColor: `${item.color}66`,
                }}
              />
              <RarityBadge rarity={item.rarity} c={c} />
              <p className="text-[10px] text-text-muted">{item.desc}</p>
              <p className="font-heading text-xs text-lavender">
                {item.pct} drop rate
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Game UI Mockup — Inventory ─── */}
      <Section title="Inventory Preview">
        <div className="bg-indigo-surface border border-indigo-border rounded-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg text-lavender">
              Stargazer's Satchel
            </h3>
            <span className="font-body text-xs text-text-muted">
              24 / 36 slots
            </span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-9 gap-1">
            {Array.from({ length: 36 }).map((_, i) => {
              const filledSlots: Record<
                number,
                { color: string; glow?: boolean }
              > = {
                0: { color: c.gold, glow: true },
                1: { color: c.starlight },
                2: { color: c.starlight },
                3: { color: c.epic },
                5: { color: c.goldWarm },
                6: { color: c.green },
                7: { color: c.green },
                8: { color: c.green },
                9: { color: c.gold },
                10: { color: c.epicDark },
                12: { color: c.destructive },
                14: { color: c.starlight },
                15: { color: c.goldWarm },
                18: { color: c.commonSwatch },
                19: { color: c.commonSwatch },
                20: { color: c.gold, glow: true },
                21: { color: c.epic },
                22: { color: c.starlight },
                23: { color: c.green },
                25: { color: c.goldWarm },
                27: { color: c.destructive },
                30: { color: c.epicDark },
                31: { color: c.gold },
              };

              const slot = filledSlots[i];
              return (
                <div
                  key={i}
                  className={`w-full aspect-square bg-indigo-muted border rounded-sm flex items-center justify-center ${
                    slot
                      ? "border-indigo-border"
                      : "border-indigo-border/50"
                  }`}
                  style={
                    slot?.glow
                      ? {
                          boxShadow: `0 0 6px ${slot.color}44`,
                          borderColor: `${slot.color}66`,
                        }
                      : undefined
                  }
                >
                  {slot && (
                    <div
                      className="w-3/5 h-3/5 rounded-sm"
                      style={{ background: slot.color }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 text-[10px] text-text-muted">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gold rounded-sm" /> Legendary
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: c.epic }} /> Epic
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-starlight rounded-sm" /> Rare
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gold-warm rounded-sm" /> Uncommon
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ background: c.commonSwatch }} /> Common
            </span>
          </div>
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Component Showcase ─── */}
      <Section title="Badge Variants">
        <div className="flex flex-wrap gap-3 items-center">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge
            variant="outline"
            className="text-gold border-gold/40 bg-gold/5 rounded-sm"
          >
            Gold Custom
          </Badge>
          <Badge
            variant="outline"
            className="text-starlight border-starlight/30 bg-starlight/5 rounded-sm"
          >
            {theme === "dark" ? "Starlight" : "Blueprint"} Custom
          </Badge>
        </div>
      </Section>

      <div className="section-divider" />

      {/* ─── Theme Summary ─── */}
      <Section title="Theme Summary">
        <div className="bg-indigo-surface border border-indigo-border rounded-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-heading text-sm text-gold">Aesthetic</h4>
              <ul className="text-xs text-text-muted space-y-1">
                <li>{theme === "dark" ? "Deep indigo/navy base" : "Cool lavender-white base"}</li>
                <li>{theme === "dark" ? "Gold star accents throughout" : "Dark goldenrod accents throughout"}</li>
                <li>Blueprint-style card borders</li>
                <li>Geometric, precise, crafted</li>
                <li>Pixelated rendering</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-heading text-sm text-starlight">
                Typography
              </h4>
              <ul className="text-xs text-text-muted space-y-1">
                <li>Pixelify Sans (headings)</li>
                <li>JetBrains Mono (body)</li>
                <li>Gold for emphasis</li>
                <li>{theme === "dark" ? "Starlight blue for accents" : "Blueprint blue for accents"}</li>
                <li>{theme === "dark" ? "Lavender white for body text" : "Deep indigo for body text"}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-heading text-sm text-gold-warm">
                Interactions
              </h4>
              <ul className="text-xs text-text-muted space-y-1">
                <li>Gold focus rings</li>
                <li>Twinkle animations on stars</li>
                <li>Pulse glow on output slots</li>
                <li>2-4px border radius</li>
                <li>Constellation line dividers</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Footer ─── */}
      <footer className="pt-12 pb-8 text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="star-dot-sm twinkle" />
          <span className="constellation-line w-20 inline-block" />
          <span className="star-dot twinkle twinkle-delay-1" />
          <span className="constellation-line w-20 inline-block" />
          <span className="star-dot-sm twinkle twinkle-delay-2" />
        </div>
        <p className="font-heading text-sm text-text-muted">
          Cozy Corner &middot; Starlit Workshop &middot; Option 3 of 5
        </p>
        <p className="font-body text-xs text-text-muted/60">
          Animal Crossing meets Roblox &mdash; where every star tells a story
        </p>
      </footer>
    </div>
  );
}

/* ─── Mount ─── */

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
