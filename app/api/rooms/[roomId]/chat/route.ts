import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, players, rooms } from '@/db/schema';
import { extractRoomIdFromRequest } from '@/lib/server-utils';
import { getRoomSnapshot } from '@/lib/realtime/snapshot';
import { broadcastRoomEvent } from '@/lib/realtime/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const params = await context.params;
  const roomId = extractRoomIdFromRequest(request, params);
  if (!roomId) {
    return NextResponse.json({ error: 'Missing room id' }, { status: 400 });
  }

  const snapshot = await getRoomSnapshot(roomId);
  if (!snapshot) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({ chatMessages: snapshot.chatMessages });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const params = await context.params;
  const roomId = extractRoomIdFromRequest(request, params);
  if (!roomId) {
    return NextResponse.json({ error: 'Missing room id' }, { status: 400 });
  }

  const { playerId, playerToken, content } = await request.json().catch(() => ({}));
  const messageText = typeof content === 'string' ? content.trim() : '';
  if (!playerId || !playerToken || !messageText) {
    return NextResponse.json({ error: 'Missing chat payload' }, { status: 400 });
  }

  const player = await db.query.players.findFirst({
    where: and(
      eq(players.id, playerId),
      eq(players.room_id, roomId),
      eq(players.token, playerToken),
    ),
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found in room' }, { status: 401 });
  }

  const inserted = await db
    .insert(chatMessages)
    .values({
      room_id: roomId,
      player_id: playerId,
      content: messageText.slice(0, 500),
    })
    .returning();

  const messageRow = inserted[0];
  if (!messageRow) {
    return NextResponse.json({ error: 'Unable to store message' }, { status: 500 });
  }

  await db
    .update(rooms)
    .set({ last_activity_at: new Date() })
    .where(eq(rooms.id, roomId));

  const formatted = {
    id: messageRow.id,
    roomId,
    playerId,
    playerName: player.name,
    content: messageRow.content,
    createdAt: messageRow.created_at.toISOString(),
  };

  broadcastRoomEvent(roomId, 'chat:new', formatted);
  return NextResponse.json({ chatMessage: formatted });
}
