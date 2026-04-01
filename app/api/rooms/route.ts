import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, rooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PLAYER_COLORS, MIN_PLAYERS, GRID_SIZES, MAX_PLAYERS } from '@/lib/constants';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const {
      roomId,
      playerName,
      gridRows,
      gridCols,
      playerCount = MIN_PLAYERS,
      autoMoveEnabled = false,
    } = payload;
    const normalizedRoomId = roomId?.toUpperCase();
    if (!normalizedRoomId) {
      return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
    }
    const normalizedPlayerCount = Math.min(
      MAX_PLAYERS,
      Math.max(MIN_PLAYERS, playerCount),
    );

    if (!roomId || !playerName || !gridRows || !gridCols) {
      return NextResponse.json(
        { error: 'Missing required room creation data' },
        { status: 400 },
      );
    }

    const existing = await db.query.rooms.findFirst({
      where: eq(rooms.id, normalizedRoomId),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Room code already exists' },
        { status: 409 },
      );
    }

    const hostId = `player-${crypto.randomUUID()}`;
    await db.insert(rooms).values({
      id: normalizedRoomId,
      host_id: hostId,
      grid_rows: gridRows,
      grid_cols: gridCols,
      player_count: normalizedPlayerCount,
      max_players: 8,
      status: 'lobby',
      timer_seconds: 30,
      auto_move_enabled: autoMoveEnabled,
      settings: {
        allowAutoMove: autoMoveEnabled,
        autoMoveEnabled,
        timeoutSeconds: autoMoveEnabled ? 30 : null,
      },
      game_state: GameEngine.serializeState(
        GameEngine.createInitialState(
          { rows: gridRows, cols: gridCols },
          [
            {
              id: hostId,
              name: playerName,
              color: PLAYER_COLORS[0],
              score: 0,
              order: 0,
              isActive: true,
              isHost: true,
            },
          ],
        ),
      ) as SerializedGameState,
    });

    const [createdPlayer] = await db.insert(players).values({
      id: hostId,
      room_id: normalizedRoomId,
      name: playerName,
      token: crypto.randomUUID(),
      color: PLAYER_COLORS[0],
      order: 0,
      is_host: true,
    }).returning();

    return NextResponse.json({
      roomId: normalizedRoomId,
      hostId,
      playerId: hostId,
      playerToken: createdPlayer.token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to create room. Try again.' },
      { status: 500 },
    );
  }
}
