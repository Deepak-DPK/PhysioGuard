import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AssetDetail from './pages/AssetDetail';
import MaintenanceCalendar from './pages/MaintenanceCalendar';
import MaintenancePlanning from './pages/MaintenancePlanning';
import FailureRisk from './pages/FailureRisk';
import Recommendations from './pages/Recommendations';
import Reliability from './pages/Reliability';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import UserManagement from './pages/UserManagement';
import AuditLogs from './pages/AuditLogs';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="assets/:assetId" element={<AssetDetail />} />
        <Route path="maintenance-calendar" element={<MaintenanceCalendar />} />
        <Route path="maintenance-planning" element={<MaintenancePlanning />} />
        <Route path="failure-risk" element={<FailureRisk />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="reliability" element={<Reliability />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="users" element={<ProtectedRoute roles={['maintenance_admin']}><UserManagement /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute roles={['maintenance_admin', 'operations_manager']}><AuditLogs /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
