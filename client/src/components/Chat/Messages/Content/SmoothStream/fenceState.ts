const FENCE_RE = /^ {0,3}(```+|~~~+)/;

export function getFenceMarker(line: string) {
  return FENCE_RE.exec(line)?.[1] ?? null;
}

export function isFenceClose(line: string, marker: string) {
  const trimmed = line.trimStart();
  return trimmed.startsWith(marker);
}

export function hasOpenCodeFence(text: string) {
  const lines = text.split('\n');
  let openMarker: string | null = null;

  for (const line of lines) {
    const marker = getFenceMarker(line);
    if (!marker) {
      continue;
    }
    if (!openMarker) {
      openMarker = marker;
    } else if (isFenceClose(line, openMarker)) {
      openMarker = null;
    }
  }

  return openMarker !== null;
}
