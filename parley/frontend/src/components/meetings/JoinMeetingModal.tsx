"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROL_CLASS, Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { api, errorMessage } from "@/lib/api";
import { parseMeetingCode } from "@/lib/format";
import type { MediaPreferences } from "@/lib/session";
import type { MeetingSession } from "@/lib/types";
import { JoinFields, type JoinDetails } from "./JoinFields";

type JoinMeetingModalProps = {
  defaultName: string;
  onClose: () => void;
  onJoined: (entered: MeetingSession, preferences: MediaPreferences) => void;
};

/** Join by typing a Meeting ID or pasting an invite link. */
export function JoinMeetingModal({ defaultName, onClose, onJoined }: JoinMeetingModalProps) {
  const [idOrLink, setIdOrLink] = useState("");
  const [details, setDetails] = useState<JoinDetails>({
    name: defaultName,
    micOn: true,
    cameraOn: true,
  });
  const [errors, setErrors] = useState<{ id?: string; name?: string }>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const code = parseMeetingCode(idOrLink);
    const name = details.name.trim();
    if (!code || !name) {
      setErrors({
        id: code ? undefined : "Enter the 10-digit meeting ID, or paste the invite link.",
        name: name ? undefined : "Enter the name others should see.",
      });
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      // The server confirms the meeting exists and is still open before letting us in.
      onJoined(await api.joinMeeting(code, name), details);
    } catch (error) {
      setErrors({ id: errorMessage(error) });
      setBusy(false);
    }
  }

  return (
    <Modal title="Join a meeting" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Meeting ID or invite link" error={errors.id}>
          {(control) => (
            <input
              {...control}
              className={`${CONTROL_CLASS} h-11`}
              value={idOrLink}
              onChange={(event) => {
                setIdOrLink(event.target.value);
                setErrors((current) => ({ ...current, id: undefined }));
              }}
              placeholder="482 019 3765"
              autoComplete="off"
              autoFocus
            />
          )}
        </Field>

        <JoinFields
          value={details}
          onChange={(next) => {
            setDetails(next);
            setErrors((current) => ({ ...current, name: undefined }));
          }}
          nameError={errors.name}
        />

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Join meeting
          </Button>
        </div>
      </form>
    </Modal>
  );
}
