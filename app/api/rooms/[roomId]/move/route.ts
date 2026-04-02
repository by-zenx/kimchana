import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { players } from '@/db/schema';
import { extractRoomIdFromRequest } from '@/lib/server-utils';
import { applyRoomMove } from '@/lib/realtime/move';
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
  const playerId = payload?.playerId;
  const playerToken = payload?.playerToken;
  const edgeKey = payload?.edgeKey;

  if (!playerId || !playerToken || typeof edgeKey !== 'string' || !edgeKey.trim()) {
    return NextResponse.json({ error: 'Missing move payload' }, { status: 400 });
  }

  const player = await db.query.players.findFirst({
    where: and(
      eq(players.id, playerId),
      eq(players.room_id, roomId),
      eq(players.token, playerToken),
    ),
  });

  if (!player) {
    return NextResponse.json({ error: 'Invalid player session' }, { status: 401 });
  }

  const result = await applyRoomMove(roomId, player.id, edgeKey);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  await broadcastRoomSnapshot(roomId);
  return NextResponse.json({ ok: true, status: result.status });
}
