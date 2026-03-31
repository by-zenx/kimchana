export const PLAYER_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#eab308', // yellow
  '#06b6d4', // cyan
];

export const GRID_SIZES = [
  { rows: 10, cols: 10, label: '10x10' },
  { rows: 10, cols: 15, label: '10x15' },
  { rows: 15, cols: 15, label: '15x15' },
  { rows: 10, cols: 20, label: '10x20' },
  { rows: 20, cols: 20, label: '20x20' },
] as const;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const DEFAULT_GRID_SIZE = { rows: 10, cols: 10 };

// Grid rendering constants
export const DOT_SIZE = 8;
export const GRID_SPACING = 40; // pixels between dots
export const EDGE_WIDTH = 3;
