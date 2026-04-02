import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { players, rooms } from '@/db/schema';
import { GameEngine, type SerializedGameState } from '@/lib/game-engine';
import { extractRoomIdFromRequest } from '@/lib/server-utils';
import { getRoomStateContext } from '@/lib/realtime/snapshot';
import { broadcastRoomSnapshot } from '@/lib/realtime/server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const params = await context.params;
  const roomId = extractRoomIdFromRequest(request, params);
  if (!roomId) {
    return NextResponse.json({ error: 'Missing room id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({}));
  const status = payload?.status;
  const playerId = payload?.playerId;
  const playerToken = payload?.playerToken;

  if (!status) {
    return NextResponse.json({ error: 'Missing status' }, { status: 400 });
  }

  if (!playerId || !playerToken) {
    return NextResponse.json({ error: 'Missing player session' }, { status: 401 });
  }

  if (!['lobby', 'playing', 'finished'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const roomContext = await getRoomStateContext(roomId);
  if (!roomContext) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const player = await db.query.players.findFirst({
    where: and(
      eq(players.id, playerId),
      eq(players.room_id, roomId),
      eq(players.token, playerToken),
    ),
  });

  if (!player || player.id !== roomContext.room.host_id) {
    return NextResponse.json({ error: 'Only host can update room status' }, { status: 403 });
  }

  let nextState = roomContext.gameState;
  if (status === 'playing') {
    nextState = {
      ...roomContext.gameState,
      status: 'playing',
      winnerId: null,
    };
  } else if (status === 'lobby') {
    nextState = GameEngine.resetGame(
      roomContext.gameState.players,
      { rows: roomContext.room.grid_rows, cols: roomContext.room.grid_cols },
    );
  } else if (status === 'finished') {
    nextState = {
      ...roomContext.gameState,
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
      started_at: status === 'playing' ? roomContext.room.started_at ?? new Date() : null,
      finished_at: status === 'finished' ? new Date() : null,
      last_activity_at: new Date(),
    })
    .where(eq(rooms.id, roomId));

  await broadcastRoomSnapshot(roomId);
  return NextResponse.json({ status });
}
