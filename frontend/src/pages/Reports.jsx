import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowDownTrayIcon, ChartBarIcon, ClockIcon, WrenchScrewdriverIcon, CpuChipIcon, CheckCircleIcon, XCircleIcon,
  ClipboardDocumentListIcon, ExclamationTriangleIcon, PrinterIcon,
} from '@heroicons/react/24/outline';
import { reportService } from '../services/reportService';
import { aiService } from '../services/aiService';
import Breadcrumbs from '../components/common/Breadcrumbs';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import ErrorAlert from '../components/common/ErrorAlert';
import { formatDate, formatDateTime, formatNumber, formatPercentage, categoryLabel } from '../utils/formatters';

const TABS = [
  { key: 'asset_health', label: 'Asset Health', icon: ChartBarIcon },
  { key: 'downtime', label: 'Downtime', icon: ClockIcon },
  { key: 'maintenance', label: 'Maintenance Effectiveness', icon: WrenchScrewdriverIcon },
  { key: 'model', label: 'Model Performance', icon: CpuChipIcon },
  { key: 'work_orders', label: 'Work Orders', icon: ClipboardDocumentListIcon },
  { key: 'failure_risk', label: 'Failure Risk', icon: ExclamationTriangleIcon },
];

const EXPORT_TYPES = { asset_health: 'asset_health', downtime: 'downtime', maintenance: 'work_orders', work_orders: 'work_orders' };

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#64748b'];
const HEALTH_COLORS = { good: '#16a34a', fair: '#f59e0b', poor: '#f97316', critical: '#dc2626' };

const toChartData = (obj, labelFn = (k) => k) =>
  Object.entries(obj || {}).map(([k, v]) => ({ key: k, name: labelFn(k), value: v }));

const pretty = (s) => String(s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function errMsg(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to load report.';
}

function Stat({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, hint, children, empty }) {
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {empty ? (
        <p className="text-sm text-gray-500 py-12 text-center">No data available.</p>
      ) : (
        <div className="h-64">{children}</div>
      )}
    </div>
  );
}

function SimpleBar({ data, onClick, activeKey }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor={onClick ? 'pointer' : 'default'} onClick={onClick ? (d) => onClick(d.key) : undefined}>
          {data.map((d, i) => (
            <Cell key={d.key} fill={activeKey && activeKey === d.key ? '#1e3a8a' : COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SimplePie({ data, colorFor, onClick }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}
          cursor={onClick ? 'pointer' : 'default'} onClick={onClick ? (d) => onClick(d.key) : undefined}>
          {data.map((d, i) => <Cell key={d.key} fill={colorFor ? colorFor(d.key, i) : COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function AssetHealthTab({ navigate }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'asset-health'],
    queryFn: async () => (await reportService.assetHealth()).data.data,
  });
  const [filter, setFilter] = useState(null); // { type, key }

  const assets = data?.assets || [];
  const filtered = useMemo(() => {
    if (!filter) return assets;
    if (filter.type === 'health') {
      const band = (s) => (s == null ? 'unscored' : s >= 80 ? 'good' : s >= 60 ? 'fair' : s >= 40 ? 'poor' : 'critical');
      return assets.filter((a) => band(a.health_score) === filter.key);
    }
    return assets.filter((a) => a[filter.type] === filter.key);
  }, [assets, filter]);

  if (isLoading) return <LoadingSpinner text="Loading asset health report..." />;
  if (error) return <ErrorAlert message={errMsg(error)} onRetry={refetch} />;
  if (!data || data.total_assets === 0) return <EmptyState title="No assets" description="There are no assets to report on yet." />;

  const scored = assets.filter((a) => a.health_score != null);
  const avg = scored.length ? scored.reduce((s, a) => s + Number(a.health_score), 0) / scored.length : null;
  const dist = data.health_distribution || {};
  const atRisk = (dist.poor || 0) + (dist.critical || 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Assets" value={formatNumber(data.total_assets)} />
        <Stat label="Average Health Score" value={avg == null ? '—' : formatNumber(avg, 1)} sub={`${scored.length} scored`} />
        <Stat label="Healthy (80+)" value={formatNumber(dist.good || 0)} />
        <Stat label="At Risk (below 60)" value={formatNumber(atRisk)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="By Category" hint="Click a bar to drill down" empty={!Object.keys(data.by_category || {}).length}>
          <SimpleBar data={toChartData(data.by_category, categoryLabel)} activeKey={filter?.type === 'category' ? filter.key : null}
            onClick={(key) => setFilter({ type: 'category', key })} />
        </ChartCard>
        <ChartCard title="By Status" hint="Click a bar to drill down" empty={!Object.keys(data.by_status || {}).length}>
          <SimpleBar data={toChartData(data.by_status, pretty)} activeKey={filter?.type === 'status' ? filter.key : null}
            onClick={(key) => setFilter({ type: 'status', key })} />
        </ChartCard>
        <ChartCard title="Health Distribution" hint="Click a slice" empty={!Object.values(dist).some((v) => v > 0)}>
          <SimplePie data={toChartData(dist, pretty)} colorFor={(k) => HEALTH_COLORS[k]} onClick={(key) => setFilter({ type: 'health', key })} />
        </ChartCard>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            Assets {filter && <span className="font-normal text-gray-500">filtered by {filter.type} = {pretty(filter.key)}</span>}
            <span className="ml-2 text-gray-400 font-normal">({filtered.length})</span>
          </h3>
          {filter && <button className="btn-secondary text-xs" onClick={() => setFilter(null)}>Clear filter</button>}
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No matching assets" description="Try clearing the drill-down filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Name</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Criticality</th><th className="px-4 py-2 text-right">Runtime (h)</th><th className="px-4 py-2 text-right">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                    <td className="px-4 py-2 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-2">{categoryLabel(a.category)}</td>
                    <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2"><StatusBadge status={a.criticality} /></td>
                    <td className="px-4 py-2 text-right">{formatNumber(a.runtime_hours)}</td>
                    <td className="px-4 py-2 text-right">{a.health_score == null ? '—' : formatNumber(a.health_score, 1)}</td>
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

function DowntimeTab({ range, navigate }) {
  const params = useMemo(() => {
    const p = {};
    if (range.from) p.from = new Date(range.from).toISOString();
    if (range.to) p.to = new Date(`${range.to}T23:59:59`).toISOString();
    return p;
  }, [range]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'downtime', params],
    queryFn: async () => (await reportService.downtime(params)).data.data,
  });

  if (isLoading) return <LoadingSpinner text="Loading downtime report..." />;
  if (error) return <ErrorAlert message={errMsg(error)} onRetry={refetch} />;

  const events = data?.events || [];
  if (events.length === 0) return <EmptyState title="No downtime events" description="No downtime was recorded for the selected period." />;

  const hoursOf = (e) => (e.started_at && e.ended_at ? (new Date(e.ended_at) - new Date(e.started_at)) / 3600000 : null);
  const byAsset = {};
  events.forEach((e) => {
    const n = e.assets?.name || 'Unknown';
    byAsset[n] = (byAsset[n] || 0) + (hoursOf(e) || 0);
  });
  const chart = Object.entries(byAsset)
    .map(([name, value]) => ({ key: name, name, value: Number(value.toFixed(1)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const ongoing = events.filter((e) => !e.ended_at).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Downtime" value={`${formatNumber(data.total_downtime_hours, 1)} h`} />
        <Stat label="Cost Impact" value={formatNumber(data.total_cost_impact, 2)} />
        <Stat label="Events" value={formatNumber(events.length)} />
        <Stat label="Ongoing" value={formatNumber(ongoing)} />
      </div>
      <ChartCard title="Downtime Hours by Asset" hint="Top 8">
        <SimpleBar data={chart} />
      </ChartCard>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Downtime Events</h3></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Asset</th><th className="px-4 py-2">Started</th><th className="px-4 py-2">Ended</th>
                <th className="px-4 py-2 text-right">Hours</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => {
                const h = hoursOf(e);
                return (
                  <tr key={e.id} className={`hover:bg-gray-50 ${e.asset_id ? 'cursor-pointer' : ''}`} onClick={() => e.asset_id && navigate(`/assets/${e.asset_id}`)}>
                    <td className="px-4 py-2 font-medium text-gray-900">{e.assets?.name || '—'}</td>
                    <td className="px-4 py-2">{formatDateTime(e.started_at)}</td>
                    <td className="px-4 py-2">{e.ended_at ? formatDateTime(e.ended_at) : <StatusBadge status="in_progress" label="Ongoing" />}</td>
                    <td className="px-4 py-2 text-right">{h == null ? '—' : formatNumber(h, 1)}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{e.reason || e.cause || e.description || '—'}</td>
                    <td className="px-4 py-2 text-right">{e.cost_impact == null ? '—' : formatNumber(e.cost_impact, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MaintenanceTab({ navigate }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'maintenance-effectiveness'],
    queryFn: async () => (await reportService.maintenanceEffectiveness()).data.data,
  });

  if (isLoading) return <LoadingSpinner text="Loading maintenance report..." />;
  if (error) return <ErrorAlert message={errMsg(error)} onRetry={refetch} />;
  if (!data || !data.total_work_orders) return <EmptyState title="No work orders" description="No work orders exist to analyse yet." />;

  const drill = (field) => (key) => navigate(`/work-orders?${field}=${encodeURIComponent(key)}`);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Work Orders" value={formatNumber(data.total_work_orders)} sub="Most recent 200" />
        <Stat label="Preventive Ratio" value={formatPercentage(data.preventive_ratio_pct)} sub="Target 60%+" />
        <Stat label="Corrective" value={formatNumber(data.corrective_count)} />
        <Stat label="Closed" value={formatNumber(data.by_status?.closed || 0)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="By Type" hint="Click to open list" empty={!Object.keys(data.by_type || {}).length}>
          <SimplePie data={toChartData(data.by_type, pretty)} onClick={drill('type')} />
        </ChartCard>
        <ChartCard title="By Status" hint="Click to open list" empty={!Object.keys(data.by_status || {}).length}>
          <SimpleBar data={toChartData(data.by_status, pretty)} onClick={drill('status')} />
        </ChartCard>
        <ChartCard title="By Priority" hint="Click to open list" empty={!Object.keys(data.by_priority || {}).length}>
          <SimpleBar data={toChartData(data.by_priority, pretty)} onClick={drill('priority')} />
        </ChartCard>
      </div>
    </div>
  );
}

function ModelTab() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'model-performance'],
    queryFn: async () => (await reportService.modelPerformance()).data.data,
  });

  if (isLoading) return <LoadingSpinner text="Loading model performance..." />;
  if (error) return <ErrorAlert message={errMsg(error)} onRetry={refetch} />;
  if (!data || (!data.total_runs && !(data.models || []).length)) {
    return <EmptyState title="No AI activity" description="No model runs or active model versions were found." />;
  }

  const runData = [
    { key: 'completed', name: 'Completed', value: data.completed_runs || 0 },
    { key: 'failed', name: 'Failed', value: data.failed_runs || 0 },
    { key: 'other', name: 'Other', value: Math.max(0, (data.total_runs || 0) - (data.completed_runs || 0) - (data.failed_runs || 0)) },
  ].filter((d) => d.value > 0);
  const runColors = { completed: '#16a34a', failed: '#dc2626', other: '#64748b' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Runs" value={formatNumber(data.total_runs)} sub="Last 100" />
        <Stat label="Avg Latency" value={`${formatNumber(data.avg_latency_ms)} ms`} />
        <Stat label="Avg Confidence" value={formatPercentage((data.avg_confidence || 0) * 100)} />
        <Stat label="Feedback Accuracy" value={data.user_feedback_accuracy_pct == null ? '—' : formatPercentage(data.user_feedback_accuracy_pct)} sub={`${formatNumber(data.total_feedback)} responses`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Run Outcomes" empty={runData.length === 0}>
          <SimplePie data={runData} colorFor={(k) => runColors[k]} />
        </ChartCard>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Model Versions</h3>
          {(data.models || []).length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No active models.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.models.map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{m.name || m.model_name || m.model_type || 'Model'}</p>
                    <p className="text-xs text-gray-500">v{m.version || '—'} {m.created_at ? `· ${formatDate(m.created_at)}` : ''}</p>
                  </div>
                  <StatusBadge status="active" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkOrdersTab() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'maintenance-effectiveness'],
    queryFn: async () => (await reportService.maintenanceEffectiveness()).data.data,
  });

  if (isLoading) return <LoadingSpinner text="Loading work order report..." />;
  if (error) return <ErrorAlert message={errMsg(error)} onRetry={refetch} />;
  if (!data || !data.total_work_orders) return <EmptyState title="No work orders" description="No work orders exist to report on yet." />;

  const countTable = (title, obj) => {
    const rows = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((s, [, v]) => s + v, 0) || 1;
    return (
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">{title}</h3></div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">No data available.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-2">{title.replace('By ', '')}</th><th className="px-4 py-2 text-right">Count</th><th className="px-4 py-2 text-right">Share</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="px-4 py-2 text-gray-900">{pretty(k)}</td>
                  <td className="px-4 py-2 text-right">{formatNumber(v)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{formatPercentage((v / total) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Work Orders" value={formatNumber(data.total_work_orders)} sub="Most recent 200" />
        <Stat label="Open" value={formatNumber(data.by_status?.open || 0)} />
        <Stat label="In Progress" value={formatNumber(data.by_status?.in_progress || 0)} />
        <Stat label="Closed" value={formatNumber(data.by_status?.closed || 0)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="By Status" empty={!Object.keys(data.by_status || {}).length}>
          <SimpleBar data={toChartData(data.by_status, pretty)} />
        </ChartCard>
        <ChartCard title="By Type" empty={!Object.keys(data.by_type || {}).length}>
          <SimplePie data={toChartData(data.by_type, pretty)} />
        </ChartCard>
        <ChartCard title="By Priority" empty={!Object.keys(data.by_priority || {}).length}>
          <SimpleBar data={toChartData(data.by_priority, pretty)} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {countTable('By Status', data.by_status)}
        {countTable('By Type', data.by_type)}
        {countTable('By Priority', data.by_priority)}
      </div>
    </div>
  );
}

const RISK_BANDS = [
  { key: 'low', label: 'Low (0-40)', color: '#16a34a', test: (s) => s <= 40 },
  { key: 'medium', label: 'Medium (41-70)', color: '#f59e0b', test: (s) => s > 40 && s <= 70 },
  { key: 'high', label: 'High (71-100)', color: '#dc2626', test: (s) => s > 70 },
];

function FailureRiskTab({ navigate }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', 'failure-risk'],
    queryFn: async () => {
      const [health, runs] = await Promise.all([
        reportService.assetHealth(),
        aiService.getRuns({ run_type: 'predict_failure', limit: 100 }),
      ]);
      return { assets: health.data?.data?.assets || [], runs: runs.data?.data || [] };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const latest = {};
    data.runs.forEach((r) => {
      if (!r.asset_id || r.status === 'failed') return;
      const score = r.output?.risk_score;
      if (score == null) return;
      const cur = latest[r.asset_id];
      if (!cur || new Date(r.created_at) > new Date(cur.created_at)) latest[r.asset_id] = { ...r, score: Number(score) };
    });
    const byId = Object.fromEntries(data.assets.map((a) => [a.id, a]));
    return Object.values(latest)
      .map((r) => ({ id: r.asset_id, name: byId[r.asset_id]?.name || 'Unknown asset', category: byId[r.asset_id]?.category, score: r.score, at: r.created_at }))
      .sort((a, b) => b.score - a.score);
  }, [data]);

  if (isLoading) return <LoadingSpinner text="Loading failure risk report..." />;
  if (error) return <ErrorAlert message={errMsg(error)} onRetry={refetch} />;
  if (!data || data.assets.length === 0) return <EmptyState title="No assets" description="There are no assets to report on yet." />;

  const bands = RISK_BANDS.map((b) => ({ key: b.key, name: b.label, color: b.color, value: rows.filter((r) => b.test(r.score)).length }));
  const unscored = Math.max(0, data.assets.length - rows.length);
  const chartData = unscored > 0 ? [...bands, { key: 'unscored', name: 'No prediction', color: '#94a3b8', value: unscored }] : bands;
  const colorMap = Object.fromEntries(chartData.map((d) => [d.key, d.color]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Assets" value={formatNumber(data.assets.length)} />
        <Stat label="Scored" value={formatNumber(rows.length)} sub="Latest failure prediction" />
        <Stat label="High Risk (> 70)" value={formatNumber(bands[2].value)} />
        <Stat label="No Prediction" value={formatNumber(unscored)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Risk Distribution" empty={chartData.every((d) => d.value === 0)}>
          <SimplePie data={chartData} colorFor={(k) => colorMap[k]} />
        </ChartCard>
        <ChartCard title="Assets per Risk Band" empty={chartData.every((d) => d.value === 0)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Assets" radius={[4, 4, 0, 0]}>
                {chartData.map((d) => <Cell key={d.key} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Highest Risk Assets</h3></div>
        {rows.length === 0 ? (
          <EmptyState title="No risk scores yet" description="Run failure predictions on the Failure Risk page to populate this report." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr><th className="px-4 py-2">Asset</th><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Risk score</th><th className="px-4 py-2">Predicted</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(0, 15).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/assets/${r.id}`)}>
                    <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-2">{r.category ? categoryLabel(r.category) : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatNumber(r.score, 1)}</td>
                    <td className="px-4 py-2">{formatDateTime(r.at)}</td>
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

export default function Reports() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('asset_health');
  const [range, setRange] = useState({ from: '', to: '' });
  const [exportState, setExportState] = useState({ status: 'idle', message: '', at: null });

  const exportType = EXPORT_TYPES[tab];

  const handleExport = async () => {
    setExportState({ status: 'generating', message: 'Generating report...', at: null });
    try {
      const filters = {};
      if (tab === 'downtime') {
        if (range.from) filters.from = range.from;
        if (range.to) filters.to = range.to;
      }
      const res = await reportService.exportReport(exportType, 'csv', filters);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setExportState({ status: 'success', message: `${pretty(exportType)} report downloaded.`, at: new Date() });
    } catch (err) {
      setExportState({ status: 'error', message: errMsg(err), at: new Date() });
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Reports' }]} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-500">Asset health, downtime, maintenance, work orders, failure risk and AI model insights.</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button className="btn-secondary inline-flex items-center gap-2" onClick={() => window.print()}>
            <PrinterIcon className="h-4 w-4" />
            Export PDF
          </button>
          {exportType && (
            <button className="btn-primary inline-flex items-center gap-2" onClick={handleExport} disabled={exportState.status === 'generating'}>
              <ArrowDownTrayIcon className="h-4 w-4" />
              {exportState.status === 'generating' ? 'Generating...' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {exportState.status !== 'idle' && (
        <div className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${
          exportState.status === 'success' ? 'bg-green-50 border-green-200 text-green-800'
            : exportState.status === 'error' ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
          {exportState.status === 'success' && <CheckCircleIcon className="h-5 w-5" />}
          {exportState.status === 'error' && <XCircleIcon className="h-5 w-5" />}
          {exportState.status === 'generating' && <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />}
          <span className="flex-1">{exportState.message}{exportState.at ? ` (${formatDateTime(exportState.at)})` : ''}</span>
          {exportState.status !== 'generating' && (
            <button className="text-xs underline" onClick={() => setExportState({ status: 'idle', message: '', at: null })}>Dismiss</button>
          )}
        </div>
      )}

      <div className="border-b border-gray-200 overflow-x-auto no-print">
        <nav className="flex gap-1 min-w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'downtime' && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div>
            <label className="label" htmlFor="rep-from">From</label>
            <input id="rep-from" type="date" className="input-field" value={range.from} max={range.to || undefined}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="rep-to">To</label>
            <input id="rep-to" type="date" className="input-field" value={range.to} min={range.from || undefined}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          {(range.from || range.to) && <button className="btn-secondary" onClick={() => setRange({ from: '', to: '' })}>Clear</button>}
        </div>
      )}

      {tab === 'asset_health' && <AssetHealthTab navigate={navigate} />}
      {tab === 'downtime' && <DowntimeTab range={range} navigate={navigate} />}
      {tab === 'maintenance' && <MaintenanceTab navigate={navigate} />}
      {tab === 'model' && <ModelTab />}
      {tab === 'work_orders' && <WorkOrdersTab />}
      {tab === 'failure_risk' && <FailureRiskTab navigate={navigate} />}
    </div>
  );
}
