import type { Metadata } from "next";
import { JoinScreen } from "@/components/meetings/JoinScreen";

export const metadata: Metadata = { title: "Join a meeting" };

/** Invite links point here: /join/<10-digit meeting ID> */
export default function JoinPage() {
  return <JoinScreen />;
}
