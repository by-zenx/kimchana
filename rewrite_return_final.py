from pathlib import Path
path = Path('app/room/[roomId]/page.tsx')
text = path.read_text()
marker = '  return (\n    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">'
start = text.index(marker)
end_marker = '    </main>\n  );'
end = text.rfind(end_marker)
if end == -1 or end <= start:
    raise SystemExit('end marker not found')
prefix = text[:start]
suffix = text[end + len(end_marker):]
new_block = '''  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="rounded-[42px] border-4 border-black/70 bg-white/80 p-0 shadow-[0_40px_70px_rgba(2,35,26,0.75)]">
          <div className="relative overflow-hidden rounded-[38px] border-2 border-black bg-gradient-to-b from-[#00d4c5] via-[#00b8ad] to-[#02a5a3] p-6">
            <RoomHeader
              statusLabel={statusLabel}
              roomId={roomId}
              copyStatus={copyStatus}
              onCopyRoomId={handleCopyRoomId}
              onChatToggle={handleChatToggle}
              onInfoToggle={handleInfoToggle}
              onPlayerListToggle={handlePlayerListToggle}
              onSettingsClick={handleSettingsButtonClick}
              canEditSettings={canEditSettings}
              isPlaying={isPlaying}
              infoOpen={infoOpen}
            />

            {showGameInfo && (
              <GameInfoChips
                gridLabel={currentGrid.label}
                playerCountText={playerCountText}
                autoMoveEnabled={autoMoveEnabled}
              />
            )}

            <div className="relative">
              <div>
                <header className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.5em] text-slate-900/70">
                      {gameState ? gameState.players[gameState.currentPlayerIndex]?.name ?? 'Waiting...' : 'Waiting...'}'s Turn
                    </p>
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

              <div className="absolute bottom-4 right-4 z-30">
                <RoomChatBubble
                  open={chatBubbleOpen}
                  chatDraft={chatDraft}
                  chatSending={chatSending}
                  onDraftChange={(value) => setChatDraft(value)}
                  onOpen={() => setChatBubbleOpen(true)}
                  onClose={() => setChatBubbleOpen(false)}
                  onSubmit={handleChatSubmit}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <PlayersModal
        open={playersModalOpen}
        players={room?.players ?? []}
        playerCount={room?.playerCount}
        connectionLabel={connectionLabel}
        currentPlayerId={playerSession?.playerId}
        onClose={() => setPlayersModalOpen(false)}
      />

      <ChatSheet
        open={chatSheetOpen}
        chatMessages={chatMessages}
        chatDraft={chatDraft}
        chatSending={chatSending}
        onDraftChange={(value) => setChatDraft(value)}
        onSubmit={handleChatSubmit}
        onClose={handleChatToggle}
      />

      <InfoModal open={infoOpen} room={room} />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        gridOptions={GRID_OPTIONS}
        selectedGridIndex={selectedGridIndex}
        onGridChange={(index) => setSelectedGridIndex(index)}
        playerCount={playerCount}
        onPlayerCountChange={(value) => setPlayerCount(value)}
        autoMoveEnabled={autoMoveEnabled}
        toggleAutoMove={() => setAutoMoveEnabled((prev) => !prev)}
        onSave={handleSettingsApply}
      />
    </main>'''
path.write_text(prefix + new_block + suffix)
