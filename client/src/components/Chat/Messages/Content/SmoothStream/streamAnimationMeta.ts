export const FADE_DURATION_MS = 280;
export const BASE_CHAR_DELAY_MS = 18;

export function getCharDelayMs(index: number, queueLength = 0) {
  const queueFactor = 1 + Math.max(0, queueLength) * 0.3;
  return BASE_CHAR_DELAY_MS / queueFactor + index;
}

export function getStreamCharStyle(index: number, queueLength = 0) {
  const delay = Math.min(FADE_DURATION_MS, getCharDelayMs(index, queueLength));
  return { animationDelay: `${-delay}ms` };
}
