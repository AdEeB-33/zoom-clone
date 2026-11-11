import Link from "next/link";
import type { EndReason } from "@/lib/protocol";
import type { ParticipantRole } from "@/lib/types";
import { ROOM_LINK, RoomMessage } from "./RoomMessage";

type RoomEndedProps = {
  reason: EndReason;
  role: ParticipantRole;
  code: string;
};

/** What to say for each way of ending up outside the meeting. */
function explain(reason: EndReason, role: ParticipantRole): { title: string; detail?: string } {
  switch (reason) {
    case "left":
      return { title: "You left the meeting." };
    case "ended":
      return role === "host"
        ? { title: "You ended the meeting for everyone." }
        : { title: "The host ended this meeting." };
    case "removed":
      return { title: "The host removed you from this meeting." };
    case "replaced":
      return {
        title: "This meeting is open in another tab.",
        detail: "You can only be connected from one tab at a time. Rejoin here to switch back.",
      };
    case "not-found":
      return { title: "This meeting no longer exists." };
    case "invalid-session":
      return {
        title: "You need to join this meeting again.",
        detail: "Your place in the meeting could not be confirmed.",
      };
    case "connection-lost":
      return {
        title: "The connection to the meeting dropped.",
        detail: "Check your internet connection, then rejoin. The meeting may still be going.",
      };
  }
}

export function RoomEnded({ reason, role, code }: RoomEndedProps) {
  const { title, detail } = explain(reason, role);
  // Reloading the page reconnects with the session this tab still holds.
  const canReconnect = reason === "connection-lost" || reason === "replaced";

  return (
    <RoomMessage title={title} detail={detail}>
      {canReconnect && (
        <a href={`/meeting/${code}`} className={ROOM_LINK.primary}>
          Rejoin
        </a>
      )}
      {reason === "invalid-session" && (
        <Link href={`/join/${code}`} className={ROOM_LINK.primary}>
          Join again
        </Link>
      )}
      <Link href="/" className={canReconnect || reason === "invalid-session" ? ROOM_LINK.quiet : ROOM_LINK.primary}>
        Back to your meetings
      </Link>
    </RoomMessage>
  );
}
