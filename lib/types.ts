export type EdgeKey = string;

export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  order: number;
}

export interface Square {
  topLeft: [number, number];
  ownerId: string | null;
}

export interface GameState {
  gridSize: { rows: number; cols: number };
  edges: Set<EdgeKey>;
  squares: Square[];
  players: Player[];
  currentPlayerIndex: number;
  status: 'lobby' | 'playing' | 'finished';
  moveHistory: EdgeKey[];
  winnerId: string | null;
}

export interface Room {
  id: string;
  gridSize: { rows: number; cols: number };
  playerCount: number;
  createdAt: number;
  gameState: GameState;
  players: Player[];
}

export interface GameMove {
  edgeKey: EdgeKey;
  playerId: string;
  timestamp: number;
  squaresCompleted: Square[];
}
