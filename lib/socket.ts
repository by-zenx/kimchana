type RoomId = string;

declare global {
  var __roomSocketMap: Map<RoomId, Set<WebSocket>> | undefined;
}

export const roomSocketMap =
  globalThis.__roomSocketMap || new Map<RoomId, Set<WebSocket>>();

if (!globalThis.__roomSocketMap) {
  globalThis.__roomSocketMap = roomSocketMap;
}

export function registerSocket(roomId: RoomId, socket: WebSocket) {
  if (!roomSocketMap.has(roomId)) {
    roomSocketMap.set(roomId, new Set());
  }
  roomSocketMap.get(roomId)?.add(socket);
}

export function unregisterSocket(roomId: RoomId, socket: WebSocket) {
  roomSocketMap.get(roomId)?.delete(socket);
}

export function broadcastToRoom(
  roomId: RoomId,
  payload: unknown,
  options?: { exclude?: WebSocket },
) {
  const sockets = roomSocketMap.get(roomId);
  if (!sockets) {
    return;
  }
  const message = JSON.stringify(payload);
  sockets.forEach((socket) => {
    if (options?.exclude && socket === options.exclude) {
      return;
    }
    try {
      socket.send(message);
    } catch (error) {
      console.error('Failed to send socket message', error);
    }
  });
}
