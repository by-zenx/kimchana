import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { players, rooms } from '@/db/schema';
import { PLAYER_COLORS } from '@/lib/constants';
import { GameEngine, type SerializedGameState } from '@/lib/game-engine';
import { getRoomSnapshot, getRoomStateContext } from '@/lib/realtime/snapshot';
import { broadcastRoomSnapshot } from '@/lib/realtime/server';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const roomId = payload?.roomId?.toUpperCase?.();
    const playerName = payload?.playerName?.trim?.();

    if (!roomId || !playerName) {
      return NextResponse.json(
        { error: 'Missing room id or player name' },
        { status: 400 },
      );
    }

    const context = await getRoomStateContext(roomId);
    if (!context) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 },
      );
    }

    if (context.players.length >= context.room.player_count) {
      return NextResponse.json(
        { error: 'Room is full' },
        { status: 400 },
      );
    }

    const playerId = `player-${crypto.randomUUID()}`;
    const token = crypto.randomUUID();
    const nextOrder = context.players.length;
    const newPlayer = {
      id: playerId,
      name: playerName,
      color: PLAYER_COLORS[nextOrder % PLAYER_COLORS.length],
      score: 0,
      order: nextOrder,
      isActive: true,
      isHost: false,
    };

    await db.insert(players).values({
      ...newPlayer,
      room_id: roomId,
      token,
      is_host: false,
    });

    const updatedGameState = {
      ...context.gameState,
      players: [...context.gameState.players, newPlayer],
    };

    await db
      .update(rooms)
      .set({
        game_state: GameEngine.serializeState(updatedGameState) as SerializedGameState,
        last_activity_at: new Date(),
      })
      .where(eq(rooms.id, roomId));

    await broadcastRoomSnapshot(roomId);
    const snapshot = await getRoomSnapshot(roomId);

    return NextResponse.json({
      room: snapshot?.room ?? {
        id: context.room.id,
        hostId: context.room.host_id,
        gridSize: { rows: context.room.grid_rows, cols: context.room.grid_cols },
        playerCount: context.room.player_count,
        maxPlayers: context.room.max_players,
        timerSeconds: context.room.timer_seconds,
        autoMoveEnabled: context.room.auto_move_enabled,
        status: context.room.status,
        settings: context.room.settings,
        createdAt: context.room.created_at.getTime(),
      },
      playerId,
      playerToken: token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to join room' },
      { status: 500 },
    );
  }
}
