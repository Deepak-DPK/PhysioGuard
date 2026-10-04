import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
  ChartBarIcon,
  HandThumbUpIcon,
  BellAlertIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { reportService } from '../services/reportService';
import { aiService } from '../services/aiService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import ConfidenceBar from '../components/ai/ConfidenceBar';
import { formatDate, formatNumber, formatPercentage } from '../utils/formatters';

const CRUMBS = [{ label: 'Home', path: '/dashboard' }, { label: 'Reliability' }];

const CONF_BUCKETS = [
  { label: '< 50%', min: 0, max: 0.5, color: '#dc2626' },
  { label: '50-69%', min: 0.5, max: 0.7, color: '#f97316' },
  { label: '70-84%', min: 0.7, max: 0.85, color: '#eab308' },
  { label: '85-100%', min: 0.85, max: 1.0001, color: '#16a34a' },
];

function errText(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

/** Metric values may be stored as a 0-1 fraction or a 0-100 percentage. */
function toPct(v) {
  if (v == null || Number.isNaN(Number(v))) return null;
  const n = Number(v);
  return n <= 1 ? n * 100 : n;
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return null;
}

function StatCard({ icon: Icon, label, value, hint, tone = 'text-gray-900' }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon className="h-5 w-5" />
        <p className="text-sm">{label}</p>
      </div>
      <p className={`text-2xl font-bold mt-2 ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function driftInfo(metrics) {
  const raw = pick(metrics, 'drift_score', 'drift', 'data_drift');
  const label = pick(metrics, 'drift_status');
  if (raw == null && !label) return null;
  const score = raw != null ? Number(raw) : null;
  let level = label ? String(label).toLowerCase() : null;
  if (!level && score != null) level = score >= 0.3 ? 'high' : score >= 0.15 ? 'moderate' : 'low';
  const cls = level === 'high' || level === 'critical' ? 'bg-red-100 text-red-800' : level === 'moderate' || level === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  return { score, level, cls };
}

export default function Reliability() {
  const perfQuery = useQuery({
    queryKey: ['reports', 'model-performance'],
    queryFn: async () => {
      const res = await reportService.modelPerformance();
      return res.data?.data || null;
    },
  });

  const runsQuery = useQuery({
    queryKey: ['ai-runs', 'reliability'],
    queryFn: async () => {
      const res = await aiService.getRuns({ limit: 100 });
      return res.data?.data || [];
    },
    retry: 1,
  });

  const perf = perfQuery.data;
  const models = perf?.models || [];
  const runs = runsQuery.data || [];

  const runsOverTime = useMemo(() => {
    const byDay = {};
    runs.forEach((r) => {
      if (!r.created_at) return;
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { day, completed: 0, failed: 0 };
      if (r.status === 'failed') byDay[day].failed += 1;
      else byDay[day].completed += 1;
    });
    return Object.values(byDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({ ...d, label: formatDate(d.day).slice(0, 6) }));
  }, [runs]);

  const latencyOverTime = useMemo(() => {
    const byDay = {};
    runs.forEach((r) => {
      if (!r.created_at || r.latency_ms == null) return;
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { day, sum: 0, n: 0 };
      byDay[day].sum += r.latency_ms;
      byDay[day].n += 1;
    });
    return Object.values(byDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => ({ label: formatDate(d.day).slice(0, 6), latency: Math.round(d.sum / d.n) }));
  }, [runs]);

  const confidenceDist = useMemo(() => {
    const buckets = CONF_BUCKETS.map((b) => ({ ...b, count: 0 }));
    runs.forEach((r) => {
      if (r.confidence == null) return;
      const c = Number(r.confidence);
      const b = buckets.find((x) => c >= x.min && c < x.max);
      if (b) b.count += 1;
    });
    return buckets;
  }, [runs]);

  const confTotal = confidenceDist.reduce((s, b) => s + b.count, 0);

  // Aggregate quality indicators from active model metrics (average across models that report them).
  const aggregate = useMemo(() => {
    const avg = (keys, transform = (v) => v) => {
      const vals = models.map((m) => pick(m.metrics, ...keys)).filter((v) => v != null).map((v) => transform(Number(v)));
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };
    return {
      falseAlarm: avg(['false_alarm_rate', 'false_positive_rate'], (v) => toPct(v)),
      missed: avg(['missed_failures', 'missed_failure_rate', 'false_negative_rate']),
      leadTime: avg(['prediction_lead_time_days', 'lead_time_days', 'avg_lead_time_days', 'prediction_lead_time']),
      adoption: avg(['adoption_rate', 'adoption'], (v) => toPct(v)),
    };
  }, [models]);

  const missedIsRate = models.some((m) => {
    const v = pick(m.metrics, 'missed_failure_rate', 'false_negative_rate');
    return v != null;
  });

  const completionRate = perf && perf.total_runs > 0 ? (perf.completed_runs / perf.total_runs) * 100 : null;
  const feedbackCoverage = perf && perf.total_runs > 0 ? Math.min(100, (perf.total_feedback / perf.total_runs) * 100) : null;
  const adoption = aggregate.adoption ?? feedbackCoverage;

  const pieData = perf
    ? [
        { name: 'Completed', value: perf.completed_runs || 0, color: '#16a34a' },
        { name: 'Failed', value: perf.failed_runs || 0, color: '#dc2626' },
        { name: 'Other', value: Math.max(0, (perf.total_runs || 0) - (perf.completed_runs || 0) - (perf.failed_runs || 0)), color: '#9ca3af' },
      ].filter((d) => d.value > 0)
    : [];

  if (perfQuery.isLoading) return <LoadingSpinner text="Loading model performance..." />;

  if (perfQuery.isError) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={CRUMBS} />
        <h1 className="text-2xl font-bold text-gray-900">Reliability &amp; Model Performance</h1>
        <ErrorAlert message={errText(perfQuery.error, 'Failed to load model performance.')} onRetry={() => perfQuery.refetch()} />
      </div>
    );
  }

  if (!perf) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={CRUMBS} />
        <h1 className="text-2xl font-bold text-gray-900">Reliability &amp; Model Performance</h1>
        <div className="card"><EmptyState title="No performance data" description="Model performance has not been reported yet." icon={CpuChipIcon} /></div>
      </div>
    );
  }

  const feedbackTone = perf.user_feedback_accuracy_pct == null ? 'text-gray-900' : perf.user_feedback_accuracy_pct >= 80 ? 'text-green-600' : perf.user_feedback_accuracy_pct >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={CRUMBS} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reliability &amp; Model Performance</h1>
        <p className="text-sm text-gray-500">Monitor AI run health, model quality, drift, and adoption. Based on the 100 most recent runs and feedback entries.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={CpuChipIcon} label="Total runs" value={formatNumber(perf.total_runs)} />
        <StatCard icon={CheckCircleIcon} label="Completed" value={formatNumber(perf.completed_runs)} tone="text-green-600" hint={completionRate != null ? `${completionRate.toFixed(1)}% success` : undefined} />
        <StatCard icon={XCircleIcon} label="Failed" value={formatNumber(perf.failed_runs)} tone={perf.failed_runs > 0 ? 'text-red-600' : 'text-gray-900'} />
        <StatCard icon={BoltIcon} label="Avg latency" value={perf.avg_latency_ms != null ? `${formatNumber(perf.avg_latency_ms)} ms` : '—'} />
        <StatCard icon={ChartBarIcon} label="Avg confidence" value={perf.avg_confidence != null ? formatPercentage(perf.avg_confidence * 100) : '—'} />
        <StatCard
          icon={HandThumbUpIcon}
          label="Feedback accuracy"
          value={perf.user_feedback_accuracy_pct != null ? formatPercentage(perf.user_feedback_accuracy_pct) : 'No feedback'}
          tone={feedbackTone}
          hint={`${formatNumber(perf.total_feedback)} feedback entries`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-3">Runs over time</h2>
          {runsQuery.isLoading ? (
            <LoadingSpinner size="sm" text="Loading runs..." />
          ) : runsQuery.isError ? (
            <ErrorAlert message={`Could not load run history: ${errText(runsQuery.error, 'unknown error')}`} onRetry={() => runsQuery.refetch()} />
          ) : runsOverTime.length === 0 ? (
            <EmptyState title="No runs yet" description="Run history will appear here once AI runs are recorded." icon={ChartBarIcon} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={runsOverTime} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="failed" name="Failed" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Run outcomes</h2>
          {pieData.length === 0 ? (
            <EmptyState title="No outcomes" description="No runs recorded." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Confidence distribution</h2>
          {confTotal === 0 ? (
            <EmptyState title="No confidence data" description="Completed runs with confidence values will be summarised here." icon={ChartBarIcon} />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceDist} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [v, 'Runs']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {confidenceDist.map((b) => <Cell key={b.label} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Average latency by day (ms)</h2>
          {latencyOverTime.length === 0 ? (
            <EmptyState title="No latency data" description="Latency is recorded for each AI run." icon={BoltIcon} />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyOverTime} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v} ms`, 'Latency']} />
                  <Area type="monotone" dataKey="latency" stroke="#2563eb" fill="#bfdbfe" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={BellAlertIcon}
          label="False alarm rate"
          value={aggregate.falseAlarm != null ? formatPercentage(aggregate.falseAlarm) : 'Not reported'}
          hint="Predicted failures that did not occur"
          tone={aggregate.falseAlarm != null && aggregate.falseAlarm > 20 ? 'text-red-600' : 'text-gray-900'}
        />
        <StatCard
          icon={ExclamationTriangleIcon}
          label="Missed failures"
          value={aggregate.missed != null ? (missedIsRate ? formatPercentage(toPct(aggregate.missed)) : formatNumber(aggregate.missed, 0)) : 'Not reported'}
          hint="Failures the model did not predict"
          tone={aggregate.missed ? 'text-red-600' : 'text-gray-900'}
        />
        <StatCard
          icon={ArrowTrendingUpIcon}
          label="Prediction lead time"
          value={aggregate.leadTime != null ? `${formatNumber(aggregate.leadTime, 1)} days` : 'Not reported'}
          hint="Average warning before failure"
        />
        <div className="card">
          <div className="flex items-center gap-2 text-gray-500">
            <UserGroupIcon className="h-5 w-5" />
            <p className="text-sm">Adoption</p>
          </div>
          {adoption != null ? (
            <div className="mt-3">
              <ConfidenceBar value={adoption / 100} label={aggregate.adoption != null ? 'Adoption rate' : 'Reviewed runs (adoption proxy)'} />
            </div>
          ) : (
            <p className="text-2xl font-bold mt-2 text-gray-900">Not reported</p>
          )}
          <p className="text-xs text-gray-400 mt-2">How often AI outputs are reviewed and used by staff</p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Model versions</h2>
        {models.length === 0 ? (
          <EmptyState title="No active models" description="No model versions are currently deployed." icon={CpuChipIcon} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Version</th>
                  <th className="py-2 pr-4">Asset class</th>
                  <th className="py-2 pr-4">Deployed</th>
                  <th className="py-2 pr-4 text-right">Accuracy</th>
                  <th className="py-2 pr-4 text-right">Precision</th>
                  <th className="py-2 pr-4 text-right">Recall</th>
                  <th className="py-2 pr-4 text-right">F1</th>
                  <th className="py-2 pr-4 text-right">MAE</th>
                  <th className="py-2 pr-4">Drift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {models.map((m) => {
                  const mt = m.metrics || {};
                  const pctCell = (v) => (v == null ? '—' : formatPercentage(toPct(v)));
                  const drift = driftInfo(mt);
                  const mae = pick(mt, 'mae', 'MAE');
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-900">{m.name}</td>
                      <td className="py-2 pr-4">{m.version}</td>
                      <td className="py-2 pr-4 capitalize">{m.asset_class ? m.asset_class.replace(/_/g, ' ') : 'All'}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(m.deployed_at)}</td>
                      <td className="py-2 pr-4 text-right">{pctCell(pick(mt, 'accuracy'))}</td>
                      <td className="py-2 pr-4 text-right">{pctCell(pick(mt, 'precision'))}</td>
                      <td className="py-2 pr-4 text-right">{pctCell(pick(mt, 'recall'))}</td>
                      <td className="py-2 pr-4 text-right">{pctCell(pick(mt, 'f1', 'f1_score'))}</td>
                      <td className="py-2 pr-4 text-right">{mae != null ? formatNumber(mae, 2) : '—'}</td>
                      <td className="py-2 pr-4">
                        {drift ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${drift.cls}`}>
                            {drift.level}{drift.score != null ? ` (${drift.score.toFixed(2)})` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not monitored</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
