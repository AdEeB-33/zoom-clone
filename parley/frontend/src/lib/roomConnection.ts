/**
 * One browser's live connection to a meeting. Plain TypeScript, no React.
 *
 * Two kinds of connection are involved:
 *
 *  1. A WebSocket to our server. It carries small JSON messages: who is in
 *     the room, who muted, host actions, and WebRTC "signals".
 *  2. One RTCPeerConnection per other participant. Audio and video travel
 *     over these, directly between browsers (a "mesh"), never via our server.
 *
 * Two browsers cannot connect directly until they have swapped a session
 * description each (an offer and an answer, describing their media) and
 * their ICE candidates (network routes to try). Our WebSocket relays those.
 * To keep that handshake simple, the rule is: whoever joined later makes
 * the call. The newcomer receives the list of people already present and
 * sends each an offer; everyone else only ever answers.
 */

import { ICE_SERVERS, meetingSocketUrl } from "./config";
import {
  endReasonForClose,
  type ClientMessage,
  type EndReason,
  type ParticipantInfo,
  type ServerMessage,
  type SignalData,
} from "./protocol";
import type { RoomSession } from "./session";

/** What the connection reports back; useMeetingRoom turns these into React state. */
export type RoomEvent =
  | { type: "media-ready"; stream: MediaStream | null; hasMic: boolean; hasCamera: boolean }
  | { type: "local-media"; micOn: boolean; cameraOn: boolean }
  | { type: "welcome"; participants: ParticipantInfo[] }
  | { type: "joined"; participant: ParticipantInfo }
  | { type: "updated"; participant: ParticipantInfo }
  | { type: "left"; participantId: number }
  | { type: "all-muted"; by: number }
  | { type: "stream"; participantId: number; stream: MediaStream }
  | { type: "notice"; text: string | null }
  | { type: "over"; reason: EndReason };

export type RoomConnection = {
  toggleMic: () => void;
  toggleCamera: () => void;
  muteAll: () => void;
  removeParticipant: (participantId: number) => void;
  endForAll: () => void;
  /** Leave on purpose. Reports an "over" event. */
  leave: () => void;
  /** Tear down silently, for when the page itself is going away. */
  dispose: () => void;
};

type Peer = {
  connection: RTCPeerConnection;
  /** Candidates that arrived before the description they belong to. */
  pendingCandidates: RTCIceCandidateInit[];
};

const NOTICE_MS = 4000;

/** Ask for microphone and camera, settling for whichever is available. */
async function openLocalMedia(): Promise<MediaStream | null> {
  // mediaDevices is missing on insecure pages (plain http on anything but localhost).
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) return null;

  const attempts: MediaStreamConstraints[] = [
    { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: true },
    { video: true },
  ];
  for (const constraints of attempts) {
    try {
      return await devices.getUserMedia(constraints);
    } catch {
      // Device missing or permission refused: try the next, smaller request.
    }
  }
  return null;
}

export function connectToRoom(
  code: string,
  session: RoomSession,
  emit: (event: RoomEvent) => void,
): RoomConnection {
  let over = false;
  let socket: WebSocket | null = null;
  let localStream: MediaStream | null = null;
  let noticeTimer: number | undefined;
  const peers = new Map<number, Peer>();
  const names = new Map<number, string>();

  // ---- small helpers --------------------------------------------------------

  function send(message: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function localTrack(kind: "audio" | "video"): MediaStreamTrack | undefined {
    return kind === "audio" ? localStream?.getAudioTracks()[0] : localStream?.getVideoTracks()[0];
  }

  /** Tell React and the other participants whether our mic and camera are on. */
  function publishMediaState() {
    const micOn = localTrack("audio")?.enabled ?? false;
    const cameraOn = localTrack("video")?.enabled ?? false;
    emit({ type: "local-media", micOn, cameraOn });
    send({ type: "media-state", audio: micOn, video: cameraOn });
  }

  function toggle(kind: "audio" | "video") {
    const track = localTrack(kind);
    if (!track) return;
    // A disabled track keeps the connection but sends silence / black frames.
    track.enabled = !track.enabled;
    publishMediaState();
  }

  function notify(text: string, duration = NOTICE_MS) {
    window.clearTimeout(noticeTimer);
    emit({ type: "notice", text });
    noticeTimer = window.setTimeout(() => emit({ type: "notice", text: null }), duration);
  }

  /** Stop everything that holds the network, the camera or the microphone. */
  function release() {
    window.clearTimeout(noticeTimer);
    peers.forEach((peer) => peer.connection.close());
    peers.clear();
    localStream?.getTracks().forEach((track) => track.stop());
    socket?.close();
  }

  function finish(reason: EndReason) {
    if (over) return;
    over = true;
    release();
    emit({ type: "over", reason });
  }

  // ---- WebRTC: one connection per other participant -------------------------

  function createPeer(remoteId: number): Peer {
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { connection, pendingCandidates: [] };
    peers.set(remoteId, peer);

    // Send our microphone and camera to this participant.
    localStream?.getTracks().forEach((track) => connection.addTrack(track, localStream!));

    // Each network route the browser discovers is passed on as soon as it is found.
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: "signal", to: remoteId, data: { candidate: event.candidate.toJSON() } });
      }
    };

    // Their audio and video arrive here once the connection is up.
    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      emit({ type: "stream", participantId: remoteId, stream });
    };

    // "failed" means no network route worked (usually a strict firewall and no TURN relay).
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        notify(`Audio and video could not be connected with ${names.get(remoteId) ?? "someone"}`);
      }
    };

    return peer;
  }

  /** We joined after `remoteId`, so we start the handshake by sending an offer. */
  async function call(remoteId: number) {
    const { connection } = createPeer(remoteId);

    // Without a mic or camera of our own, still ask to receive theirs.
    for (const kind of ["audio", "video"] as const) {
      if (!localTrack(kind)) connection.addTransceiver(kind, { direction: "recvonly" });
    }

    await connection.setLocalDescription(await connection.createOffer());
    send({ type: "signal", to: remoteId, data: { description: connection.localDescription! } });
  }

  async function handleSignal(from: number, { description, candidate }: SignalData) {
    // An offer from someone we have no connection with yet means they are calling us.
    const peer = peers.get(from) ?? createPeer(from);
    const { connection } = peer;

    if (description) {
      await connection.setRemoteDescription(description);
      for (const pending of peer.pendingCandidates.splice(0)) {
        await connection.addIceCandidate(pending);
      }
      if (description.type === "offer") {
        await connection.setLocalDescription(await connection.createAnswer());
        send({ type: "signal", to: from, data: { description: connection.localDescription! } });
      }
    } else if (candidate) {
      // A candidate can only be added once the description it refers to is in place.
      if (connection.remoteDescription) await connection.addIceCandidate(candidate);
      else peer.pendingCandidates.push(candidate);
    }
  }

  function dropPeer(remoteId: number) {
    peers.get(remoteId)?.connection.close();
    peers.delete(remoteId);
  }

  /** A failed handshake with one person should not take the whole meeting down. */
  function reportSignalError(error: unknown) {
    if (!over) console.warn("Media connection problem:", error);
  }

  // ---- messages from the server ---------------------------------------------

  function handleMessage(message: ServerMessage) {
    switch (message.type) {
      case "welcome":
        message.participants.forEach((other) => names.set(other.id, other.name));
        emit({ type: "welcome", participants: message.participants });
        publishMediaState();
        message.participants.forEach((other) => call(other.id).catch(reportSignalError));
        break;

      case "participant-joined":
        names.set(message.participant.id, message.participant.name);
        emit({ type: "joined", participant: message.participant });
        notify(`${message.participant.name} joined`);
        break;

      case "participant-updated":
        emit({ type: "updated", participant: message.participant });
        break;

      case "participant-left":
        dropPeer(message.participantId);
        emit({ type: "left", participantId: message.participantId });
        notify(`${names.get(message.participantId) ?? "Someone"} left`);
        names.delete(message.participantId);
        break;

      case "all-muted": {
        const byMe = message.by === session.participantId;
        const mic = localTrack("audio");
        if (!byMe && mic) mic.enabled = false;
        emit({ type: "all-muted", by: message.by });
        emit({
          type: "local-media",
          micOn: mic?.enabled ?? false,
          cameraOn: localTrack("video")?.enabled ?? false,
        });
        notify(byMe ? "You muted everyone" : "The host muted everyone");
        break;
      }

      case "signal":
        handleSignal(message.from, message.data).catch(reportSignalError);
        break;

      case "error":
        notify(message.message);
        break;
    }
  }

  // ---- start ----------------------------------------------------------------

  async function open() {
    const stream = await openLocalMedia();
    if (over) {
      // The page went away while the browser was still asking for permission.
      stream?.getTracks().forEach((track) => track.stop());
      return;
    }

    localStream = stream;
    const mic = localTrack("audio");
    const camera = localTrack("video");
    if (mic) mic.enabled = session.micOn;
    if (camera) camera.enabled = session.cameraOn;
    emit({ type: "media-ready", stream, hasMic: Boolean(mic), hasCamera: Boolean(camera) });
    emit({ type: "local-media", micOn: mic?.enabled ?? false, cameraOn: camera?.enabled ?? false });
    if (!mic && !camera) {
      notify("No camera or microphone is available, so you can only watch and listen.", 8000);
    }

    socket = new WebSocket(meetingSocketUrl(code, session.token));
    socket.onmessage = (event) => handleMessage(JSON.parse(event.data) as ServerMessage);
    // The server explains why it closed the socket through the close code.
    socket.onclose = (event) => finish(endReasonForClose(event.code));
  }

  void open();

  return {
    toggleMic: () => toggle("audio"),
    toggleCamera: () => toggle("video"),
    muteAll: () => send({ type: "mute-all" }),
    removeParticipant: (participantId) => send({ type: "remove-participant", participantId }),
    endForAll: () => send({ type: "end-meeting" }),
    leave: () => finish("left"),
    dispose: () => {
      over = true;
      release();
    },
  };
}
