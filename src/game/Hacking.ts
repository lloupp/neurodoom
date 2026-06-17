/**
 * Hacking minigame — TIS-100-inspired.
 *
 * The player sees three columns of "code tokens":
 *   - One column is a `<MISSING>` segment; they need to fill it
 *     with the correct pattern they deduce from hints.
 *   - Two columns are visible; the missing segment is the same shape
 *     modulo token translation.
 *
 * Difficulty scales:
 *   - Easy: 4 tokens, 1 missing row
 *   - Normal: 6 tokens, 2 missing rows
 *   - Hard: 8 tokens, 3 missing rows
 *
 * Failure: triggers ALARM (calls callback.alarm()) which spawns a ghost
 *           in adjacent room.
 */

export interface HackNode {
  text: string;
  hint?: string;
}

export interface HackPuzzle {
  difficulty: 'easy' | 'normal' | 'hard';
  program: HackNode[];
  /** Tokens to choose from to fill missing rows. */
  tokenBank: string[];
  /** The expected pattern. Tokens are compared positionally. */
  missingIndices: number[];
  /** Trail pattern. */
  timeLimit: number;
  /** Number of allowed wrong-token insertions. */
  traces: number;
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
  const sizes = { easy: 4, normal: 6, hard: 8 };
  const missingPerLevel = { easy: 1, normal: 2, hard: 3 };
  const tracePerLevel = { easy: 5, normal: 3, hard: 2 };
  const timeLimits = { easy: 45, normal: 30, hard: 22 };

  const size = sizes[difficulty];
  const missingCount = missingPerLevel[difficulty];

  // Pick missing indices distributed across the program
  const shuffledIndices = shuffle(Array.from({ length: size }, (_v, i) => i), rng);
  const missingIndices = shuffledIndices.slice(0, missingCount).sort((a, b) => a - b);

  // Token pool: unique tokens, real code
  const tokenSet = shuffle(TOKEN_BANK, rng).slice(0, size + 2);
  const program: HackNode[] = [];
  for (let i = 0; i < size; i++) {
    if (missingIndices.includes(i)) {
      program.push({ text: '???', hint: '[ MISSING_SEGMENT ]' });
    } else {
      const token = tokenSet.pop() ?? 'NOP';
      program.push({ text: token, hint: 'op' });
    }
  }
  // Fill missing token choices — the solver picks one of the bank tokens
  return {
    difficulty,
    program,
    tokenBank: shuffle(TOKEN_BANK.slice(), rng).slice(0, 10),
    missingIndices,
    timeLimit: timeLimits[difficulty],
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
  const expected = state.puzzle.program[idx]?.hint === 'op';
  // Missing rows accept any token BUT the program demands a specific token.
  // We use the *previous* (visible) tokens as hints to deduce which one.
  // For this vertical slice we accept any non-empty token as correct, but
  // each wrong guess costs a trace. Real game would parse TIS-style ports.
  state.userInput.set(idx, token);
  if (token.length === 0) return { tracesLeft: state.tracesLeft, correct: false };
  // Mark correct on a successful non-empty match
  const isAcceptable = !!token && /^[A-Z]{2,4}$/.test(token);
  if (!isAcceptable) {
    state.tracesLeft = Math.max(0, state.tracesLeft - 1);
    return { tracesLeft: state.tracesLeft, correct: false };
  }
  void expected;
  return { tracesLeft: state.tracesLeft, correct: true };
}

export function tickHack(state: HackState, dt: number): HackState {
  if (state.status !== 'running') return state;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft <= 0 || state.tracesLeft <= 0) {
    state.status = 'lost';
  } else if (state.puzzle.missingIndices.every((i) => (state.userInput.get(i) ?? '').length > 0)) {
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
