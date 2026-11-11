import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Every person gets a flag instead of a photo or initials.
 *
 * The flag is worked out from the name alone (the same name always gives the
 * same flag), so nothing needs to be stored or uploaded. Patterns and colours
 * borrow from maritime signal flags: flat blocks that stay readable when tiny.
 */

const COLOURS = ["#ffcb1f", "#1b4db1", "#cf3327", "#0d1b2a", "#ffffff"];

// Each pattern paints colour `b` on top of a 12 x 9 field of colour `a`.
const PATTERNS: Array<(b: string) => ReactNode> = [
  (b) => <rect y="4.5" width="12" height="4.5" fill={b} />, // two bands
  (b) => <rect x="6" width="6" height="9" fill={b} />, // two halves
  (b) => <path d="M6 0h6v4.5H6zM0 4.5h6V9H0z" fill={b} />, // quarters
  (b) => <rect x="2.25" y="2.25" width="7.5" height="4.5" fill={b} />, // border
  (b) => <path d="M0 9 12 0v9z" fill={b} />, // diagonal
  (b) => <path d="M4.5 0h3v9h-3zM0 3h12v3H0z" fill={b} />, // cross
  (b) => <circle cx="6" cy="4.5" r="2.6" fill={b} />, // disc
  (b) => <path d="M0 0 6.5 4.5 0 9z" fill={b} />, // triangle at the mast
  (b) => <rect y="3" width="12" height="3" fill={b} />, // centre stripe
  (b) => <path d="M0 0h2.4L12 7.2V9H9.6L0 1.8zM12 0v1.8L2.4 9H0V7.2L9.6 0z" fill={b} />, // saltire
];

/** FNV-1a: a tiny, well-known string hash. Good enough to spread names around. */
function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function Flag({ name, className }: { name: string; className?: string }) {
  // Different bits of the hash pick the pattern and each colour, so they vary independently.
  const seed = hash(name.trim().toLowerCase());
  const pattern = PATTERNS[seed % PATTERNS.length];
  const field = (seed >>> 8) % COLOURS.length;
  // Step 1-4 places on from the field colour, so the two are never the same.
  const figure = (field + 1 + ((seed >>> 16) % (COLOURS.length - 1))) % COLOURS.length;

  return (
    <svg
      viewBox="0 0 12 9"
      className={cn("aspect-[4/3] w-6 shrink-0 rounded-[3px] ring-1 ring-ink/20", className)}
      aria-hidden
    >
      <rect width="12" height="9" fill={COLOURS[field]} />
      {pattern(COLOURS[figure])}
    </svg>
  );
}
