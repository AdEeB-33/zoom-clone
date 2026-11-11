"use client";

import { Link2, LogOut, Mic, MicOff, Users, Video, VideoOff, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";

type ControlDockProps = {
  micOn: boolean;
  cameraOn: boolean;
  hasMic: boolean;
  hasCamera: boolean;
  peopleCount: number;
  peopleOpen: boolean;
  isHost: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onTogglePeople: () => void;
  onCopyInvite: () => void;
  onLeave: () => void;
  onEndForAll: () => void;
};

/** The meeting controls along the bottom of the room. */
export function ControlDock(props: ControlDockProps) {
  return (
    <footer className="flex justify-center px-2 pt-1 pb-3 sm:pb-4">
      <div className="flex items-center gap-1 rounded-2xl bg-night-2 p-1.5 sm:gap-1.5">
        <DockButton
          icon={props.micOn ? Mic : MicOff}
          label={!props.hasMic ? "No microphone" : props.micOn ? "Mute" : "Unmute"}
          tone={props.micOn ? "plain" : "off"}
          disabled={!props.hasMic}
          onClick={props.onToggleMic}
        />
        <DockButton
          icon={props.cameraOn ? Video : VideoOff}
          label={!props.hasCamera ? "No camera" : props.cameraOn ? "Stop video" : "Start video"}
          tone={props.cameraOn ? "plain" : "off"}
          disabled={!props.hasCamera}
          onClick={props.onToggleCamera}
        />

        <Divider />

        <DockButton
          icon={Users}
          label={`People (${props.peopleCount})`}
          shortLabel={String(props.peopleCount)}
          tone={props.peopleOpen ? "active" : "plain"}
          pressed={props.peopleOpen}
          onClick={props.onTogglePeople}
        />
        <DockButton
          icon={Link2}
          label="Invite"
          description="Copy invite link"
          onClick={props.onCopyInvite}
        />

        <Divider />

        {props.isHost ? (
          <Popover
            label="End or leave the meeting"
            side="top"
            trigger={
              <>
                <LogOut className="size-5" aria-hidden />
                <span>End</span>
              </>
            }
            triggerClassName={cn(DOCK_BUTTON, "bg-flare text-white hover:bg-flare-deep")}
            panelClassName="w-72"
          >
            <p className="text-sm text-slate">
              Ending closes the meeting for everyone. Leaving lets the others carry on without you.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button variant="danger" onClick={props.onEndForAll}>
                End meeting for everyone
              </Button>
              <Button onClick={props.onLeave}>Leave meeting</Button>
            </div>
          </Popover>
        ) : (
          <button
            type="button"
            onClick={props.onLeave}
            className={cn(DOCK_BUTTON, "bg-flare text-white hover:bg-flare-deep")}
          >
            <LogOut className="size-5" aria-hidden />
            <span>Leave</span>
          </button>
        )}
      </div>
    </footer>
  );
}

const DOCK_BUTTON =
  "inline-flex h-12 items-center gap-2 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-4";

const TONES = {
  plain: "text-foam hover:bg-night-3",
  off: "bg-foam text-ink hover:bg-white", // the mic or camera is switched off
  active: "bg-signal text-ink hover:bg-signal-deep", // the panel this opens is showing
};

type DockButtonProps = {
  icon: LucideIcon;
  /** Text beside the icon (hidden on small screens). */
  label: string;
  /** Fuller wording for the tooltip and screen readers. Defaults to the label. */
  description?: string;
  /** Shown beside the icon on small screens, where the label is hidden. */
  shortLabel?: string;
  tone?: keyof typeof TONES;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function DockButton({
  icon: Icon,
  label,
  description = label,
  shortLabel,
  tone = "plain",
  pressed,
  disabled,
  onClick,
}: DockButtonProps) {
  return (
    <button
      type="button"
      aria-label={description}
      aria-pressed={pressed}
      title={description}
      disabled={disabled}
      onClick={onClick}
      className={cn(DOCK_BUTTON, TONES[tone], "disabled:cursor-not-allowed disabled:opacity-45")}
    >
      <Icon className="size-5" aria-hidden />
      {shortLabel && <span className="md:hidden">{shortLabel}</span>}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-7 w-px bg-night-3 sm:mx-1" aria-hidden />;
}
