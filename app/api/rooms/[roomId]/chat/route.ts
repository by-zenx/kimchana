import { NextRequest, NextResponse } from 'next/server';
import { chatMessages, players } from '@/db/schema';
import { db } from '@/db';
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

  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.room_id, roomId),
    orderBy: asc(chatMessages.created_at),
    limit: 50,
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

  const payload = messages.map((message) => ({
    id: message.id,
    roomId: message.room_id,
    playerId: message.player_id,
    playerName: playerMap[message.player_id] ?? 'Guest',
    content: message.content,
    createdAt: message.created_at.toISOString(),
  }));

  return NextResponse.json({ chatMessages: payload });
}
