// Pure stock-adjustment math, split out of inventory.ts (which pulls in
// 'server-only' + DB + the transactional row lock) so the negative-stock
// rule is testable without a database — mirrors lib/commerce/checkoutValidation.ts's
// split. The transactional enforcement (for('update') row lock, insert of the
// adjustment audit row) stays in inventory.ts; this only decides the number.
export class NegativeStockError extends Error {
  constructor() {
    super('موجودی نمی‌تواند منفی شود.');
    this.name = 'NegativeStockError';
  }
}

export function computeResultingStock(currentStock: number, delta: number): number {
  const resulting = currentStock + delta;
  if (resulting < 0) throw new NegativeStockError();
  return resulting;
}
