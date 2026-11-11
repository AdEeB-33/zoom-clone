import { API_URL } from "./config";
import type { Meeting, MeetingSession, ScheduleInput, User } from "./types";

/** An error with the HTTP status attached. Status 0 means the server was unreachable. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** FastAPI sends {"detail": "text"} for our errors and a list for validation errors. */
function readDetail(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("detail" in body)) return null;
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return detail[0].msg.replace(/^Value error, /, "");
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, `The meeting server at ${API_URL} is not responding.`);
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, readDetail(body) ?? `Request failed (${response.status}).`);
  }
  return body as T;
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body ?? {}),
});

export const api = {
  me: () => request<User>("/users/me"),

  upcomingMeetings: () => request<Meeting[]>("/meetings/upcoming"),
  recentMeetings: () => request<Meeting[]>("/meetings/recent"),
  getMeeting: (code: string) => request<Meeting>(`/meetings/${code}`),

  createInstantMeeting: () => request<MeetingSession>("/meetings/instant", post()),
  scheduleMeeting: (input: ScheduleInput) => request<Meeting>("/meetings/scheduled", post(input)),
  updateMeeting: (code: string, input: ScheduleInput) =>
    request<Meeting>(`/meetings/${code}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteMeeting: (code: string) => request<void>(`/meetings/${code}`, { method: "DELETE" }),

  startMeeting: (code: string) => request<MeetingSession>(`/meetings/${code}/start`, post()),
  joinMeeting: (code: string, displayName: string) =>
    request<MeetingSession>(`/meetings/${code}/join`, post({ display_name: displayName })),
};

/** A message that is safe to show, whatever was thrown. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
