import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { broadcastToRoom } from '@/lib/socket';
import { extractRoomIdFromRequest } from '@/lib/server-utils';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId?: string } },
) {
  const roomId = extractRoomIdFromRequest(request, params);
  if (!roomId) {
    return NextResponse.json({ error: 'Missing room id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => ({}));
  const status = payload?.status;
  if (!status) {
    return NextResponse.json({ error: 'Missing status' }, { status: 400 });
  }

  if (!['lobby', 'playing', 'finished'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await db
    .update(rooms)
    .set({ status, last_activity_at: new Date() })
    .where(eq(rooms.id, roomId));

  broadcastToRoom(roomId, { type: 'status', payload: { status } });

  return NextResponse.json({ status });
}
