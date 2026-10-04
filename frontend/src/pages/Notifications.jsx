import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BellIcon, ClipboardDocumentListIcon, UserPlusIcon, CpuChipIcon, WrenchScrewdriverIcon,
  ExclamationTriangleIcon, Cog6ToothIcon, CheckIcon, CheckCircleIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { notificationService } from '../services/notificationService';
import { useNotifications } from '../hooks/useNotifications';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { NOTIFICATION_TYPES } from '../utils/constants';
import { formatDateTime, formatRelative } from '../utils/formatters';

const PAGE_SIZE = 15;

const TYPE_ICONS = {
  work_order: ClipboardDocumentListIcon,
  assignment: UserPlusIcon,
  ai_prediction: CpuChipIcon,
  maintenance_due: WrenchScrewdriverIcon,
  anomaly_detected: ExclamationTriangleIcon,
  system: Cog6ToothIcon,
};

const ICON_COLORS = {
  info: 'bg-blue-100 text-blue-600',
  warning: 'bg-yellow-100 text-yellow-600',
  critical: 'bg-red-100 text-red-600',
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'system', label: 'System-generated' },
];

const SYSTEM_TYPES = ['system', 'ai_prediction', 'maintenance_due', 'anomaly_detected'];

const ENTITY_ROUTES = {
  work_order: (id) => `/work-orders/${id}`,
  asset: (id) => `/assets/${id}`,
  maintenance_plan: () => '/maintenance',
  maintenance: () => '/maintenance',
  ai_prediction: () => '/ai',
  ai_run: () => '/ai',
};

function targetFor(n) {
  if (!n.related_entity_type || !n.related_entity_id) return null;
  const fn = ENTITY_ROUTES[n.related_entity_type];
  return fn ? fn(n.related_entity_id) : null;
}

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { fetchNotifications } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') || 'all';
  const severity = searchParams.get('severity') || '';
  const unreadOnly = searchParams.get('unread') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const [prefs, setPrefs] = useState(() =>
    Object.keys(NOTIFICATION_TYPES).reduce((acc, k) => ({ ...acc, [k]: { inApp: true, email: k !== 'system' } }), {})
  );
  const [showPrefs, setShowPrefs] = useState(false);
  const [searchText, setSearchText] = useState('');

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => {
      if (v === '' || v == null || v === false || (k === 'page' && v === 1) || (k === 'tab' && v === 'all')) next.delete(k);
      else next.set(k, String(v));
    });
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  const effectiveSeverity = tab === 'urgent' ? 'critical' : severity;
  const effectiveUnread = tab === 'unread' || unreadOnly;

  const params = { page, limit: PAGE_SIZE };
  if (effectiveUnread) params.unread_only = 'true';
  if (effectiveSeverity) params.severity = effectiveSeverity;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => (await notificationService.getAll(params)).data,
    placeholderData: keepPreviousData,
  });

  const afterChange = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    if (fetchNotifications) fetchNotifications();
  };

  const markRead = useMutation({ mutationFn: (id) => notificationService.markRead(id), onSuccess: afterChange });
  const markAll = useMutation({ mutationFn: () => notificationService.markAllRead(), onSuccess: afterChange });

  const all = data?.data || [];
  const items = useMemo(() => {
    let list = all;
    if (tab === 'read') list = list.filter((n) => n.is_read);
    else if (tab === 'system') list = list.filter((n) => SYSTEM_TYPES.includes(n.type));
    const q = searchText.trim().toLowerCase();
    if (q) list = list.filter((n) => `${n.title || ''} ${n.message || ''}`.toLowerCase().includes(q));
    return list;
  }, [all, tab, searchText]);

  const pagination = data?.pagination;
  const unreadCount = data?.unread_count ?? 0;

  const handleClick = (n) => {
    if (!n.is_read) markRead.mutate(n.id);
    const to = targetFor(n);
    if (to) navigate(to);
  };

  const togglePref = (type, channel) =>
    setPrefs((p) => ({ ...p, [type]: { ...p[type], [channel]: !p[type][channel] } }));

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Notifications' }]} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">{unreadCount} unread</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowPrefs((s) => !s)}>
            {showPrefs ? 'Hide preferences' : 'Preferences'}
          </button>
          <button className="btn-primary inline-flex items-center gap-2" disabled={unreadCount === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCircleIcon className="h-4 w-4" />Mark all as read
          </button>
        </div>
      </div>

      {markAll.isError && <ErrorAlert message="Could not mark all notifications as read." />}
      {markRead.isError && <ErrorAlert message="Could not mark the notification as read." />}

      {showPrefs && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-900">Notification preferences</h2>
          <p className="text-xs text-gray-500 mb-3">Display only. Changes here are not saved.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr><th className="py-2 pr-4">Type</th><th className="py-2 px-4 text-center">In-app</th><th className="py-2 px-4 text-center">Email</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(NOTIFICATION_TYPES).map(([key, label]) => (
                  <tr key={key}>
                    <td className="py-2 pr-4 text-gray-900">{label}</td>
                    <td className="py-2 px-4 text-center">
                      <input type="checkbox" aria-label={`${label} in-app`} className="h-4 w-4 rounded border-gray-300" checked={prefs[key].inApp} onChange={() => togglePref(key, 'inApp')} />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <input type="checkbox" aria-label={`${label} email`} className="h-4 w-4 rounded border-gray-300" checked={prefs[key].email} onChange={() => togglePref(key, 'email')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => updateParams({ tab: t.key })}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
              {t.key === 'unread' && unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="sm:flex-1">
          <label className="label" htmlFor="notif-search">Search</label>
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="notif-search" type="search" className="input-field pl-9" placeholder="Search title or message..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={effectiveUnread} disabled={tab === 'unread'}
            onChange={(e) => updateParams({ unread: e.target.checked, tab })} />
          Unread only
        </label>
        <div className="sm:w-48">
          <label className="label" htmlFor="notif-severity">Severity</label>
          <select id="notif-severity" className="input-field" value={effectiveSeverity} disabled={tab === 'urgent'}
            onChange={(e) => updateParams({ severity: e.target.value, tab })}>
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        {isFetching && !isLoading && <span className="text-xs text-gray-400">Refreshing...</span>}
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading notifications..." />
      ) : error ? (
        <ErrorAlert message={error?.response?.data?.error?.message || 'Failed to load notifications.'} onRetry={refetch} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={BellIcon} title="No notifications" description="Nothing matches your current filters." />
        </div>
      ) : (
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {items.map((n) => {
            const Icon = TYPE_ICONS[n.type] || BellIcon;
            const to = targetFor(n);
            return (
              <div key={n.id} role={to ? 'button' : undefined} tabIndex={to ? 0 : undefined}
                onClick={() => handleClick(n)}
                onKeyDown={(e) => { if (to && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick(n); } }}
                className={`flex gap-3 p-4 ${n.is_read ? 'bg-white' : 'bg-blue-50/60'} ${to ? 'cursor-pointer hover:bg-gray-50' : ''}`}>
                <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${ICON_COLORS[n.severity] || ICON_COLORS.info}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm ${n.is_read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                    <StatusBadge status={n.severity === 'critical' ? 'critical' : n.severity === 'warning' ? 'warning' : 'info'} label={n.severity ? n.severity.charAt(0).toUpperCase() + n.severity.slice(1) : 'Info'} />
                    <span className="text-xs text-gray-400">{NOTIFICATION_TYPES[n.type] || n.type}</span>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />}
                  </div>
                  {n.message && <p className="mt-1 text-sm text-gray-600 break-words">{n.message}</p>}
                  <p className="mt-1 text-xs text-gray-400" title={formatDateTime(n.created_at)}>{formatRelative(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <button className="shrink-0 self-start p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800" title="Mark as read" aria-label="Mark as read"
                    onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id); }}>
                    <CheckIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={(p) => updateParams({ page: p })} />
    </div>
  );
}
