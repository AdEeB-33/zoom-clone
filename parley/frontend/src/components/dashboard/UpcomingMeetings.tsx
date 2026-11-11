import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { formatDay, formatDuration, formatMeetingId, formatTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { ListSkeleton, SectionHeading } from "./Section";

export type MeetingActions = {
  onStart: (meeting: Meeting) => void;
  onCopyInvitation: (meeting: Meeting) => void;
  onEdit: (meeting: Meeting) => void;
  onDelete: (meeting: Meeting) => void;
  /** Code of the meeting that is being started right now, if any. */
  startingCode: string | null;
};

type UpcomingMeetingsProps = MeetingActions & {
  meetings: Meeting[] | null;
  now: Date | null;
  onSchedule: () => void;
};

type DayGroup = { label: string; meetings: Meeting[] };

/** Meetings arrive sorted by start time; this groups neighbours that share a day. */
function groupByDay(meetings: Meeting[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const meeting of meetings) {
    const label =
      meeting.status === "live"
        ? "Happening now"
        : formatDay(new Date(meeting.scheduled_start!), now);
    const last = groups.at(-1);
    if (last?.label === label) last.meetings.push(meeting);
    else groups.push({ label, meetings: [meeting] });
  }
  return groups;
}

export function UpcomingMeetings({ meetings, now, onSchedule, ...actions }: UpcomingMeetingsProps) {
  return (
    <section aria-labelledby="upcoming-heading">
      <SectionHeading id="upcoming-heading">Upcoming</SectionHeading>

      {meetings === null || now === null ? (
        <ListSkeleton rows={3} />
      ) : meetings.length === 0 ? (
        <div className="py-8">
          <p className="text-slate">Nothing is scheduled. Plan a meeting and it will appear here.</p>
          <Button className="mt-4" onClick={onSchedule}>
            Schedule a meeting
          </Button>
        </div>
      ) : (
        groupByDay(meetings, now).map((group) => (
          <div key={group.label} className="pt-6">
            <h3 className="text-sm font-medium text-slate">{group.label}</h3>
            <ul className="divide-y divide-line">
              {group.meetings.map((meeting) => (
                <UpcomingRow key={meeting.code} meeting={meeting} now={now} {...actions} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function UpcomingRow({
  meeting,
  now,
  onStart,
  onCopyInvitation,
  onEdit,
  onDelete,
  startingCode,
}: MeetingActions & { meeting: Meeting; now: Date }) {
  const live = meeting.status === "live";
  const start = meeting.scheduled_start ? new Date(meeting.scheduled_start) : null;
  const overdue = !live && start !== null && start < now;

  return (
    <li className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center">
      <div>
        {live ? (
          <p className="flex items-center gap-2 font-medium text-flare">
            <span className="size-2.5 animate-pulse rounded-full bg-flare" aria-hidden />
            Live
          </p>
        ) : (
          start && <p className="text-data text-xl">{formatTime(start)}</p>
        )}
        {meeting.duration_minutes && (
          <p className="text-sm text-slate">{formatDuration(meeting.duration_minutes)}</p>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium">{meeting.title}</p>
        {meeting.description && (
          <p className="truncate text-sm text-slate">{meeting.description}</p>
        )}
        <p className="text-sm text-slate">
          Meeting ID <span className="text-data text-ink">{formatMeetingId(meeting.code)}</span>
          {overdue && <span className="ml-2 text-flare">Start time has passed</span>}
        </p>
      </div>

      <div className="col-span-2 flex items-center gap-1 sm:col-span-1">
        <Button
          variant="dark"
          size="sm"
          className="mr-1"
          busy={startingCode === meeting.code}
          onClick={() => onStart(meeting)}
        >
          {live ? "Rejoin" : "Start"}
        </Button>
        <IconButton label="Copy invitation" onClick={() => onCopyInvitation(meeting)}>
          <Copy className="size-4.5" aria-hidden />
        </IconButton>
        {!live && (
          <>
            <IconButton label="Edit meeting" onClick={() => onEdit(meeting)}>
              <Pencil className="size-4.5" aria-hidden />
            </IconButton>
            <IconButton label="Delete meeting" onClick={() => onDelete(meeting)}>
              <Trash2 className="size-4.5" aria-hidden />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );
}
