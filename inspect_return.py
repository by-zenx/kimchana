from pathlib import Path
text = Path('app/room/[roomId]/page.tsx').read_text()
first = text.index('  return (')
second = text.index('  return (', first + 1)
print(text[second:second+200])
