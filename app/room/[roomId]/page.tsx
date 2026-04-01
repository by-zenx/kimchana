'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GameBoard } from '@/components/game/GameBoard';
import { GameEngine, SerializedGameState } from '@/lib/game-engine';
import { Room, GameState, ChatMessage } from '@/lib/types';
import { Clock3, Copy, Info, MessageCircle, Send, Settings2, X } from 'lucide-react';
import { GRID_SIZES } from '@/lib/constants';

type PlayerSession = {
  playerId: string;
  playerToken: string;
  playerName: string;
  isHost: boolean;
};

const GRID_OPTIONS = GRID_SIZES.slice(0, 3);

export default function RoomPage() {
  const params = useParams();
  const roomId = (params?.roomId as string)?.toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null);
  const [socketStatus, setSocketStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [chatDraft, setChatDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [selectedGridIndex, setSelectedGridIndex] = useState(0);
  const [playerCount, setPlayerCount] = useState(2);
  const [autoMoveEnabled, setAutoMoveEnabled] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [chatSending, setChatSending] = useState(false);
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

  useEffect(() => {
    if (!roomId || !playerSession) {
      return;
    }
    setSocketStatus('connecting');
    const url = new URL('/api/socket', window.location.origin);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('playerId', playerSession.playerId);
    url.protocol = url.protocol.replace('http', 'ws');
    const socket = new WebSocket(url.toString());
    socketRef.current = socket;
    socket.onopen = () => setSocketStatus('connected');
    socket.onclose = () => setSocketStatus('disconnected');
    socket.onerror = () => setSocketStatus('disconnected');
    socket.onmessage = handleIncomingSocket;
    return () => {
      socket.close();
      socketRef.current = null;
      setSocketStatus('disconnected');
    };
  }, [handleIncomingSocket, playerSession, roomId]);

  const sendSocket = useCallback((payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

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
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setChatDraft('');
      setChatSending(false);
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
  const isWaiting = room?.status === 'lobby';
  const isHostPlayer = Boolean(playerSession?.isHost);
  const canEditSettings = isHostPlayer && isWaiting;
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

  const handleChatToggle = useCallback(() => {
    setChatSheetOpen((prev) => !prev);
  }, []);

  const handleSettingsApply = () => {
    if (!canEditSettings) {
      return;
    }
    sendSocket({
      type: 'settings',
      payload: {
        gridRows: currentGrid.rows,
        gridCols: currentGrid.cols,
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

  const renderChatMessages = (messages: ChatMessage[]) => (
    <div className="space-y-3">
      {messages.map((message) => (
        <div
          key={`${message.id}-${message.createdAt}`}
          className="rounded-2xl border border-white/20 bg-slate-900/70 p-3 text-sm text-white shadow-[0_10px_30px_rgba(2,12,23,0.6)]"
        >
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.5em] text-slate-400">
            <span>{message.playerName}</span>
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <p className="mt-2 text-sm text-white">{message.content}</p>
        </div>
      ))}
      {!messages.length && (
        <p className="text-center text-xs uppercase tracking-[0.4em] text-slate-500">
          No messages yet
        </p>
      )}
    </div>
  );

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
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setInfoOpen((prev) => !prev);
              }}
              className="absolute top-4 right-4 z-30 rounded-full border border-white/60 bg-white/80 p-1 text-slate-900 shadow-sm transition hover:scale-105 cursor-pointer"
              aria-expanded={infoOpen}
              aria-label="Toggle quick rules"
            >
              {infoOpen ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </button>

            <div className="flex flex-col items-center gap-1 text-center mb-6">
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
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                type="button"
                onClick={handleCopyRoomId}
                className="rounded-full border border-slate-900/50 px-4 py-1 text-[11px] uppercase tracking-[0.35em] bg-white/50 text-slate-900/80 transition cursor-pointer hover:bg-white/70"
              >
                <Copy className="inline h-3 w-3 mr-2" />
                {copyStatus || 'Copy Code'}
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
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                {currentGrid.label}
              </span>
              <span className="rounded-full border border-white/40 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                {playerCountText}
              </span>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${
                autoMoveEnabled ? 'border-green-400 bg-green-400/20 text-green-900' : 'border-slate-900/30 bg-white/60 text-slate-900/70'
              }`}>
                <Clock3 className="inline h-3 w-3 mr-1" />
                {autoMoveEnabled ? 'Auto 30s' : 'Timer off'}
              </span>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/70 text-center">Players joined</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {room?.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex min-w-[180px] items-center justify-between gap-3 rounded-2xl border border-white/20 bg-black/20 px-4 py-2 text-sm transition ${
                      player.id === playerSession?.playerId ? 'border-emerald-300/60 bg-emerald-300/20' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: player.color }} />
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">P{player.order + 1}</p>
                        <p className="font-semibold text-white">{player.name}</p>
                      </div>
                    </div>
                    <span className="text-[9px] uppercase tracking-[0.4em] text-white/70">
                      {player.isHost ? 'Host' : 'Guest'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[9px] uppercase tracking-[0.4em] text-white/70">
              <span>Status</span>
              <span>{connectionLabel}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr] mt-6">
          <div className="rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
            <div className="rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
              <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.5em] text-slate-900/70">{gameState ? gameState.players[gameState.currentPlayerIndex]?.name ?? 'Waiting...' : 'Waiting...'}'s Turn</p>
                  <h2 className="text-2xl font-semibold text-white tracking-[0.3em]">
                    Claim the next edge
                  </h2>
                </div>
                <div className="text-[10px] uppercase tracking-[0.5em] text-slate-900/70">
                  Moves: {gameState?.moveHistory.length ?? 0}
                </div>
              </header>
              <div className="mt-6 rounded-[32px] border border-white/20 bg-white/80 p-4">
                {room && gameState ? (
                  <GameBoard
                    room={{ ...room, gameState }}
                    playerId={playerSession?.playerId ?? null}
                    onStateChange={handleStateChange}
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
                  Waiting for the host to start the match
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
            <div className="rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
              <header className="flex items-center justify-between text-[10px] uppercase tracking-[0.5em] text-slate-900/70">
                <span>Chat</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.35em] text-slate-900/70">{connectionLabel}</span>
                  <button
                    type="button"
                    onClick={handleChatToggle}
                    className="rounded-full border border-white/60 bg-white/80 p-2 text-slate-900 transition hover:scale-105 cursor-pointer"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>
              </header>
              <div className="mt-4 flex-1 overflow-y-auto max-h-[400px]" ref={chatScrollRef}>
                {renderChatMessages(chatMessages)}
              </div>
              <form onSubmit={handleChatSubmit} className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder="Send a hint to your crew"
                  className="flex-1 rounded-full border border-white/20 bg-white/80 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={chatSending}
                  className="rounded-full border border-slate-900/30 bg-slate-900/80 p-2 text-white transition hover:scale-105 disabled:opacity-40"
                  aria-label="Send chat"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {chatSheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
            <div className="rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-900">
                  Chat room
                </p>
                <button
                  type="button"
                  onClick={handleChatToggle}
                  className="rounded-full border border-white/60 bg-white/80 p-2 text-slate-900 cursor-pointer"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-3 text-sm">
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

      {infoOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
            <div className="rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-900">
                  Quick Rules
                </p>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  className="rounded-full border border-white/60 bg-white/80 p-2 text-slate-900 cursor-pointer"
                  aria-label="Close quick rules"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-4 space-y-3 text-[11px] uppercase tracking-[0.35em] text-slate-800">
                <li>Rooms hold up to {room?.maxPlayers ?? 8} dreamers.</li>
                <li>Grab an edge-if it closes a square you keep the turn.</li>
                <li>Timer auto-picks a random edge when you pause too long.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
            <div className="rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-900">
                  Room Settings
                </p>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full border border-white/60 bg-white/80 p-2 text-slate-900 cursor-pointer"
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 space-y-5 text-[10px] uppercase tracking-[0.35em] text-slate-800">
                <div>
                  <p className="mb-2 text-slate-700">Grid size</p>
                  <div className="flex flex-wrap gap-2">
                    {GRID_OPTIONS.map((grid, index) => (
                      <button
                        key={grid.label}
                        type="button"
                        onClick={() => setSelectedGridIndex(index)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          selectedGridIndex === index
                            ? 'border-emerald-300 bg-emerald-300/20 text-emerald-800'
                            : 'border-slate-900/30 bg-white/60 text-slate-900/70'
                        }`}
                      >
                        {grid.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-slate-700">Players</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 7 }, (_, idx) => idx + 2).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPlayerCount(value)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          playerCount === value
                            ? 'border-sky-400 bg-sky-400/20 text-sky-800'
                            : 'border-slate-900/30 bg-white/60 text-slate-900/60'
                        }`}
                      >
                        {value}P
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/20 pt-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.4em] text-slate-700">
                      Auto move
                    </p>
                    <p className="text-[11px] font-semibold text-slate-900">
                      {autoMoveEnabled ? 'Enabled (30s)' : 'Disabled'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoMoveEnabled((prev) => !prev)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] transition cursor-pointer ${
                      autoMoveEnabled
                        ? 'border-emerald-300 bg-emerald-300/20 text-emerald-800'
                        : 'border-slate-900/30 bg-white/60 text-slate-900/60'
                    }`}
                  >
                    <Clock3 className="h-4 w-4" />
                    {autoMoveEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <p className="text-[9px] uppercase tracking-[0.35em] text-slate-700">
                  Auto move picks a random edge after the timer expires.
                </p>
              </div>
              <Button
                onClick={handleSettingsApply}
                className="mt-6 w-full rounded-full border-0 bg-black px-6 py-3 text-base font-semibold tracking-[0.35em] text-white shadow-[0_15px_30px_rgba(0,0,0,0.45)] hover:-translate-y-0.5 hover:bg-slate-900 cursor-pointer"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
