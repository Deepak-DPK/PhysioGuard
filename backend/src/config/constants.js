const ROLES = {
  MAINTENANCE_ADMIN: 'maintenance_admin',
  TECHNICIAN: 'technician',
  OPERATIONS_MANAGER: 'operations_manager',
  VENDOR: 'vendor',
};

const ASSET_CATEGORIES = {
  THERAPY_BED: 'therapy_bed',
  ELECTROTHERAPY_UNIT: 'electrotherapy_unit',
  EXERCISE_EQUIPMENT: 'exercise_equipment',
  MOBILITY_AID: 'mobility_aid',
  TREATMENT_ROOM: 'treatment_room',
};

const ASSET_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNDER_MAINTENANCE: 'under_maintenance',
  DECOMMISSIONED: 'decommissioned',
};

const CRITICALITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const WORK_ORDER_TYPE = {
  PREVENTIVE: 'preventive',
  CORRECTIVE: 'corrective',
  EMERGENCY: 'emergency',
};

const WORK_ORDER_STATUS = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLOSED: 'closed',
};

const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const MAINTENANCE_PLAN_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

const INSPECTION_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const AI_REVIEW_DECISION = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  OVERRIDDEN: 'overridden',
};

const NOTIFICATION_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

const SENSOR_TYPE = {
  METER: 'meter',
  SENSOR: 'sensor',
};

const ROLE_PERMISSIONS = {
  [ROLES.MAINTENANCE_ADMIN]: [
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
  [ROLES.TECHNICIAN]: [
    'assets:read',
    'work_orders:read', 'work_orders:create', 'work_orders:update', 'work_orders:close',
    'maintenance:read',
    'inspections:read', 'inspections:create',
    'technicians:read',
    'ai:read',
    'reports:read',
    'notifications:read',
  ],
  [ROLES.OPERATIONS_MANAGER]: [
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
  [ROLES.VENDOR]: [
    'assets:read:own',
    'work_orders:read:own',
    'notifications:read',
  ],
};

module.exports = {
  ROLES,
  ASSET_CATEGORIES,
  ASSET_STATUS,
  CRITICALITY,
  WORK_ORDER_TYPE,
  WORK_ORDER_STATUS,
  PRIORITY,
  MAINTENANCE_PLAN_STATUS,
  INSPECTION_STATUS,
  AI_REVIEW_DECISION,
  NOTIFICATION_SEVERITY,
  SENSOR_TYPE,
  ROLE_PERMISSIONS,
};
