// Role/permission matrix for the admin panel. Authorization is enforced
// SERVER-SIDE ONLY (session.ts's requirePermission) — nothing here decides
// what renders in the UI, since hiding a button is not authorization.
export type AdminRole = 'owner' | 'admin' | 'editor' | 'support';

export type Permission =
  | 'dashboard.view'
  | 'products.manage'
  | 'categories.manage'
  | 'inventory.manage'
  | 'orders.view'
  | 'orders.manage'
  | 'payments.view'
  | 'payments.inquiry'
  | 'coupons.view'
  | 'coupons.manage'
  | 'settings.manage'
  | 'support.manage'
  | 'customers.view'
  | 'admins.manage';

// OWNER: everything, including admin-user management and security settings.
// ADMIN: full commerce operations, but never other admins' accounts.
// EDITOR: products/content only — explicitly no payment, security, or
// admin-user access.
// SUPPORT: orders and customer-facing info, read-only-ish payment visibility,
// no destructive product/security operations.
const MATRIX: Record<AdminRole, Set<Permission>> = {
  owner: new Set<Permission>([
    'dashboard.view',
    'products.manage',
    'categories.manage',
    'inventory.manage',
    'orders.view',
    'orders.manage',
    'payments.view',
    'payments.inquiry',
    'coupons.view',
    'coupons.manage',
    'settings.manage',
    'support.manage',
    'customers.view',
    'admins.manage',
  ]),
  admin: new Set<Permission>([
    'dashboard.view',
    'products.manage',
    'categories.manage',
    'inventory.manage',
    'orders.view',
    'orders.manage',
    'payments.view',
    'payments.inquiry',
    'coupons.view',
    'coupons.manage',
    'settings.manage',
    'support.manage',
    'customers.view',
  ]),
  editor: new Set<Permission>(['dashboard.view', 'products.manage', 'categories.manage', 'support.manage']),
  support: new Set<Permission>(['dashboard.view', 'orders.view', 'orders.manage', 'payments.view', 'customers.view']),
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}
