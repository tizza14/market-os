import { describe, it, expect } from 'vitest';
import { calcBackoffDelay } from './binanceWebSocket.js';

describe('calcBackoffDelay', () => {
  it('attempt=0 → delay=0ms（立即重試）', () => {
    expect(calcBackoffDelay(0)).toBe(0);
  });

  it('attempt=1 → delay=1000ms', () => {
    expect(calcBackoffDelay(1)).toBe(1000);
  });

  it('attempt=2 → delay=2000ms', () => {
    expect(calcBackoffDelay(2)).toBe(2000);
  });

  it('attempt=3 → delay=4000ms', () => {
    expect(calcBackoffDelay(3)).toBe(4000);
  });

  it('attempt=4 → delay=8000ms', () => {
    expect(calcBackoffDelay(4)).toBe(8000);
  });

  it('attempt=5 → delay=16000ms', () => {
    expect(calcBackoffDelay(5)).toBe(16000);
  });

  it('attempt=6 → delay=30000ms（上限截斷）', () => {
    expect(calcBackoffDelay(6)).toBe(30000);
  });

  it('attempt=100 → delay=30000ms（上限不超過）', () => {
    expect(calcBackoffDelay(100)).toBe(30000);
  });

  it('負數 attempt → delay=0ms（防呆）', () => {
    expect(calcBackoffDelay(-1)).toBe(0);
  });
});
