import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { GameEngine, type SerializedGameState } from '@/lib/game-engine';
import { getRoomStateContext } from '@/lib/realtime/snapshot';

export type ApplyMoveResult =
  | { ok: true; status: 'lobby' | 'playing' | 'finished' }
  | { ok: false; error: string };

export async function applyRoomMove(
  roomId: string,
  playerId: string,
  edgeKey: string,
): Promise<ApplyMoveResult> {
  const context = await getRoomStateContext(roomId);
  if (!context) {
    return { ok: false, error: 'Room not found' };
  }

  if (context.room.status !== 'playing') {
    return { ok: false, error: 'Game is not in playing state' };
  }

  const trimmedEdgeKey = edgeKey.trim();
  if (!trimmedEdgeKey) {
    return { ok: false, error: 'Missing edge key' };
  }

  const previousMoveCount = context.gameState.moveHistory.length;
  const { newState } = GameEngine.playMove(
    context.gameState,
    trimmedEdgeKey,
    playerId,
  );

  if (newState.moveHistory.length === previousMoveCount) {
    return { ok: false, error: 'Invalid move' };
  }

  await db
    .update(rooms)
    .set({
      game_state: GameEngine.serializeState(newState) as SerializedGameState,
      status: newState.status,
      winner_id: newState.winnerId,
      current_player_index: newState.currentPlayerIndex,
      finished_at: newState.status === 'finished' ? new Date() : null,
      last_activity_at: new Date(),
    })
    .where(eq(rooms.id, roomId));

  return { ok: true, status: newState.status };
}
