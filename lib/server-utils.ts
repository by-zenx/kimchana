import { NextRequest } from 'next/server';

export function extractRoomIdFromRequest(
  request: NextRequest,
  params?: { roomId?: string },
): string | null {
  const paramId = params?.roomId;
  if (paramId) {
    return paramId.toUpperCase();
  }

  const pathnameMatch = request.nextUrl.pathname.match(/\/api\/rooms\/([^/]+)/i);
  if (pathnameMatch) {
    return pathnameMatch[1].toUpperCase();
  }

  const queryId = request.nextUrl.searchParams.get('roomId');
  if (queryId) {
    return queryId.toUpperCase();
  }

  return null;
}
