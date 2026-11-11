"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api, errorMessage } from "@/lib/api";
import type { Meeting } from "@/lib/types";

type DeleteMeetingModalProps = {
  meeting: Meeting;
  onClose: () => void;
  onDeleted: (meeting: Meeting) => void;
};

/** Deleting cannot be undone, so it is confirmed first. */
export function DeleteMeetingModal({ meeting, onClose, onDeleted }: DeleteMeetingModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    try {
      await api.deleteMeeting(meeting.code);
      onDeleted(meeting);
    } catch (problem) {
      setError(errorMessage(problem));
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete this meeting?" onClose={onClose}>
      <p>
        <span className="font-medium">{meeting.title}</span> will be removed, and its meeting ID and
        invite link will stop working.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-flare">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Keep meeting
        </Button>
        <Button variant="danger" busy={busy} onClick={handleDelete}>
          Delete meeting
        </Button>
      </div>
    </Modal>
  );
}
