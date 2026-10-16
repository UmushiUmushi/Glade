// The memory ring buffer: the newest log lines of this session, for the log viewer and bug reports.
// When full, each new line pushes out the oldest.

import type { LogLine, Sink } from "./line";

export const RING_CAPACITY = 5000;

export interface Ring extends Sink {
  /** Lines, oldest first. */
  lines(): LogLine[];
  clear(): void;
}

export function createRing(capacity = RING_CAPACITY): Ring {
  let buffer: LogLine[] = [];
  let start = 0;
  return {
    write(line) {
      if (buffer.length < capacity) buffer.push(line);
      else {
        buffer[start] = line;
        start = (start + 1) % capacity;
      }
    },
    lines() {
      return [...buffer.slice(start), ...buffer.slice(0, start)];
    },
    clear() {
      buffer = [];
      start = 0;
    },
  };
}
