'use client';

import { useState, useEffect } from 'react';
import { Room, GameState } from '@/lib/types';
import { GameEngine } from '@/lib/game-engine';
import { GRID_SPACING, DOT_SIZE } from '@/lib/constants';

interface GameBoardProps {
  room: Room;
  playerId: string | null;
  onStateChange?: (state: GameState) => void;
}

export function GameBoard({ room, playerId, onStateChange }: GameBoardProps) {
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const { gridSize, edges, squares, players, currentPlayerIndex } = room.gameState;
  
  const rows = gridSize.rows;
  const cols = gridSize.cols;
  const boardWidth = (cols - 1) * GRID_SPACING + DOT_SIZE * 2;
  const boardHeight = (rows - 1) * GRID_SPACING + DOT_SIZE * 2;

  const currentPlayer = players[currentPlayerIndex];

  const handleEdgeClick = (edgeKey: string) => {
    if (!playerId) {
      return;
    }

    if (!GameEngine.isValidEdgeMove(edgeKey, room.gameState)) {
      return;
    }

    const { newState } = GameEngine.playMove(
      room.gameState,
      edgeKey,
      playerId
    );

    onStateChange?.(newState);
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

      {/* Game Board Container */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 backdrop-blur-sm">
        <svg
          width={boardWidth}
          height={boardHeight}
          className="bg-slate-950 rounded border border-slate-700"
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

      {/* Move Counter */}
      <div className="text-sm text-slate-400">
        Moves played: <span className="text-blue-400 font-semibold">{room.gameState.moveHistory.length}</span>
      </div>
    </div>
  );
}
