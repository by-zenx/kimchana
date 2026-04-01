import { GameState, Player, Square, EdgeKey } from './types';

export type SerializedGameState = Omit<GameState, 'edges'> & {
  edges: EdgeKey[];
};
import { PLAYER_COLORS, DEFAULT_GRID_SIZE } from './constants';

export class GameEngine {
  static serializeState(state: GameState): SerializedGameState {
    return {
      ...state,
      edges: Array.from(state.edges),
    };
  }

  static deserializeState(payload: SerializedGameState): GameState {
    return {
      ...payload,
      edges: new Set(payload.edges),
    };
  }

  static createInitialState(
    gridSize: { rows: number; cols: number },
    players: Player[]
  ): GameState {
    return {
      gridSize,
      edges: new Set<EdgeKey>(),
      squares: this.initializeSquares(gridSize),
      players,
      currentPlayerIndex: 0,
      status: 'lobby',
      moveHistory: [],
      winnerId: null,
    };
  }

  static initializeSquares(gridSize: { rows: number; cols: number }): Square[] {
    const squares: Square[] = [];
    // A grid with rows and cols has (rows-1) x (cols-1) squares
    for (let row = 0; row < gridSize.rows - 1; row++) {
      for (let col = 0; col < gridSize.cols - 1; col++) {
        squares.push({
          topLeft: [row, col],
          ownerId: null,
        });
      }
    }
    return squares;
  }

  static normalizeEdgeKey(r1: number, c1: number, r2: number, c2: number): EdgeKey {
    // Normalize to always have the smaller coordinate first
    if (r1 > r2 || (r1 === r2 && c1 > c2)) {
      return `${r2}-${c2}|${r1}-${c1}`;
    }
    return `${r1}-${c1}|${r2}-${c2}`;
  }

  static isValidEdgeMove(
    edgeKey: EdgeKey,
    state: GameState
  ): boolean {
    // Check if edge already exists
    if (state.edges.has(edgeKey)) {
      return false;
    }

    // Parse edge key
    const [start, end] = edgeKey.split('|');
    const [r1, c1] = start.split('-').map(Number);
    const [r2, c2] = end.split('-').map(Number);

    const { rows, cols } = state.gridSize;

    // Check bounds
    if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols ||
        r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) {
      return false;
    }

    // Edge must be horizontal or vertical (adjacent dots only)
    const isHorizontal = r1 === r2 && Math.abs(c1 - c2) === 1;
    const isVertical = c1 === c2 && Math.abs(r1 - r2) === 1;

    return isHorizontal || isVertical;
  }

  static getAdjacentSquares(
    edgeKey: EdgeKey,
    gridSize: { rows: number; cols: number }
  ): [number, number][] {
    const [start, end] = edgeKey.split('|');
    const [r1, c1] = start.split('-').map(Number);
    const [r2, c2] = end.split('-').map(Number);

    const adjacentSquares: [number, number][] = [];
    const { rows, cols } = gridSize;

    if (r1 === r2) {
      // Horizontal edge
      const minC = Math.min(c1, c2);
      const row = r1;
      
      // Square above
      if (row > 0) {
        adjacentSquares.push([row - 1, minC]);
      }
      // Square below
      if (row < rows - 1) {
        adjacentSquares.push([row, minC]);
      }
    } else {
      // Vertical edge
      const minR = Math.min(r1, r2);
      const col = c1;
      
      // Square to the left
      if (col > 0) {
        adjacentSquares.push([minR, col - 1]);
      }
      // Square to the right
      if (col < cols - 1) {
        adjacentSquares.push([minR, col]);
      }
    }

    return adjacentSquares;
  }

  static isSquareComplete(
    squareRow: number,
    squareCol: number,
    edges: Set<EdgeKey>
  ): boolean {
    // A square has 4 edges
    const top = this.normalizeEdgeKey(squareRow, squareCol, squareRow, squareCol + 1);
    const bottom = this.normalizeEdgeKey(squareRow + 1, squareCol, squareRow + 1, squareCol + 1);
    const left = this.normalizeEdgeKey(squareRow, squareCol, squareRow + 1, squareCol);
    const right = this.normalizeEdgeKey(squareRow, squareCol + 1, squareRow + 1, squareCol + 1);

    return edges.has(top) && edges.has(bottom) && edges.has(left) && edges.has(right);
  }

  static playMove(
    state: GameState,
    edgeKey: EdgeKey,
    playerId: string
  ): { newState: GameState; squaresCompleted: Square[] } {
    if (state.status !== 'playing') {
      return { newState: state, squaresCompleted: [] };
    }

    if (!this.isValidEdgeMove(edgeKey, state)) {
      return { newState: state, squaresCompleted: [] };
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      return { newState: state, squaresCompleted: [] };
    }

    // Add edge
    const newEdges = new Set(state.edges);
    newEdges.add(edgeKey);

    // Check for completed squares
    const adjacentSquares = this.getAdjacentSquares(edgeKey, state.gridSize);
    const squaresCompleted: Square[] = [];
    const newSquares = state.squares.map((square) => {
      const [row, col] = square.topLeft;
      if (
        adjacentSquares.some(([r, c]) => r === row && c === col) &&
        square.ownerId === null &&
        this.isSquareComplete(row, col, newEdges)
      ) {
        squaresCompleted.push(square);
        return { ...square, ownerId: playerId };
      }
      return square;
    });

    // Update player scores
    const newPlayers = state.players.map((p) => {
      if (p.id === playerId) {
        return { ...p, score: p.score + squaresCompleted.length };
      }
      return p;
    });

    // Determine next player
    let nextPlayerIndex = state.currentPlayerIndex;
    if (squaresCompleted.length === 0) {
      // No squares completed, next player's turn
      nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    }
    // If squares were completed, same player goes again

    // Check if game is finished
    const allSquaresClaimed = newSquares.every((s) => s.ownerId !== null);
    const status = allSquaresClaimed ? 'finished' : 'playing';

    // Determine winner if finished
    let winnerId: string | null = null;
    if (status === 'finished') {
      const maxScore = Math.max(...newPlayers.map((p) => p.score));
      winnerId = newPlayers.find((p) => p.score === maxScore)?.id || null;
    }

    const newState: GameState = {
      ...state,
      edges: newEdges,
      squares: newSquares,
      players: newPlayers,
      currentPlayerIndex: nextPlayerIndex,
      status,
      moveHistory: [...state.moveHistory, edgeKey],
      winnerId,
    };

    return { newState, squaresCompleted };
  }

  static startGame(state: GameState): GameState {
    return {
      ...state,
      status: 'playing',
    };
  }

  static resetGame(players: Player[], gridSize: { rows: number; cols: number }): GameState {
    const resetPlayers = players.map((p) => ({ ...p, score: 0 }));
    return this.createInitialState(gridSize, resetPlayers);
  }

  static generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  static createPlayer(
    id: string,
    name: string,
    order: number,
    colorIndex?: number
  ): Player {
    const colorIdx = colorIndex ?? order;
    return {
      id,
      name,
      color: PLAYER_COLORS[colorIdx % PLAYER_COLORS.length],
      score: 0,
      order,
    };
  }
}
