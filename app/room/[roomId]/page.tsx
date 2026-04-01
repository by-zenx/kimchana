'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GameBoard } from '@/components/game/GameBoard';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import { Room, GameState, ChatMessage } from '@/lib/types';
import { GRID_SIZES } from '@/lib/constants';
import {
  Clock3,
  Copy,
  Info,
  MessageCircle,
  Send,
  Settings2,
  Users,
  X,
} from 'lucide-react';

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
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.5);
  }
`;

type PlayerSession = {
  playerId: string;
  playerToken: string;
  playerName: string;
  isHost: boolean;
};

const GRID_OPTIONS = GRID_SIZES.slice(0, 3);

const renderChatMessages = (messages: ChatMessage[]) => {
  return messages.map((msg, index) => (
    <div key={msg.id ?? `${msg.playerId}-${index}`} className="flex gap-2 pb-2">
      <div>
        <p className="text-xs font-semibold text-slate-900">
          {msg.playerName}
        </p>
        <p className="text-xs text-slate-700 bg-white/60 rounded-lg px-3 py-2 mt-1">
          {msg.content}
        </p>
      </div>
    </div>
  ));
};

export default function RoomPage() {
  const params = useParams();
  const roomId = (params?.roomId as string)?.toUpperCase();

  // Inject custom styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [chatDraft, setChatDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [selectedGridIndex, setSelectedGridIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState(2);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatBubbleOpen, setChatBubbleOpen] = useState(false);
  const [animatedChatBubbles, setAnimatedChatBubbles] = useState<Array<{id: string, playerId: string, message: string, x?: number, y?: number}>>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const currentGrid = useMemo(
    () => GRID_OPTIONS[selectedGridIndex] ?? GRID_OPTIONS[0],
    [selectedGridIndex],
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }
    setError('');
    let retry: ReturnType<typeof setTimeout> | null = null;
    let didCancel = false;

    const attempt = async () => {
      if (!roomId || didCancel) {
        return;
      }
      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        if (!response.ok) {
          if (response.status === 400) {
            retry = setTimeout(attempt, 500);
            return;
          }
          setError('Room not found');
          return;
        }
        const data = await response.json();
        const payload = data.room;
        const deserialized = GameEngine.deserializeState(
          payload.gameState as SerializedGameState,
        );
        setRoom({
          ...payload,
          gameState: deserialized,
        });
        setGameState(deserialized);
        setChatMessages(payload.chatMessages ?? []);
        const gridIndex = GRID_OPTIONS.findIndex(
          (grid) =>
            grid.rows === payload.gridSize.rows &&
            grid.cols === payload.gridSize.cols,
        );
        setSelectedGridIndex(gridIndex >= 0 ? gridIndex : 0);
        setPlayerCount(payload.playerCount);
        setAutoMoveEnabled(payload.autoMoveEnabled);
        setError('');
      } catch {
        if (!didCancel) {
          setError('Unable to load room data');
        }
      }
    };

    attempt();

    return () => {
      didCancel = true;
      if (retry) {
        clearTimeout(retry);
      }
    };
  }, [roomId]);

  const fetchChat = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`);
      if (response.ok) {
        const { chatMessages } = await response.json();
        setChatMessages(chatMessages ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    const raw = localStorage.getItem(`room-${roomId}-session`);
    if (raw) {
      setPlayerSession(JSON.parse(raw));
    }
    fetchChat();
  }, [roomId, fetchChat]);

  const handleIncomingSocket = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'initial') {
          const payload = message.payload;
          const deserialized = GameEngine.deserializeState(
            payload.gameState as SerializedGameState,
          );
          setRoom({
            ...payload.room,
            gameState: deserialized,
            players: payload.players ?? [],
          });
          setGameState(deserialized);
          setChatMessages(payload.chatMessages ?? []);
          const gridIndex = GRID_OPTIONS.findIndex(
            (grid) =>
              grid.rows === payload.room.gridSize?.rows &&
              grid.cols === payload.room.gridSize?.cols,
          );
          setSelectedGridIndex(gridIndex >= 0 ? gridIndex : 0);
          setPlayerCount(payload.room.playerCount ?? playerCount);
          setAutoMoveEnabled(payload.room.autoMoveEnabled ?? false);
        } else if (message.type === 'state') {
          const state = GameEngine.deserializeState(
            message.gameState as SerializedGameState,
          );
          setGameState(state);
          setRoom((prev) =>
            prev
              ? {
                ...prev,
                gameState: state,
              }
              : prev,
          );
        } else if (message.type === 'chat') {
          setChatMessages((prev) => [...prev, message.payload]);
        } else if (message.type === 'settings') {
          const { gridRows, gridCols, playerCount, autoMoveEnabled } =
            message.payload;
          setSelectedGridIndex(
            GRID_OPTIONS.findIndex(
              (grid) =>
                grid.rows === gridRows && grid.cols === gridCols,
            ) || 0,
          );
          setPlayerCount(playerCount);
          setAutoMoveEnabled(autoMoveEnabled);
          setRoom((prev) =>
            prev
              ? {
                ...prev,
                gridSize: { rows: gridRows, cols: gridCols },
                playerCount,
                autoMoveEnabled,
              }
              : prev,
          );
        } else if (message.type === 'status') {
          setRoom((prev) =>
            prev
              ? {
                ...prev,
                status: message.payload.status,
              }
              : prev,
          );
        }
      } catch (error) {
        console.error('Socket parse failed', error);
      }
    },
    [playerCount, roomId],
  );

  const sendSocket = useCallback((payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const handleColorChange = useCallback((newColor: string) => {
    if (!playerSession?.playerId || !room) return;

    // Check if color is already taken by another player
    const isColorTaken = room.players.some(player =>
      player.id !== playerSession.playerId && player.color === newColor
    );

    if (isColorTaken) {
      // Show error feedback
      const takenBy = room.players.find(p => p.color === newColor);
      console.warn(`Color ${newColor} is taken by ${takenBy?.name || 'another player'}`);
      return;
    }

    // Optimistically update local state immediately
    const oldColor = room.players.find(p => p.id === playerSession.playerId)?.color;
    setRoom(prev => prev ? {
      ...prev,
      players: prev.players.map(p =>
        p.id === playerSession.playerId
          ? { ...p, color: newColor }
          : p
      )
    } : prev);

    // Send to server
    sendSocket({
      type: 'color_change',
      payload: {
        playerId: playerSession.playerId,
        color: newColor,
        timestamp: Date.now() // Add timestamp for conflict resolution
      }
    });

    // Set timeout to handle potential server rejection
    setTimeout(() => {
      // If server hasn't confirmed the change within 2 seconds, revert
      // This handles cases where another player changed to the same color simultaneously
      const currentRoomState = room; // This would ideally come from latest server state
      const currentPlayer = currentRoomState?.players.find(p => p.id === playerSession.playerId);

      if (currentPlayer?.color !== newColor) {
        // Revert to old color if server didn't accept our change
        setRoom(prev => prev ? {
          ...prev,
          players: prev.players.map(p =>
            p.id === playerSession.playerId
              ? { ...p, color: oldColor || newColor }
              : p
          )
        } : prev);

        console.warn('Color change was rejected by server, possibly due to concurrent change');
      }
    }, 2000);
  }, [playerSession, room, sendSocket]);

  useEffect(() => {
    // Add global function for color changing
    (window as any).changePlayerColor = (color: string) => {
      handleColorChange(color);
      // Remove all palettes after color change
      document.querySelectorAll('[id^="palette-"]').forEach(el => el.remove());
    };

    return () => {
      delete (window as any).changePlayerColor;
    };
  }, [handleColorChange]);

  const handleStateChange = (state: GameState) => {
    setGameState(state);
    setRoom((prev) =>
      prev
        ? {
          ...prev,
          gameState: state,
        }
        : prev,
    );
    sendSocket({
      type: 'state',
      gameState: GameEngine.serializeState(state),
    });
  };

  const handleChatSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatDraft.trim() || !playerSession || !roomId) {
      return;
    }
    setChatSending(true);
    const payload = {
      type: 'chat',
      playerId: playerSession.playerId,
      playerName: playerSession.playerName,
      content: chatDraft.trim(),
    };
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendSocket(payload);
      setChatDraft('');
      setChatSending(false);
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: payload.playerId,
          playerName: payload.playerName,
          content: payload.content,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.chatMessage) {
          setChatMessages((prev) => [...prev, data.chatMessage]);
          
          // Create animated chat bubble for GameBoard
          const bubbleId = Date.now().toString();
          setAnimatedChatBubbles(prev => [...prev, {
            id: bubbleId,
            playerId: data.chatMessage.playerId,
            message: data.chatMessage.content
          }]);
          
          // Remove bubble after animation
          setTimeout(() => {
            setAnimatedChatBubbles(prev => prev.filter(b => b.id !== bubbleId));
          }, 3000);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setChatDraft('');
      setChatSending(false);
      setChatBubbleOpen(false); // Close the chat bubble after sending
    }
  };

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
    });
  }, [chatMessages]);

  const connectionLabel =
    socketStatus === 'connected'
      ? 'Live'
      : socketStatus === 'connecting'
        ? 'Syncing'
        : 'Offline';
  const statusLabel = room?.status === 'playing'
    ? 'Playing'
    : room?.status === 'finished'
      ? 'Finished'
      : 'Lobby';
  const isPlaying = room?.status === 'playing';
  const isWaiting = room?.status === 'lobby';
  const isHostPlayer = Boolean(playerSession?.isHost);
  const canEditSettings = isHostPlayer && isWaiting;
  const showGameInfo = isWaiting || !isPlaying;
  const playerCountText = `${room?.players.length ?? 0}/${room?.playerCount ?? 2} Players`;

  const handleCopyRoomId = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      await navigator.clipboard.writeText(roomId);
      setCopyStatus('Copied!');
    } catch {
      setCopyStatus('Unable to copy');
    } finally {
      setTimeout(() => setCopyStatus(''), 2000);
    }
  }, [roomId]);

  const handleSettingsToggle = useCallback(() => {
    if (!canEditSettings) {
      return;
    }
    setInfoOpen(false);
    setSettingsOpen((prev) => !prev);
  }, [canEditSettings]);

  const handleSettingsButtonClick = useCallback(() => {
    if (canEditSettings) {
      handleSettingsToggle();
      return;
    }
    if (isPlaying) {
      setSettingsOpen(true);
    }
  }, [canEditSettings, handleSettingsToggle, isPlaying]);

  const handleInfoToggle = useCallback(() => {
    setSettingsOpen(false);
    setInfoOpen((prev) => !prev);
  }, []);

  const handleChatToggle = useCallback(() => {
    setChatSheetOpen((prev) => !prev);
  }, []);

  const handlePlayerListToggle = useCallback(() => {
    setPlayersModalOpen((prev) => !prev);
  }, []);

  const handleSettingsApply = () => {
    if (!canEditSettings) {
      return;
    }
    const rows = currentGrid.rows;
    const cols = currentGrid.cols;
    const playersForReset = gameState?.players ?? room?.players ?? [];
    const restartedState = GameEngine.createInitialState(
      { rows, cols },
      playersForReset,
    );
    setGameState(restartedState);
    setRoom((prev) =>
      prev
        ? {
          ...prev,
          gridSize: { rows, cols },
          playerCount,
          autoMoveEnabled,
          gameState: restartedState,
        }
        : prev,
    );
    sendSocket({
      type: 'settings',
      payload: {
        gridRows: rows,
        gridCols: cols,
        playerCount,
        autoMoveEnabled,
      },
    });
    setSettingsOpen(false);
  };

  const startGameViaHttp = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${roomId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'playing' }),
      });
      if (response.ok) {
        setRoom((prev) =>
          prev
            ? {
              ...prev,
              status: 'playing',
            }
            : prev,
        );
      }
    } catch (error) {
      console.error(error);
    }
  }, [roomId]);

  const handleStartGame = async () => {
    if (!playerSession?.isHost || !roomId) {
      return;
    }
    setIsStarting(true);
    const targetStatus = 'playing';
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendSocket({ type: 'status', payload: { status: targetStatus } });
      setRoom((prev) =>
        prev
          ? {
            ...prev,
            status: targetStatus,
          }
          : prev,
      );
    } else {
      await startGameViaHttp();
    }
    setIsStarting(false);
  };

  if (error && !room) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
        <div className="rounded-[32px] border border-white/30 bg-black/70 p-8 text-center text-slate-100 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
          <p className="text-lg font-semibold text-white mb-4">Room not found</p>
          <p className="text-sm text-slate-200 mb-6">
            We couldn't load the room yet. Try refreshing or creating a new room.
          </p>
          <Button asChild>
            <a
              href="/"
              className="w-full rounded-full border border-white/50 bg-white/10 px-5 py-2 text-[11px] uppercase tracking-[0.35em] text-white"
            >
              Go home
            </a>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
          <div className="relative overflow-hidden rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-[10px] tracking-[0.5em] text-slate-900/70">
                  D &amp; B
                </span>
                <h1 className="text-4xl font-black uppercase tracking-[0.45em] text-white drop-shadow">
                  {statusLabel}
                </h1>
                <p className="text-xs uppercase tracking-[0.4em] text-white/80">
                  Room / {roomId ?? '??????'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyRoomId}
                  className="rounded-full border border-slate-900/50 px-4 py-1 text-[11px] uppercase tracking-[0.35em] bg-white/50 text-slate-900/80 transition cursor-pointer hover:bg-white/70"
                >
                  <Copy className="inline h-3 w-3 mr-2" />
                  {copyStatus || 'Copy Code'}
                </button>
                <>
                  <button
                    type="button"
                    onClick={handlePlayerListToggle}
                    className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
                    aria-label="Show players"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleChatToggle}
                    className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
                    aria-label="Show chat"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  {canEditSettings && (
                    <button
                      type="button"
                      onClick={handleSettingsToggle}
                      className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer"
                      aria-label="Edit room settings"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  )}
                  {!canEditSettings && isPlaying && (
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="rounded-full border border-white/80 bg-black/80 p-2 text-white transition hover:scale-105 cursor-pointer opacity-60"
                      aria-label="View room settings"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  )}
                </>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setInfoOpen((prev) => !prev);
                  }}
                  className="rounded-full border border-white/60 bg-white/80 p-1 text-slate-900 shadow-sm transition hover:scale-105 cursor-pointer"
                  aria-expanded={infoOpen}
                  aria-label="Toggle quick rules"
                >
                  {infoOpen ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Game Info - Only show when waiting or not playing */}
            {showGameInfo && (
              <div className="space-y-4 mb-6">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                    {currentGrid.label}
                  </span>
                  <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                    {playerCountText}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${autoMoveEnabled ? 'border-green-400 bg-green-400/20 text-green-900' : 'border-slate-900/30 bg-white/60 text-slate-900/70'
                    }`}>
                    <Clock3 className="inline h-3 w-3 mr-1" />
                    {autoMoveEnabled ? 'Auto 30s' : 'Timer off'}
                  </span>
                </div>
              </div>
            )}

            {/* Main Game Area */}
            <div className="relative">
              {/* Game Board */}
              <div>
                <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.5em] text-slate-900/70">{gameState ? gameState.players[gameState.currentPlayerIndex]?.name ?? 'Waiting...' : 'Waiting...'}'s Turn</p>
                    <h2 className="text-2xl font-semibold text-white tracking-[0.3em]">
                      Claim next edge
                    </h2>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.5em] text-slate-900/70">
                    Moves: {gameState?.moveHistory.length ?? 0}
                  </div>
                </header>
                <div className="rounded-[32px] border border-white/20 bg-white/80 p-4">
                  {room && gameState ? (
                    <GameBoard
                      room={{ ...room, gameState }}
                      playerId={playerSession?.playerId ?? null}
                      onStateChange={handleStateChange}
                      chatBubbles={animatedChatBubbles}
                    />
                  ) : (
                    <div className="min-h-[260px] flex items-center justify-center text-slate-500">
                      Loading board...
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-col gap-2 text-[10px] uppercase tracking-[0.5em] text-slate-900/70 lg:flex-row lg:items-center lg:justify-between">
                  <span>Move history</span>
                  <span>{gameState?.moveHistory.length ?? 0} moves</span>
                </div>
                {isWaiting && isHostPlayer && (
                  <Button
                    onClick={handleStartGame}
                    className="mt-4 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900 cursor-pointer"
                    disabled={isStarting}
                  >
                    {isStarting ? 'Starting...' : 'Start Game'}
                  </Button>
                )}
                {isWaiting && !isHostPlayer && (
                  <p className="mt-4 text-center text-[10px] uppercase tracking-[0.5em] text-slate-900/70">
                    Waiting for host to start match
                  </p>
                )}
              </div>

              {/* Floating Chat Bubble */}
              <div className="absolute bottom-4 right-4 z-30">
                {!chatBubbleOpen ? (
                  <button
                    type="button"
                    onClick={() => setChatBubbleOpen(true)}
                    className="rounded-full border border-white/60 bg-black/80 p-3 text-white shadow-lg transition hover:scale-105 cursor-pointer"
                    aria-label="Open chat"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>
                ) : (
                  <div className="rounded-[20px] border border-white/20 bg-white/90 p-3 shadow-xl min-w-[280px] max-w-[320px]">
                    <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(event) => setChatDraft(event.target.value)}
                        placeholder="Send a hint to your crew"
                        className="flex-1 rounded-full border border-white/20 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={chatSending}
                        className="rounded-full border border-slate-900/30 bg-slate-900/80 p-2 text-white transition hover:scale-105 disabled:opacity-40"
                        aria-label="Send chat"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatBubbleOpen(false)}
                        className="rounded-full border border-white/60 bg-white/60 p-2 text-slate-900 transition hover:scale-105"
                        aria-label="Close chat"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Players Modal */}
      {playersModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPlayersModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-[32px] border border-white/30 bg-slate-950/90 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">
                Players
              </p>
              <button
                type="button"
                onClick={() => setPlayersModalOpen(false)}
                className="rounded-full border border-white/40 bg-white/30 p-2 text-white cursor-pointer"
                aria-label="Close players"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {room?.players.map((player) => (
                <>
                  <div key={player.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: player.color }} />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {player.name}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.4em] text-white/70">
                          P{player.order + 1} • {player.isHost ? 'Host' : 'Guest'}
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          // Toggle color palette for this player
                          const paletteId = `palette-${player.id}`;
                          const existingPalette = document.getElementById(paletteId);
                          if (existingPalette) {
                            existingPalette.remove();
                          } else {
                            // Remove any existing palettes first
                            document.querySelectorAll('[id^="palette-"]').forEach(el => el.remove());

                            // Create color palette
                            const palette = document.createElement('div');
                            palette.id = paletteId;
                            palette.className = 'absolute left-0 top-full mt-2 bg-slate-900/95 rounded-lg p-3 border border-white/20 shadow-lg z-50 min-w-[200px]';

                            const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e'];
                            const colorButtons = colors.map((color) => {
                              const isTaken = room.players.some(p => p.id !== player.id && p.color === color);
                              const isCurrent = player.color === color;
                              const takenBy = room.players.find(p => p.color === color);
                              return '<div class="relative group">' +
                                '<button ' +
                                'class="w-6 h-6 rounded-full transition-all ' +
                                (isCurrent
                                  ? 'scale-110'
                                  : 'hover:scale-110') + '"' +
                                ' style="background-color: ' + color + ';' +
                                (isCurrent ? 'box-shadow: 0 0 0 2px #1e293b, 0 0 0 4px white;' : '') + '"' +
                                (player.id === playerSession?.playerId && !isTaken && !isCurrent
                                  ? ' onclick="window.changePlayerColor(\'' + color + '\')"'
                                  : isTaken || isCurrent ? ' disabled' : '') +
                                ' title="' + (isTaken ? 'Taken by ' + (takenBy?.name || 'another player') : isCurrent ? 'Your current color' : 'Available - Click to select') + '"' +
                                '/>' +
                                (isTaken && !isCurrent
                                  ? '<div class="absolute inset-0 rounded-full pointer-events-none flex items-center justify-center" style="border: 2px solid rgba(255,255,255,0.6);">' +
                                  '<div style="position:absolute;width:60%;height:2px;background:rgba(255,255,255,0.7);transform:rotate(45deg);border-radius:1px;"></div>' +
                                  '<div style="position:absolute;width:60%;height:2px;background:rgba(255,255,255,0.7);transform:rotate(-45deg);border-radius:1px;"></div>' +
                                  '</div>'
                                  : '') +
                                '</div>';
                            }).join('');

                            palette.innerHTML =
                              '<div class="text-[11px] font-semibold text-white mb-3 text-center">' +
                              (player.id === playerSession?.playerId ? 'Choose Your Color' : 'Player Colors') +
                              '</div>' +
                              '<div class="grid grid-cols-6 gap-2 mb-3">' +
                              colorButtons +
                              '</div>' +
                              '<div class="text-[9px] text-white/60 text-center">' +
                              (player.id === playerSession?.playerId ? 'Click an available color' : 'Viewing only') +
                              '</div>';

                            // Position palette inset of the button
                            event.currentTarget.parentElement?.appendChild(palette);
                          }
                        }}
                        className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] rounded-full border transition cursor-pointer ${player.id === playerSession?.playerId
                          ? 'border-white/40 bg-white/20 text-white hover:bg-white/30'
                          : 'border-white/20 bg-white/10 text-white/60 cursor-not-allowed'}`}
                        disabled={player.id !== playerSession?.playerId}
                      >
                        {player.id === playerSession?.playerId ? 'Change' : 'View'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-[9px] uppercase tracking-[0.4em] text-white/70">
                      {room?.players.length ?? 0} / {room?.playerCount ?? 2} Players
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.4em] text-white/70">
                      {connectionLabel}
                    </span>
                  </div>
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {chatSheetOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleChatToggle();
            }
          }}
        >
          <div className="w-full max-w-md rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)] transition-all duration-300 scale-95 opacity-0"
            style={{
              transform: chatSheetOpen ? 'scale(1)' : 'scale(0.95)',
              opacity: chatSheetOpen ? 1 : 0
            }}
          >
            <div className="rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-900">
                  Chat room
                </p>
                <button
                  type="button"
                  onClick={handleChatToggle}
                  className="rounded-full border border-white/60 bg-white/80 p-2 text-slate-900 cursor-pointer transition-transform hover:scale-105"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3 text-sm custom-scrollbar">
                {renderChatMessages(chatMessages)}
              </div>
              <form onSubmit={handleChatSubmit} className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder="Message your crew"
                  className="flex-1 rounded-full border border-white/20 bg-white/80 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={chatSending}
                  className="rounded-full border border-slate-900/30 bg-slate-900/80 p-2 text-white transition hover:scale-105 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal - EntryPanel Style */}
      <div
        className={`absolute inset-6 z-20 max-w-sm rounded-[28px] border border-white/30 bg-black/90 p-5 text-[10px] uppercase tracking-[0.3em] text-slate-100 shadow-[0_40px_70px_rgba(0,0,0,0.75)] transition duration-300 ${infoOpen
          ? 'translate-y-0 opacity-100'
          : 'translate-y-full opacity-0 pointer-events-none'
          }`}
        style={{ transformOrigin: 'bottom center' }}
        aria-hidden={!infoOpen}
      >
        <p className="mb-3 text-[12px] font-semibold tracking-[0.55em] text-white">
          Quick Rules
        </p>
        <ul className="space-y-2 text-[10px] leading-snug text-slate-200">
          <li className="flex gap-2">
            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
            <span className="text-left">Rooms hold up to {room?.maxPlayers ?? 8} dreamers.</span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
            <span className="text-left">Grab an edge-if it closes a square you keep the turn.</span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-white"></span>
            <span className="text-left">Timer auto-picks a random edge when you pause too long.</span>
          </li>
        </ul>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
          Tap the info icon to close
        </p>
      </div>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSettingsOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-[32px] border border-white/30 bg-slate-950/90 p-6 shadow-[0_40px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white">
                Room Settings
              </p>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-white/40 bg-white/30 p-2 text-white cursor-pointer"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <p className="text-[9px] uppercase tracking-[0.4em] text-slate-300">
                Grid size
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {GRID_OPTIONS.map((grid, index) => (
                  <button
                    key={grid.label}
                    type="button"
                    onClick={() => setSelectedGridIndex(index)}
                    className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${selectedGridIndex === index
                      ? 'border-emerald-300 bg-emerald-300/20 text-emerald-200'
                      : 'border-white/30 bg-white/10 text-white/70'
                      }`}
                  >
                    {grid.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[9px] uppercase tracking-[0.4em] text-slate-300">
                Players
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {Array.from({ length: 7 }, (_, idx) => idx + 2).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlayerCount(value)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${playerCount === value
                      ? 'border-sky-400 bg-sky-400/20 text-sky-100'
                      : 'border-white/30 bg-white/10 text-white/60'
                      }`}
                  >
                    {value}P
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-slate-300">
                  Auto move
                </p>
                <p className="text-[11px] font-semibold text-white/90">
                  {autoMoveEnabled ? 'Enabled (30s)' : 'Disabled'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoMoveEnabled((prev) => !prev)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${autoMoveEnabled
                  ? 'border-emerald-300 bg-emerald-300/20 text-emerald-100'
                  : 'border-white/30 bg-white/10 text-white/60'
                  }`}
              >
                <Clock3 className="h-4 w-4" />
                {autoMoveEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <p className="mt-4 text-[9px] uppercase tracking-[0.35em] text-white/70">
              Auto move picks a random edge after the timer expires.
            </p>

            <Button
              onClick={handleSettingsApply}
              className="mt-6 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900 cursor-pointer"
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
