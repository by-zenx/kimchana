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
'''
print(new_block[:400])
