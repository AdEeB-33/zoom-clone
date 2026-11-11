import { formatDate, formatTime, startPhrase } from "@/lib/format";
import type { Meeting } from "@/lib/types";

type NextUpProps = {
  /** null until the dashboard has loaded. */
  upcoming: Meeting[] | null;
  /** null while rendering on the server, where the viewer's clock is unknown. */
  now: Date | null;
  /** True when loading failed, so there is nothing to wait for. */
  failed: boolean;
};

/** One sentence about the next thing on the calendar. */
function headline(upcoming: Meeting[], now: Date): string {
  const live = upcoming.find((meeting) => meeting.status === "live");
  if (live) return `${live.title} is live now.`;

  const scheduled = upcoming.filter((meeting) => meeting.scheduled_start !== null);
  // Prefer the next meeting still ahead of us; fall back to one that is overdue.
  const next =
    scheduled.find((meeting) => new Date(meeting.scheduled_start!) >= now) ?? scheduled.at(-1);
  if (!next) return "Nothing is scheduled.";

  return `${next.title} ${startPhrase(new Date(next.scheduled_start!), now)}.`;
}

/** The top of the dashboard: today's date and what is coming up next. */
export function NextUp({ upcoming, now, failed }: NextUpProps) {
  const text = failed
    ? "Your meetings could not be loaded."
    : upcoming !== null && now !== null
      ? headline(upcoming, now)
      : null;

  return (
    <div>
      <p className="h-6 text-slate">{now && `${formatDate(now, now)}, ${formatTime(now)}`}</p>
      {text ? (
        <h1 className="mt-3 max-w-[20ch] text-display text-4xl text-balance sm:text-5xl lg:text-6xl">
          {text}
        </h1>
      ) : (
        <div className="mt-3 flex max-w-xl animate-pulse flex-col gap-3" aria-hidden>
          <div className="h-10 rounded-lg bg-line sm:h-12 lg:h-14" />
          <div className="h-10 w-2/3 rounded-lg bg-line sm:h-12 lg:h-14" />
        </div>
      )}
    </div>
  );
}
