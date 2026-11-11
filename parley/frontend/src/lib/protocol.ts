/** Messages on the meeting WebSocket. Mirrors backend/app/routers/ws.py. */

import type { ParticipantRole } from "./types";

export type ParticipantInfo = {
  id: number;
  name: string;
  role: ParticipantRole;
  /** Whether their microphone / camera is switched on. */
  audio: boolean;
  video: boolean;
};

/** What two browsers exchange (through the server) to set up a media connection. */
export type SignalData = {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export type ServerMessage =
  | { type: "welcome"; self: ParticipantInfo; participants: ParticipantInfo[] }
  | { type: "participant-joined"; participant: ParticipantInfo }
  | { type: "participant-updated"; participant: ParticipantInfo }
  | { type: "participant-left"; participantId: number }
  | { type: "all-muted"; by: number }
  | { type: "signal"; from: number; data: SignalData }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "media-state"; audio: boolean; video: boolean }
  | { type: "signal"; to: number; data: SignalData }
  | { type: "mute-all" }
  | { type: "remove-participant"; participantId: number }
  | { type: "end-meeting" };

/** Why this browser is no longer in the meeting. */
export type EndReason =
  | "left"
  | "ended"
  | "removed"
  | "replaced"
  | "invalid-session"
  | "not-found"
  | "connection-lost";

/** Close codes the server uses (backend/app/errors.py), mapped to a reason. */
const REASON_BY_CLOSE_CODE: Record<number, EndReason> = {
  4401: "invalid-session",
  4403: "removed",
  4404: "not-found",
  4409: "replaced",
  4410: "ended",
};

export function endReasonForClose(code: number): EndReason {
  return REASON_BY_CLOSE_CODE[code] ?? "connection-lost";
}
