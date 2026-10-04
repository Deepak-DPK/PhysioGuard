-- PhysioGuard Smart Asset Reliability & Maintenance Suite
-- Initial Database Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE DOMAIN
-- ============================================================

CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('maintenance_admin', 'technician', 'operations_manager', 'vendor')),
  is_active BOOLEAN DEFAULT TRUE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE roles_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(30) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- ============================================================
-- ASSET MANAGEMENT
-- ============================================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  parent_id UUID REFERENCES locations(id),
  floor VARCHAR(20),
  building VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  location_id UUID REFERENCES locations(id),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('therapy_bed', 'electrotherapy_unit', 'exercise_equipment', 'mobility_aid', 'treatment_room')),
  serial_number VARCHAR(100),
  model VARCHAR(200),
  manufacturer VARCHAR(200),
  install_date TIMESTAMPTZ,
  warranty_expiry TIMESTAMPTZ,
  criticality VARCHAR(10) DEFAULT 'medium' CHECK (criticality IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'under_maintenance', 'decommissioned')),
  owner_id UUID REFERENCES users(id),
  runtime_hours NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE asset_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  part_number VARCHAR(100),
  install_date TIMESTAMPTZ,
  expected_life_hours NUMERIC(10, 2),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE warranties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  vendor VARCHAR(200),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  coverage_details TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meters_sensors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  unit VARCHAR(50),
  type VARCHAR(10) CHECK (type IN ('meter', 'sensor')),
  current_value NUMERIC(15, 4),
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_id UUID NOT NULL REFERENCES meters_sensors(id),
  asset_id UUID NOT NULL REFERENCES assets(id),
  value NUMERIC(15, 4) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  raw JSONB
);

-- ============================================================
-- MAINTENANCE
-- ============================================================

CREATE TABLE technicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  org_id UUID NOT NULL REFERENCES organisations(id),
  skills JSONB DEFAULT '[]',
  certifications JSONB DEFAULT '[]',
  availability_status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  org_id UUID NOT NULL REFERENCES organisations(id),
  name VARCHAR(300) NOT NULL,
  frequency_days INT NOT NULL,
  last_performed TIMESTAMPTZ,
  next_due TIMESTAMPTZ,
  required_skill VARCHAR(200),
  estimated_hours NUMERIC(6, 2),
  status VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  org_id UUID NOT NULL REFERENCES organisations(id),
  plan_id UUID REFERENCES maintenance_plans(id),
  title VARCHAR(300) NOT NULL,
  type VARCHAR(15) NOT NULL CHECK (type IN ('preventive', 'corrective', 'emergency')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'pending_review', 'approved', 'rejected', 'closed')),
  assigned_to UUID REFERENCES users(id),
  skill_required VARCHAR(200),
  estimated_downtime_hours NUMERIC(6, 2),
  actual_downtime_hours NUMERIC(6, 2),
  parts_used JSONB DEFAULT '[]',
  evidence_urls JSONB DEFAULT '[]',
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE spare_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  name VARCHAR(200) NOT NULL,
  part_number VARCHAR(100),
  quantity_on_hand INT DEFAULT 0,
  min_quantity INT DEFAULT 0,
  supplier VARCHAR(200),
  unit_cost NUMERIC(10, 2),
  location VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE downtime_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  work_order_id UUID REFERENCES work_orders(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  reason TEXT,
  cost_impact NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  org_id UUID NOT NULL REFERENCES organisations(id),
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  checklist JSONB DEFAULT '[]',
  findings TEXT,
  status VARCHAR(15) DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed')),
  images_urls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  work_order_id UUID REFERENCES work_orders(id),
  description TEXT,
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ,
  cost NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI / PREDICTIONS
-- ============================================================

CREATE TABLE model_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  asset_class VARCHAR(30),
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  metrics JSONB DEFAULT '{}'
);

CREATE TABLE health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  score NUMERIC(5, 2) NOT NULL,
  factors JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE failure_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  model_version VARCHAR(50),
  risk_score NUMERIC(5, 2),
  rul_days INT,
  confidence NUMERIC(5, 4),
  input_snapshot JSONB,
  explanation TEXT,
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  review_decision VARCHAR(15) DEFAULT 'pending' CHECK (review_decision IN ('pending', 'approved', 'rejected', 'overridden')),
  review_reason TEXT,
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE ai_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  run_type VARCHAR(50) NOT NULL,
  asset_id UUID REFERENCES assets(id),
  input_snapshot JSONB,
  output JSONB,
  model_version VARCHAR(50),
  confidence NUMERIC(5, 4),
  latency_ms INT,
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ai_run_id UUID NOT NULL REFERENCES ai_runs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  was_correct BOOLEAN,
  correction JSONB,
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYSTEM
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(300) NOT NULL,
  message TEXT,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  severity VARCHAR(10) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organisations(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  previous_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  outcome VARCHAR(20) DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  storage_url TEXT NOT NULL,
  checksum VARCHAR(64),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organisations(id),
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, key)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_assets_org ON assets(org_id);
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_criticality ON assets(criticality);
CREATE INDEX idx_assets_location ON assets(location_id);
CREATE INDEX idx_telemetry_asset ON telemetry(asset_id);
CREATE INDEX idx_telemetry_sensor ON telemetry(sensor_id);
CREATE INDEX idx_telemetry_timestamp ON telemetry(timestamp DESC);
CREATE INDEX idx_work_orders_org ON work_orders(org_id);
CREATE INDEX idx_work_orders_asset ON work_orders(asset_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_priority ON work_orders(priority);
CREATE INDEX idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX idx_maintenance_plans_asset ON maintenance_plans(asset_id);
CREATE INDEX idx_maintenance_plans_next_due ON maintenance_plans(next_due);
CREATE INDEX idx_inspections_asset ON inspections(asset_id);
CREATE INDEX idx_health_scores_asset ON health_scores(asset_id);
CREATE INDEX idx_failure_predictions_asset ON failure_predictions(asset_id);
CREATE INDEX idx_ai_runs_org ON ai_runs(org_id);
CREATE INDEX idx_ai_runs_asset ON ai_runs(asset_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_downtime_asset ON downtime_events(asset_id);
CREATE INDEX idx_spare_parts_org ON spare_parts(org_id);
