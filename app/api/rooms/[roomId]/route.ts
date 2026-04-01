import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { chatMessages, players, rooms } from '@/db/schema';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import { asc, eq, inArray } from 'drizzle-orm';
import { extractRoomIdFromRequest } from '@/lib/server-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId?: string } },
) {
  const roomId = extractRoomIdFromRequest(request, params);
  if (!roomId) {
    return NextResponse.json({ error: 'Missing room id' }, { status: 400 });
  }

  const room = await db.query.rooms.findFirst({
    where: eq(rooms.id, roomId),
  });

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const gameState =
    room.game_state && Object.keys(room.game_state).length
      ? GameEngine.deserializeState(room.game_state as SerializedGameState)
      : GameEngine.createInitialState(
          { rows: room.grid_rows, cols: room.grid_cols },
          [],
        );

  const serializedGameState = GameEngine.serializeState(gameState);

  const roomPlayers = await db.query.players.findMany({
    where: eq(players.room_id, room.id),
  });

  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.room_id, room.id),
    orderBy: asc(chatMessages.created_at),
    limit: 40,
  });

  const playerIds = [...new Set(messages.map((message) => message.player_id))];
  const playerRows =
    playerIds.length > 0
      ? await db.query.players.findMany({
          where: inArray(players.id, playerIds),
        })
      : [];

  const playerMap = playerRows.reduce<Record<string, string>>((acc, player) => {
    acc[player.id] = player.name;
    return acc;
  }, {});

  const chatPayload = messages.map((message) => ({
    id: message.id,
    roomId: message.room_id,
    playerId: message.player_id,
    playerName: playerMap[message.player_id] ?? 'Guest',
    content: message.content,
    createdAt: message.created_at.toISOString(),
  }));

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
        gameState: serializedGameState,
      players: roomPlayers,
      chatMessages: chatPayload,
    },
  });
}
