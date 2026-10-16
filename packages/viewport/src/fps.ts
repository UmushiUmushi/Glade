// The FPS readout: counts frames and reports how many came in each second.

export const FPS_WINDOW_MS = 1000;

export interface FpsMeter {
  /** Call once a frame with the frame's time (ms). Returns a new reading once a second, else null. */
  frame(now: number): number | null;
}

export function createFpsMeter(windowMs = FPS_WINDOW_MS): FpsMeter {
  let start: number | null = null;
  let frames = 0;
  return {
    frame(now) {
      if (start === null) {
        start = now;
        return null;
      }
      frames++;
      const elapsed = now - start;
      if (elapsed < windowMs) return null;
      const fps = Math.round((frames * 1000) / elapsed);
      start = now;
      frames = 0;
      return fps;
    },
  };
}
