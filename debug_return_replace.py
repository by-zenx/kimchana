from pathlib import Path
path = Path('app/room/[roomId]/page.tsx')
text = path.read_text()
start = text.rfind('  return (')
closing = text.rfind('  );')
print('start', start)
print('closing', closing)
print('substring', repr(text[start:start+50]))
print('closing segment', repr(text[closing-20:closing+10]))
