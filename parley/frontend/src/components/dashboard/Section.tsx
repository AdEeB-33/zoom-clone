import type { ReactNode } from "react";

/** Heading shared by the dashboard's two lists. */
export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="border-b-2 border-ink pb-3 text-heading text-2xl">
      {children}
    </h2>
  );
}

/** Grey placeholder rows shown while a list is loading. */
export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="animate-pulse divide-y divide-line" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2.5 py-5">
          <div className="h-4 w-1/2 rounded bg-line" />
          <div className="h-3.5 w-1/3 rounded bg-line" />
        </li>
      ))}
    </ul>
  );
}
