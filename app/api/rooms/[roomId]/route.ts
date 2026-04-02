import { NextRequest, NextResponse } from 'next/server';
import { extractRoomIdFromRequest } from '@/lib/server-utils';
import { getRoomSnapshot } from '@/lib/realtime/snapshot';

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

  return NextResponse.json({ room: snapshot });
}
