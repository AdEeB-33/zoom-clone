"use client";

import { Mic, MicOff, UserMinus, Video, VideoOff, X } from "lucide-react";
import { Flag } from "@/components/brand/Flag";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Tile } from "./VideoTile";

type ParticipantsPanelProps = {
  people: Tile[];
  /** Host controls are only shown to the host. */
  canManage: boolean;
  onMuteAll: () => void;
  onRemove: (participantId: number) => void;
  onClose: () => void;
};

/** Who is in the meeting. For the host, also where people are muted or removed. */
export function ParticipantsPanel({
  people,
  canManage,
  onMuteAll,
  onRemove,
  onClose,
}: ParticipantsPanelProps) {
  return (
    <aside
      aria-label="People in this meeting"
      className={cn(
        "flex flex-col bg-night-2",
        // A sheet over the stage on phones, a column beside it on wider screens.
        "absolute inset-x-2 bottom-0 z-20 max-h-[70%] rounded-t-2xl",
        "md:static md:m-3 md:ml-0 md:max-h-none md:w-80 md:shrink-0 md:rounded-xl",
      )}
    >
      <div className="flex items-center justify-between py-2 pr-2 pl-4">
        <h2 className="text-heading text-lg">People ({people.length})</h2>
        <IconButton label="Close people list" onClick={onClose}>
          <X className="size-5" aria-hidden />
        </IconButton>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Flag name={person.name} className="w-7 ring-foam/45" />
            <div className="min-w-0 flex-1">
              <p className="truncate">
                {person.name}
                {person.isSelf && " (you)"}
              </p>
              {person.isHost && <p className="text-sm text-haze">Host</p>}
            </div>
            <StatusIcon on={person.audio} onIcon={Mic} offIcon={MicOff} what="Microphone" />
            <StatusIcon on={person.video} onIcon={Video} offIcon={VideoOff} what="Camera" />
            {canManage && !person.isSelf && (
              <IconButton
                label={`Remove ${person.name} from the meeting`}
                onClick={() => onRemove(person.id)}
                className="text-foam"
              >
                <UserMinus className="size-4.5" aria-hidden />
              </IconButton>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="border-t border-night-3 p-3">
          <button
            type="button"
            onClick={onMuteAll}
            disabled={people.length < 2}
            className="h-10 w-full rounded-lg bg-night-3 font-medium hover:bg-foam hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-night-3 disabled:hover:text-foam"
          >
            Mute everyone
          </button>
        </div>
      )}
    </aside>
  );
}

function StatusIcon(props: {
  on: boolean;
  onIcon: typeof Mic;
  offIcon: typeof Mic;
  what: string;
}) {
  const Icon = props.on ? props.onIcon : props.offIcon;
  return (
    <Icon
      className={cn("size-4.5 shrink-0", props.on ? "text-foam" : "text-haze")}
      aria-label={`${props.what} ${props.on ? "on" : "off"}`}
    />
  );
}
