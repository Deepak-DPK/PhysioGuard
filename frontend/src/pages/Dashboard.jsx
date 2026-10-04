import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Squares2X2Icon, ListBulletIcon, MagnifyingGlassIcon, CubeIcon, CheckCircleIcon, WrenchIcon,
  ExclamationTriangleIcon, MapPinIcon, PlusIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { assetService } from '../services/assetService';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { ASSET_CATEGORIES, ASSET_STATUS, CRITICALITY } from '../utils/constants';
import { categoryLabel, formatNumber } from '../utils/formatters';

const PAGE_SIZE = 12;

const HEALTH_BUCKETS = [
  { key: 'good', label: 'Good', min: 75, color: '#16a34a' },
  { key: 'fair', label: 'Fair', min: 50, color: '#eab308' },
  { key: 'poor', label: 'Poor', min: 25, color: '#f97316' },
  { key: 'critical', label: 'Critical', min: -Infinity, color: '#dc2626' },
];

function healthBucket(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  return HEALTH_BUCKETS.find((b) => Number(score) >= b.min);
}

// Risk levels based on health score: Critical < 30, Warning 30-60, Good > 60.
const RISK_LEVELS = [
  { key: 'critical', label: 'Critical (< 30)' },
  { key: 'warning', label: 'Warning (30-60)' },
  { key: 'good', label: 'Good (> 60)' },
];

function riskLevel(score) {
  if (score == null || Number.isNaN(Number(score))) return null;
  const s = Number(score);
  if (s < 30) return 'critical';
  if (s <= 60) return 'warning';
  return 'good';
}

const EMPTY_FILTERS = {
  category: '', status: '', criticality: '', location: '', risk: '',
  installFrom: '', installTo: '', warrantyFrom: '', warrantyTo: '',
};

function locationText(a) {
  const loc = a?.location || a?.locations;
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  return loc.name || '';
}

const dayOf = (v) => (v ? String(v).slice(0, 10) : '');

function inRange(value, from, to) {
  if (!from && !to) return true;
  const d = dayOf(value);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function extractList(res) {
  const body = res?.data;
  const inner = body?.data;
  if (Array.isArray(inner)) return inner;
  if (Array.isArray(inner?.items)) return inner.items;
  if (Array.isArray(body)) return body;
  return [];
}

function extractPagination(res, page, count) {
  const body = res?.data;
  const p = body?.pagination || body?.meta?.pagination;
  if (p) {
    const totalCount = p.totalCount ?? p.total ?? count;
    const totalPages = p.totalPages ?? Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const current = p.page ?? page;
    return { page: current, totalPages, totalCount, hasNext: current < totalPages, hasPrev: current > 1 };
  }
  return { page, totalPages: 1, totalCount: count, hasNext: false, hasPrev: false };
}

function HealthBar({ score }) {
  const bucket = healthBucket(score);
  if (!bucket) return <span className="text-xs text-gray-400">No data</span>;
  const pct = Math.max(0, Math.min(100, Number(score)));
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: bucket.color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: bucket.color }}>
        {Math.round(pct)}
      </span>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

const INITIAL_ASSET = {
  name: '', category: 'therapy_bed', serial_number: '', model: '', manufacturer: '',
  install_date: '', warranty_expiry: '', criticality: 'medium', status: 'active',
  runtime_hours: 0, notes: '',
};

function AddAssetModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(INITIAL_ASSET);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => assetService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setForm(INITIAL_ASSET);
      setError('');
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create asset.'),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'runtime_hours' ? Number(value) || 0 : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Asset name is required.'); return; }
    const payload = { ...form };
    if (!payload.install_date) delete payload.install_date;
    if (!payload.warranty_expiry) delete payload.warranty_expiry;
    if (!payload.serial_number) delete payload.serial_number;
    if (!payload.model) delete payload.model;
    if (!payload.manufacturer) delete payload.manufacturer;
    if (!payload.notes) delete payload.notes;
    mutation.mutate(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Register New Asset</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <ErrorAlert message={error} />}
          <div>
            <label className="label">Asset Name *</label>
            <input name="name" value={form.name} onChange={handleChange} className="input-field" placeholder="e.g. Therapy Bed - Station 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select name="category" value={form.category} onChange={handleChange} className="input-field">
                {Object.entries(ASSET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Criticality *</label>
              <select name="criticality" value={form.criticality} onChange={handleChange} className="input-field">
                {Object.entries(CRITICALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Serial Number</label>
              <input name="serial_number" value={form.serial_number} onChange={handleChange} className="input-field" placeholder="TB-001" />
            </div>
            <div>
              <label className="label">Model</label>
              <input name="model" value={form.model} onChange={handleChange} className="input-field" placeholder="ProFlex 3000" />
            </div>
          </div>
          <div>
            <label className="label">Manufacturer</label>
            <input name="manufacturer" value={form.manufacturer} onChange={handleChange} className="input-field" placeholder="MedBed Corp" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Install Date</label>
              <input name="install_date" type="date" value={form.install_date} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="label">Warranty Expiry</label>
              <input name="warranty_expiry" type="date" value={form.warranty_expiry} onChange={handleChange} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="input-field">
                {Object.entries(ASSET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Runtime Hours</label>
              <input name="runtime_hours" type="number" min="0" value={form.runtime_hours} onChange={handleChange} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} className="input-field h-20 resize-none" placeholder="Any additional details..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Registering...' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [search, setSearch] = useState(urlSearch.trim());
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sync the global (Navbar) search, which navigates to /dashboard?search=...
  useEffect(() => {
    if (urlSearch) {
      setSearchInput(urlSearch);
      setSearch(urlSearch.trim());
      setPage(1);
    }
  }, [urlSearch]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Location, risk and date-range filters are applied client-side over the full asset list.
  const clientFilterActive = !!(
    filters.location || filters.risk || filters.installFrom || filters.installTo || filters.warrantyFrom || filters.warrantyTo
  );

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (search) p.search = search;
    if (filters.category) p.category = filters.category;
    if (filters.status) p.status = filters.status;
    if (filters.criticality) p.criticality = filters.criticality;
    return p;
  }, [page, search, filters]);

  const listQuery = useQuery({
    queryKey: ['assets', 'list', params],
    queryFn: () => assetService.getAll(params),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['assets', 'stats'],
    queryFn: () => assetService.getAll({ page: 1, limit: 1000 }),
  });

  const allAssets = useMemo(() => extractList(statsQuery.data), [statsQuery.data]);

  const locationOptions = useMemo(
    () => [...new Set(allAssets.map(locationText).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [allAssets]
  );

  const clientFiltered = useMemo(() => {
    if (!clientFilterActive) return [];
    const q = search.toLowerCase();
    return allAssets.filter((a) => {
      if (q) {
        const hay = [a.name, a.serial_number, a.serialNumber, a.model, a.manufacturer, locationText(a)].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.category && a.category !== filters.category) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.criticality && a.criticality !== filters.criticality) return false;
      if (filters.location && locationText(a) !== filters.location) return false;
      if (filters.risk && riskLevel(a.healthScore ?? a.health_score) !== filters.risk) return false;
      if (!inRange(a.install_date ?? a.installDate ?? a.installationDate, filters.installFrom, filters.installTo)) return false;
      if (!inRange(a.warranty_expiry ?? a.warrantyExpiry ?? a.warrantyExpiryDate, filters.warrantyFrom, filters.warrantyTo)) return false;
      return true;
    });
  }, [clientFilterActive, allAssets, search, filters]);

  const assets = useMemo(
    () => (clientFilterActive ? clientFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : extractList(listQuery.data)),
    [clientFilterActive, clientFiltered, page, listQuery.data]
  );
  const pagination = useMemo(() => {
    if (clientFilterActive) {
      const totalCount = clientFiltered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      return { page, totalPages, totalCount, hasNext: page < totalPages, hasPrev: page > 1 };
    }
    return extractPagination(listQuery.data, page, assets.length);
  }, [clientFilterActive, clientFiltered, listQuery.data, page, assets.length]);
  const listLoading = clientFilterActive ? statsQuery.isLoading : listQuery.isLoading;

  const summary = useMemo(() => {
    const total = statsQuery.data?.data?.pagination?.totalCount ?? allAssets.length;
    return {
      total,
      active: allAssets.filter((a) => a.status === 'active').length,
      maintenance: allAssets.filter((a) => a.status === 'under_maintenance').length,
      critical: allAssets.filter((a) => a.criticality === 'critical' || healthBucket(a.healthScore)?.key === 'critical').length,
    };
  }, [allAssets, statsQuery.data]);

  const healthData = useMemo(
    () => HEALTH_BUCKETS.map((b) => ({ name: b.label, value: allAssets.filter((a) => healthBucket(a.healthScore)?.key === b.key).length, color: b.color })),
    [allAssets]
  );
  const healthTotal = healthData.reduce((s, d) => s + d.value, 0);

  const categoryData = useMemo(
    () => Object.keys(ASSET_CATEGORIES).map((key) => ({ name: ASSET_CATEGORIES[key], count: allAssets.filter((a) => a.category === key).length })),
    [allAssets]
  );

  const setFilter = (name) => (e) => { setFilters((f) => ({ ...f, [name]: e.target.value })); setPage(1); };
  const setFilterValue = (name) => (e) => { const v = e.target.value; setFilters((f) => ({ ...f, [name]: v })); setPage(1); };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS); setSearchInput(''); setSearch(''); setPage(1);
    if (searchParams.has('search')) setSearchParams({}, { replace: true });
  };
  const hasFilters = !!(search || Object.values(filters).some(Boolean));
  const goTo = (a) => navigate(`/assets/${a.id}`);
  const canCreate = user?.role === 'maintenance_admin' || user?.role === 'operations_manager';
  const isEmpty = !statsQuery.isLoading && summary.total === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Home' }]} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to PhysioGuard</h1>
          <p className="text-sm text-gray-500 mt-1">Smart Asset Reliability &amp; Maintenance Suite for your physiotherapy practice.</p>
        </div>
        <div className="card text-center py-16">
          <CubeIcon className="h-16 w-16 text-primary-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Get started by registering your first equipment</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Register therapy beds, electrotherapy units, exercise equipment, mobility aids and treatment rooms.
            Once registered, you can track maintenance, predict failures with AI, and manage work orders.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {canCreate && (
              <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
                <PlusIcon className="h-5 w-5" /> Register First Asset
              </button>
            )}
            <button onClick={() => navigate('/users')} className="btn-secondary">
              Add Team Members
            </button>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-primary-50">
              <p className="font-semibold text-primary-900 text-sm">Step 1</p>
              <p className="text-sm text-primary-700 mt-1">Register your equipment and treatment rooms</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-50">
              <p className="font-semibold text-yellow-900 text-sm">Step 2</p>
              <p className="text-sm text-yellow-700 mt-1">Create maintenance plans and assign technicians</p>
            </div>
            <div className="p-4 rounded-xl bg-green-50">
              <p className="font-semibold text-green-900 text-sm">Step 3</p>
              <p className="text-sm text-green-700 mt-1">Track health, predict failures, and optimize uptime</p>
            </div>
          </div>
        </div>
        <AddAssetModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home' }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Registry &amp; Health Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor equipment status, health and risk across all facilities.</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-4 w-4" /> Add Asset
          </button>
        )}
      </div>

      {statsQuery.isError && <ErrorAlert message="Unable to load asset summary." onRetry={() => statsQuery.refetch()} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Total Assets" value={formatNumber(summary.total)} icon={CubeIcon} tone="bg-primary-50 text-primary-600" />
        <SummaryCard label="Active" value={formatNumber(summary.active)} icon={CheckCircleIcon} tone="bg-green-50 text-green-600" />
        <SummaryCard label="Under Maintenance" value={formatNumber(summary.maintenance)} icon={WrenchIcon} tone="bg-yellow-50 text-yellow-600" />
        <SummaryCard label="Critical Risk" value={formatNumber(summary.critical)} icon={ExclamationTriangleIcon} tone="bg-red-50 text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Health Distribution</h2>
          {healthTotal === 0 ? (
            <EmptyState title="No health data yet" description="Health scores appear after the system runs its first analysis cycle." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {healthData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Assets by Category</h2>
          {allAssets.length === 0 ? (
            <EmptyState title="No assets" description="Register assets to see category breakdown." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Assets" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="search" className="label">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name, serial number..." className="input-field pl-9" />
              </div>
            </div>
            <div>
              <label className="label">Category</label>
              <select value={filters.category} onChange={setFilter('category')} className="input-field">
                <option value="">All categories</option>
                {Object.entries(ASSET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select value={filters.status} onChange={setFilter('status')} className="input-field">
                <option value="">All statuses</option>
                {Object.entries(ASSET_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Criticality</label>
              <select value={filters.criticality} onChange={setFilter('criticality')} className="input-field">
                <option value="">All levels</option>
                {Object.entries(CRITICALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="f-location" className="label">Location</label>
              <select id="f-location" value={filters.location} onChange={setFilterValue('location')} className="input-field">
                <option value="">All locations</option>
                {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-risk" className="label">Risk level</label>
              <select id="f-risk" value={filters.risk} onChange={setFilterValue('risk')} className="input-field">
                <option value="">All risk levels</option>
                {RISK_LEVELS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Install date</label>
              <div className="flex items-center gap-1">
                <input type="date" aria-label="Install from" value={filters.installFrom} max={filters.installTo || undefined} onChange={setFilterValue('installFrom')} className="input-field text-xs px-1.5" />
                <span className="text-gray-400 text-xs shrink-0">to</span>
                <input type="date" aria-label="Install to" value={filters.installTo} min={filters.installFrom || undefined} onChange={setFilterValue('installTo')} className="input-field text-xs px-1.5" />
              </div>
            </div>
            <div>
              <label className="label">Warranty expiry</label>
              <div className="flex items-center gap-1">
                <input type="date" aria-label="Warranty from" value={filters.warrantyFrom} max={filters.warrantyTo || undefined} onChange={setFilterValue('warrantyFrom')} className="input-field text-xs px-1.5" />
                <span className="text-gray-400 text-xs shrink-0">to</span>
                <input type="date" aria-label="Warranty to" value={filters.warrantyTo} min={filters.warrantyFrom || undefined} onChange={setFilterValue('warrantyTo')} className="input-field text-xs px-1.5" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {listLoading ? 'Loading...' : `${formatNumber(pagination.totalCount)} asset${pagination.totalCount === 1 ? '' : 's'}`}
              {hasFilters && <button onClick={clearFilters} className="ml-3 text-primary-600 hover:text-primary-700 font-medium">Clear filters</button>}
            </p>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <button onClick={() => setView('grid')} aria-label="Grid view" className={`p-2 ${view === 'grid' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button onClick={() => setView('list')} aria-label="List view" className={`p-2 ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <ListBulletIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {listLoading ? (
        <LoadingSpinner text="Loading assets..." />
      ) : (clientFilterActive ? statsQuery.isError : listQuery.isError) ? (
        <ErrorAlert message="Failed to load assets." onRetry={() => (clientFilterActive ? statsQuery.refetch() : listQuery.refetch())} />
      ) : assets.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No assets match"
            description={hasFilters ? 'Try adjusting your filters.' : 'Register your first asset to get started.'}
            action={hasFilters ? <button onClick={clearFilters} className="btn-secondary">Clear filters</button> : canCreate ? <button onClick={() => setShowAddModal(true)} className="btn-primary">Add Asset</button> : null}
          />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assets.map((a) => (
            <button key={a.id} onClick={() => goTo(a)} className="card text-left hover:shadow-md hover:border-primary-300 transition focus:outline-none focus:ring-2 focus:ring-primary-500">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{categoryLabel(a.category)}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-gray-500">Criticality</span>
                <StatusBadge status={a.criticality} />
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Health score</p>
                <HealthBar score={a.healthScore} />
              </div>
              <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                <MapPinIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{locationText(a) || 'Location not set'}</span>
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criticality</th>
                <th className="px-4 py-3 w-40">Health</th>
                <th className="px-4 py-3">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assets.map((a) => (
                <tr key={a.id} onClick={() => goTo(a)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{categoryLabel(a.category)}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={a.criticality} /></td>
                  <td className="px-4 py-3"><HealthBar score={a.healthScore} /></td>
                  <td className="px-4 py-3 text-gray-600">{locationText(a) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
      <AddAssetModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
