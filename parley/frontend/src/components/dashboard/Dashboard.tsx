"use client";

import { CalendarPlus, LogIn, Video } from "lucide-react";
import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { DeleteMeetingModal } from "@/components/meetings/DeleteMeetingModal";
import { JoinMeetingModal } from "@/components/meetings/JoinMeetingModal";
import { ScheduleMeetingModal } from "@/components/meetings/ScheduleMeetingModal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useDashboard } from "@/hooks/useDashboard";
import { useEnterMeeting } from "@/hooks/useEnterMeeting";
import { useNow } from "@/hooks/useNow";
import { api, errorMessage } from "@/lib/api";
import { buildInvitation } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { NextUp } from "./NextUp";
import { RecentMeetings } from "./RecentMeetings";
import { UpcomingMeetings } from "./UpcomingMeetings";

/** Which dialog is open, with whatever it needs. null means none. */
type OpenDialog =
  | { kind: "join" }
  | { kind: "schedule"; openedAt: Date; meeting?: Meeting }
  | { kind: "delete"; meeting: Meeting }
  | null;

export function Dashboard() {
  const { state, refresh } = useDashboard();
  const now = useNow();
  const toast = useToast();
  const enterMeeting = useEnterMeeting();

  const [dialog, setDialog] = useState<OpenDialog>(null);
  // "new" while an instant meeting is being created, or the code of a meeting being started.
  const [starting, setStarting] = useState<string | null>(null);

  const data = state.status === "ready" ? state.data : null;
  const closeDialog = () => setDialog(null);

  async function startNewMeeting() {
    setStarting("new");
    try {
      enterMeeting(await api.createInstantMeeting());
    } catch (error) {
      toast(errorMessage(error), "error");
      setStarting(null);
    }
  }

  async function startMeeting(meeting: Meeting) {
    setStarting(meeting.code);
    try {
      enterMeeting(await api.startMeeting(meeting.code));
    } catch (error) {
      toast(errorMessage(error), "error");
      setStarting(null);
      void refresh();
    }
  }

  async function copyInvitation(meeting: Meeting) {
    try {
      await navigator.clipboard.writeText(buildInvitation(meeting, new Date()));
      toast("Invitation copied");
    } catch {
      toast(`Copying is blocked here. The link is ${meeting.invite_link}`, "error");
    }
  }

  function handleSaved(meeting: Meeting, wasEdit: boolean) {
    closeDialog();
    toast(wasEdit ? `Saved changes to ${meeting.title}` : `Scheduled ${meeting.title}`);
    void refresh();
  }

  function handleDeleted(meeting: Meeting) {
    closeDialog();
    toast(`Deleted ${meeting.title}`);
    void refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar user={data?.user ?? null} loading={state.status === "loading"} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6 lg:px-8">
        <section className="py-10 sm:py-14">
          <NextUp
            upcoming={data?.upcoming ?? null}
            now={now}
            failed={state.status === "error"}
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button variant="primary" size="lg" busy={starting === "new"} onClick={startNewMeeting}>
              {starting !== "new" && <Video className="size-5" aria-hidden />}
              New meeting
            </Button>
            <Button variant="dark" size="lg" onClick={() => setDialog({ kind: "join" })}>
              <LogIn className="size-5" aria-hidden />
              Join a meeting
            </Button>
            <Button
              size="lg"
              onClick={() => setDialog({ kind: "schedule", openedAt: new Date() })}
            >
              <CalendarPlus className="size-5" aria-hidden />
              Schedule a meeting
            </Button>
          </div>
        </section>

        {state.status === "error" ? (
          <div role="alert" className="rounded-xl border border-flare/40 bg-white p-6">
            <p>{state.message}</p>
            <p className="mt-1 text-slate">
              If it is still starting up, give it a minute and try again.
            </p>
            <Button className="mt-4" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="grid gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <UpcomingMeetings
              meetings={data?.upcoming ?? null}
              now={now}
              startingCode={starting}
              onStart={startMeeting}
              onCopyInvitation={copyInvitation}
              onEdit={(meeting) => setDialog({ kind: "schedule", openedAt: new Date(), meeting })}
              onDelete={(meeting) => setDialog({ kind: "delete", meeting })}
              onSchedule={() => setDialog({ kind: "schedule", openedAt: new Date() })}
            />
            <RecentMeetings
              meetings={data?.recent ?? null}
              now={now}
              currentUser={data?.user ?? null}
            />
          </div>
        )}
      </main>

      {dialog?.kind === "join" && (
        <JoinMeetingModal
          defaultName={data?.user.name ?? ""}
          onClose={closeDialog}
          onJoined={enterMeeting}
        />
      )}
      {dialog?.kind === "schedule" && (
        <ScheduleMeetingModal
          openedAt={dialog.openedAt}
          meeting={dialog.meeting}
          onClose={closeDialog}
          onSaved={(meeting) => handleSaved(meeting, dialog.meeting !== undefined)}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteMeetingModal meeting={dialog.meeting} onClose={closeDialog} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
