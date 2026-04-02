import type { Server as HttpServer } from 'http';
import { and, eq, ne } from 'drizzle-orm';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { db } from '@/db';
import { chatMessages, players, rooms } from '@/db/schema';
import { GameEngine, type SerializedGameState } from '@/lib/game-engine';
import { GRID_SIZES, MAX_PLAYERS, MIN_PLAYERS } from '@/lib/constants';
import type { RealtimeAck, RealtimeRoomStatus } from '@/lib/realtime/types';
import { getRoomSnapshot, getRoomStateContext } from '@/lib/realtime/snapshot';
import { applyRoomMove } from '@/lib/realtime/move';

type JoinRoomPayload = {
  roomId?: string;
  playerId?: string;
  playerToken?: string;
};

type MovePayload = {
  edgeKey?: string;
};

type SettingsPayload = {
  gridRows?: number;
  gridCols?: number;
  playerCount?: number;
  autoMoveEnabled?: boolean;
};

type StatusPayload = {
  status?: RealtimeRoomStatus;
};

type ChatPayload = {
  content?: string;
};

type ColorPayload = {
  color?: string;
};

type RoomSocketData = {
  roomId?: string;
  playerId?: string;
  playerToken?: string;
};

type RoomSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  RoomSocketData
>;

declare global {
  // eslint-disable-next-line no-var
  var __realtimeIoServer: SocketIOServer | undefined;
}

function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function isValidColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);
}

function isAllowedGrid(rows: number, cols: number): boolean {
  return GRID_SIZES.some((grid) => grid.rows === rows && grid.cols === cols);
}

async function validateSession(socket: RoomSocket) {
  const roomId = normalizeRoomId(socket.data.roomId);
  const playerId = socket.data.playerId;
  const playerToken = socket.data.playerToken;

  if (!roomId || !playerId || !playerToken) {
    return null;
  }

  const player = await db.query.players.findFirst({
    where: and(
      eq(players.id, playerId),
      eq(players.room_id, roomId),
      eq(players.token, playerToken),
    ),
  });

  if (!player) {
    return null;
  }

  return { roomId, player, playerToken };
}

function fail(ack: ((response: RealtimeAck) => void) | undefined, error: string) {
  ack?.({ ok: false, error });
}

async function emitRoomSnapshot(io: SocketIOServer, roomId: string) {
  const snapshot = await getRoomSnapshot(roomId);
  if (!snapshot) {
    return;
  }

  io.to(roomId).emit('room:snapshot', snapshot);
}

function attachSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: RoomSocket) => {
    socket.on('room:join', async (payload: JoinRoomPayload, ack?: (response: RealtimeAck) => void) => {
      try {
        const roomId = normalizeRoomId(payload?.roomId);
        const playerId = payload?.playerId;
        const playerToken = payload?.playerToken;

        if (!roomId || !playerId || !playerToken) {
          fail(ack, 'Missing room session payload');
          return;
        }

        const player = await db.query.players.findFirst({
          where: and(
            eq(players.id, playerId),
            eq(players.room_id, roomId),
            eq(players.token, playerToken),
          ),
        });

        if (!player) {
          fail(ack, 'Invalid room session');
          return;
        }

        if (socket.data.roomId && socket.data.roomId !== roomId) {
          socket.leave(socket.data.roomId);
        }

        socket.data.roomId = roomId;
        socket.data.playerId = playerId;
        socket.data.playerToken = playerToken;
        socket.join(roomId);

        await emitRoomSnapshot(io, roomId);
        ack?.({ ok: true });
      } catch (error) {
        console.error('room:join failed', error);
        fail(ack, 'Unable to join realtime room');
      }
    });

    socket.on('room:leave', () => {
      if (socket.data.roomId) {
        socket.leave(socket.data.roomId);
      }
      socket.data.roomId = undefined;
      socket.data.playerId = undefined;
      socket.data.playerToken = undefined;
    });

    socket.on('game:play-move', async (payload: MovePayload, ack?: (response: RealtimeAck) => void) => {
      try {
        const session = await validateSession(socket);
        if (!session) {
          fail(ack, 'Session expired. Please rejoin the room.');
          return;
        }

        const edgeKey = typeof payload?.edgeKey === 'string' ? payload.edgeKey.trim() : '';
        if (!edgeKey) {
          fail(ack, 'Missing edge key');
          return;
        }

        const result = await applyRoomMove(session.roomId, session.player.id, edgeKey);
        if (!result.ok) {
          fail(ack, result.error);
          return;
        }

        await emitRoomSnapshot(io, session.roomId);
        ack?.({ ok: true });
      } catch (error) {
        console.error('game:play-move failed', error);
        fail(ack, 'Unable to apply move');
      }
    });

    socket.on('room:update-settings', async (payload: SettingsPayload, ack?: (response: RealtimeAck) => void) => {
      try {
        const session = await validateSession(socket);
        if (!session) {
          fail(ack, 'Session expired. Please rejoin the room.');
          return;
        }

        const context = await getRoomStateContext(session.roomId);
        if (!context) {
          fail(ack, 'Room not found');
          return;
        }

        if (context.room.host_id !== session.player.id) {
          fail(ack, 'Only the host can update settings');
          return;
        }

        if (context.room.status !== 'lobby') {
          fail(ack, 'Settings can only be changed in lobby');
          return;
        }

        const gridRows = Number(payload?.gridRows);
        const gridCols = Number(payload?.gridCols);
        const playerCount = Number(payload?.playerCount);
        const autoMoveEnabled = Boolean(payload?.autoMoveEnabled);

        if (
          !Number.isInteger(gridRows) ||
          !Number.isInteger(gridCols) ||
          !isAllowedGrid(gridRows, gridCols)
        ) {
          fail(ack, 'Invalid grid size');
          return;
        }

        const requestedPlayerCount = Number.isInteger(playerCount) ? playerCount : context.room.player_count;
        const normalizedPlayerCount = Math.max(
          context.players.length,
          Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, requestedPlayerCount)),
        );

        const resetPlayers = context.gameState.players.map((player) => ({
          ...player,
          score: 0,
          isActive: true,
        }));

        const restartedState = GameEngine.createInitialState(
          { rows: gridRows, cols: gridCols },
          resetPlayers,
        );

        await db
          .update(rooms)
          .set({
            grid_rows: gridRows,
            grid_cols: gridCols,
            player_count: normalizedPlayerCount,
            auto_move_enabled: autoMoveEnabled,
            settings: {
              allowAutoMove: autoMoveEnabled,
              autoMoveEnabled,
              timeoutSeconds: autoMoveEnabled ? 30 : null,
            },
            status: 'lobby',
            winner_id: null,
            current_player_index: 0,
            game_state: GameEngine.serializeState(restartedState) as SerializedGameState,
            finished_at: null,
            last_activity_at: new Date(),
          })
          .where(eq(rooms.id, session.roomId));

        await emitRoomSnapshot(io, session.roomId);
        ack?.({ ok: true });
      } catch (error) {
        console.error('room:update-settings failed', error);
        fail(ack, 'Unable to update room settings');
      }
    });

    socket.on('room:update-status', async (payload: StatusPayload, ack?: (response: RealtimeAck) => void) => {
      try {
        const session = await validateSession(socket);
        if (!session) {
          fail(ack, 'Session expired. Please rejoin the room.');
          return;
        }

        const status = payload?.status;
        if (!status || !['lobby', 'playing', 'finished'].includes(status)) {
          fail(ack, 'Invalid room status');
          return;
        }

        const context = await getRoomStateContext(session.roomId);
        if (!context) {
          fail(ack, 'Room not found');
          return;
        }

        if (context.room.host_id !== session.player.id) {
          fail(ack, 'Only the host can change room status');
          return;
        }

        let nextState = context.gameState;
        if (status === 'playing') {
          nextState = {
            ...context.gameState,
            status: 'playing',
            winnerId: null,
          };
        } else if (status === 'lobby') {
          nextState = GameEngine.resetGame(
            context.gameState.players,
            { rows: context.room.grid_rows, cols: context.room.grid_cols },
          );
        } else if (status === 'finished') {
          nextState = {
            ...context.gameState,
            status: 'finished',
          };
        }

        await db
          .update(rooms)
          .set({
            status,
            game_state: GameEngine.serializeState(nextState) as SerializedGameState,
            winner_id: nextState.winnerId,
            current_player_index: nextState.currentPlayerIndex,
            started_at: status === 'playing' ? context.room.started_at ?? new Date() : null,
            finished_at: status === 'finished' ? new Date() : null,
            last_activity_at: new Date(),
          })
          .where(eq(rooms.id, session.roomId));

        await emitRoomSnapshot(io, session.roomId);
        ack?.({ ok: true });
      } catch (error) {
        console.error('room:update-status failed', error);
        fail(ack, 'Unable to update room status');
      }
    });

    socket.on('chat:send', async (payload: ChatPayload, ack?: (response: RealtimeAck) => void) => {
      try {
        const session = await validateSession(socket);
        if (!session) {
          fail(ack, 'Session expired. Please rejoin the room.');
          return;
        }

        const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
        if (!content) {
          fail(ack, 'Message cannot be empty');
          return;
        }

        const inserted = await db
          .insert(chatMessages)
          .values({
            room_id: session.roomId,
            player_id: session.player.id,
            content: content.slice(0, 500),
          })
          .returning();

        const row = inserted[0];
        if (!row) {
          fail(ack, 'Unable to store chat message');
          return;
        }

        await db
          .update(rooms)
          .set({ last_activity_at: new Date() })
          .where(eq(rooms.id, session.roomId));

        io.to(session.roomId).emit('chat:new', {
          id: row.id,
          roomId: session.roomId,
          playerId: session.player.id,
          playerName: session.player.name,
          content: row.content,
          createdAt: row.created_at.toISOString(),
        });

        ack?.({ ok: true });
      } catch (error) {
        console.error('chat:send failed', error);
        fail(ack, 'Unable to send chat message');
      }
    });

    socket.on('player:update-color', async (payload: ColorPayload, ack?: (response: RealtimeAck) => void) => {
      try {
        const session = await validateSession(socket);
        if (!session) {
          fail(ack, 'Session expired. Please rejoin the room.');
          return;
        }

        const color = typeof payload?.color === 'string' ? payload.color.trim() : '';
        if (!color || !isValidColor(color)) {
          fail(ack, 'Invalid color value');
          return;
        }

        const context = await getRoomStateContext(session.roomId);
        if (!context) {
          fail(ack, 'Room not found');
          return;
        }

        if (context.room.status !== 'lobby') {
          fail(ack, 'Color can only be changed in lobby');
          return;
        }

        const colorTaken = await db.query.players.findFirst({
          where: and(
            eq(players.room_id, session.roomId),
            eq(players.color, color),
            ne(players.id, session.player.id),
          ),
        });

        if (colorTaken) {
          fail(ack, 'Color already taken');
          return;
        }

        await db
          .update(players)
          .set({
            color,
            last_action_at: new Date(),
          })
          .where(eq(players.id, session.player.id));

        const nextState = {
          ...context.gameState,
          players: context.gameState.players.map((player) =>
            player.id === session.player.id
              ? { ...player, color }
              : player,
          ),
        };

        await db
          .update(rooms)
          .set({
            game_state: GameEngine.serializeState(nextState) as SerializedGameState,
            last_activity_at: new Date(),
          })
          .where(eq(rooms.id, session.roomId));

        await emitRoomSnapshot(io, session.roomId);
        ack?.({ ok: true });
      } catch (error) {
        console.error('player:update-color failed', error);
        fail(ack, 'Unable to update player color');
      }
    });
  });
}

export function initializeSocketServer(httpServer: HttpServer): SocketIOServer {
  if (globalThis.__realtimeIoServer) {
    return globalThis.__realtimeIoServer;
  }

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
  });

  attachSocketHandlers(io);
  globalThis.__realtimeIoServer = io;
  return io;
}

export function getSocketServer(): SocketIOServer | undefined {
  return globalThis.__realtimeIoServer;
}

export async function broadcastRoomSnapshot(roomId: string) {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    return;
  }

  await emitRoomSnapshot(io, normalizedRoomId);
}

export function broadcastRoomEvent(roomId: string, event: string, payload: unknown) {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  const normalizedRoomId = normalizeRoomId(roomId);
  if (!normalizedRoomId) {
    return;
  }

  io.to(normalizedRoomId).emit(event, payload);
}
