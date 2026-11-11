"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./Button";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A modal built on the native <dialog> element, which already provides the
 * hard parts: focus stays inside, Escape closes it, and the page behind
 * cannot be interacted with. Render it only while it should be open.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click that lands on the dialog element itself is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(100vw-2rem,30rem)] overflow-y-auto rounded-2xl bg-white text-ink shadow-2xl"
    >
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-heading text-2xl">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
            <X className="size-5" aria-hidden />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
