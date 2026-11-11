import { cn } from "@/lib/cn";

/** The Parley mark: a signal pennant on its mast. The mast follows the text colour. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-7", className)} aria-hidden>
      <path d="M5 3v18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M8 4h13l-4 5 4 5H8z" className="fill-signal" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo />
      <span className="text-heading text-xl">Parley</span>
    </span>
  );
}
