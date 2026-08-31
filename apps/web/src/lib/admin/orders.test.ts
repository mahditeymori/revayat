// UNIT VERIFIED — pure state-machine table, no DB.
// updateOrderStatusAdmin itself (which reads/writes via lib/commerce/orders.ts)
// is DB INTEGRATION UNVERIFIED — not exercised here.
import { describe, expect, it } from 'vitest';
import { ALLOWED_TRANSITIONS } from './orderTransitions';

describe('order fulfillment ALLOWED_TRANSITIONS', () => {
  it('allows the normal happy path', () => {
    expect(ALLOWED_TRANSITIONS.pending).toContain('processing');
    expect(ALLOWED_TRANSITIONS.processing).toContain('shipped');
    expect(ALLOWED_TRANSITIONS.shipped).toContain('completed');
  });

  it('allows cancellation only from pending/processing', () => {
    expect(ALLOWED_TRANSITIONS.pending).toContain('canceled');
    expect(ALLOWED_TRANSITIONS.processing).toContain('canceled');
    expect(ALLOWED_TRANSITIONS.shipped).not.toContain('canceled');
  });

  it('treats completed and canceled as terminal', () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.canceled).toEqual([]);
  });

  it('never allows skipping a step (pending -> shipped/completed)', () => {
    expect(ALLOWED_TRANSITIONS.pending).not.toContain('shipped');
    expect(ALLOWED_TRANSITIONS.pending).not.toContain('completed');
  });
});
