"""Who is connected to which meeting right now.

This state lives in memory, which is all a single API process needs. Running
several processes would need a shared channel between them (for example
Redis pub/sub) so a message can reach sockets held by another process.
"""

from dataclasses import dataclass

from starlette.websockets import WebSocket, WebSocketDisconnect


@dataclass
class Member:
    """One connected participant: who they are, their socket, their media state."""

    id: int  # participants.id
    name: str
    role: str
    socket: WebSocket
    audio: bool = False
    video: bool = False

    def describe(self) -> dict:
        """What other participants are told about this member."""
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "audio": self.audio,
            "video": self.video,
        }


class Room:
    def __init__(self, code: str) -> None:
        self.code = code
        self.members: dict[int, Member] = {}

    async def send(self, member: Member, message: dict) -> None:
        try:
            await member.socket.send_json(message)
        except (WebSocketDisconnect, RuntimeError):
            # The socket closed under us. Its own handler does the cleanup.
            pass

    async def broadcast(self, message: dict, *, exclude: int | None = None) -> None:
        for member in list(self.members.values()):
            if member.id != exclude:
                await self.send(member, message)


class Hub:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    def room(self, code: str) -> Room:
        """The room for a meeting, created the first time someone connects."""
        if code not in self._rooms:
            self._rooms[code] = Room(code)
        return self._rooms[code]

    def is_empty(self, code: str) -> bool:
        room = self._rooms.get(code)
        return room is None or not room.members

    def discard(self, code: str) -> None:
        self._rooms.pop(code, None)


hub = Hub()
