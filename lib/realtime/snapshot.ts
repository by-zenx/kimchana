import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, players, rooms } from '@/db/schema';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import type { GameState, Player, RoomSettings, ChatMessage } from '@/lib/types';
import type { RoomSnapshot } from '@/lib/realtime/types';

type RoomRow = typeof rooms.$inferSelect;
type PlayerRow = typeof players.$inferSelect;

function hasSerializedState(input: unknown): input is SerializedGameState {
  return Boolean(input && typeof input === 'object' && Object.keys(input as object).length);
}

function mergePlayers(playerRows: PlayerRow[], statePlayers: Player[]): Player[] {
  const stateById = new Map(statePlayers.map((player) => [player.id, player]));
  const merged = [...playerRows]
    .sort((a, b) => a.order - b.order)
    .map((row) => {
      const statePlayer = stateById.get(row.id);
      return {
        id: row.id,
        name: row.name,
        color: row.color ?? statePlayer?.color ?? '#3b82f6',
        score: statePlayer?.score ?? row.score ?? 0,
        order: row.order,
        isActive: row.is_active,
        isHost: row.is_host,
      } satisfies Player;
    });

  if (merged.length > 0) {
    return merged;
  }

  return [...statePlayers].sort((a, b) => a.order - b.order);
}

function normalizeCurrentPlayerIndex(currentPlayerIndex: number, playerCount: number): number {
  if (playerCount <= 0) {
    return 0;
  }

  if (currentPlayerIndex < 0) {
    return 0;
  }

  if (currentPlayerIndex >= playerCount) {
    return playerCount - 1;
  }

  return currentPlayerIndex;
}

function normalizeGameState(room: RoomRow, mergedPlayers: Player[]): GameState {
  const baseState = hasSerializedState(room.game_state)
    ? GameEngine.deserializeState(room.game_state as SerializedGameState)
    : GameEngine.createInitialState(
        { rows: room.grid_rows, cols: room.grid_cols },
        mergedPlayers,
      );

  return {
    ...baseState,
    gridSize: { rows: room.grid_rows, cols: room.grid_cols },
    players: mergedPlayers,
    status: room.status,
    currentPlayerIndex: normalizeCurrentPlayerIndex(
      baseState.currentPlayerIndex ?? 0,
      mergedPlayers.length,
    ),
    winnerId: room.status === 'finished' ? baseState.winnerId ?? room.winner_id : null,
  };
}

function mapChatMessages(
  roomId: string,
  rows: (typeof chatMessages.$inferSelect)[],
  roomPlayers: Player[],
): ChatMessage[] {
  const playerNames = new Map(roomPlayers.map((player) => [player.id, player.name]));

  return rows.map((row) => ({
    id: row.id,
    roomId,
    playerId: row.player_id,
    playerName: playerNames.get(row.player_id) ?? 'Guest',
    content: row.content,
    createdAt: row.created_at.toISOString(),
  }));
}

function toSnapshot(
  room: RoomRow,
  roomPlayers: Player[],
  gameState: GameState,
  roomChatMessages: ChatMessage[],
): RoomSnapshot {
  return {
    room: {
      id: room.id,
      hostId: room.host_id,
      gridSize: { rows: room.grid_rows, cols: room.grid_cols },
      playerCount: room.player_count,
      maxPlayers: room.max_players,
      timerSeconds: room.timer_seconds,
      autoMoveEnabled: room.auto_move_enabled,
      status: room.status,
      settings: (room.settings ?? {}) as RoomSettings,
      createdAt: room.created_at.getTime(),
    },
    players: roomPlayers,
    gameState: GameEngine.serializeState(gameState),
    chatMessages: roomChatMessages,
  };
}

export type RoomStateContext = {
  room: RoomRow;
  playerRows: PlayerRow[];
  players: Player[];
  gameState: GameState;
};

export async function getRoomStateContext(roomId: string): Promise<RoomStateContext | null> {
  const room = await db.query.rooms.findFirst({
    where: eq(rooms.id, roomId),
  });

  if (!room) {
    return null;
  }

  const playerRows = await db.query.players.findMany({
    where: eq(players.room_id, room.id),
  });

  const baseState = hasSerializedState(room.game_state)
    ? GameEngine.deserializeState(room.game_state as SerializedGameState)
    : GameEngine.createInitialState(
        { rows: room.grid_rows, cols: room.grid_cols },
        [],
      );

  const mergedPlayers = mergePlayers(playerRows, baseState.players ?? []);
  const gameState = normalizeGameState(room, mergedPlayers);

  return {
    room,
    playerRows,
    players: mergedPlayers,
    gameState,
  };
}

export async function getRoomSnapshot(roomId: string): Promise<RoomSnapshot | null> {
  const context = await getRoomStateContext(roomId);
  if (!context) {
    return null;
  }

  const messageRows = await db.query.chatMessages.findMany({
    where: eq(chatMessages.room_id, roomId),
    orderBy: asc(chatMessages.created_at),
    limit: 80,
  });

  const roomChatMessages = mapChatMessages(
    roomId,
    messageRows,
    context.players,
  );

  return toSnapshot(
    context.room,
    context.players,
    context.gameState,
    roomChatMessages,
  );
}
