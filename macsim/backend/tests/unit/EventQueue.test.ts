import { describe, it, expect } from 'vitest';
import { EventQueue } from '../../src/engine/EventQueue.js';

describe('EventQueue (Min-Heap Priority Queue)', () => {
  it('should maintain events in chronological order', () => {
    const queue = new EventQueue();

    queue.push({ id: 'e1', time: 100, priority: 1, type: 'TX', handler: () => {} });
    queue.push({ id: 'e2', time: 50, priority: 1, type: 'TX', handler: () => {} });
    queue.push({ id: 'e3', time: 75, priority: 1, type: 'TX', handler: () => {} });

    expect(queue.pop()?.id).toBe('e2');
    expect(queue.pop()?.id).toBe('e3');
    expect(queue.pop()?.id).toBe('e1');
    expect(queue.isEmpty()).toBe(true);
  });

  it('should break ties using priority then FIFO sequenceNumber', () => {
    const queue = new EventQueue();

    // Identical time, different priority
    queue.push({ id: 'low_prio', time: 100, priority: 5, type: 'TX', handler: () => {} });
    queue.push({ id: 'high_prio', time: 100, priority: 1, type: 'TX', handler: () => {} });

    expect(queue.pop()?.id).toBe('high_prio');
    expect(queue.pop()?.id).toBe('low_prio');

    // Identical time and priority -> FIFO sequence order
    queue.push({ id: 'first', time: 200, priority: 2, type: 'A', handler: () => {} });
    queue.push({ id: 'second', time: 200, priority: 2, type: 'B', handler: () => {} });

    expect(queue.pop()?.id).toBe('first');
    expect(queue.pop()?.id).toBe('second');
  });
});

