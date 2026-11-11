"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { EndReason, ParticipantInfo } from "@/lib/protocol";
import { connectToRoom, type RoomConnection, type RoomEvent } from "@/lib/roomConnection";
import type { RoomSession } from "@/lib/session";

export type RemoteParticipant = ParticipantInfo & {
  /** Their audio and video, once the media connection is up. */
  stream: MediaStream | null;
};

export type RoomState = {
  phase: "connecting" | "live" | "over";
  /** Why we are out of the meeting. Set when phase is "over". */
  endReason: EndReason | null;
  /** Everyone else, in the order they joined. */
  others: RemoteParticipant[];
  localStream: MediaStream | null;
  hasMic: boolean;
  hasCamera: boolean;
  micOn: boolean;
  cameraOn: boolean;
  /** A short message to show for a few seconds, e.g. "Sam joined". */
  notice: string | null;
};

const INITIAL_STATE: RoomState = {
  phase: "connecting",
  endReason: null,
  others: [],
  localStream: null,
  hasMic: false,
  hasCamera: false,
  micOn: false,
  cameraOn: false,
  notice: null,
};

/** Applies one event from the connection to the state React renders. */
function reduce(state: RoomState, event: RoomEvent): RoomState {
  switch (event.type) {
    case "media-ready":
      return {
        ...state,
        localStream: event.stream,
        hasMic: event.hasMic,
        hasCamera: event.hasCamera,
      };
    case "local-media":
      return { ...state, micOn: event.micOn, cameraOn: event.cameraOn };
    case "welcome":
      return {
        ...state,
        phase: "live",
        others: event.participants.map((participant) => ({ ...participant, stream: null })),
      };
    case "joined":
      return {
        ...state,
        others: [
          ...state.others.filter((other) => other.id !== event.participant.id),
          { ...event.participant, stream: null },
        ],
      };
    case "updated":
      return {
        ...state,
        others: state.others.map((other) =>
          other.id === event.participant.id ? { ...other, ...event.participant } : other,
        ),
      };
    case "left":
      return { ...state, others: state.others.filter((other) => other.id !== event.participantId) };
    case "all-muted":
      return {
        ...state,
        others: state.others.map((other) =>
          other.id === event.by ? other : { ...other, audio: false },
        ),
      };
    case "stream":
      return {
        ...state,
        others: state.others.map((other) =>
          other.id === event.participantId ? { ...other, stream: event.stream } : other,
        ),
      };
    case "notice":
      return { ...state, notice: event.text };
    case "over":
      return { ...INITIAL_STATE, phase: "over", endReason: event.reason };
  }
}

/**
 * Connects to a meeting for as long as the component is mounted.
 *
 * The connection itself (lib/roomConnection.ts) is ordinary imperative code.
 * This hook is the bridge: events from the connection flow into a reducer,
 * and the returned actions call back into the connection.
 */
export function useMeetingRoom(code: string, session: RoomSession) {
  const [state, dispatch] = useReducer(reduce, INITIAL_STATE);
  const connectionRef = useRef<RoomConnection | null>(null);

  useEffect(() => {
    const connection = connectToRoom(code, session, dispatch);
    connectionRef.current = connection;
    return () => {
      connectionRef.current = null;
      connection.dispose();
    };
  }, [code, session]);

  // Stable functions the UI can call; they do nothing once disconnected.
  const actions = useMemo<Omit<RoomConnection, "dispose">>(
    () => ({
      toggleMic: () => connectionRef.current?.toggleMic(),
      toggleCamera: () => connectionRef.current?.toggleCamera(),
      muteAll: () => connectionRef.current?.muteAll(),
      removeParticipant: (id) => connectionRef.current?.removeParticipant(id),
      endForAll: () => connectionRef.current?.endForAll(),
      leave: () => connectionRef.current?.leave(),
    }),
    [],
  );

  return { state, actions };
}
