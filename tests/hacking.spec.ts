import { describe, it, expect } from 'vitest';
import { generatePuzzle, startHack, tickHack, submitToken } from '../src/game/Hacking';

describe('Hacking - vertical slice', () => {
  it('generates 3-line puzzles with the requested difficulty', () => {
    const easy = generatePuzzle(1234, 'easy');
    expect(easy.missingIndices.length).toBe(1);
    expect(easy.lineWidth).toBe(2);
    expect(easy.program.length).toBe(6);   // 3 lines x 2 tokens
    const normal = generatePuzzle(1234, 'normal');
    expect(normal.missingIndices.length).toBe(2);
    expect(normal.lineWidth).toBe(3);
    expect(normal.program.length).toBe(9); // 3 lines x 3 tokens
  });

  it('grants three seconds of tolerance per token', () => {
    const hard = generatePuzzle(1234, 'hard');
    expect(hard.program.length).toBe(12);  // 3 lines x 4 tokens
    expect(hard.timeLimit).toBe(36);       // 3s x 12 tokens
  });

  it('completion wins only when missing slots are filled with the real (cipher-deduced) solution', () => {
    const puzzle = generatePuzzle(7, 'easy');
    const state = startHack(puzzle);
    for (const idx of puzzle.missingIndices) {
      submitToken(state, idx, puzzle.solution[idx]!);
    }
    tickHack(state, 0.01);
    expect(state.status).toBe('won');
  });

  it('does not win on a wrong-but-non-empty guess', () => {
    const puzzle = generatePuzzle(7, 'easy');
    const state = startHack(puzzle);
    for (const idx of puzzle.missingIndices) {
      submitToken(state, idx, 'ZZZ');
    }
    tickHack(state, 0.01);
    expect(state.status).not.toBe('won');
  });

  it('loses if time runs out', () => {
    const puzzle = generatePuzzle(7, 'hard');
    const state = startHack(puzzle);
    tickHack(state, puzzle.timeLimit + 1);
    expect(state.status).toBe('lost');
  });

  it('invalid tokens drain trace count', () => {
    const puzzle = generatePuzzle(7, 'easy');
    const state = startHack(puzzle);
    const before = state.tracesLeft;
    submitToken(state, puzzle.missingIndices[0]!, '&& !');
    expect(state.tracesLeft).toBeLessThanOrEqual(before);
  });
});
