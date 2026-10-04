import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ClipboardDocumentCheckIcon, Cog6ToothIcon, PencilSquareIcon, XMarkIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { auditService } from '../services/auditService';
import { userService } from '../services/userService';
import { usePermissions } from '../hooks/usePermissions';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { ROLES } from '../utils/constants';
import { formatDateTime } from '../utils/formatters';

const PAGE_SIZE = 20;

const ENTITY_TYPES = ['asset', 'work_order', 'user', 'maintenance_plan', 'inspection', 'technician', 'ai_run', 'notification', 'system_config', 'spare_part'];
const OUTCOMES = ['success', 'failure', 'denied'];

const CATEGORIES = [
  { key: 'ai', label: 'AI settings', hint: 'Prediction and anomaly thresholds', match: (k) => /(^|_)(ai|model|threshold|confidence|anomaly|prediction|health)(_|$)/i.test(k) },
  { key: 'notification', label: 'Notification rules', hint: 'Alert and delivery rules', match: (k) => /(notif|alert|email|reminder|digest)/i.test(k) },
  { key: 'workflow', label: 'Workflow rules', hint: 'Work order and approval rules', match: (k) => /(workflow|work_order|approval|sla|escalat|assign|maintenance)/i.test(k) },
  { key: 'other', label: 'Other', hint: 'Uncategorised settings', match: () => true },
];

const EVENT_CATEGORIES = [
  { key: 'auth', label: 'Auth' },
  { key: 'data', label: 'Data' },
  { key: 'ai', label: 'AI' },
  { key: 'approval', label: 'Approval' },
];

function eventCategory(log) {
  const action = String(log.action || '').toLowerCase();
  const entity = String(log.entity_type || '').toLowerCase();
  if (/(login|logout|log_in|log_out|auth|password|token|session)/.test(action) || entity === 'session') return 'auth';
  if (/(approv|reject|review|deny|denied)/.test(action) || log.outcome === 'denied') return 'approval';
  if (entity === 'ai_run' || /(^|_)(ai|predict|anomaly|rul|recogni[sz]e|summari[sz]e)/.test(action)) return 'ai';
  return 'data';
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportLogsCsv(logs) {
  const header = ['Timestamp', 'User', 'Email', 'Action', 'Category', 'Entity type', 'Entity ID', 'Outcome', 'IP address'];
  const lines = logs.map((l) => [
    l.created_at, l.users?.full_name || 'System', l.users?.email || '', l.action, eventCategory(l),
    l.entity_type || '', l.entity_id || '', l.outcome || 'success', l.ip_address || '',
  ].map(csvCell).join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

const pretty = (s) => String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const errMsg = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;
const outcomeStatus = (o) => (o === 'success' ? 'approved' : o === 'failure' ? 'rejected' : 'warning');

function AuditLogsTab() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ user_id: '', action: '', entity_type: '', outcome: '', from: '', to: '' });
  const [expanded, setExpanded] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [eventCat, setEventCat] = useState('');

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  const params = { page, limit: PAGE_SIZE };
  Object.entries(filters).forEach(([k, v]) => {
    if (!v) return;
    if (k === 'from') params.from = new Date(v).toISOString();
    else if (k === 'to') params.to = new Date(`${v}T23:59:59`).toISOString();
    else params[k] = v.trim();
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => (await auditService.getAll(params)).data,
    placeholderData: keepPreviousData,
  });

  const usersQuery = useQuery({
    queryKey: ['audit-users'],
    queryFn: async () => (await userService.getAll({ limit: 100 })).data.data,
    retry: false,
  });

  const rawLogs = data?.data || [];
  const logs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rawLogs.filter((l) => {
      if (eventCat && eventCategory(l) !== eventCat) return false;
      if (!q) return true;
      return [l.action, l.entity_type, l.entity_id, l.outcome, l.ip_address, l.users?.full_name, l.users?.email]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [rawLogs, searchText, eventCat]);
  const hasFilters = Object.values(filters).some(Boolean) || !!searchText.trim() || !!eventCat;

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="al-search">Search</label>
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="al-search" type="search" className="input-field pl-9" placeholder="Search action, entity type, user..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </div>
        </div>
        <div className="sm:w-48">
          <label className="label" htmlFor="al-category">Event category</label>
          <select id="al-category" className="input-field" value={eventCat} onChange={(e) => setEventCat(e.target.value)}>
            <option value="">All events</option>
            {EVENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <button className="btn-secondary inline-flex items-center justify-center gap-2" disabled={logs.length === 0} onClick={() => exportLogsCsv(logs)}>
          <ArrowDownTrayIcon className="h-4 w-4" />Export CSV
        </button>
      </div>
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div>
          <label className="label" htmlFor="al-user">User</label>
          <select id="al-user" className="input-field" value={filters.user_id} onChange={(e) => setFilter('user_id', e.target.value)}>
            <option value="">All users</option>
            {(usersQuery.data || []).map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="al-action">Action</label>
          <input id="al-action" className="input-field" placeholder="e.g. create" value={filters.action} onChange={(e) => setFilter('action', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="al-entity">Entity type</label>
          <select id="al-entity" className="input-field" value={filters.entity_type} onChange={(e) => setFilter('entity_type', e.target.value)}>
            <option value="">All types</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{pretty(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="al-outcome">Outcome</label>
          <select id="al-outcome" className="input-field" value={filters.outcome} onChange={(e) => setFilter('outcome', e.target.value)}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{pretty(o)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="al-from">From</label>
          <input id="al-from" type="date" className="input-field" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="al-to">To</label>
          <input id="al-to" type="date" className="input-field" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
        </div>
        {hasFilters && (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
            <button className="btn-secondary text-xs" onClick={() => { setFilters({ user_id: '', action: '', entity_type: '', outcome: '', from: '', to: '' }); setSearchText(''); setEventCat(''); setPage(1); }}>Clear all filters</button>
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading audit logs..." />
      ) : error ? (
        <ErrorAlert message={errMsg(error, 'Failed to load audit logs.')} onRetry={refetch} />
      ) : logs.length === 0 ? (
        <div className="card"><EmptyState icon={ClipboardDocumentCheckIcon} title="No audit entries" description={hasFilters ? 'No entries match the selected filters.' : 'No activity has been recorded yet.'} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2 w-8" /><th className="px-4 py-2">User</th><th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Entity type</th><th className="px-4 py-2">Entity ID</th><th className="px-4 py-2">Outcome</th><th className="px-4 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((l) => {
                  const open = expanded === l.id;
                  const hasDetail = l.previous_value || l.new_value || l.ip_address;
                  return [
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2">
                        {hasDetail && (
                          <button aria-label={open ? 'Hide details' : 'Show details'} className="p-1 text-gray-400 hover:text-gray-700" onClick={() => setExpanded(open ? null : l.id)}>
                            {open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium text-gray-900">{l.users?.full_name || 'System'}</p>
                        {l.users?.email && <p className="text-xs text-gray-500">{l.users.email}</p>}
                      </td>
                      <td className="px-4 py-2">{l.action}</td>
                      <td className="px-4 py-2">{l.entity_type ? pretty(l.entity_type) : '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600" title={l.entity_id || ''}>{l.entity_id ? `${l.entity_id.slice(0, 8)}...` : '—'}</td>
                      <td className="px-4 py-2"><StatusBadge status={outcomeStatus(l.outcome)} label={pretty(l.outcome || 'success')} /></td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    </tr>,
                    open && (
                      <tr key={`${l.id}-d`} className="bg-gray-50">
                        <td />
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div><p className="font-semibold text-gray-700 mb-1">Previous value</p><pre className="bg-white border border-gray-200 rounded p-2 overflow-auto max-h-48">{l.previous_value ? JSON.stringify(l.previous_value, null, 2) : '—'}</pre></div>
                            <div><p className="font-semibold text-gray-700 mb-1">New value</p><pre className="bg-white border border-gray-200 rounded p-2 overflow-auto max-h-48">{l.new_value ? JSON.stringify(l.new_value, null, 2) : '—'}</pre></div>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">IP: {l.ip_address || '—'} &middot; Entity ID: {l.entity_id || '—'}</p>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="px-2 pb-3"><Pagination pagination={data?.pagination} onPageChange={setPage} /></div>
        </div>
      )}
    </div>
  );
}

function ConfigRow({ item, onSaved }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState('');

  const mut = useMutation({
    mutationFn: (value) => auditService.updateSystemConfig(item.key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      setEditing(false);
      onSaved(`Saved "${item.key}".`);
    },
  });

  const start = () => { setText(JSON.stringify(item.value, null, 2)); setParseError(''); mut.reset(); setEditing(true); };
  const save = () => {
    try {
      mut.mutate(JSON.parse(text));
      setParseError('');
    } catch (e) {
      setParseError(`Invalid JSON: ${e.message}`);
    }
  };

  const isScalar = item.value === null || typeof item.value !== 'object';

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium text-gray-900 break-all">{item.key}</p>
          <p className="text-xs text-gray-400">Updated {formatDateTime(item.updated_at)}</p>
        </div>
        {!editing && (
          <button className="btn-secondary inline-flex items-center gap-1 text-xs" onClick={start}><PencilSquareIcon className="h-4 w-4" />Edit</button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 space-y-2">
          <label className="label" htmlFor={`cfg-${item.key}`}>Value (JSON)</label>
          <textarea id={`cfg-${item.key}`} rows={Math.min(14, Math.max(3, text.split('\n').length))} className="input-field font-mono text-xs" value={text}
            onChange={(e) => setText(e.target.value)} spellCheck={false} />
          {parseError && <p className="text-xs text-red-600">{parseError}</p>}
          {mut.isError && <ErrorAlert message={errMsg(mut.error, 'Failed to save setting.')} />}
          <div className="flex gap-2">
            <button className="btn-success" onClick={save} disabled={mut.isPending}>{mut.isPending ? 'Saving...' : 'Save'}</button>
            <button className="btn-secondary" onClick={() => setEditing(false)} disabled={mut.isPending}>Cancel</button>
          </div>
        </div>
      ) : isScalar ? (
        <p className="mt-2 text-sm text-gray-800 break-words">{String(item.value)}</p>
      ) : (
        <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-48">{JSON.stringify(item.value, null, 2)}</pre>
      )}
    </div>
  );
}

function SystemSettingsTab() {
  const [notice, setNotice] = useState('');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => (await auditService.getSystemConfig()).data.data,
  });

  const grouped = useMemo(() => {
    const out = Object.fromEntries(CATEGORIES.map((c) => [c.key, []]));
    (data || []).forEach((item) => {
      const cat = CATEGORIES.find((c) => c.match(item.key));
      out[cat.key].push(item);
    });
    Object.values(out).forEach((arr) => arr.sort((a, b) => a.key.localeCompare(b.key)));
    return out;
  }, [data]);

  if (isLoading) return <LoadingSpinner text="Loading system settings..." />;
  if (error) return <ErrorAlert message={errMsg(error, 'Failed to load system settings.')} onRetry={refetch} />;
  if (!data || data.length === 0) return <div className="card"><EmptyState icon={Cog6ToothIcon} title="No settings" description="No system configuration entries exist yet." /></div>;

  return (
    <div className="space-y-6">
      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 text-green-800 p-3 text-sm flex items-center justify-between">
          <span>{notice}</span>
          <button aria-label="Dismiss" onClick={() => setNotice('')}><XMarkIcon className="h-4 w-4" /></button>
        </div>
      )}
      {CATEGORIES.filter((c) => grouped[c.key].length > 0).map((c) => (
        <section key={c.key} className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">{c.label}</h2>
            <p className="text-xs text-gray-500">{c.hint}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {grouped[c.key].map((item) => <ConfigRow key={item.id || item.key} item={item} onSaved={setNotice} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AuditLogs() {
  const { is } = usePermissions();
  const isAdmin = is(ROLES.MAINTENANCE_ADMIN);
  const [tab, setTab] = useState('logs');

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Audit Logs' }]} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs &amp; System Settings</h1>
        <p className="text-sm text-gray-500">Review system activity{isAdmin ? ' and manage configuration' : ''}.</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          <button onClick={() => setTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === 'logs' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <ClipboardDocumentCheckIcon className="h-4 w-4" />Audit Logs
          </button>
          {isAdmin && (
            <button onClick={() => setTab('settings')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === 'settings' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Cog6ToothIcon className="h-4 w-4" />System Settings
            </button>
          )}
        </nav>
      </div>

      {tab === 'logs' && <AuditLogsTab />}
      {tab === 'settings' && isAdmin && <SystemSettingsTab />}
    </div>
  );
}
