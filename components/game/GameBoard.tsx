'use client';

import { useState, useEffect } from 'react';
import { Room } from '@/lib/types';
import { GameEngine } from '@/lib/game-engine';
import { GRID_SPACING, DOT_SIZE } from '@/lib/constants';

// Add custom animation styles
const customStyles = `
  @keyframes floatUp {
    0% {
      opacity: 1;
      transform: translateY(0px) scale(1);
    }
    50% {
      opacity: 0.8;
      transform: translateY(-20px) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translateY(-50px) scale(0.8);
    }
  }
`;

interface GameBoardProps {
  room: Room;
  playerId: string | null;
  onMove?: (edgeKey: string) => void;
  chatBubbles?: Array<{id: string, playerId: string, message: string, x?: number, y?: number}>;
}

export function GameBoard({ room, playerId, onMove, chatBubbles = [] }: GameBoardProps) {
  // Inject custom styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const { gridSize, edges, squares, players, currentPlayerIndex } = room.gameState;
  
  const rows = gridSize.rows;
  const cols = gridSize.cols;
  const boardWidth = (cols - 1) * GRID_SPACING + DOT_SIZE * 2;
  const boardHeight = (rows - 1) * GRID_SPACING + DOT_SIZE * 2;

  const currentPlayer = players[currentPlayerIndex];

  // Calculate avatar positions around the board
  const getAvatarPositions = (playerCount: number) => {
    const positions: { side: 'left' | 'right'; index: number }[] = [];
    
    if (playerCount === 1) {
      positions.push({ side: 'left', index: 0 });
    } else if (playerCount === 2) {
      positions.push({ side: 'left', index: 0 });
      positions.push({ side: 'right', index: 0 });
    } else if (playerCount === 3) {
      positions.push({ side: 'left', index: 0 });
      positions.push({ side: 'right', index: 0 });
      positions.push({ side: 'right', index: 1 });
    } else if (playerCount === 4) {
      positions.push({ side: 'left', index: 0 });
      positions.push({ side: 'left', index: 1 });
      positions.push({ side: 'right', index: 0 });
      positions.push({ side: 'right', index: 1 });
    } else if (playerCount === 5) {
      positions.push({ side: 'left', index: 0 });
      positions.push({ side: 'left', index: 1 });
      positions.push({ side: 'left', index: 2 });
      positions.push({ side: 'right', index: 0 });
      positions.push({ side: 'right', index: 1 });
    } else if (playerCount === 6) {
      positions.push({ side: 'left', index: 0 });
      positions.push({ side: 'left', index: 1 });
      positions.push({ side: 'left', index: 2 });
      positions.push({ side: 'right', index: 0 });
      positions.push({ side: 'right', index: 1 });
      positions.push({ side: 'right', index: 2 });
    } else if (playerCount === 7) {
      positions.push({ side: 'left', index: 0 });
      positions.push({ side: 'left', index: 1 });
      positions.push({ side: 'left', index: 2 });
      positions.push({ side: 'left', index: 3 });
      positions.push({ side: 'right', index: 0 });
      positions.push({ side: 'right', index: 1 });
      positions.push({ side: 'right', index: 2 });
    } else if (playerCount === 8) {
      positions.push({ side: 'left', index: 0 });
      positions.push({ side: 'left', index: 1 });
      positions.push({ side: 'left', index: 2 });
      positions.push({ side: 'left', index: 3 });
      positions.push({ side: 'right', index: 0 });
      positions.push({ side: 'right', index: 1 });
      positions.push({ side: 'right', index: 2 });
      positions.push({ side: 'right', index: 3 });
    }
    
    return positions;
  };

  const avatarPositions = getAvatarPositions(players.length);
  const avatarSize = 60;
  const avatarSpacing = 80;

  const handleEdgeClick = (edgeKey: string) => {
    if (!playerId) {
      return;
    }

    if (room.gameState.status !== 'playing') {
      return;
    }

    const activePlayer = room.gameState.players[room.gameState.currentPlayerIndex];
    if (!activePlayer || activePlayer.id !== playerId) {
      return;
    }

    if (!GameEngine.isValidEdgeMove(edgeKey, room.gameState)) {
      return;
    }

    onMove?.(edgeKey);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-slate-200">
          <span style={{ color: currentPlayer.color }}>
            {currentPlayer.name}&apos;s Turn
          </span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Click edges to claim them
        </p>
      </div>

      {/* Game Board with Avatars Around */}
      <div className="flex items-center justify-center gap-6">
        {/* Left side avatars */}
        <div className="flex flex-col gap-4">
          {avatarPositions
            .filter(pos => pos.side === 'left')
            .sort((a, b) => a.index - b.index)
            .map((pos, idx) => {
              const player = players[idx];
              return (
                <div
                  key={`avatar-left-${idx}`}
                  className="flex flex-col items-center"
                  style={{ height: avatarSize }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform hover:scale-110"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span 
                    className="text-xs mt-1 font-medium text-center max-w-[60px] truncate"
                    style={{ color: player.color }}
                  >
                    {player.name}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Game Board Container */}
        <div className="bg-slate-950 rounded border-slate-700 p-4">
          <svg
            width={boardWidth}
            height={boardHeight}
            className="bg-slate-950 rounded border-slate-700"
            style={{ minWidth: boardWidth, minHeight: boardHeight }}
          >
            {/* Render dots */}
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const x = DOT_SIZE / 2 + c * GRID_SPACING;
                const y = DOT_SIZE / 2 + r * GRID_SPACING;
                return (
                  <circle
                    key={`dot-${r}-${c}`}
                    cx={x}
                    cy={y}
                    r={DOT_SIZE / 2}
                    fill="#64748b"
                    className="transition-all"
                  />
                );
              })
            )}

            {/* Render horizontal edges */}
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols - 1 }).map((_, c) => {
                const edgeKey = GameEngine.normalizeEdgeKey(r, c, r, c + 1);
                const isExisting = edges.has(edgeKey);
                const isHovered = hoveredEdge === edgeKey;
                const x1 = DOT_SIZE / 2 + c * GRID_SPACING;
                const y1 = DOT_SIZE / 2 + r * GRID_SPACING;
                const x2 = DOT_SIZE / 2 + (c + 1) * GRID_SPACING;
                const y2 = y1;

                const edgeOwner = isExisting
                  ? room.gameState.players.find(
                      (p) =>
                        room.gameState.squares.some(
                          (sq) => sq.ownerId === p.id
                        )
                    )
                  : null;

                let strokeColor = '#475569';
                let strokeWidth = 3;

                if (isExisting) {
                  strokeColor = currentPlayer.color;
                  strokeWidth = 4;
                } else if (isHovered) {
                  strokeColor = currentPlayer.color;
                  strokeWidth = 4;
                }

                return (
                  <g key={`edge-h-${r}-${c}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      className={`transition-all ${
                        !isExisting ? 'cursor-pointer hover:drop-shadow-lg' : ''
                      }`}
                      opacity={isHovered && !isExisting ? 0.8 : 1}
                      onMouseEnter={() =>
                        !isExisting && setHoveredEdge(edgeKey)
                      }
                      onMouseLeave={() => setHoveredEdge(null)}
                      onClick={() => !isExisting && handleEdgeClick(edgeKey)}
                      style={{
                        filter: isHovered && !isExisting ? `drop-shadow(0 0 8px ${currentPlayer.color})` : 'drop-shadow(0 0 0px transparent)',
                        transition: 'filter 0.2s ease-out'
                      }}
                    />
                    {isHovered && !isExisting && (
                      <circle
                        cx={(x1 + x2) / 2}
                        cy={(y1 + y2) / 2}
                        r="6"
                        fill={currentPlayer.color}
                        opacity="0.3"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* Render vertical edges */}
            {Array.from({ length: rows - 1 }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const edgeKey = GameEngine.normalizeEdgeKey(r, c, r + 1, c);
                const isExisting = edges.has(edgeKey);
                const isHovered = hoveredEdge === edgeKey;
                const x1 = DOT_SIZE / 2 + c * GRID_SPACING;
                const y1 = DOT_SIZE / 2 + r * GRID_SPACING;
                const x2 = x1;
                const y2 = DOT_SIZE / 2 + (r + 1) * GRID_SPACING;

                let strokeColor = '#475569';
                let strokeWidth = 3;

                if (isExisting) {
                  strokeColor = currentPlayer.color;
                  strokeWidth = 4;
                } else if (isHovered) {
                  strokeColor = currentPlayer.color;
                  strokeWidth = 4;
                }

                return (
                  <g key={`edge-v-${r}-${c}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      className={`transition-all ${
                        !isExisting ? 'cursor-pointer hover:drop-shadow-lg' : ''
                      }`}
                      opacity={isHovered && !isExisting ? 0.8 : 1}
                      onMouseEnter={() =>
                        !isExisting && setHoveredEdge(edgeKey)
                      }
                      onMouseLeave={() => setHoveredEdge(null)}
                      onClick={() => !isExisting && handleEdgeClick(edgeKey)}
                      style={{
                        filter: isHovered && !isExisting ? `drop-shadow(0 0 8px ${currentPlayer.color})` : 'drop-shadow(0 0 0px transparent)',
                        transition: 'filter 0.2s ease-out'
                      }}
                    />
                    {isHovered && !isExisting && (
                      <circle
                        cx={x1}
                        cy={(y1 + y2) / 2}
                        r="6"
                        fill={currentPlayer.color}
                        opacity="0.3"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* Render completed squares */}
            {squares.map((square, idx) => {
              if (!square.ownerId) return null;

              const [row, col] = square.topLeft;
              const owner = players.find((p) => p.id === square.ownerId);
              if (!owner) return null;

              const x = DOT_SIZE / 2 + col * GRID_SPACING;
              const y = DOT_SIZE / 2 + row * GRID_SPACING;
              const size = GRID_SPACING - 2;

              return (
                <g key={`square-${idx}`}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={size}
                    height={size}
                    fill={owner.color}
                    opacity="0.2"
                    className="animate-pulse"
                  />
                  <text
                    x={x + size / 2}
                    y={y + size / 2 + 4}
                    textAnchor="middle"
                    fill={owner.color}
                    fontSize="14"
                    fontWeight="bold"
                    opacity="0.7"
                  >
                    P{owner.order + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right side avatars */}
        <div className="flex flex-col gap-4">
          {avatarPositions
            .filter(pos => pos.side === 'right')
            .sort((a, b) => a.index - b.index)
            .map((pos, idx) => {
              const leftCount = avatarPositions.filter(p => p.side === 'left').length;
              const playerIndex = leftCount + idx;
              const player = players[playerIndex];
              return (
                <div
                  key={`avatar-right-${idx}`}
                  className="flex flex-col items-center"
                  style={{ height: avatarSize }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform hover:scale-110"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span 
                    className="text-xs mt-1 font-medium text-center max-w-[60px] truncate"
                    style={{ color: player.color }}
                  >
                    {player.name}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Chat Bubbles near Avatars */}
        {chatBubbles.map((bubble) => {
          const player = players.find((p) => p.id === bubble.playerId);
          const playerIndex = players.findIndex((p) => p.id === bubble.playerId);
          if (!player || playerIndex === -1) return null;

          // Calculate position based on avatar position
          const avatarPositions = getAvatarPositions(players.length);
          const playerPos = avatarPositions[playerIndex];
          if (!playerPos) return null;

          let bubbleX = 0;
          let bubbleY = 0;

          if (playerPos.side === 'left') {
            bubbleX = 60; // Near left avatars
            bubbleY = 100 + playerPos.index * 80;
          } else {
            bubbleX = boardWidth + 100; // Near right avatars
            bubbleY = 100 + playerPos.index * 80;
          }

          return (
            <div
              key={bubble.id}
              className="absolute pointer-events-none animate-bounce"
              style={{
                left: `${bubbleX}px`,
                top: `${bubbleY}px`,
                animation: 'floatUp 3s ease-out forwards',
                zIndex: 50
              }}
            >
              <div 
                className="rounded-full px-3 py-2 text-white text-sm shadow-lg max-w-[200px] wrap-break-word"
                style={{ backgroundColor: player.color }}
              >
                {bubble.message}
              </div>
            </div>
          );
        })}
      </div>

      {/* Move Counter */}
      <div className="text-sm text-slate-400">
        Moves played: <span className="text-blue-400 font-semibold">{room.gameState.moveHistory.length}</span>
      </div>
    </div>
  );
}
