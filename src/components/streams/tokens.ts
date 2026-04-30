/**
 * src/components/streams/tokens.ts
 *
 * Locked design tokens for the Streams panel.
 * Single source of truth — every component imports from here.
 * No arbitrary values anywhere in the panel.
 *
 * Spec: #080C1E navy base · #7C3AED accent
 * Spacing: 4 8 12 16 20 24 32 40 48 64 80 96
 * Radius: 8 12 16 20 24 999
 * Shadows: 0 4 14 .06 · 0 10 30 .08 · 0 18 60 .10
 * Motion: transform + opacity only · 150–220ms
 */

export const C = {
  bg:      "#080C1E",
  bg2:     "#0D1228",
  bg3:     "#111830",
  bg4:     "#161E38",
  bg5:     "#1C2540",
  surf:    "rgba(255,255,255,0.04)",
  surf2:   "rgba(255,255,255,0.07)",
  surf3:   "rgba(255,255,255,0.10)",
  bdr:     "rgba(255,255,255,0.08)",
  bdr2:    "rgba(255,255,255,0.14)",
  acc:     "#7C3AED",
  acc2:    "#9D5CF0",
  accDim:  "rgba(124,58,237,0.15)",
  accBr:   "rgba(124,58,237,0.3)",
  t1:      "#F0F2FF",
  t2:      "#9BA3C9",
  t3:      "#8891B8",
  t4:      "#5A6390",
  red:     "#ef4444",
  green:   "#10b981",
  amber:   "#f59e0b",
  blue:    "#3b82f6",
  orange:  "#f97316",
  teal:    "#34d399",
  sky:     "#60a5fa",
  gray:    "#6b7280",
  dark:    "#374151",
  blueLink: "#0f5bff",
  blueDim:  "rgba(59,130,246,0.15)",
  redDim:   "rgba(239,68,68,0.15)",
} as const;

/** Light-mode chat theme — used by ChatTab (white background) */
export const CT = {
  bg:          "#ffffff",
  sbBg:        "#f9f9f9",
  border:      "rgba(0,0,0,0.08)",
  t1:          "#18181b",
  t2:          "#52525b",
  t3:          "#71717a",
  t4:          "#a1a1aa",
  chipBorder:  "#d4d4d8",
  chipActive:  "#18181b",
  send:        "#d95b2a",
  inputBorder: "#d4d4d8",
  inputFocus:  "#a1a1aa",
  statusBg:    "rgba(0,0,0,0.04)",
} as const;

export const S = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20,
  s6: 24, s8: 32, s10: 40, s12: 48,
  s16: 64, s20: 80, s24: 96,
} as const;

export const R = {
  r1: 8, r2: 12, r3: 16, r4: 20, r5: 24, pill: 999,
} as const;

export const SH = {
  sh1: "0 4px 14px rgba(0,0,0,0.06)",
  sh2: "0 10px 30px rgba(0,0,0,0.08)",
  sh3: "0 18px 60px rgba(0,0,0,0.10)",
  shAcc: "0 8px 32px rgba(124,58,237,0.3)",
} as const;

export const DUR = {
  fast: "150ms",
  base: "180ms",
  slow: "220ms",
} as const;

export const EASE = "cubic-bezier(.4,0,.2,1)";

/** Typed style helper — returns React inline style object */
export function t(obj: React.CSSProperties): React.CSSProperties {
  return obj;
}
