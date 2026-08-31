// UNIT VERIFIED — pure matrix lookup, no DB.
import { describe, expect, it } from 'vitest';
import { hasPermission } from './rbac';

describe('hasPermission', () => {
  it('grants owner every permission', () => {
    expect(hasPermission('owner', 'admins.manage')).toBe(true);
    expect(hasPermission('owner', 'payments.inquiry')).toBe(true);
  });

  it('denies admin the owner-only admins.manage permission', () => {
    expect(hasPermission('admin', 'admins.manage')).toBe(false);
    expect(hasPermission('admin', 'payments.inquiry')).toBe(true);
  });

  it('restricts editor to content-only permissions', () => {
    expect(hasPermission('editor', 'products.manage')).toBe(true);
    expect(hasPermission('editor', 'payments.view')).toBe(false);
    expect(hasPermission('editor', 'orders.manage')).toBe(false);
  });

  it('restricts support to orders/payments-view/customers, no product or security access', () => {
    expect(hasPermission('support', 'orders.manage')).toBe(true);
    expect(hasPermission('support', 'payments.view')).toBe(true);
    expect(hasPermission('support', 'payments.inquiry')).toBe(false);
    expect(hasPermission('support', 'products.manage')).toBe(false);
    expect(hasPermission('support', 'admins.manage')).toBe(false);
  });
});
