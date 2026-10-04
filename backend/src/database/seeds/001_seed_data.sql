-- PhysioGuard - Minimal Bootstrap
-- Creates only the organisation and admin account so the system can be set up through the UI.

-- Organisation
INSERT INTO organisations (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'PhysioHealth Chain', 'physiohealth');

-- Admin user (password: Password123!)
-- Hash generated with bcryptjs rounds=12
INSERT INTO users (id, org_id, email, password_hash, full_name, role) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin@physiohealth.com', '$2a$12$oLO.0WeJ/x1.F3QLZ0qMy.Rijo2uR0bFkdlUnHASv/10MgVmINEVe', 'Sarah Mitchell', 'maintenance_admin');
