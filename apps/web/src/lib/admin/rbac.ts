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

// Proxy-layer route gate (defense in depth ahead of each page's own
// requirePermission() call). Uses the LIST-level permission for a section
// (e.g. 'coupons.view', not 'coupons.manage') — safe only because every role
// above holds a section's .view/.manage-equivalent permissions as a matched
// pair (no role has one without the other). If MATRIX is ever changed to
// break that pairing, this table must gain per-subpath entries too.
const ROUTE_PERMISSIONS: { prefix: string; permission: Permission }[] = [
  { prefix: '/admin/admins', permission: 'admins.manage' },
  { prefix: '/admin/categories', permission: 'categories.manage' },
  { prefix: '/admin/coupons', permission: 'coupons.view' },
  { prefix: '/admin/inbox', permission: 'support.manage' },
  { prefix: '/admin/inventory', permission: 'inventory.manage' },
  { prefix: '/admin/orders', permission: 'orders.view' },
  { prefix: '/admin/payments', permission: 'payments.view' },
  { prefix: '/admin/products', permission: 'products.manage' },
  { prefix: '/admin/settings', permission: 'settings.manage' },
  { prefix: '/admin/support', permission: 'support.manage' },
];

export function permissionForPath(pathname: string): Permission | null {
  if (pathname === '/admin') return 'dashboard.view';
  const match = ROUTE_PERMISSIONS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return match ? match.permission : null;
}
