import { ScheduledEvent } from '../types/event.types.js';

/**
 * Min-Heap Priority Queue for Discrete Event Simulation.
 * Guarantees strict determinism via (time, priority, sequenceNumber) ordering.
 */
export class EventQueue {
  private heap: ScheduledEvent[] = [];
  private sequenceCounter: number = 0;

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public clear(): void {
    this.heap = [];
    this.sequenceCounter = 0;
  }

  public push(
    event: Omit<ScheduledEvent, 'sequenceNumber'> & { sequenceNumber?: number }
  ): ScheduledEvent {
    const fullEvent: ScheduledEvent = {
      ...event,
      sequenceNumber: event.sequenceNumber ?? ++this.sequenceCounter,
    };

    this.heap.push(fullEvent);
    this.bubbleUp(this.heap.length - 1);
    return fullEvent;
  }

  public pop(): ScheduledEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return min;
  }

  public peek(): ScheduledEvent | undefined {
    return this.heap.length > 0 ? this.heap[0] : undefined;
  }

  /**
   * Compare two events: returns negative if a < b, positive if a > b, 0 if equal.
   */
  private compare(a: ScheduledEvent, b: ScheduledEvent): number {
    // 1. Time comparison (floating-point microseconds with epsilon)
    const timeDiff = a.time - b.time;
    if (Math.abs(timeDiff) > 1e-9) {
      return timeDiff;
    }

    // 2. Priority comparison (lower priority number executes first)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // 3. FIFO sequence number comparison
    return a.sequenceNumber - b.sequenceNumber;
  }

  private bubbleUp(index: number): void {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];

      if (this.compare(element, parent) >= 0) break;

      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = element;
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let swapIndex = -1;

      if (leftChildIndex < length) {
        if (this.compare(this.heap[leftChildIndex], element) < 0) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const compareTarget = swapIndex === -1 ? element : this.heap[leftChildIndex];
        if (this.compare(this.heap[rightChildIndex], compareTarget) < 0) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === -1) break;

      this.heap[index] = this.heap[swapIndex];
      index = swapIndex;
    }
    this.heap[index] = element;
  }
}

