/**
 * Pure formatting helpers. Anything that depends on the current time takes
 * `now` as an argument instead of reading the clock, so results are
 * predictable and components stay pure.
 */

import type { Meeting } from "./types";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

// `undefined` means "use the viewer's own locale".
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dateWithYearFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// ---- Meeting IDs ------------------------------------------------------------

/** "4820193765" -> "482 019 3765" */
export function formatMeetingId(code: string): string {
  return code.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
}

/** Accepts a typed ID ("482 019 3765", "482-019-3765") or a pasted invite link. */
export function parseMeetingCode(input: string): string | null {
  const fromLink = input.match(/\/join\/(\d{10})(?!\d)/);
  if (fromLink) return fromLink[1];
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

// ---- Dates and times --------------------------------------------------------

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole calendar days from `now` to `date`: 0 today, 1 tomorrow, -1 yesterday. */
export function dayDifference(date: Date, now: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

/** "4:00 – 4:45 PM" */
export function formatTimeRange(start: Date, durationMinutes: number): string {
  return timeFormat.formatRange(start, new Date(start.getTime() + durationMinutes * MINUTE_MS));
}

/** "Tuesday 10 November", with the year only when it is not this year. */
export function formatDate(date: Date, now: Date): string {
  const sameYear = date.getFullYear() === now.getFullYear();
  return (sameYear ? dateFormat : dateWithYearFormat).format(date);
}

/** "Today", "Tomorrow", "Yesterday", otherwise the full date. */
export function formatDay(date: Date, now: Date): string {
  const days = dayDifference(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return formatDate(date, now);
}

/** 45 -> "45 min", 60 -> "1 hr", 95 -> "1 hr 35 min" */
export function formatDuration(minutes: number): string {
  const whole = Math.max(1, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MINUTE_MS;
}

/** How a start time reads after a meeting's title: "starts in 25 min". */
export function startPhrase(start: Date, now: Date): string {
  const minutes = Math.round(minutesBetween(now, start));
  const days = dayDifference(start, now);
  const day = days === 0 || Math.abs(days) === 1 ? formatDay(start, now).toLowerCase() : `on ${formatDate(start, now)}`;

  if (minutes < 0) return `was due to start ${day} at ${formatTime(start)}`;
  if (minutes < 1) return "starts now";
  if (days === 0) return `starts in ${formatDuration(minutes)}`;
  return `starts ${day} at ${formatTime(start)}`;
}

/** Time since a meeting started, as a running clock: "07:42" or "1:07:42". */
export function formatElapsed(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** The viewer's timezone, e.g. "Asia/Kolkata". */
export function timeZoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ---- <input type="date"> and <input type="time"> ----------------------------
// These inputs work in the viewer's local time, so the helpers do too.

const pad2 = (value: number) => String(value).padStart(2, "0");

/** Local date as "YYYY-MM-DD". */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local time as "HH:MM". */
export function toTimeInput(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Combines the two input values back into a Date in the viewer's timezone. */
export function fromDateAndTimeInputs(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}

// ---- Invitations ------------------------------------------------------------

/** The text copied by "Copy invitation": everything someone needs to join. */
export function buildInvitation(meeting: Meeting, now: Date): string {
  const lines = [`${meeting.host.name} invites you to a meeting.`, "", `Topic: ${meeting.title}`];

  if (meeting.scheduled_start && meeting.duration_minutes) {
    const start = new Date(meeting.scheduled_start);
    const when = `${formatDate(start, now)}, ${formatTimeRange(start, meeting.duration_minutes)}`;
    lines.push(`When: ${when} (${timeZoneName()})`);
  }

  lines.push("", `Join: ${meeting.invite_link}`, `Meeting ID: ${formatMeetingId(meeting.code)}`);
  return lines.join("\n");
}
