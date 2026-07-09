import { describe, it, expect } from 'vitest';
import { generatePuzzle, startHack, tickHack, submitToken, describeProgram } from '../src/game/Hacking';

describe('Hacking edge cases', () => {
  it('submitToken when status is already won returns no-op', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    // Fill all missing and tick to win
    for (const idx of puzzle.missingIndices) {
      submitToken(state, idx, puzzle.solution[idx]!);
    }
    tickHack(state, 0.01);
    expect(state.status).toBe('won');
    // Now try to submit after game is won
    const result = submitToken(state, puzzle.missingIndices[0]!, 'ADD');
    expect(result.correct).toBe(false);
    expect(result.tracesLeft).toBe(state.tracesLeft); // unchanged
  });

  it('submitToken when status is lost returns no-op', () => {
    const puzzle = generatePuzzle(42, 'hard');
    const state = startHack(puzzle);
    tickHack(state, puzzle.timeLimit + 1);
    expect(state.status).toBe('lost');
    const result = submitToken(state, puzzle.missingIndices[0]!, 'MOV');
    expect(result.correct).toBe(false);
  });

  it('submitToken with empty string returns correct=false', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    const result = submitToken(state, puzzle.missingIndices[0]!, '');
    expect(result.correct).toBe(false);
    expect(state.tracesLeft).toBe(puzzle.traces); // no trace drain for empty
  });

  it('submitToken with lowercase token is rejected (only uppercase 2-4 chars)', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    const before = state.tracesLeft;
    const result = submitToken(state, puzzle.missingIndices[0]!, 'mov');
    expect(result.correct).toBe(false);
    expect(state.tracesLeft).toBeLessThan(before); // drains a trace
  });

  it('submitToken with 5+ char token is rejected', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    const before = state.tracesLeft;
    const result = submitToken(state, puzzle.missingIndices[0]!, 'MOOVS');
    expect(result.correct).toBe(false);
    expect(state.tracesLeft).toBeLessThan(before);
  });

  it('submitToken with 1-char token is rejected', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    const before = state.tracesLeft;
    const result = submitToken(state, puzzle.missingIndices[0]!, 'M');
    expect(result.correct).toBe(false);
    expect(state.tracesLeft).toBeLessThan(before);
  });

  it('submitToken with special chars is rejected', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    const before = state.tracesLeft;
    const result = submitToken(state, puzzle.missingIndices[0]!, '&& !');
    expect(result.correct).toBe(false);
    expect(state.tracesLeft).toBeLessThanOrEqual(before);
  });

  it('traces hitting zero causes loss', () => {
    const puzzle = generatePuzzle(42, 'hard'); // hard = 2 traces
    const state = startHack(puzzle);
    // Submit invalid tokens to drain all traces
    let attempts = 0;
    while (state.tracesLeft > 0 && attempts < 20) {
      submitToken(state, puzzle.missingIndices[0]!, 'invalid');
      attempts++;
    }
    tickHack(state, 0.01);
    expect(state.status).toBe('lost');
  });

  it('tickHack does not mutate state when status is not running', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    // Force a win
    for (const idx of puzzle.missingIndices) {
      submitToken(state, idx, puzzle.solution[idx]!);
    }
    tickHack(state, 0.01);
    expect(state.status).toBe('won');
    const timeBefore = state.timeLeft;
    tickHack(state, 5); // should be no-op
    expect(state.timeLeft).toBe(timeBefore);
  });

  it('describeProgram returns correct length matching program', () => {
    const puzzle = generatePuzzle(42, 'normal');
    const user = new Map<number, string>();
    const lines = describeProgram(puzzle, user);
    expect(lines.length).toBe(puzzle.program.length);
  });

  it('describeProgram shows ?? for unfilled missing indices', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const user = new Map<number, string>();
    const lines = describeProgram(puzzle, user);
    for (const idx of puzzle.missingIndices) {
      expect(lines[idx]).toContain('??');
    }
  });

  it('describeProgram shows filled token for completed missing indices', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const user = new Map<number, string>([[puzzle.missingIndices[0]!, 'MOV']]);
    const lines = describeProgram(puzzle, user);
    expect(lines[puzzle.missingIndices[0]!]).toContain('MOV');
    expect(lines[puzzle.missingIndices[0]!]).not.toContain('??');
  });

  it('generatePuzzle with easy difficulty has correct structure', () => {
    const puzzle = generatePuzzle(999, 'easy');
    expect(puzzle.difficulty).toBe('easy');
    expect(puzzle.program.length).toBe(6);
    expect(puzzle.missingIndices.length).toBe(1);
    expect(puzzle.traces).toBe(5);
    expect(puzzle.timeLimit).toBe(18);
  });

  it('generatePuzzle with normal difficulty has correct structure', () => {
    const puzzle = generatePuzzle(999, 'normal');
    expect(puzzle.program.length).toBe(9);
    expect(puzzle.missingIndices.length).toBe(2);
    expect(puzzle.traces).toBe(3);
    expect(puzzle.timeLimit).toBe(27);
  });

  it('generatePuzzle with hard difficulty has correct structure', () => {
    const puzzle = generatePuzzle(999, 'hard');
    expect(puzzle.program.length).toBe(12);
    expect(puzzle.missingIndices.length).toBe(3);
    expect(puzzle.traces).toBe(2);
    expect(puzzle.timeLimit).toBe(36);
  });

  it('generatePuzzle is deterministic for same seed', () => {
    const a = generatePuzzle(12345, 'normal');
    const b = generatePuzzle(12345, 'normal');
    expect(a.program.map((n) => n.text)).toEqual(b.program.map((n) => n.text));
    expect(a.missingIndices).toEqual(b.missingIndices);
    expect(a.tokenBank).toEqual(b.tokenBank);
  });

  it('generatePuzzle produces different puzzles for different seeds', () => {
    const a = generatePuzzle(1, 'normal');
    const b = generatePuzzle(2, 'normal');
    // Not guaranteed but extremely unlikely to be identical
    const same = a.program.map((n) => n.text).join() === b.program.map((n) => n.text).join();
    expect(same).toBe(false);
  });

  it('token bank has at most 10 tokens', () => {
    const puzzle = generatePuzzle(42, 'hard');
    expect(puzzle.tokenBank.length).toBeLessThanOrEqual(10);
  });

  it('submitToken on a non-missing index is rejected (not editable)', () => {
    const puzzle = generatePuzzle(42, 'easy');
    const state = startHack(puzzle);
    // Find an index that is NOT missing
    const nonMissing = Array.from({ length: puzzle.program.length }, (_, i) => i)
      .filter((i) => !puzzle.missingIndices.includes(i))[0]!;
    const result = submitToken(state, nonMissing, 'XOR');
    // Non-missing rows should not accept user input — no-op
    expect(result.correct).toBe(false);
    expect(result.tracesLeft).toBe(state.tracesLeft); // no trace drain
    expect(state.userInput.get(nonMissing)).toBeUndefined();
  });

  it('missing indices are sorted ascending', () => {
    const puzzle = generatePuzzle(42, 'hard');
    const sorted = [...puzzle.missingIndices].sort((a, b) => a - b);
    expect(puzzle.missingIndices).toEqual(sorted);
  });
});
