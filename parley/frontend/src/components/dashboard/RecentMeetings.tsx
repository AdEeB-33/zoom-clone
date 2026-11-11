import { Clock, Users } from "lucide-react";
import { Flag } from "@/components/brand/Flag";
import { formatDay, formatDuration, formatTime, minutesBetween } from "@/lib/format";
import type { Meeting, User } from "@/lib/types";
import { ListSkeleton, SectionHeading } from "./Section";

type RecentMeetingsProps = {
  meetings: Meeting[] | null;
  now: Date | null;
  currentUser: User | null;
};

export function RecentMeetings({ meetings, now, currentUser }: RecentMeetingsProps) {
  return (
    <section aria-labelledby="recent-heading">
      <SectionHeading id="recent-heading">Recent</SectionHeading>

      {meetings === null || now === null ? (
        <ListSkeleton rows={3} />
      ) : meetings.length === 0 ? (
        <p className="py-8 text-slate">Meetings you finish are listed here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {meetings.map((meeting) => (
            <RecentRow
              key={meeting.code}
              meeting={meeting}
              now={now}
              hostedByMe={meeting.host.id === currentUser?.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentRow(props: { meeting: Meeting; now: Date; hostedByMe: boolean }) {
  const { meeting, now, hostedByMe } = props;
  // Every ended meeting has both timestamps; the fallback only satisfies the types.
  const started = new Date(meeting.started_at ?? meeting.created_at);
  const ended = new Date(meeting.ended_at ?? meeting.created_at);
  const people = meeting.participant_count;

  return (
    <li className="py-4">
      <p className="font-medium">{meeting.title}</p>
      <p className="mt-0.5 text-sm text-slate">
        {formatDay(started, now)} at {formatTime(started)}
      </p>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate">
        <li className="flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden />
          {formatDuration(minutesBetween(started, ended))}
        </li>
        <li className="flex items-center gap-1.5">
          <Users className="size-4" aria-hidden />
          {people} {people === 1 ? "person" : "people"}
        </li>
        <li className="flex items-center gap-1.5">
          <Flag name={meeting.host.name} className="w-4.5" />
          {hostedByMe ? "Hosted by you" : `Hosted by ${meeting.host.name}`}
        </li>
      </ul>
    </li>
  );
}
