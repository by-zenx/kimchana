import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HttpServer } from 'http';
import { initializeSocketServer } from '@/lib/realtime/server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function socketHandler(_req: NextApiRequest, res: NextApiResponse) {
  const httpServer = (res.socket as any)?.server as HttpServer | undefined;
  if (!httpServer) {
    res.status(500).json({ error: 'Server socket unavailable' });
    return;
  }

  initializeSocketServer(httpServer);
  res.status(200).json({ ok: true });
}
