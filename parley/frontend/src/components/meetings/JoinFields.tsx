"use client";

import { CONTROL_CLASS, Field } from "@/components/ui/Field";
import type { MediaPreferences } from "@/lib/session";

export type JoinDetails = MediaPreferences & { name: string };

type JoinFieldsProps = {
  value: JoinDetails;
  onChange: (value: JoinDetails) => void;
  nameError?: string | null;
  autoFocusName?: boolean;
};

/** The questions asked before entering a meeting: your name, and mic/camera on or off. */
export function JoinFields({ value, onChange, nameError, autoFocusName }: JoinFieldsProps) {
  return (
    <>
      <Field label="Your name" error={nameError} hint="Shown to everyone in the meeting.">
        {(control) => (
          <input
            {...control}
            className={`${CONTROL_CLASS} h-11`}
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            maxLength={60}
            autoComplete="name"
            autoFocus={autoFocusName}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="sr-only">Microphone and camera</legend>
        <Toggle
          label="Join with my microphone off"
          checked={!value.micOn}
          onChange={(off) => onChange({ ...value, micOn: !off })}
        />
        <Toggle
          label="Join with my camera off"
          checked={!value.cameraOn}
          onChange={(off) => onChange({ ...value, cameraOn: !off })}
        />
      </fieldset>
    </>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        className="size-[1.125rem] accent-ink"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  );
}
