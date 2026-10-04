import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  CircleStackIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { assetService } from '../services/assetService';
import { aiService } from '../services/aiService';
import { usePermissions } from '../hooks/usePermissions';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import AIOutputCard from '../components/ai/AIOutputCard';
import AIReviewActions from '../components/ai/AIReviewActions';
import ConfidenceBar from '../components/ai/ConfidenceBar';
import { ASSET_CATEGORIES, CRITICALITY } from '../utils/constants';
import { formatRelative, categoryLabel } from '../utils/formatters';

const LOW_CONFIDENCE = 0.5;

const BUCKETS = [
  { label: '0-20', min: 0, max: 20, color: '#16a34a' },
  { label: '21-40', min: 20, max: 40, color: '#84cc16' },
  { label: '41-60', min: 40, max: 60, color: '#eab308' },
  { label: '61-80', min: 60, max: 80, color: '#f97316' },
  { label: '81-100', min: 80, max: 100.01, color: '#dc2626' },
];

function errText(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

/** Classify an AI failure into one of the supported failure states. */
function classifyError(err) {
  const status = err?.response?.status;
  const msg = String(errText(err, '')).toLowerCase();
  if (status === 503 || status === 501 || /unavailable|not deployed|no active model|api key|quota|model not found|overloaded/.test(msg)) {
    return { state: 'unavailable-model', message: errText(err, 'The prediction model is currently unavailable.') };
  }
  if (status === 422 || /insufficient|not enough|no telemetry|no data|too few/.test(msg)) {
    return { state: 'insufficient-data', message: errText(err, 'Not enough data to produce a prediction for this asset.') };
  }
  return { state: 'failed-prediction', message: errText(err, 'The prediction failed to complete.') };
}

function runToResult(run) {
  if (!run) return null;
  const out = run.output || {};
  return {
    ...out,
    confidence: run.confidence ?? out.confidence,
    model_version: run.model_version,
    timestamp: run.created_at,
    ai_run_id: run.id,
    asset_id: run.asset_id,
  };
}

function mergeResults(failure, rul) {
  if (!failure && !rul) return null;
  const confs = [failure?.confidence, rul?.confidence].filter((c) => c != null);
  const factors = [...(failure?.factors || []), ...(rul?.factors || [])];
  const newest = [failure, rul].filter(Boolean).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];
  return {
    risk_score: failure?.risk_score,
    rul_days: rul?.rul_days,
    confidence: confs.length ? Math.min(...confs) : undefined,
    explanation: [failure?.explanation, rul?.explanation].filter(Boolean).join(' '),
    factors: Array.from(new Set(factors)),
    recommended_action: failure?.recommended_action,
    recommended_maintenance_date: rul?.recommended_maintenance_date,
    urgency: failure?.urgency,
    model_version: failure?.model_version || rul?.model_version,
    timestamp: newest?.timestamp,
    ai_run_id: failure?.ai_run_id || rul?.ai_run_id,
    asset_id: failure?.asset_id || rul?.asset_id,
  };
}

function StateBanner({ state, message, onRetry, running }) {
  const config = {
    loading: { icon: BoltIcon, cls: 'bg-blue-50 border-blue-200 text-blue-800', title: 'Running prediction...' },
    'unavailable-model': { icon: NoSymbolIcon, cls: 'bg-gray-50 border-gray-300 text-gray-800', title: 'Model unavailable' },
    'insufficient-data': { icon: CircleStackIcon, cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', title: 'Insufficient data' },
    'low-confidence': { icon: ExclamationTriangleIcon, cls: 'bg-orange-50 border-orange-200 text-orange-800', title: 'Low confidence result' },
    'failed-prediction': { icon: ShieldExclamationIcon, cls: 'bg-red-50 border-red-200 text-red-800', title: 'Prediction failed' },
  }[state];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${config.cls}`} role="status">
      <Icon className={`h-5 w-5 mt-0.5 ${state === 'loading' ? 'animate-pulse' : ''}`} />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{config.title}</p>
        {message && <p className="mt-0.5">{message}</p>}
        {state === 'low-confidence' && (
          <p className="mt-0.5">Treat this output as advisory only. Human review is strongly recommended before acting on it.</p>
        )}
        {state === 'insufficient-data' && <p className="mt-0.5">Add telemetry readings or service history for this asset, then retry.</p>}
        {state === 'unavailable-model' && <p className="mt-0.5">No automated estimate is shown. Use manual inspection until the model is back.</p>}
        {onRetry && state !== 'loading' && state !== 'low-confidence' && (
          <button onClick={onRetry} disabled={running} className="mt-2 text-sm font-medium underline">Retry</button>
        )}
      </div>
    </div>
  );
}

function riskColor(score) {
  if (score == null) return 'text-gray-400';
  if (score > 70) return 'text-red-600';
  if (score > 40) return 'text-yellow-600';
  return 'text-green-600';
}

export default function FailureRisk() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canExecute = can('ai:execute');
  const canReview = can('ai:review');

  const [category, setCategory] = useState('');
  const [criticality, setCriticality] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [running, setRunning] = useState({}); // assetId -> true
  const [fresh, setFresh] = useState({}); // assetId -> { result, state, message }

  const assetsQuery = useQuery({
    queryKey: ['assets', 'risk', category, criticality],
    queryFn: async () => {
      const params = { limit: 100 };
      if (category) params.category = category;
      if (criticality) params.criticality = criticality;
      const res = await assetService.getAll(params);
      return res.data?.data || [];
    },
  });

  const runsQuery = useQuery({
    queryKey: ['ai-runs', 'risk'],
    queryFn: async () => {
      const [fail, rul] = await Promise.all([
        aiService.getRuns({ run_type: 'predict_failure', limit: 100 }),
        aiService.getRuns({ run_type: 'estimate_rul', limit: 100 }),
      ]);
      const latest = (rows) => {
        const map = {};
        (rows || []).forEach((r) => {
          if (!r.asset_id) return;
          const cur = map[r.asset_id];
          if (!cur || new Date(r.created_at) > new Date(cur.created_at)) map[r.asset_id] = r;
        });
        return map;
      };
      return { failure: latest(fail.data?.data), rul: latest(rul.data?.data) };
    },
  });

  const rows = useMemo(() => {
    const assets = (assetsQuery.data || []).filter((a) => {
      if (category && a.category !== category) return false;
      if (criticality && a.criticality !== criticality) return false;
      if (search && !a.name?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return assets.map((asset) => {
      const fRun = runsQuery.data?.failure?.[asset.id];
      const rRun = runsQuery.data?.rul?.[asset.id];
      const stored = { failure: runToResult(fRun?.status === 'failed' ? null : fRun), rul: runToResult(rRun?.status === 'failed' ? null : rRun) };
      const storedFailed = (fRun?.status === 'failed' && !stored.failure) || (rRun?.status === 'failed' && !stored.rul);
      const storedResult = mergeResults(stored.failure, stored.rul);
      const f = fresh[asset.id];
      const result = f?.result || storedResult;
      let state = null;
      let message = '';
      if (running[asset.id]) {
        state = 'loading';
      } else if (f?.state) {
        state = f.state;
        message = f.message;
      } else if (!result && storedFailed) {
        state = 'failed-prediction';
        message = fRun?.error_message || rRun?.error_message || 'The last prediction run failed.';
      } else if (result?.confidence != null && result.confidence < LOW_CONFIDENCE) {
        state = 'low-confidence';
        message = `Model confidence is ${(result.confidence * 100).toFixed(1)}%, below the ${LOW_CONFIDENCE * 100}% reliability threshold.`;
      }
      return { asset, result, state, message };
    });
  }, [assetsQuery.data, runsQuery.data, fresh, running, category, criticality, search]);

  const distribution = useMemo(() => {
    const counts = BUCKETS.map((b) => ({ ...b, count: 0 }));
    rows.forEach(({ result }) => {
      if (result?.risk_score == null) return;
      const b = counts.find((x) => result.risk_score >= x.min && result.risk_score < x.max);
      if (b) b.count += 1;
    });
    return counts;
  }, [rows]);

  const scored = distribution.reduce((s, b) => s + b.count, 0);
  const highRisk = rows.filter((r) => r.result?.risk_score > 70).length;

  const runPrediction = useCallback(
    async (asset) => {
      setRunning((p) => ({ ...p, [asset.id]: true }));
      setFresh((p) => {
        const next = { ...p };
        delete next[asset.id];
        return next;
      });
      setExpanded(asset.id);
      const [failRes, rulRes] = await Promise.allSettled([aiService.predictFailure(asset.id), aiService.estimateRUL(asset.id)]);
      const failure = failRes.status === 'fulfilled' ? failRes.value.data?.data : null;
      const rul = rulRes.status === 'fulfilled' ? rulRes.value.data?.data : null;
      const result = mergeResults(failure, rul);

      let entry;
      if (!result) {
        const reason = failRes.status === 'rejected' ? failRes.reason : rulRes.reason;
        const c = classifyError(reason);
        entry = { state: c.state, message: c.message };
      } else {
        const partial = failRes.status === 'rejected' || rulRes.status === 'rejected';
        const partialMsg = partial
          ? `Only part of the analysis completed (${failRes.status === 'rejected' ? 'failure risk' : 'remaining useful life'} unavailable): ${errText(failRes.status === 'rejected' ? failRes.reason : rulRes.reason, 'unknown error')}`
          : '';
        if (result.confidence != null && result.confidence < LOW_CONFIDENCE) {
          entry = { result, state: 'low-confidence', message: `Model confidence is ${(result.confidence * 100).toFixed(1)}%. ${partialMsg}`.trim() };
        } else if (partial) {
          entry = { result, state: 'failed-prediction', message: partialMsg };
        } else {
          entry = { result };
        }
      }
      setFresh((p) => ({ ...p, [asset.id]: entry }));
      setRunning((p) => {
        const next = { ...p };
        delete next[asset.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['ai-runs'] });
    },
    [queryClient]
  );

  const isLoading = assetsQuery.isLoading || runsQuery.isLoading;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Failure Risk' }]} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Failure Risk &amp; Remaining Useful Life</h1>
        <p className="text-sm text-gray-500">AI-estimated failure risk and RUL per asset. Predictions are advisory and require human review.</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="fr-search">Search</label>
            <input id="fr-search" className="input-field" placeholder="Asset name" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="fr-category">Category</label>
            <select id="fr-category" className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(ASSET_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fr-crit">Criticality</label>
            <select id="fr-crit" className="input-field" value={criticality} onChange={(e) => setCriticality(e.target.value)}>
              <option value="">All criticality levels</option>
              {Object.entries(CRITICALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading assets and predictions..." />
      ) : assetsQuery.isError ? (
        <ErrorAlert message={errText(assetsQuery.error, 'Failed to load assets.')} onRetry={() => assetsQuery.refetch()} />
      ) : (
        <>
          {runsQuery.isError && (
            <ErrorAlert message={`Could not load existing predictions: ${errText(runsQuery.error, 'unknown error')}`} onRetry={() => runsQuery.refetch()} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ChartBarIcon className="h-5 w-5 text-gray-500" /> Risk score distribution</h2>
                <span className="text-xs text-gray-500">{scored} asset{scored === 1 ? '' : 's'} scored</span>
              </div>
              {scored === 0 ? (
                <EmptyState title="No risk scores yet" description="Run a prediction on an asset to populate the distribution." icon={ChartBarIcon} />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [v, 'Assets']} labelFormatter={(l) => `Risk score ${l}`} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {distribution.map((b) => <Cell key={b.label} fill={b.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card space-y-3">
              <h2 className="font-semibold text-gray-900">Summary</h2>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Assets shown</p>
                <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-700">High risk (&gt; 70)</p>
                <p className="text-2xl font-bold text-red-700">{highRisk}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Without a prediction</p>
                <p className="text-2xl font-bold text-gray-900">{rows.filter((r) => !r.result).length}</p>
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="card">
              <EmptyState title="No assets match" description="Adjust the filters to see assets and their predictions." />
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(({ asset, result, state, message }) => {
                const isOpen = expanded === asset.id;
                const isRunning = !!running[asset.id];
                return (
                  <div key={asset.id} className="card p-0 overflow-hidden">
                    <div className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <Link to={`/assets/${asset.id}`} className="font-semibold text-gray-900 hover:text-primary-600">{asset.name}</Link>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{categoryLabel(asset.category)}</span>
                          <StatusBadge status={asset.criticality} label={`${CRITICALITY[asset.criticality] || asset.criticality} criticality`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 md:w-96 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Risk</p>
                          <p className={`text-lg font-bold ${riskColor(result?.risk_score)}`}>{result?.risk_score != null ? `${result.risk_score}%` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">RUL</p>
                          <p className="text-lg font-bold text-gray-900">{result?.rul_days != null ? `${result.rul_days} d` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Updated</p>
                          <p className="text-sm text-gray-700 mt-1">{result?.timestamp ? formatRelative(result.timestamp) : 'Never'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canExecute && (
                          <button onClick={() => runPrediction(asset)} disabled={isRunning} className="btn-primary text-sm inline-flex items-center gap-1">
                            <BoltIcon className="h-4 w-4" /> {isRunning ? 'Running...' : result ? 'Re-run' : 'Run prediction'}
                          </button>
                        )}
                        <button
                          onClick={() => setExpanded(isOpen ? null : asset.id)}
                          className="btn-secondary p-2"
                          aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {state && !isOpen && state !== 'loading' && (
                      <div className="px-4 pb-4">
                        <StateBanner state={state} message={message} />
                      </div>
                    )}

                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                        {state && <StateBanner state={state} message={message} running={isRunning} onRetry={canExecute ? () => runPrediction(asset) : undefined} />}
                        {isRunning && <LoadingSpinner size="sm" text="Contacting prediction model..." />}
                        {!isRunning && !result && !state && (
                          <p className="text-sm text-gray-500">No prediction exists for this asset yet.{canExecute ? ' Use "Run prediction" to generate one.' : ''}</p>
                        )}
                        {!isRunning && result && state !== 'unavailable-model' && (
                          <AIOutputCard result={result} title={`Failure risk and RUL: ${asset.name}`}>
                            <div className="mt-3 space-y-3">
                              <ConfidenceBar value={result.confidence} />
                              {result.recommended_action && (
                                <p className="text-sm text-gray-700"><span className="font-medium">Recommended action:</span> {result.recommended_action}</p>
                              )}
                              {result.recommended_maintenance_date && (
                                <p className="text-sm text-gray-700"><span className="font-medium">Suggested maintenance by:</span> {String(result.recommended_maintenance_date).slice(0, 10)}</p>
                              )}
                              {canReview && result.ai_run_id && (
                                <AIReviewActions
                                  runId={result.ai_run_id}
                                  onReviewed={() => queryClient.invalidateQueries({ queryKey: ['ai-runs'] })}
                                />
                              )}
                              {!canReview && <p className="text-xs text-gray-400">You do not have permission to review AI outputs.</p>}
                            </div>
                          </AIOutputCard>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
