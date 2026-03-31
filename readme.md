1. Core Game Concept (Refined)
Game Type
Multiplayer (2–8 players)
Turn-based
Grid-based strategy game
Objective
Complete the most squares by drawing edges between dots.
🎮 2. Gameplay Rules (Well-Structured)
Grid
Configurable sizes:
10×10 (default)
10×15
15×15
10×20
20×20
Turn Mechanics

Each turn:

Player selects two adjacent dots
Allowed:
Horizontal
Vertical
Not allowed:
Diagonal
Non-adjacent
System draws a line.
Square Completion Logic
A square is formed when all 4 edges exist
If a player completes a square:
That square is claimed by the player
Player gets +1 score
Square is filled with player color + label (e.g., “P1”)
Bonus Turn Rule
If player completes ≥1 square:
They get another turn
Player may:
Continue completing squares
Or play any valid move
Turn Timeout Rule
Optional setting (e.g., 30s)
If player does not act:
System auto-selects a random valid edge
Prevents unfair skipping
Game End
When all possible squares are completed
Winner = player with highest score
🏗️ 3. App Structure (Next.js Architecture)
Pages / Routes
/                → Landing page
/create          → Create room
/join            → Join room
/room/[roomId]   → Lobby + Game
State Layers
1. Room State
type Room = {
  id: string
  hostId: string
  players: Player[]
  settings: GameSettings
  status: "lobby" | "in-game" | "finished"
}
2. Player
type Player = {
  id: string
  name: string
  color: string
  score: number
  order: number // P1–P8
  isActive: boolean
}
3. Game State
type GameState = {
  gridSize: { rows: number; cols: number }
  edges: Set<string> // "r1-c1:r1-c2"
  squares: Square[]
  currentPlayerIndex: number
  turnEndsAt?: number
}
4. Square Model
type Square = {
  topLeft: [number, number]
  ownerId: string
}
🔄 4. Game Logic (Important)
Edge Representation

Use normalized keys:

"r1-c1|r1-c2"

(always sorted to avoid duplicates)

Check Square Completion

When an edge is added:

Check up to 2 possible squares
For each square:
Check if all 4 edges exist
Turn Flow
if (moveCompletesSquare) {
  currentPlayer continues
} else {
  nextPlayer()
}
Auto Move (Timeout)
const availableEdges = allEdges - usedEdges
pick random edge
apply move
🌐 5. Multiplayer Setup
Recommended Stack
Next.js (App Router)
Realtime:
✅ Supabase Realtime (since you're already using it)
OR WebSockets (Socket.io)
Sync Strategy
Store:
room
game state
moves
Broadcast updates:
edge added
square claimed
turn change
🧩 6. UI Layout
Game Screen Layout
--------------------------------------
| Player List (Left Panel)           |
|-----------------------------------|
| P1 (active) 🔵                    |
| P2 🔴                             |
| P3 🟢                             |
--------------------------------------
|                                   |
|        GAME GRID (CENTER)         |
|                                   |
--------------------------------------
| Controls / Status (Bottom)        |
--------------------------------------
Grid UI Behavior
Dots → small gray circles
Hover:
highlight valid edge
Click:
draw line in player color
Completed square:
filled with player color
shows label (P1, P2...)
Player Panel
Shows:
Player order (P1–P8)
Color
Score
Turn highlight
⚙️ 7. Room Features
Host Controls
Select grid size
Start game
Kick players
Enable/disable timer
Room Flow
Create Room
Generate random ID (e.g., AB12CD)
Copy/share link
Join Room
Enter ID
Assign:
next available player slot
random color
🎨 8. Visual Design Rules
Background: dark or neutral
Dots: gray
Lines: player color
Squares:
filled with player color (slightly transparent)
Active player:
glow / highlight
🧱 9. Suggested Folder Structure
/app
  /room/[id]
    page.tsx
    GameBoard.tsx
    PlayerList.tsx
    useGame.ts

/lib
  game-engine.ts
  helpers.ts

/components
  Dot.tsx
  Edge.tsx
  Square.tsx
⚡ 10. MVP Development Plan
Phase 1 (Core)
Grid rendering
Edge drawing
Square detection
Turn system
Phase 2
Multiplayer sync
Room system
Phase 3
Timer + auto move
Host controls
Phase 4
Polish UI + animations
💡 Extra Ideas (Future)
Spectator mode
Replay game
Leaderboard
Private/public rooms
Mobile optimization