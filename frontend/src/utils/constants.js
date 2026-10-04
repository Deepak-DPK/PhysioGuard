export const ROLES = {
  MAINTENANCE_ADMIN: 'maintenance_admin',
  TECHNICIAN: 'technician',
  OPERATIONS_MANAGER: 'operations_manager',
  VENDOR: 'vendor',
};

export const ROLE_LABELS = {
  maintenance_admin: 'Maintenance Admin',
  technician: 'Technician',
  operations_manager: 'Operations Manager',
  vendor: 'Vendor',
};

export const ASSET_CATEGORIES = {
  therapy_bed: 'Therapy Bed',
  electrotherapy_unit: 'Electrotherapy Unit',
  exercise_equipment: 'Exercise Equipment',
  mobility_aid: 'Mobility Aid',
  treatment_room: 'Treatment Room',
};

export const ASSET_STATUS = {
  active: 'Active',
  inactive: 'Inactive',
  under_maintenance: 'Under Maintenance',
  decommissioned: 'Decommissioned',
};

export const CRITICALITY = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const WORK_ORDER_STATUS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
};

export const PRIORITY = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const STATUS_COLORS = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  under_maintenance: 'bg-yellow-100 text-yellow-800',
  decommissioned: 'bg-red-100 text-red-800',
  open: 'bg-blue-100 text-blue-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-800',
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
};

export const NOTIFICATION_TYPES = {
  work_order: 'Work Order',
  assignment: 'Assignment',
  ai_prediction: 'AI Prediction',
  maintenance_due: 'Maintenance Due',
  anomaly_detected: 'Anomaly Detected',
  system: 'System',
};
