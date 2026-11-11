"use client";

import dynamic from "next/dynamic";
import { RoomMessage } from "@/components/room/RoomMessage";

// The room needs the browser from its very first render (the saved session,
// the camera, a WebSocket), so it is never rendered on the server.
const MeetingRoom = dynamic(
  () => import("@/components/room/MeetingRoom").then((module) => module.MeetingRoom),
  { ssr: false, loading: () => <RoomMessage title="Opening the meeting…" /> },
);

export default function MeetingPage() {
  return <MeetingRoom />;
}
