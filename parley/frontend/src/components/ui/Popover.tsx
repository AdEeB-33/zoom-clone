"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type PopoverProps = {
  /** Accessible name of the button that opens the popover. */
  label: string;
  /** What the button looks like. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Which edge of the button the panel lines up with, and whether it opens upwards. */
  align?: "left" | "right";
  side?: "bottom" | "top";
  panelClassName?: string;
  children: ReactNode;
};

/** A button with a small floating panel. Closes on outside click or Escape. */
export function Popover({
  label,
  trigger,
  triggerClassName,
  align = "right",
  side = "bottom",
  panelClassName,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-30 w-64 rounded-xl border border-line bg-white p-4 text-ink shadow-xl",
            align === "right" ? "right-0" : "left-0",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
