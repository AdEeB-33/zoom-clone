"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Meeting, User } from "@/lib/types";

export type DashboardData = {
  user: User;
  upcoming: Meeting[];
  recent: Meeting[];
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

const REFRESH_MS = 20_000;

/** Loads everything the dashboard shows and keeps it fresh. */
export function useDashboard() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const [user, upcoming, recent] = await Promise.all([
        api.me(),
        api.upcomingMeetings(),
        api.recentMeetings(),
      ]);
      setState({ status: "ready", data: { user, upcoming, recent } });
    } catch (error) {
      // A failed background refresh keeps showing what we already have.
      setState((current) =>
        current.status === "ready" ? current : { status: "error", message: errorMessage(error) },
      );
    }
  }, []);

  useEffect(() => {
    void refresh();

    // Meetings change on their own (one goes live, one ends), so reload every
    // so often while the tab is visible, and at once when it becomes visible.
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refresh]);

  return { state, refresh };
}
