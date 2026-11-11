"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Flag } from "@/components/brand/Flag";
import { Wordmark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { useEnterMeeting } from "@/hooks/useEnterMeeting";
import { useNow } from "@/hooks/useNow";
import { ApiError, api, errorMessage } from "@/lib/api";
import { formatDay, formatMeetingId, formatTimeRange } from "@/lib/format";
import { recallName, rememberName } from "@/lib/session";
import type { Meeting } from "@/lib/types";
import { JoinFields, type JoinDetails } from "./JoinFields";

type Lookup =
  | { status: "loading" }
  | { status: "found"; meeting: Meeting }
  | { status: "missing" }
  | { status: "error"; message: string };

/** Where an invite link lands: confirm the meeting exists, ask for a name, join. */
export function JoinScreen() {
  const { code } = useParams<{ code: string }>();
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getMeeting(code)
      .then((meeting) => {
        if (!cancelled) setLookup({ status: "found", meeting });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const missing = error instanceof ApiError && error.status === 404;
        setLookup(missing ? { status: "missing" } : { status: "error", message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  function retry() {
    setLookup({ status: "loading" });
    setAttempt((count) => count + 1);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="rounded-md">
            <Wordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-0">
        {lookup.status === "loading" && (
          <div className="flex animate-pulse flex-col gap-4" aria-label="Looking up the meeting">
            <div className="h-10 w-3/4 rounded-lg bg-line" />
            <div className="h-5 w-1/2 rounded bg-line" />
            <div className="mt-6 h-11 rounded-lg bg-line" />
          </div>
        )}

        {lookup.status === "missing" && (
          <Problem
            title="No meeting has this ID."
            detail={`Nothing was found for ${formatMeetingId(code)}. Check the link, or ask the host to send it again.`}
          />
        )}

        {lookup.status === "error" && (
          <Problem title="The meeting could not be looked up." detail={lookup.message}>
            <Button onClick={retry}>Try again</Button>
          </Problem>
        )}

        {lookup.status === "found" &&
          (lookup.meeting.status === "ended" ? (
            <Problem
              title="This meeting has ended."
              detail={`${lookup.meeting.title} is over. Ask ${lookup.meeting.host.name} for a new link if you still need to meet.`}
            />
          ) : (
            <JoinForm meeting={lookup.meeting} />
          ))}
      </main>
    </div>
  );
}

function JoinForm({ meeting }: { meeting: Meeting }) {
  const now = useNow();
  const enterMeeting = useEnterMeeting();
  const [details, setDetails] = useState<JoinDetails>(() => ({
    name: recallName(),
    micOn: true,
    cameraOn: true,
  }));
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = meeting.scheduled_start ? new Date(meeting.scheduled_start) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = details.name.trim();
    if (!name) {
      setNameError("Enter the name others should see.");
      return;
    }

    setNameError(null);
    setFormError(null);
    setBusy(true);
    try {
      const entered = await api.joinMeeting(meeting.code, name);
      rememberName(name);
      enterMeeting(entered, details);
    } catch (error) {
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <>
      <title>{`Join ${meeting.title} | Parley`}</title>

      <h1 className="text-display text-4xl text-balance">{meeting.title}</h1>
      <p className="mt-4 flex items-center gap-2.5">
        <Flag name={meeting.host.name} />
        Hosted by {meeting.host.name}
      </p>
      <p className="mt-1.5 min-h-6 text-slate">
        {meeting.status === "live" ? (
          <span className="flex items-center gap-2 font-medium text-flare">
            <span className="size-2.5 animate-pulse rounded-full bg-flare" aria-hidden />
            Live now
          </span>
        ) : (
          start &&
          now &&
          meeting.duration_minutes &&
          `${formatDay(start, now)}, ${formatTimeRange(start, meeting.duration_minutes)}`
        )}
      </p>
      {meeting.description && <p className="mt-4 text-slate">{meeting.description}</p>}

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <JoinFields
          value={details}
          onChange={(next) => {
            setDetails(next);
            setNameError(null);
          }}
          nameError={nameError}
          autoFocusName
        />
        {formError && (
          <p role="alert" className="text-sm font-medium text-flare">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" busy={busy}>
          Join meeting
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate">
        Meeting ID <span className="text-data text-ink">{formatMeetingId(meeting.code)}</span>
      </p>
    </>
  );
}

function Problem(props: { title: string; detail: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-display text-4xl text-balance">{props.title}</h1>
      <p className="text-slate">{props.detail}</p>
      {props.children}
      <Link href="/" className="font-medium underline underline-offset-4">
        Go to your meetings
      </Link>
    </div>
  );
}
