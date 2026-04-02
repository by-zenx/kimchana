export type EdgeKey = string;

export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  order: number;
  isActive: boolean;
  isHost?: boolean;
}

export interface Square {
  topLeft: [number, number];
  ownerId: string | null;
}

export interface GameState {
  gridSize: { rows: number; cols: number };
  edges: Set<EdgeKey>;
  edgeOwners: Record<EdgeKey, string>;
  squares: Square[];
  players: Player[];
  currentPlayerIndex: number;
  status: 'lobby' | 'playing' | 'finished';
  moveHistory: EdgeKey[];
  winnerId: string | null;
}

export interface RoomSettings {
  allowAutoMove: boolean;
  timeoutSeconds: number | null;
  autoMoveEnabled: boolean;
  label?: string;
  description?: string;
}

export interface Room {
  id: string;
  hostId: string;
  gridSize: { rows: number; cols: number };
  playerCount: number;
  maxPlayers: number;
  timerSeconds: number;
  autoMoveEnabled: boolean;
  status: GameState['status'];
  settings: RoomSettings;
  createdAt: number;
  gameState: GameState;
  players: Player[];
  chatMessages?: ChatMessage[];
}

export interface ChatMessage {
  id: number;
  roomId: string;
  playerId: string;
  playerName: string;
  content: string;
  createdAt: string;
}

export interface GameMove {
  edgeKey: EdgeKey;
  playerId: string;
  timestamp: number;
  squaresCompleted: Square[];
}
