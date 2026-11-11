/**
 * A browser tab's place in a meeting.
 *
 * Joining through the API returns a participant id and a secret token. They
 * are kept in sessionStorage (per tab, cleared when the tab closes) so that
 * refreshing the meeting page reconnects as the same participant.
 */

import type { MeetingSession, ParticipantRole } from "./types";

export type MediaPreferences = {
  micOn: boolean;
  cameraOn: boolean;
};

export type RoomSession = MediaPreferences & {
  participantId: number;
  token: string;
  role: ParticipantRole;
  displayName: string;
  /** The few meeting details the room shows, saved so it needs no extra request. */
  meeting: {
    title: string;
    inviteLink: string;
    startedAt: string | null;
  };
};

const sessionKey = (code: string) => `parley:session:${code}`;
const NAME_KEY = "parley:display-name";

export function saveSession(entered: MeetingSession, preferences: MediaPreferences): void {
  const session: RoomSession = {
    participantId: entered.participant.id,
    token: entered.token,
    role: entered.participant.role,
    displayName: entered.participant.display_name,
    meeting: {
      title: entered.meeting.title,
      inviteLink: entered.meeting.invite_link,
      startedAt: entered.meeting.started_at,
    },
    ...preferences,
  };
  sessionStorage.setItem(sessionKey(entered.meeting.code), JSON.stringify(session));
}

export function readSession(code: string): RoomSession | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(code));
    return raw ? (JSON.parse(raw) as RoomSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(code: string): void {
  sessionStorage.removeItem(sessionKey(code));
}

/** The name last used to join, offered again next time. */
export function rememberName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage can be unavailable (private mode); the name is only a convenience.
  }
}

export function recallName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
