import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  ArrowLeftIcon, WrenchScrewdriverIcon, CogIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { assetService } from '../services/assetService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { categoryLabel, formatDate, formatDateTime, formatNumber } from '../utils/formatters';

const LINE_COLORS = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#dc2626', '#0891b2'];
const OPEN_STATUSES = ['open', 'assigned', 'in_progress', 'pending_review'];

function unwrap(res) {
  const body = res?.data;
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.workOrders)) return payload.workOrders;
  if (Array.isArray(payload?.readings)) return payload.readings;
  if (Array.isArray(payload?.telemetry)) return payload.telemetry;
  return [];
}

function healthTone(score) {
  if (score >= 75) return { color: '#16a34a', label: 'Good' };
  if (score >= 50) return { color: '#eab308', label: 'Fair' };
  if (score >= 25) return { color: '#f97316', label: 'Poor' };
  return { color: '#dc2626', label: 'Critical' };
}

function HealthGauge({ score }) {
  if (score == null || Number.isNaN(Number(score))) {
    return <p className="text-sm text-gray-400 py-6 text-center">No health score available.</p>;
  }
  const value = Math.max(0, Math.min(100, Number(score)));
  const tone = healthTone(value);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius} fill="none" stroke={tone.color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: tone.color }}>{Math.round(value)}</span>
          <span className="text-xs text-gray-500">out of 100</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-semibold" style={{ color: tone.color }}>{tone.label}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 break-words">{children || '—'}</dd>
    </div>
  );
}

function buildTelemetry(records) {
  if (!records.length) return { rows: [], keys: [] };
  const keySet = new Set();
  const byTime = new Map();
  const ignore = new Set(['_id', 'id', 'assetId', 'asset', 'timestamp', 'time', 'recordedAt', 'createdAt', 'updatedAt', '__v', 'unit', 'status']);

  records.forEach((r) => {
    const ts = r.timestamp || r.recordedAt || r.time || r.createdAt;
    if (!ts) return;
    const row = byTime.get(ts) || { ts, label: formatDateTime(ts) };
    const sensorName = r.sensorType || r.metric || r.sensor || r.type;
    if (sensorName && typeof r.value === 'number') {
      row[sensorName] = r.value;
      keySet.add(sensorName);
    } else {
      const source = r.metrics && typeof r.metrics === 'object' ? r.metrics : r;
      Object.entries(source).forEach(([k, v]) => {
        if (!ignore.has(k) && typeof v === 'number') {
          row[k] = v;
          keySet.add(k);
        }
      });
    }
    byTime.set(ts, row);
  });

  const rows = [...byTime.values()].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  return { rows, keys: [...keySet].slice(0, 6) };
}

const woTitle = (w) => w.title || w.workOrderNumber || '';
const woType = (w) => (w.type || w.workType || '').toString();
const woTech = (w) => w.assignedTo?.name || w.technician?.name || w.assignedTo?.fullName || '';
const woCreated = (w) => w.createdAt || w.created_at || w.scheduledDate || '';
const woCompleted = (w) => w.completedAt || w.closedAt || '';
const PRIORITY_RANK = { low: 1, medium: 2, high: 3, critical: 4, urgent: 4 };

const HISTORY_SORTERS = {
  title: (w) => woTitle(w).toLowerCase(),
  type: (w) => woType(w).toLowerCase(),
  priority: (w) => PRIORITY_RANK[String(w.priority || '').toLowerCase()] || 0,
  status: (w) => String(w.status || '').toLowerCase(),
  technician: (w) => woTech(w).toLowerCase(),
  created: (w) => new Date(woCreated(w) || 0).getTime(),
  completed: (w) => new Date(woCompleted(w) || 0).getTime(),
};

function SortHeader({ label, field, sort, onSort }) {
  const active = sort.key === field;
  return (
    <th className="px-4 py-3" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1 uppercase tracking-wide font-medium hover:text-gray-800">
        {label}
        {active ? (sort.dir === 'asc' ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />) : <span className="h-3 w-3" />}
      </button>
    </th>
  );
}

export default function AssetDetail() {
  const { assetId, id: legacyId } = useParams();
  const id = assetId ?? legacyId;
  const navigate = useNavigate();
  const [woSearch, setWoSearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historySort, setHistorySort] = useState({ key: 'created', dir: 'desc' });

  const assetQuery = useQuery({ queryKey: ['asset', id], queryFn: () => assetService.getById(id) });
  const telemetryQuery = useQuery({
    queryKey: ['asset', id, 'telemetry'],
    queryFn: () => assetService.getTelemetry(id, { limit: 100 }),
    enabled: !!id,
  });
  const workOrdersQuery = useQuery({
    queryKey: ['asset', id, 'work-orders'],
    queryFn: () => assetService.getWorkOrders(id),
    enabled: !!id,
  });
  const healthQuery = useQuery({
    queryKey: ['asset', id, 'health'],
    queryFn: () => assetService.getHealthScore(id),
    enabled: !!id,
  });

  const asset = useMemo(() => {
    const p = unwrap(assetQuery.data);
    return p?.asset || p || null;
  }, [assetQuery.data]);

  const healthScore = useMemo(() => {
    const p = unwrap(healthQuery.data);
    const val = typeof p === 'number' ? p : p?.score ?? p?.healthScore ?? p?.current?.score;
    return val ?? asset?.healthScore;
  }, [healthQuery.data, asset]);

  const telemetry = useMemo(() => buildTelemetry(toList(unwrap(telemetryQuery.data))), [telemetryQuery.data]);
  const workOrders = useMemo(() => toList(unwrap(workOrdersQuery.data)), [workOrdersQuery.data]);
  const matchesSearch = (w) => {
    const q = woSearch.trim().toLowerCase();
    if (!q) return true;
    return [w.title, w.workOrderNumber].filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
  };
  const openOrders = useMemo(
    () => workOrders.filter((w) => OPEN_STATUSES.includes(w.status) && matchesSearch(w)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workOrders, woSearch]
  );
  const statusOptions = useMemo(() => [...new Set(workOrders.map((w) => w.status).filter(Boolean))], [workOrders]);
  const history = useMemo(() => {
    const get = HISTORY_SORTERS[historySort.key] || HISTORY_SORTERS.created;
    const dir = historySort.dir === 'asc' ? 1 : -1;
    return workOrders
      .filter((w) => matchesSearch(w) && (!historyStatus || w.status === historyStatus))
      .sort((a, b) => {
        const x = get(a);
        const y = get(b);
        return x < y ? -dir : x > y ? dir : 0;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrders, woSearch, historyStatus, historySort]);
  const toggleSort = (key) =>
    setHistorySort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'created' || key === 'completed' ? 'desc' : 'asc' }));
  const parts = useMemo(() => {
    const raw = asset?.spareParts || asset?.components || asset?.parts || [];
    return Array.isArray(raw) ? raw : [];
  }, [asset]);

  const locationText =
    typeof asset?.location === 'object' && asset?.location !== null
      ? [asset.location.name, asset.location.room, asset.location.building].filter(Boolean).join(', ')
      : asset?.location;

  const breadcrumb = (
    <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Assets', path: '/dashboard' }, { label: asset?.name || 'Asset' }]} />
  );

  if (assetQuery.isLoading) return <LoadingSpinner text="Loading asset..." />;

  if (assetQuery.isError || !asset) {
    const notFound = assetQuery.error?.response?.status === 404 || (!assetQuery.isError && !asset);
    return (
      <div className="space-y-4">
        {breadcrumb}
        {notFound ? (
          <div className="card">
            <EmptyState
              title="Asset not found"
              description="This asset does not exist or you do not have access to it."
              action={<button onClick={() => navigate('/dashboard')} className="btn-primary">Back to dashboard</button>}
            />
          </div>
        ) : (
          <ErrorAlert
            message={assetQuery.error?.response?.data?.message || 'Failed to load asset details.'}
            onRetry={() => assetQuery.refetch()}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {breadcrumb}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100" aria-label="Go back">
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
            <p className="text-sm text-gray-500">{categoryLabel(asset.category)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={asset.status} />
          <StatusBadge status={asset.criticality} label={asset.criticality ? `${asset.criticality[0].toUpperCase()}${asset.criticality.slice(1)} criticality` : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Asset Information</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            <Field label="Category">{categoryLabel(asset.category)}</Field>
            <Field label="Serial number">{asset.serialNumber || asset.serial}</Field>
            <Field label="Model">{asset.model}</Field>
            <Field label="Manufacturer">{asset.manufacturer}</Field>
            <Field label="Location">{locationText}</Field>
            <Field label="Install date">{asset.installDate || asset.installationDate ? formatDate(asset.installDate || asset.installationDate) : null}</Field>
            <Field label="Warranty expiry">{asset.warrantyExpiry || asset.warrantyExpiryDate ? formatDate(asset.warrantyExpiry || asset.warrantyExpiryDate) : null}</Field>
            <Field label="Criticality"><StatusBadge status={asset.criticality} /></Field>
            <Field label="Status"><StatusBadge status={asset.status} /></Field>
            <Field label="Runtime hours">{asset.runtimeHours != null ? `${formatNumber(asset.runtimeHours, 1)} h` : null}</Field>
          </dl>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Health Score</h2>
          {healthQuery.isLoading ? <LoadingSpinner size="sm" text="" /> : <HealthGauge score={healthScore} />}
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sensor Trends</h2>
        {telemetryQuery.isLoading ? (
          <LoadingSpinner size="sm" text="Loading telemetry..." />
        ) : telemetryQuery.isError ? (
          <ErrorAlert message="Failed to load telemetry data." onRetry={() => telemetryQuery.refetch()} />
        ) : telemetry.rows.length === 0 || telemetry.keys.length === 0 ? (
          <EmptyState title="No telemetry yet" description="This asset has not reported any sensor readings." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry.rows} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {telemetry.keys.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card py-3">
        <label htmlFor="wo-search" className="label">Search work orders</label>
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input id="wo-search" type="search" value={woSearch} onChange={(e) => setWoSearch(e.target.value)} placeholder="Filter by work order title..." className="input-field pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <WrenchScrewdriverIcon className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Open Work Orders</h2>
            <span className="ml-auto text-xs text-gray-500">{openOrders.length}</span>
          </div>
          {workOrdersQuery.isLoading ? (
            <LoadingSpinner size="sm" text="" />
          ) : workOrdersQuery.isError ? (
            <ErrorAlert message="Failed to load work orders." onRetry={() => workOrdersQuery.refetch()} />
          ) : openOrders.length === 0 ? (
            <EmptyState title="No open work orders" description="Nothing is currently pending for this asset." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {openOrders.map((w) => (
                <li key={w._id || w.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{w.title || w.workOrderNumber || 'Work order'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {w.workOrderNumber ? `${w.workOrderNumber} · ` : ''}Created {formatDate(w.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={w.status} />
                    {w.priority && <StatusBadge status={w.priority} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CogIcon className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Spare Parts &amp; Components</h2>
            <span className="ml-auto text-xs text-gray-500">{parts.length}</span>
          </div>
          {parts.length === 0 ? (
            <EmptyState title="No components listed" description="No spare parts or components are linked to this asset." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Part</th>
                    <th className="py-2 pr-4">Part no.</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parts.map((p, i) => (
                    <tr key={p._id || p.id || i}>
                      <td className="py-2 pr-4 font-medium text-gray-900">{p.name || p.partName || String(p)}</td>
                      <td className="py-2 pr-4 text-gray-600">{p.partNumber || p.sku || '—'}</td>
                      <td className="py-2 pr-4 text-right text-gray-600">{p.quantity ?? p.stock ?? '—'}</td>
                      <td className="py-2">{p.status ? <StatusBadge status={p.status} /> : <span className="text-gray-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900">Maintenance History <span className="text-xs font-normal text-gray-500">({history.length})</span></h2>
          <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} className="input-field w-auto" aria-label="Filter history by status">
            <option value="">All statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{String(s).replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        {workOrdersQuery.isLoading ? (
          <LoadingSpinner size="sm" text="" />
        ) : history.length === 0 ? (
          <EmptyState
            title={workOrders.length === 0 ? 'No maintenance history' : 'No matching work orders'}
            description={workOrders.length === 0 ? 'No work orders have been recorded for this asset.' : 'Try adjusting the search or status filter.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                <tr>
                  <SortHeader label="Work order" field="title" sort={historySort} onSort={toggleSort} />
                  <SortHeader label="Type" field="type" sort={historySort} onSort={toggleSort} />
                  <SortHeader label="Priority" field="priority" sort={historySort} onSort={toggleSort} />
                  <SortHeader label="Status" field="status" sort={historySort} onSort={toggleSort} />
                  <SortHeader label="Technician" field="technician" sort={historySort} onSort={toggleSort} />
                  <SortHeader label="Created" field="created" sort={historySort} onSort={toggleSort} />
                  <SortHeader label="Completed" field="completed" sort={historySort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((w) => (
                  <tr key={w._id || w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{w.title || w.workOrderNumber || '—'}</p>
                      {w.workOrderNumber && w.title && <p className="text-xs text-gray-500">{w.workOrderNumber}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{(w.type || w.workType || '—').toString().replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{w.priority ? <StatusBadge status={w.priority} /> : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{w.assignedTo?.name || w.technician?.name || w.assignedTo?.fullName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(w.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(w.completedAt || w.closedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
