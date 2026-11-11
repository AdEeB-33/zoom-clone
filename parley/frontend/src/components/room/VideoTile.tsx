"use client";

import { MicOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { Flag } from "@/components/brand/Flag";
import { cn } from "@/lib/cn";

export type Tile = {
  id: number;
  name: string;
  isHost: boolean;
  isSelf: boolean;
  audio: boolean;
  video: boolean;
  stream: MediaStream | null;
};

/** One participant on the stage: their video, or their flag when the camera is off. */
export function VideoTile({ tile }: { tile: Tile }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // A MediaStream cannot be passed as a prop, so it is attached to the element here.
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.srcObject !== tile.stream) video.srcObject = tile.stream;
  }, [tile.stream]);

  const showVideo = tile.stream !== null && tile.video;

  return (
    <div className="relative min-h-0 overflow-hidden rounded-xl bg-night-2">
      {/* The element stays mounted while hidden because it also plays their audio.
          Our own tile is muted (no echo) and mirrored (it reads like a mirror). */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={tile.isSelf}
        className={cn(
          "absolute inset-0 size-full object-cover",
          tile.isSelf && "-scale-x-100",
          !showVideo && "invisible",
        )}
      />

      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <Flag name={tile.name} className="w-[clamp(4rem,22%,9rem)] ring-foam/45" />
        </div>
      )}

      <p className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-night/80 px-2 py-1 text-sm">
        {!tile.audio && <MicOff className="size-3.5 shrink-0 text-signal" aria-label="Muted" />}
        <span className="truncate">
          {tile.name}
          {tile.isSelf && " (you)"}
        </span>
        {tile.isHost && <span className="shrink-0 text-haze">Host</span>}
      </p>
    </div>
  );
}

/** Lays tiles out so they share the stage evenly, whatever their number. */
export function VideoStage({ tiles }: { tiles: Tile[] }) {
  const count = tiles.length;
  const columns =
    count === 1
      ? "grid-cols-1"
      : count === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : count <= 4
          ? "grid-cols-2"
          : "grid-cols-2 lg:grid-cols-3";

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 auto-rows-[minmax(9rem,1fr)] gap-2 overflow-y-auto p-2 sm:gap-3 sm:p-3",
        columns,
        count === 1 && "mx-auto w-full max-w-5xl",
      )}
    >
      {tiles.map((tile) => (
        <VideoTile key={tile.id} tile={tile} />
      ))}
    </div>
  );
}
