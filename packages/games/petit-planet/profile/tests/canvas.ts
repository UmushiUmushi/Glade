// A stand-in 2D canvas context for Node tests: every call and every property set is written to a
// log, in order ("fillStyle=#a4c148", "fillRect(0,0,2,2)"), so a test can check what was drawn.

export interface Recorded {
  ctx: CanvasRenderingContext2D;
  log: string[];
  /** Runs `draw` with just enough of `document` and `ImageData` for an offscreen terrain canvas. */
  offscreen(draw: () => void): void;
}

export function recordCanvas(): Recorded {
  const log: string[] = [];
  const state: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  const ctx = new Proxy(state, {
    get: (t, k) =>
      k in t
        ? t[k as string]
        : (...args: unknown[]) => void log.push(`${String(k)}(${args.map(String).join(",")})`),
    set: (t, k, v) => {
      t[k as string] = v;
      log.push(`${String(k)}=${String(v)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const offscreen = (draw: () => void) => {
    const g = globalThis as Record<string, unknown>;
    g.document = { createElement: () => ({ getContext: () => ctx }) };
    g.ImageData = class {
      data: Uint8ClampedArray;
      constructor(w: number, h: number) {
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    };
    try {
      draw();
    } finally {
      delete g.document;
      delete g.ImageData;
    }
  };
  return { ctx, log, offscreen };
}
