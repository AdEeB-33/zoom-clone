import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Logo";

/** A full-screen message in the room's dark style: loading, or why the meeting is over. */
export function RoomMessage(props: { title: string; detail?: string; children?: ReactNode }) {
  return (
    <main className="on-dark flex min-h-dvh flex-col bg-night text-foam">
      <div className="px-4 py-4 sm:px-6">
        <Wordmark />
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 pb-24">
        <h1 className="text-display text-3xl text-balance sm:text-4xl">{props.title}</h1>
        {props.detail && <p className="text-haze">{props.detail}</p>}
        {props.children && <div className="mt-2 flex flex-wrap gap-3">{props.children}</div>}
      </div>
    </main>
  );
}

/** Link styles for the actions under a room message. */
export const ROOM_LINK = {
  primary:
    "inline-flex h-11 items-center rounded-lg bg-signal px-5 font-medium text-ink hover:bg-signal-deep",
  quiet:
    "inline-flex h-11 items-center rounded-lg border border-night-3 px-5 font-medium hover:bg-night-2",
};
