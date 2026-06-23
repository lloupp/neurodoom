/**
 * Hacking minigame — TIS-100-inspired (SPEC 4.6).
 *
 * The player sees THREE lines of "code tokens" (see `lineWidth`):
 *   - Some tokens are `???` missing segments; they need to fill them
 *     with the correct token, deduced by decoding its hint (a
 *     Caesar-shift-by-1 of the real token — e.g. hint "NPW" means "MOV").
 *   - The rest are visible.
 *
 * Difficulty scales (3 lines always; `lineWidth` tokens per line):
 *   - Easy:   2/line (6 tokens), 1 missing
 *   - Normal: 3/line (9 tokens), 2 missing
 *   - Hard:   4/line (12 tokens), 3 missing
 *
 * Time budget is 3 seconds per token ("three seconds-per-token tolerance").
 *
 * Failure: the caller (Game) is responsible for the consequence
 *           (trace alarm + enemy spawn nearby) when status becomes 'lost'.
 */

/** Every puzzle is laid out as this many lines (SPEC 4.6: "three lines"). */
export const HACK_LINES = 3;
/** Seconds of time budget granted per token in the program (SPEC 4.6). */
export const HACK_SECONDS_PER_TOKEN = 3;

export interface HackNode {
  text: string;
  hint?: string;
}

export interface HackPuzzle {
  difficulty: 'easy' | 'normal' | 'hard';
  program: HackNode[];
  /** Tokens per line; the program is `HACK_LINES * lineWidth` tokens (SPEC 4.6). */
  lineWidth: number;
  /** Tokens to choose from to fill missing rows. */
  tokenBank: string[];
  /** The expected pattern. Tokens are compared positionally. */
  missingIndices: number[];
  /** The real token for each missing index — deducible from its Caesar-shifted hint. */
  solution: Record<number, string>;
  /** Trail pattern. */
  timeLimit: number;
  /** Number of allowed wrong-token insertions. */
  traces: number;
}

/** Caesar shift A-Z by `n` (wrapping); used to encode/decode hack hints. */
function caesarShift(text: string, n: number): string {
  return text.replace(/[A-Z]/g, (ch) => {
    const code = ((ch.charCodeAt(0) - 65 + n) % 26 + 26) % 26;
    return String.fromCharCode(65 + code);
  });
}

export interface HackState {
  puzzle: HackPuzzle;
  /** Per index in program: user-chosen token or null if accepting source. */
  userInput: Map<number, string>;
  timeLeft: number;
  tracesLeft: number;
  status: 'unset' | 'running' | 'won' | 'lost';
  startTime: number;
}

const TOKEN_BANK = [
  'MOV', 'ADD', 'SUB', 'SAY', 'JMP', 'NOP', 'CMP', 'SWP',
  'XOR', 'AND', 'OR', 'NEG', 'PUSH', 'POP', 'PEEK', 'ACK',
  'GRAB', 'DROP', 'WIPE', 'TRCE',
];

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generatePuzzle(seed: number, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): HackPuzzle {
  const rng = rand(seed);
  // 3 lines always; difficulty sets tokens-per-line (SPEC 4.6).
  const lineWidths = { easy: 2, normal: 3, hard: 4 };
  const missingPerLevel = { easy: 1, normal: 2, hard: 3 };
  const tracePerLevel = { easy: 5, normal: 3, hard: 2 };

  const lineWidth = lineWidths[difficulty];
  const size = HACK_LINES * lineWidth;
  const missingCount = missingPerLevel[difficulty];
  // 3 seconds of tolerance per token in the program.
  const timeLimit = HACK_SECONDS_PER_TOKEN * size;

  // Pick missing indices distributed across the program
  const shuffledIndices = shuffle(Array.from({ length: size }, (_v, i) => i), rng);
  const missingIndices = shuffledIndices.slice(0, missingCount).sort((a, b) => a - b);

  // Token pool: unique tokens, real code — generated for every line (including
  // missing ones), so each missing line has one definite correct answer.
  const tokenSet = shuffle(TOKEN_BANK, rng).slice(0, size);
  const program: HackNode[] = [];
  const solution: Record<number, string> = {};
  for (let i = 0; i < size; i++) {
    const token = tokenSet[i] ?? 'NOP';
    if (missingIndices.includes(i)) {
      solution[i] = token;
      program.push({ text: '???', hint: caesarShift(token, 1) });
    } else {
      program.push({ text: token, hint: 'op' });
    }
  }
  // Bank must contain every real solution so the player can pick it, plus filler.
  const filler = shuffle(TOKEN_BANK.filter((t) => !tokenSet.includes(t)), rng);
  const tokenBank = shuffle([...Object.values(solution), ...filler], rng).slice(0, Math.max(10, missingCount + 4));
  return {
    difficulty,
    program,
    lineWidth,
    tokenBank,
    missingIndices,
    solution,
    timeLimit,
    traces: tracePerLevel[difficulty],
  };
}

export function startHack(puzzle: HackPuzzle): HackState {
  return {
    puzzle,
    userInput: new Map(puzzle.missingIndices.map((i) => [i, ''])),
    timeLeft: puzzle.timeLimit,
    tracesLeft: puzzle.traces,
    status: 'running',
    startTime: performance.now(),
  };
}

export function submitToken(state: HackState, idx: number, token: string): { tracesLeft: number; correct: boolean } {
  if (state.status !== 'running') return { tracesLeft: state.tracesLeft, correct: false };
  state.userInput.set(idx, token);
  if (token.length === 0) return { tracesLeft: state.tracesLeft, correct: false };
  const isCorrect = token.toUpperCase() === state.puzzle.solution[idx];
  if (!isCorrect) {
    state.tracesLeft = Math.max(0, state.tracesLeft - 1);
    return { tracesLeft: state.tracesLeft, correct: false };
  }
  return { tracesLeft: state.tracesLeft, correct: true };
}

export function tickHack(state: HackState, dt: number): HackState {
  if (state.status !== 'running') return state;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft <= 0 || state.tracesLeft <= 0) {
    state.status = 'lost';
  } else if (state.puzzle.missingIndices.every((i) => state.userInput.get(i) === state.puzzle.solution[i])) {
    state.status = 'won';
  }
  return state;
}

export function describeProgram(puzzle: HackPuzzle, user: Map<number, string>): string[] {
  return puzzle.program.map((node, i) => {
    const filled = user.get(i) ?? '';
    return puzzle.missingIndices.includes(i)
      ? `  ${String(i).padStart(2)}: ${(filled || '??').padEnd(4)}`
      : `  ${String(i).padStart(2)}: ${node.text.padEnd(4)}`;
  });
}
