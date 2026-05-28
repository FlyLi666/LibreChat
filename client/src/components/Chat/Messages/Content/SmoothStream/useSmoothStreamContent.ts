import { useEffect, useRef, useState } from 'react';

export const TARGET_BUFFER_MS = 120;
export const MIN_CPS = 20;
export const MAX_CPS = 300;
export const SETTLE_AFTER_MS = 300;
export const SETTLE_DRAIN_MAX_MS = 500;
export const EMA_ALPHA = 0.2;
export const LARGE_APPEND_BYPASS_CHARS = 200;

type SmoothStreamOptions = {
  streaming: boolean;
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function shouldRenderImmediately(text: string, previousText: string, streaming: boolean) {
  if (!streaming || prefersReducedMotion()) {
    return true;
  }
  return Math.abs(text.length - previousText.length) > LARGE_APPEND_BYPASS_CHARS;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useSmoothStreamContent(text: string, { streaming }: SmoothStreamOptions): string {
  const frameRef = useRef<number | null>(null);
  const settleRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const targetRef = useRef(text);
  const displayedRef = useRef('');
  const arrivalCpsRef = useRef(MIN_CPS);
  const lastTargetAtRef = useRef(Date.now());
  const lastFrameAtRef = useRef(Date.now());
  const lastStreamingRef = useRef(streaming);
  const drainingRef = useRef(false);
  const drainStartedAtRef = useRef(0);
  const drainStartedLengthRef = useRef(0);
  const drainBacklogRef = useRef(0);
  const [displayed, setDisplayed] = useState(() => {
    if (shouldRenderImmediately(text, '', streaming)) {
      displayedRef.current = text;
      return text;
    }
    const initial = text.slice(0, 1);
    displayedRef.current = initial;
    return initial;
  });

  useEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);

  useEffect(() => {
    const previousTarget = targetRef.current;
    const now = Date.now();
    const elapsedSeconds = Math.max(0.016, (now - lastTargetAtRef.current) / 1000);
    const appendedChars =
      text.startsWith(previousTarget) && text.length > previousTarget.length
        ? text.length - previousTarget.length
        : 0;

    targetRef.current = text;
    lastTargetAtRef.current = now;

    if (appendedChars > 0) {
      const instantCps = appendedChars / elapsedSeconds;
      arrivalCpsRef.current = arrivalCpsRef.current * (1 - EMA_ALPHA) + instantCps * EMA_ALPHA;
    }

    const cancelFrame = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const cancelSettle = () => {
      if (settleRef.current !== null) {
        window.clearTimeout(settleRef.current);
        settleRef.current = null;
      }
    };

    const syncImmediate = () => {
      cancelFrame();
      cancelSettle();
      drainingRef.current = false;
      displayedRef.current = text;
      setDisplayed(text);
    };

    if (shouldRenderImmediately(text, previousTarget, streaming)) {
      if (!streaming && lastStreamingRef.current && displayedRef.current !== text) {
        cancelFrame();
        cancelSettle();
        settleRef.current = window.setTimeout(() => {
          drainingRef.current = true;
          drainStartedAtRef.current = Date.now();
          drainStartedLengthRef.current = displayedRef.current.length;
          drainBacklogRef.current = Math.max(
            0,
            targetRef.current.length - displayedRef.current.length,
          );
          scheduleFrame();
        }, SETTLE_AFTER_MS);
      } else {
        syncImmediate();
      }
      lastStreamingRef.current = streaming;
      return;
    }

    function getNextText(current: string) {
      const target = targetRef.current;
      if (current === target) {
        drainingRef.current = false;
        return current;
      }
      if (!target.startsWith(current)) {
        return target;
      }

      const backlog = target.length - current.length;
      if (drainingRef.current) {
        const elapsed = Date.now() - drainStartedAtRef.current;
        const targetLength =
          drainStartedLengthRef.current +
          Math.ceil((drainBacklogRef.current * elapsed) / SETTLE_DRAIN_MAX_MS);
        return target.slice(0, Math.min(target.length, Math.max(current.length + 1, targetLength)));
      }

      const now = Date.now();
      const frameSeconds = Math.max(0.016, (now - lastFrameAtRef.current) / 1000);
      lastFrameAtRef.current = now;
      const cps = clamp(arrivalCpsRef.current, MIN_CPS, MAX_CPS);
      const lagChars = Math.ceil((cps * TARGET_BUFFER_MS) / 1000);
      const frameChars = clamp(Math.ceil(cps * frameSeconds), 1, Math.ceil(MAX_CPS * frameSeconds));
      const catchUpChars = Math.max(1, backlog - lagChars);
      const release = Math.min(backlog, Math.max(frameChars, catchUpChars));
      return target.slice(0, current.length + release);
    }

    const tick = () => {
      frameRef.current = null;
      let shouldContinue = false;
      setDisplayed((current) => {
        const next = getNextText(current);
        displayedRef.current = next;
        shouldContinue = next !== targetRef.current;
        return next;
      });
      if (shouldContinue) {
        scheduleFrame();
      }
    };

    function scheduleFrame() {
      if (frameRef.current === null) {
        lastFrameAtRef.current = Date.now();
        frameRef.current = window.requestAnimationFrame(tick);
      }
    }

    scheduleFrame();
    lastStreamingRef.current = streaming;

    return () => {
      cancelFrame();
    };
  }, [streaming, text]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (settleRef.current !== null) {
        window.clearTimeout(settleRef.current);
      }
    },
    [],
  );

  return displayed;
}
