"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * The current time, refreshed every `intervalMs`.
 *
 * Returns null while the page is rendered on the server, where the viewer's
 * clock and timezone are unknown. useSyncExternalStore is React's way of
 * reading a value that lives outside React (here, the clock) without the
 * server and browser output disagreeing.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const subscribe = useCallback(
    (notify: () => void) => {
      const timer = window.setInterval(notify, intervalMs);
      return () => window.clearInterval(timer);
    },
    [intervalMs],
  );

  // The snapshot only changes once per interval, so React re-renders once per interval.
  const tick = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs),
    () => null,
  );

  return useMemo(() => (tick === null ? null : new Date(tick * intervalMs)), [tick, intervalMs]);
}
