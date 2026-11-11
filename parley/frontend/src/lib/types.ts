/** Shapes returned by the REST API (see backend/app/schemas.py). */

export type User = {
  id: number;
  name: string;
  email: string;
};

export type MeetingStatus = "scheduled" | "live" | "ended";
export type ParticipantRole = "host" | "participant";

export type Meeting = {
  /** The public 10-digit Meeting ID. */
  code: string;
  title: string;
  description: string | null;
  kind: "instant" | "scheduled";
  status: MeetingStatus;
  host: User;
  /** ISO timestamps in UTC; null where they do not apply. */
  scheduled_start: string | null;
  duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  participant_count: number;
  invite_link: string;
};

/** What the API returns when you enter a meeting. */
export type MeetingSession = {
  meeting: Meeting;
  participant: {
    id: number;
    display_name: string;
    role: ParticipantRole;
    joined_at: string;
  };
  /** Secret that opens this participant's WebSocket. */
  token: string;
};

export type ScheduleInput = {
  title: string;
  description: string;
  scheduled_start: string;
  duration_minutes: number;
};
