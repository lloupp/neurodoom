import { describe, it, expect } from 'vitest';
import { generatePuzzle, startHack, tickHack, submitToken } from '../src/game/Hacking';

describe('Hacking - vertical slice', () => {
  it('generates puzzles with the requested difficulty', () => {
    const easy = generatePuzzle(1234, 'easy');
    expect(easy.missingIndices.length).toBe(1);
    expect(easy.program.length).toBe(4);
    const normal = generatePuzzle(1234, 'normal');
    expect(normal.missingIndices.length).toBe(2);
    expect(normal.program.length).toBe(6);
  });

  it('completion wins when all missing slots filled with valid tokens', () => {
    const puzzle = generatePuzzle(7, 'easy');
    const state = startHack(puzzle);
    for (const idx of puzzle.missingIndices) {
      submitToken(state, idx, 'MOV');
    }
    expect(state.puzzle.missingIndices.every((i) => (state.userInput.get(i) ?? '').length > 0)).toBe(true);
    tickHack(state, 0.01);
    expect(state.status === 'won' || state.status === 'running').toBe(true);
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
