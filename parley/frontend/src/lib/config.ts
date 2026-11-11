/** Where the FastAPI backend lives. Set NEXT_PUBLIC_API_URL when deploying. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

/** The meeting socket is served by the same backend: http -> ws, https -> wss. */
export function meetingSocketUrl(code: string, token: string): string {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws/meetings/${code}?token=${encodeURIComponent(token)}`;
}

/**
 * Servers that help two browsers find a route to each other.
 *
 * The default is a public STUN server, which is enough when at least one side
 * is on an ordinary home or office network. Stricter networks need a TURN
 * relay; supply one by setting NEXT_PUBLIC_ICE_SERVERS to a JSON list, e.g.
 * [{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
 */
function readIceServers(): RTCIceServer[] {
  const custom = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (custom) {
    try {
      return JSON.parse(custom) as RTCIceServer[];
    } catch {
      console.warn("NEXT_PUBLIC_ICE_SERVERS is not valid JSON; using the default STUN server.");
    }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

export const ICE_SERVERS = readIceServers();
