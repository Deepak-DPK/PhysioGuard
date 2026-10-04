const ROLE_PERMISSIONS = {
  maintenance_admin: [
    'assets:read', 'assets:create', 'assets:update', 'assets:delete',
    'work_orders:read', 'work_orders:create', 'work_orders:update', 'work_orders:approve', 'work_orders:close',
    'maintenance:read', 'maintenance:create', 'maintenance:update',
    'inspections:read', 'inspections:create',
    'technicians:read', 'technicians:manage',
    'ai:read', 'ai:execute', 'ai:review',
    'reports:read', 'reports:export',
    'users:read', 'users:create', 'users:update', 'users:delete',
    'audit:read',
    'settings:read', 'settings:update',
    'notifications:read',
  ],
  technician: [
    'assets:read',
    'work_orders:read', 'work_orders:create', 'work_orders:update', 'work_orders:close',
    'maintenance:read',
    'inspections:read', 'inspections:create',
    'technicians:read',
    'ai:read',
    'reports:read',
    'notifications:read',
  ],
  operations_manager: [
    'assets:read', 'assets:create', 'assets:update',
    'work_orders:read', 'work_orders:create', 'work_orders:update', 'work_orders:approve', 'work_orders:close',
    'maintenance:read', 'maintenance:create', 'maintenance:update',
    'inspections:read', 'inspections:create',
    'technicians:read',
    'ai:read', 'ai:execute', 'ai:review',
    'reports:read', 'reports:export',
    'audit:read',
    'notifications:read',
  ],
  vendor: [
    'assets:read:own',
    'work_orders:read:own',
    'notifications:read',
  ],
};

export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export function hasRole(userRole, ...roles) {
  return roles.includes(userRole);
}
