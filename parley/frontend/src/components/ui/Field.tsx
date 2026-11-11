import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Shared look for text inputs, textareas and selects. */
export const CONTROL_CLASS =
  "w-full rounded-lg border border-ink/30 bg-white px-3 text-base text-ink placeholder:text-slate/70 " +
  "hover:border-ink/60 focus:border-ink aria-invalid:border-flare";

type FieldProps = {
  label: string;
  /** Explains what is wrong. Replaces the hint while present. */
  error?: string | null;
  hint?: string;
  className?: string;
  /** Receives the ids to put on the control so the label and messages are linked to it. */
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
};

/** A labelled form control with room for a hint or an error underneath. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error || hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {message && (
        <p id={messageId} className={cn("text-sm", error ? "text-flare" : "text-slate")}>
          {message}
        </p>
      )}
    </div>
  );
}
