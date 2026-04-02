'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Room } from '@/lib/types';
import { GameEngine } from '@/lib/game-engine';
import { GRID_SPACING, DOT_SIZE } from '@/lib/constants';

const customStyles = `
  @keyframes floatUp {
    0% {
      opacity: 1;
      transform: translateY(0px) scale(1);
    }
    50% {
      opacity: 0.82;
      transform: translateY(-20px) scale(1.08);
    }
    100% {
      opacity: 0;
      transform: translateY(-50px) scale(0.84);
    }
  }

  @keyframes edgePulse {
    0% {
      opacity: 0.3;
      transform: scale(0.98);
    }
    60% {
      opacity: 1;
      transform: scale(1.02);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes squarePop {
    0% {
      opacity: 0;
      transform: scale(0.85);
    }
    70% {
      opacity: 1;
      transform: scale(1.03);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

interface GameBoardProps {
  room: Room;
  playerId: string | null;
  onMove?: (edgeKey: string) => void;
  chatBubbles?: Array<{ id: string; playerId: string; message: string; x?: number; y?: number }>;
}

type AvatarPosition = {
  side: 'left' | 'right';
  index: number;
  playerIndex: number;
};

const BASE_EDGE_COLOR = 'rgba(186, 230, 253, 0.42)';

function getAvatarPositions(playerCount: number): AvatarPosition[] {
  const leftCount = Math.ceil(playerCount / 2);
  const rightCount = playerCount - leftCount;
  const positions: AvatarPosition[] = [];

  for (let index = 0; index < leftCount; index += 1) {
    positions.push({ side: 'left', index, playerIndex: index });
  }
  for (let index = 0; index < rightCount; index += 1) {
    positions.push({
      side: 'right',
      index,
      playerIndex: leftCount + index,
    });
  }

  return positions;
}

export function GameBoard({ room, playerId, onMove, chatBubbles = [] }: GameBoardProps) {
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [freshEdges, setFreshEdges] = useState<Record<string, true>>({});
  const [freshSquares, setFreshSquares] = useState<Record<string, true>>({});
  const previousEdgesRef = useRef<Set<string>>(new Set());
  const previousSquareOwnersRef = useRef<Record<string, string | null>>({});

  const { gridSize, edges, edgeOwners, squares, players, currentPlayerIndex } = room.gameState;
  const rows = gridSize.rows;
  const cols = gridSize.cols;
  const boardWidth = (cols - 1) * GRID_SPACING + DOT_SIZE * 2;
  const boardHeight = (rows - 1) * GRID_SPACING + DOT_SIZE * 2;
  const currentPlayer = players[currentPlayerIndex] ?? players[0] ?? null;
  const isPlaying = room.gameState.status === 'playing';
  const isMyTurn = Boolean(currentPlayer && playerId && currentPlayer.id === playerId && isPlaying);
  const activeColor = currentPlayer?.color ?? '#38bdf8';

  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const avatarPositions = useMemo(
    () => getAvatarPositions(players.length),
    [players.length],
  );

  const edgeSignature = useMemo(
    () => Array.from(edges).sort().join(','),
    [edges],
  );

  const squareOwnerSignature = useMemo(
    () =>
      squares
        .map((square) => `${square.topLeft[0]}-${square.topLeft[1]}:${square.ownerId ?? 'none'}`)
        .join('|'),
    [squares],
  );

  useEffect(() => {
    const previous = previousEdgesRef.current;
    const current = new Set(edges);
    const addedEdges = Array.from(current).filter((edgeKey) => !previous.has(edgeKey));
    previousEdgesRef.current = current;

    if (addedEdges.length === 0) {
      return;
    }

    setFreshEdges((prev) => {
      const next = { ...prev };
      addedEdges.forEach((edgeKey) => {
        next[edgeKey] = true;
      });
      return next;
    });

    const timeout = window.setTimeout(() => {
      setFreshEdges((prev) => {
        const next = { ...prev };
        addedEdges.forEach((edgeKey) => {
          delete next[edgeKey];
        });
        return next;
      });
    }, 420);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [edgeSignature, edges]);

  useEffect(() => {
    const previousOwners = previousSquareOwnersRef.current;
    const newlyClaimed: string[] = [];

    squares.forEach((square) => {
      const key = `${square.topLeft[0]}-${square.topLeft[1]}`;
      const previousOwner = previousOwners[key] ?? null;
      if (!previousOwner && square.ownerId) {
        newlyClaimed.push(key);
      }
      previousOwners[key] = square.ownerId;
    });

    if (newlyClaimed.length === 0) {
      return;
    }

    setFreshSquares((prev) => {
      const next = { ...prev };
      newlyClaimed.forEach((key) => {
        next[key] = true;
      });
      return next;
    });

    const timeout = window.setTimeout(() => {
      setFreshSquares((prev) => {
        const next = { ...prev };
        newlyClaimed.forEach((key) => {
          delete next[key];
        });
        return next;
      });
    }, 520);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [squareOwnerSignature, squares]);

  useEffect(() => {
    if (!isMyTurn) {
      setHoveredEdge(null);
    }
  }, [isMyTurn]);

  const handleEdgeClick = (edgeKey: string) => {
    if (!isMyTurn) {
      return;
    }

    if (!GameEngine.isValidEdgeMove(edgeKey, room.gameState)) {
      return;
    }

    onMove?.(edgeKey);
  };

  const renderEdge = (
    edgeKey: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    renderKey: string,
  ) => {
    const isClaimed = edges.has(edgeKey);
    const canInteract = isMyTurn && !isClaimed;
    const isHovered = canInteract && hoveredEdge === edgeKey;
    const ownerId = edgeOwners[edgeKey];
    const ownerColor = ownerId ? playerById.get(ownerId)?.color : null;
    const stroke = isClaimed
      ? ownerColor ?? '#60a5fa'
      : isHovered
        ? activeColor
        : BASE_EDGE_COLOR;
    const strokeWidth = isClaimed ? 6 : isHovered ? 5 : 3;
    const isFresh = Boolean(freshEdges[edgeKey]);

    return (
      <g key={renderKey}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pointerEvents="none"
          className={isFresh ? 'animate-[edgePulse_320ms_ease-out]' : undefined}
          style={{
            opacity: isHovered && !isClaimed ? 0.95 : 1,
            filter: isHovered
              ? `drop-shadow(0 0 8px ${activeColor})`
              : isClaimed
                ? `drop-shadow(0 0 6px ${stroke}88)`
                : 'none',
            transition: 'stroke 140ms ease, stroke-width 140ms ease, opacity 140ms ease, filter 140ms ease',
          }}
        />
        {!isClaimed && (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="transparent"
            strokeWidth={16}
            strokeLinecap="round"
            className={canInteract ? 'cursor-pointer' : 'cursor-not-allowed'}
            onMouseEnter={() => {
              if (canInteract) {
                setHoveredEdge(edgeKey);
              }
            }}
            onMouseLeave={() => {
              if (hoveredEdge === edgeKey) {
                setHoveredEdge(null);
              }
            }}
            onClick={() => {
              if (canInteract) {
                handleEdgeClick(edgeKey);
              }
            }}
          />
        )}
      </g>
    );
  };

  if (!currentPlayer) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500">
        Waiting for players to join...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="mb-4 text-center">
        <h2 className="text-xl font-semibold text-white">
          <span style={{ color: activeColor }}>
            {currentPlayer.name}&apos;s Turn
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-200/90">
          {isMyTurn ? 'Your move - claim an edge.' : 'Watch the board update live.'}
        </p>
      </div>

      {/* Game Board with Avatars Around */}
      <div className="relative flex items-center justify-center gap-6">
        <div className="flex flex-col gap-4">
          {avatarPositions
            .filter((position) => position.side === 'left')
            .map((position) => {
              const player = players[position.playerIndex];
              if (!player) {
                return null;
              }
              const isActiveTurn = isPlaying && currentPlayer.id === player.id;
              return (
                <div key={`avatar-left-${player.id}`} className="flex min-h-[74px] flex-col items-center justify-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg transition-transform ${
                      isActiveTurn ? 'scale-105 ring-4 ring-white/70' : 'ring-2 ring-white/25'
                    }`}
                    style={{
                      backgroundColor: player.color,
                      boxShadow: isActiveTurn
                        ? `0 0 0 4px ${player.color}55, 0 0 18px ${player.color}88`
                        : undefined,
                    }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="mt-1 max-w-[72px] truncate text-xs font-medium text-white">
                    {player.name}
                  </span>
                  <span className="text-[11px] font-semibold text-white/85">
                    {player.score} pts
                  </span>
                </div>
              );
            })}
        </div>

        <div className="rounded-2xl border border-cyan-200/30 bg-[#061532] p-4 shadow-[0_20px_45px_rgba(4,11,35,0.65)]">
          <svg
            width={boardWidth}
            height={boardHeight}
            className="rounded-xl"
            style={{ minWidth: boardWidth, minHeight: boardHeight }}
          >
            <defs>
              <linearGradient id="boardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#051129" />
                <stop offset="100%" stopColor="#071d42" />
              </linearGradient>
            </defs>

            <rect x={0} y={0} width={boardWidth} height={boardHeight} rx={14} fill="url(#boardGradient)" />

            {squares.map((square) => {
              const [row, col] = square.topLeft;
              const owner = square.ownerId ? playerById.get(square.ownerId) : null;
              const x = DOT_SIZE / 2 + col * GRID_SPACING + 2;
              const y = DOT_SIZE / 2 + row * GRID_SPACING + 2;
              const size = GRID_SPACING - 4;
              const squareKey = `${row}-${col}`;
              const isFreshSquare = Boolean(freshSquares[squareKey]);

              return (
                <g key={`square-${squareKey}`}>
                  <rect
                    x={x}
                    y={y}
                    width={size}
                    height={size}
                    rx={6}
                    className={isFreshSquare ? 'animate-[squarePop_360ms_ease-out]' : undefined}
                    style={{
                      fill: owner?.color ?? '#000000',
                      opacity: owner ? 0.28 : 0,
                      transform: owner ? 'scale(1)' : 'scale(0.9)',
                      transformOrigin: `${x + size / 2}px ${y + size / 2}px`,
                      transition: 'fill 220ms ease, opacity 220ms ease, transform 220ms ease',
                    }}
                  />
                  {owner && (
                    <text
                      x={x + size / 2}
                      y={y + size / 2 + 4}
                      textAnchor="middle"
                      fill={owner.color}
                      fontSize="13"
                      fontWeight="bold"
                      style={{ opacity: 0.9 }}
                    >
                      P{owner.order + 1}
                    </text>
                  )}
                </g>
              );
            })}

            {Array.from({ length: rows }).map((_, row) =>
              Array.from({ length: cols - 1 }).map((_, col) => {
                const edgeKey = GameEngine.normalizeEdgeKey(row, col, row, col + 1);
                const x1 = DOT_SIZE / 2 + col * GRID_SPACING;
                const y1 = DOT_SIZE / 2 + row * GRID_SPACING;
                const x2 = DOT_SIZE / 2 + (col + 1) * GRID_SPACING;
                const y2 = y1;
                return renderEdge(edgeKey, x1, y1, x2, y2, `edge-h-${row}-${col}`);
              }),
            )}

            {Array.from({ length: rows - 1 }).map((_, row) =>
              Array.from({ length: cols }).map((_, col) => {
                const edgeKey = GameEngine.normalizeEdgeKey(row, col, row + 1, col);
                const x1 = DOT_SIZE / 2 + col * GRID_SPACING;
                const y1 = DOT_SIZE / 2 + row * GRID_SPACING;
                const x2 = x1;
                const y2 = DOT_SIZE / 2 + (row + 1) * GRID_SPACING;
                return renderEdge(edgeKey, x1, y1, x2, y2, `edge-v-${row}-${col}`);
              }),
            )}

            {Array.from({ length: rows }).map((_, row) =>
              Array.from({ length: cols }).map((_, col) => {
                const x = DOT_SIZE / 2 + col * GRID_SPACING;
                const y = DOT_SIZE / 2 + row * GRID_SPACING;
                return (
                  <circle
                    key={`dot-${row}-${col}`}
                    cx={x}
                    cy={y}
                    r={DOT_SIZE / 2}
                    fill="#dbeafe"
                    stroke="#7dd3fc"
                    strokeWidth={1}
                  />
                );
              }),
            )}
          </svg>
        </div>

        <div className="flex flex-col gap-4">
          {avatarPositions
            .filter((position) => position.side === 'right')
            .map((position) => {
              const player = players[position.playerIndex];
              if (!player) {
                return null;
              }
              const isActiveTurn = isPlaying && currentPlayer.id === player.id;
              return (
                <div key={`avatar-right-${player.id}`} className="flex min-h-[74px] flex-col items-center justify-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg transition-transform ${
                      isActiveTurn ? 'scale-105 ring-4 ring-white/70' : 'ring-2 ring-white/25'
                    }`}
                    style={{
                      backgroundColor: player.color,
                      boxShadow: isActiveTurn
                        ? `0 0 0 4px ${player.color}55, 0 0 18px ${player.color}88`
                        : undefined,
                    }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="mt-1 max-w-[72px] truncate text-xs font-medium text-white">
                    {player.name}
                  </span>
                  <span className="text-[11px] font-semibold text-white/85">
                    {player.score} pts
                  </span>
                </div>
              );
            })}
        </div>

        {chatBubbles.map((bubble) => {
          const playerIndex = players.findIndex((player) => player.id === bubble.playerId);
          if (playerIndex < 0) {
            return null;
          }
          const player = players[playerIndex];
          const avatarPosition = avatarPositions.find((position) => position.playerIndex === playerIndex);
          if (!avatarPosition) {
            return null;
          }

          const baseY = 62 + avatarPosition.index * 86;
          const baseX = avatarPosition.side === 'left'
            ? 64
            : boardWidth + 172;

          return (
            <div
              key={bubble.id}
              className="pointer-events-none absolute"
              style={{
                left: `${baseX}px`,
                top: `${baseY}px`,
                animation: 'floatUp 3s ease-out forwards',
                zIndex: 50,
              }}
            >
              <div
                className="max-w-[190px] rounded-full px-3 py-2 text-sm text-white shadow-lg"
                style={{ backgroundColor: player.color }}
              >
                {bubble.message}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-slate-200/90">
        Moves played:{' '}
        <span className="font-semibold text-cyan-200">{room.gameState.moveHistory.length}</span>
      </div>
    </div>
  );
}
