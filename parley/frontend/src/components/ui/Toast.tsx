"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "error";
type Toast = { id: number; message: string; tone: Tone };
type ShowToast = (message: string, tone?: Tone) => void;

const TOAST_MS = 4000;
const MAX_VISIBLE = 3;

const ToastContext = createContext<ShowToast>(() => {});

/** Call the returned function to show a short message at the bottom of the screen. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((message, tone = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }].slice(-MAX_VISIBLE));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_MS);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      {/* aria-live makes screen readers announce new messages. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={cn(
              "max-w-md rounded-lg px-4 py-3 text-sm font-medium text-white shadow-xl",
              toast.tone === "error" ? "bg-flare" : "bg-ink",
            )}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext>
  );
}
