import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, rooms } from '@/db/schema';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import { PLAYER_COLORS } from '@/lib/constants';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { roomId, playerName } = payload;

    if (!roomId || !playerName) {
      return NextResponse.json(
        { error: 'Missing room id or player name' },
        { status: 400 },
      );
    }

    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 },
      );
    }

    const baseState =
      (room.game_state && Object.keys(room.game_state).length
        ? GameEngine.deserializeState(room.game_state as SerializedGameState)
        : GameEngine.createInitialState(
            { rows: room.grid_rows, cols: room.grid_cols },
            [],
          ));
    const currentPlayers = baseState.players ?? [];

    if (currentPlayers.length >= room.player_count) {
      return NextResponse.json(
        { error: 'Room is full' },
        { status: 400 },
      );
    }

    const playerId = `player-${crypto.randomUUID()}`;
    const token = crypto.randomUUID();
    const newPlayer = {
      id: playerId,
      name: playerName,
      color: PLAYER_COLORS[currentPlayers.length % PLAYER_COLORS.length],
      score: 0,
      order: currentPlayers.length,
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
      ...baseState,
      players: [...currentPlayers, newPlayer],
    };

    await db
      .update(rooms)
      .set({
        game_state: GameEngine.serializeState(updatedGameState) as SerializedGameState,
        last_activity_at: new Date(),
      })
      .where(eq(rooms.id, roomId));

    return NextResponse.json({
      room: {
        id: room.id,
        hostId: room.host_id,
        gridSize: { rows: room.grid_rows, cols: room.grid_cols },
        playerCount: room.player_count,
        maxPlayers: room.max_players,
        timerSeconds: room.timer_seconds,
        autoMoveEnabled: room.auto_move_enabled,
        status: room.status,
        settings: room.settings,
        createdAt: room.created_at.getTime(),
        gameState: GameEngine.serializeState(updatedGameState),
        players: updatedGameState.players,
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
