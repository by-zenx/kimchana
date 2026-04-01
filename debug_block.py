from pathlib import Path
path = Path('app/room/[roomId]/page.tsx')
text = path.read_text()
start = text.rfind('  return (')
closing = text.rfind('  );')
print(text[start:closing])
