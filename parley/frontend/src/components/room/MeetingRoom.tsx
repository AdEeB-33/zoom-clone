"use client";

import { Copy } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
import { useNow } from "@/hooks/useNow";
import { formatElapsed, formatMeetingId } from "@/lib/format";
import { clearSession, readSession, type RoomSession } from "@/lib/session";
import { ControlDock } from "./ControlDock";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { RoomEnded } from "./RoomEnded";
import { RoomMessage } from "./RoomMessage";
import { VideoStage, type Tile } from "./VideoTile";

const FLASH_MS = 3000;

/**
 * The meeting page. You can only be here after joining: the session saved by
 * the join step proves who you are. Without one, you are sent to join first.
 */
export function MeetingRoom() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [session] = useState(() => readSession(code));

  useEffect(() => {
    if (!session) router.replace(`/join/${code}`);
  }, [session, code, router]);

  if (!session) return <RoomMessage title="Taking you to the meeting…" />;
  return <LiveRoom code={code} session={session} />;
}

function LiveRoom({ code, session }: { code: string; session: RoomSession }) {
  const router = useRouter();
  const { state, actions } = useMeetingRoom(code, session);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const isHost = session.role === "host";

  // A short confirmation for things done on this screen, e.g. copying the link.
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  function showFlash(text: string) {
    window.clearTimeout(flashTimer.current);
    setFlash(text);
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // Out for good (not just a dropped connection): this tab's session is spent.
  useEffect(() => {
    const reason = state.endReason;
    if (reason && reason !== "connection-lost" && reason !== "replaced") clearSession(code);
  }, [state.endReason, code]);

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(session.meeting.inviteLink);
      showFlash("Invite link copied");
    } catch {
      showFlash(`Copying is blocked here. Share meeting ID ${formatMeetingId(code)} instead.`);
    }
  }

  function leave() {
    actions.leave();
    router.push("/");
  }

  if (state.phase === "over") {
    return <RoomEnded reason={state.endReason ?? "left"} role={session.role} code={code} />;
  }

  const tiles: Tile[] = [
    {
      id: session.participantId,
      name: session.displayName,
      isHost,
      isSelf: true,
      audio: state.micOn,
      video: state.cameraOn,
      stream: state.localStream,
    },
    ...state.others.map((other) => ({
      id: other.id,
      name: other.name,
      isHost: other.role === "host",
      isSelf: false,
      audio: other.audio,
      video: other.video,
      stream: other.stream,
    })),
  ];

  const notice = flash ?? state.notice ?? (state.phase === "connecting" ? "Connecting…" : null);

  return (
    <div className="on-dark flex h-dvh flex-col bg-night text-foam">
      <title>{`${session.meeting.title} | Parley`}</title>

      <RoomHeader
        title={session.meeting.title}
        code={code}
        startedAt={session.meeting.startedAt}
        onCopy={copyInviteLink}
      />

      <div className="relative flex min-h-0 flex-1">
        <VideoStage tiles={tiles} />
        {peopleOpen && (
          <ParticipantsPanel
            people={tiles}
            canManage={isHost}
            onMuteAll={actions.muteAll}
            onRemove={actions.removeParticipant}
            onClose={() => setPeopleOpen(false)}
          />
        )}

        {/* role="status" makes screen readers announce the message. */}
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4"
        >
          {notice && (
            <span className="rounded-lg bg-foam px-3.5 py-2 text-sm font-medium text-ink shadow-lg">
              {notice}
            </span>
          )}
        </p>
      </div>

      <ControlDock
        micOn={state.micOn}
        cameraOn={state.cameraOn}
        hasMic={state.hasMic}
        hasCamera={state.hasCamera}
        peopleCount={tiles.length}
        peopleOpen={peopleOpen}
        isHost={isHost}
        onToggleMic={actions.toggleMic}
        onToggleCamera={actions.toggleCamera}
        onTogglePeople={() => setPeopleOpen((open) => !open)}
        onCopyInvite={copyInviteLink}
        onLeave={leave}
        onEndForAll={actions.endForAll}
      />
    </div>
  );
}

type RoomHeaderProps = {
  title: string;
  code: string;
  startedAt: string | null;
  onCopy: () => void;
};

function RoomHeader({ title, code, startedAt, onCopy }: RoomHeaderProps) {
  const now = useNow(1000);
  const elapsed =
    now && startedAt ? formatElapsed(now.getTime() - new Date(startedAt).getTime()) : null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-4">
      <Logo className="size-6 shrink-0" />
      <h1 className="min-w-0 truncate font-medium">{title}</h1>
      {elapsed && (
        <span className="text-data text-haze" aria-label="Time since the meeting started">
          {elapsed}
        </span>
      )}
      <button
        type="button"
        onClick={onCopy}
        title="Copy invite link"
        className="ml-auto hidden shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-haze hover:bg-night-2 hover:text-foam sm:flex"
      >
        Meeting ID <span className="text-data text-foam">{formatMeetingId(code)}</span>
        <Copy className="size-4" aria-hidden />
      </button>
    </header>
  );
}
