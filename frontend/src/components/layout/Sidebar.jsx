import { NavLink } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import {
  HomeIcon, WrenchScrewdriverIcon, ClipboardDocumentListIcon,
  CalendarDaysIcon, CpuChipIcon, LightBulbIcon, ChartBarIcon,
  DocumentChartBarIcon, BellIcon, UsersIcon, ShieldCheckIcon,
  CubeIcon
} from '@heroicons/react/24/outline';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, permission: 'assets:read' },
  { to: '/assets', label: 'Assets', icon: CubeIcon, permission: 'assets:read' },
  { to: '/maintenance-calendar', label: 'Maintenance Calendar', icon: CalendarDaysIcon, permission: 'maintenance:read' },
  { to: '/maintenance-planning', label: 'Planning Board', icon: ClipboardDocumentListIcon, permission: 'work_orders:read' },
  { to: '/failure-risk', label: 'Failure Risk & RUL', icon: CpuChipIcon, permission: 'ai:read' },
  { to: '/recommendations', label: 'AI Recommendations', icon: LightBulbIcon, permission: 'ai:read' },
  { to: '/reliability', label: 'Model Performance', icon: ChartBarIcon, permission: 'ai:read' },
  { to: '/reports', label: 'Reports & Analytics', icon: DocumentChartBarIcon, permission: 'reports:read' },
  { to: '/notifications', label: 'Notifications', icon: BellIcon, permission: 'notifications:read' },
  { to: '/users', label: 'User Management', icon: UsersIcon, permission: 'users:read' },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheckIcon, permission: 'audit:read' },
];

export default function Sidebar({ open, onClose }) {
  const { can } = usePermissions();

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <WrenchScrewdriverIcon className="h-8 w-8 text-primary-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">PhysioGuard</h1>
            <p className="text-xs text-gray-500">Maintenance Suite</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.filter((item) => can(item.permission)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
