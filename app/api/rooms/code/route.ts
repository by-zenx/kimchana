import { NextResponse } from 'next/server';
import { db } from '@/db';
import { rooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { GameEngine } from '@/lib/game-engine';

const MAX_ATTEMPTS = 20;

export async function GET() {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const roomId = GameEngine.generateRoomId();
    const existing = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });
    if (!existing) {
      return NextResponse.json({ roomId });
    }
  }

  return NextResponse.json(
    { error: 'Unable to generate a unique room code. Try again.' },
    { status: 500 },
  );
}
