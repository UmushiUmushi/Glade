// Ids for log lines: a random session id per tab, and action ids that count up within a session.
// The random source is passed in, so tests and replays get the same ids every time.

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SESSION_ID_LENGTH = 8;

/** `s_` and eight random letters and digits. `rng` gives numbers in [0, 1), like Math.random. */
export function newSessionId(rng: () => number): string {
  let id = "s_";
  for (let i = 0; i < SESSION_ID_LENGTH; i++) id += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return id;
}

/** Action ids for one session: a_0001, a_0002, … in the order actions start. */
export function actionIds(): () => string {
  let next = 0;
  return () => `a_${(++next).toString(16).padStart(4, "0")}`;
}
