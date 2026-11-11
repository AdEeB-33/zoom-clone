"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROL_CLASS, Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { api, errorMessage } from "@/lib/api";
import {
  formatDuration,
  fromDateAndTimeInputs,
  timeZoneName,
  toDateInput,
  toTimeInput,
} from "@/lib/format";
import type { Meeting } from "@/lib/types";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const HALF_HOUR_MS = 30 * 60_000;

type ScheduleMeetingModalProps = {
  /** When the modal was opened. Used for the suggested start and "earliest date". */
  openedAt: Date;
  /** Pass a meeting to edit it; leave out to schedule a new one. */
  meeting?: Meeting;
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
};

/** New meetings are suggested for the next half hour that is at least 30 minutes away. */
function suggestedStart(openedAt: Date): Date {
  return new Date(Math.ceil((openedAt.getTime() + HALF_HOUR_MS) / HALF_HOUR_MS) * HALF_HOUR_MS);
}

export function ScheduleMeetingModal({
  openedAt,
  meeting,
  onClose,
  onSaved,
}: ScheduleMeetingModalProps) {
  const initialStart = meeting?.scheduled_start
    ? new Date(meeting.scheduled_start)
    : suggestedStart(openedAt);

  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [date, setDate] = useState(toDateInput(initialStart));
  const [time, setTime] = useState(toTimeInput(initialStart));
  const [duration, setDuration] = useState(meeting?.duration_minutes ?? 30);
  const [errors, setErrors] = useState<{ title?: string; start?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  // Keep an unusual saved duration selectable when editing.
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const start = fromDateAndTimeInputs(date, time);
    const problems = {
      title: title.trim() ? undefined : "Give the meeting a title.",
      start: Number.isNaN(start.getTime())
        ? "Choose a date and a start time."
        : start.getTime() <= Date.now()
          ? "Choose a start time in the future."
          : undefined,
    };
    if (problems.title || problems.start) {
      setErrors(problems);
      return;
    }

    const input = {
      title: title.trim(),
      description: description.trim(),
      // toISOString() converts the viewer's local time to UTC for the server.
      scheduled_start: start.toISOString(),
      duration_minutes: duration,
    };

    setErrors({});
    setBusy(true);
    try {
      onSaved(
        meeting ? await api.updateMeeting(meeting.code, input) : await api.scheduleMeeting(input),
      );
    } catch (error) {
      setErrors({ form: errorMessage(error) });
      setBusy(false);
    }
  }

  return (
    <Modal title={meeting ? "Edit meeting" : "Schedule a meeting"} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Title" error={errors.title}>
          {(control) => (
            <input
              {...control}
              className={`${CONTROL_CLASS} h-11`}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setErrors((current) => ({ ...current, title: undefined }));
              }}
              placeholder="Weekly product sync"
              maxLength={120}
              autoComplete="off"
              autoFocus
            />
          )}
        </Field>

        <Field label="Description (optional)">
          {(control) => (
            <textarea
              {...control}
              className={`${CONTROL_CLASS} min-h-20 py-2.5`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={3}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" error={errors.start} className="col-span-2">
            {(control) => (
              <input
                {...control}
                type="date"
                className={`${CONTROL_CLASS} h-11`}
                value={date}
                min={toDateInput(openedAt)}
                onChange={(event) => {
                  setDate(event.target.value);
                  setErrors((current) => ({ ...current, start: undefined }));
                }}
              />
            )}
          </Field>
          <Field label="Start time">
            {(control) => (
              <input
                {...control}
                type="time"
                step={300}
                className={`${CONTROL_CLASS} h-11`}
                value={time}
                aria-invalid={errors.start ? true : undefined}
                onChange={(event) => {
                  setTime(event.target.value);
                  setErrors((current) => ({ ...current, start: undefined }));
                }}
              />
            )}
          </Field>
          <Field label="Duration">
            {(control) => (
              <select
                {...control}
                className={`${CONTROL_CLASS} h-11`}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              >
                {durations.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <p className="text-sm text-slate">
          Times are in your timezone, {timeZoneName()}. A meeting ID and invite link are created
          for you.
        </p>

        {errors.form && (
          <p role="alert" className="text-sm font-medium text-flare">
            {errors.form}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {meeting ? "Save changes" : "Schedule meeting"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
