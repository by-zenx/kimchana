import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, rooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PLAYER_COLORS, MIN_PLAYERS } from '@/lib/constants';

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

    if (!roomId || !playerName || !gridRows || !gridCols) {
      return NextResponse.json(
        { error: 'Missing required room creation data' },
        { status: 400 },
      );
    }

    const existing = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Room code already exists' },
        { status: 409 },
      );
    }

    const hostId = `player-${crypto.randomUUID()}`;
    await db.insert(rooms).values({
      id: roomId,
      host_id: hostId,
      grid_rows: gridRows,
      grid_cols: gridCols,
      player_count: playerCount,
      max_players: 8,
      status: 'lobby',
      timer_seconds: 30,
      auto_move_enabled: autoMoveEnabled,
      settings: {
        allowAutoMove: autoMoveEnabled,
        autoMoveEnabled,
        timeoutSeconds: autoMoveEnabled ? 30 : null,
      },
    });

    await db.insert(players).values({
      id: hostId,
      room_id: roomId,
      name: playerName,
      color: PLAYER_COLORS[0],
      order: 0,
      is_host: true,
    });

    return NextResponse.json({ roomId, hostId });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to create room. Try again.' },
      { status: 500 },
    );
  }
}
