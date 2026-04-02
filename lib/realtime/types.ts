import type { SerializedGameState } from '@/lib/game-engine';
import type { ChatMessage, Player, RoomSettings } from '@/lib/types';

export type RealtimeRoomStatus = 'lobby' | 'playing' | 'finished';

export type RoomSnapshot = {
  room: {
    id: string;
    hostId: string;
    gridSize: { rows: number; cols: number };
    playerCount: number;
    maxPlayers: number;
    timerSeconds: number;
    autoMoveEnabled: boolean;
    status: RealtimeRoomStatus;
    settings: RoomSettings;
    createdAt: number;
  };
  players: Player[];
  gameState: SerializedGameState;
  chatMessages: ChatMessage[];
};

export type RealtimeAck =
  | { ok: true }
  | { ok: false; error: string };
