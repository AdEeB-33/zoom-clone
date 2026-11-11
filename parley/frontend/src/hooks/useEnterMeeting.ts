"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { saveSession, type MediaPreferences } from "@/lib/session";
import type { MeetingSession } from "@/lib/types";

const EVERYTHING_ON: MediaPreferences = { micOn: true, cameraOn: true };

/**
 * The last step of every way into a meeting (new, start, join by ID, join by
 * link): keep the session for this tab, then go to the meeting room.
 */
export function useEnterMeeting() {
  const router = useRouter();

  return useCallback(
    (entered: MeetingSession, preferences: MediaPreferences = EVERYTHING_ON) => {
      saveSession(entered, preferences);
      router.push(`/meeting/${entered.meeting.code}`);
    },
    [router],
  );
}
