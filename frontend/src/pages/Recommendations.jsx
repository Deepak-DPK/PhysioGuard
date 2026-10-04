import { useState, useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  SparklesIcon,
  CheckBadgeIcon,
  CalendarDaysIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  ClockIcon,
  FlagIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { aiService } from '../services/aiService';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Breadcrumbs from '../components/common/Breadcrumbs';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import ErrorAlert from '../components/common/ErrorAlert';
import AIOutputCard from '../components/ai/AIOutputCard';
import AIReviewActions from '../components/ai/AIReviewActions';
import { formatDateTime, formatDate } from '../utils/formatters';

const RUN_TYPES = [
  { value: 'predict_failure', label: 'Failure prediction' },
  { value: 'estimate_rul', label: 'Remaining useful life' },
  { value: 'anomaly_detection', label: 'Anomaly detection' },
  { value: 'defect_recognition', label: 'Defect recognition' },
  { value: 'summarise_notes', label: 'Repair note summary' },
];

const RUN_STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const REVIEW_KEY = 'ai_run_reviews_v1';
const PAGE_SIZE = 12;

function readReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistReviews(map) {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable; reviews remain in memory for this session */
  }
}

function errText(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

function firstDefined(...vals) {
  return vals.find((v) => v !== undefined && v !== null && v !== '');
}

function asList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : x?.name || x?.part_number || JSON.stringify(x)));
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [String(v)];
}

function runTypeLabel(value) {
  return RUN_TYPES.find((t) => t.value === value)?.label || String(value || '').replace(/_/g, ' ');
}

function toResult(run) {
  const out = run.output || {};
  return {
    ...out,
    confidence: run.confidence ?? out.confidence,
    model_version: run.model_version,
    timestamp: run.created_at,
    ai_run_id: run.id,
  };
}

function extractDetails(run) {
  const out = run.output || {};
  return {
    timing: firstDefined(out.recommended_maintenance_date, out.recommended_timing, out.recommended_date, out.timing),
    skills: asList(firstDefined(out.skills_required, out.skill_required, out.skills)),
    parts: asList(firstDefined(out.parts_required, out.recommended_parts, out.parts)),
    downtime: firstDefined(out.estimated_downtime_hours, out.expected_downtime_hours, out.downtime_hours),
    priority: firstDefined(out.priority, out.urgency),
    action: firstDefined(out.recommended_action, out.recommendation, out.summary),
  };
}

function RecommendationDetails({ run }) {
  const d = extractDetails(run);
  const items = [
    { icon: CalendarDaysIcon, label: 'Recommended timing', value: d.timing ? (Number.isNaN(Date.parse(d.timing)) ? String(d.timing) : formatDate(d.timing)) : null },
    { icon: WrenchScrewdriverIcon, label: 'Skills', value: d.skills.length ? d.skills.join(', ') : null },
    { icon: CubeIcon, label: 'Parts', value: d.parts.length ? d.parts.join(', ') : null },
    { icon: ClockIcon, label: 'Expected downtime', value: d.downtime != null ? `${d.downtime} h` : null },
  ];
  return (
    <div className="mt-3 space-y-3">
      {d.action && (
        <p className="text-sm text-gray-800"><span className="font-medium">Recommendation:</span> {d.action}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2">
            <Icon className="h-4 w-4 text-gray-400 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm text-gray-800 break-words">{value || 'Not specified'}</p>
            </div>
          </div>
        ))}
      </div>
      {d.priority && (
        <div className="flex items-center gap-2 text-sm">
          <FlagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">Priority:</span>
          <StatusBadge status={String(d.priority).toLowerCase()} />
        </div>
      )}
    </div>
  );
}

export default function Recommendations() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const canReview = can('ai:review');

  const [runType, setRunType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState(readReviews);

  const runsQuery = useQuery({
    queryKey: ['ai-runs', 'recommendations', runType, status, page],
    queryFn: async () => {
      const params = { page, limit: PAGE_SIZE };
      if (runType) params.run_type = runType;
      if (status) params.status = status;
      const res = await aiService.getRuns(params);
      return { runs: res.data?.data || [], pagination: res.data?.pagination };
    },
    placeholderData: keepPreviousData,
  });

  const reviewer = user?.full_name || user?.name || user?.email || 'Unknown reviewer';

  const onReviewed = useCallback(
    (runId, { decision, reason }) => {
      setReviews((prev) => {
        const next = { ...prev, [runId]: { decision, reason, by: reviewer, at: new Date().toISOString() } };
        persistReviews(next);
        return next;
      });
    },
    [reviewer]
  );

  const reviewOf = useCallback(
    (run) => {
      const out = run.output || {};
      const local = reviews[run.id];
      if (local) return local;
      const decision = firstDefined(run.review_decision, out.review_decision);
      if (decision && decision !== 'pending') {
        return { decision, reason: firstDefined(run.review_reason, out.review_reason), by: firstDefined(run.reviewed_by, out.reviewed_by), at: firstDefined(run.reviewed_at, out.reviewed_at) };
      }
      return null;
    },
    [reviews]
  );

  const { suggestions, approved, closed, failed } = useMemo(() => {
    const s = [];
    const a = [];
    const c = [];
    const f = [];
    (runsQuery.data?.runs || []).forEach((run) => {
      if (run.status === 'failed') return f.push(run);
      const r = reviewOf(run);
      if (!r) return s.push(run);
      if (r.decision === 'approved') return a.push(run);
      return c.push(run);
    });
    return { suggestions: s, approved: a, closed: c, failed: f };
  }, [runsQuery.data, reviewOf]);

  const changeFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const renderRun = (run, mode) => {
    const review = reviewOf(run);
    return (
      <div key={run.id} className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{runTypeLabel(run.run_type)}</span>
          {run.assets?.name && (
            run.asset_id ? <Link to={`/assets/${run.asset_id}`} className="text-primary-600 hover:underline">{run.assets.name}</Link> : <span>{run.assets.name}</span>
          )}
        </div>
        <AIOutputCard result={toResult(run)} title={`${runTypeLabel(run.run_type)} recommendation`}>
          <RecommendationDetails run={run} />
          {mode === 'suggestion' && canReview && (
            <AIReviewActions runId={run.id} onReviewed={(r) => onReviewed(run.id, r)} />
          )}
          {mode === 'suggestion' && !canReview && (
            <p className="mt-3 text-xs text-gray-400">Awaiting review by an authorised reviewer.</p>
          )}
          {mode !== 'suggestion' && review && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${review.decision === 'approved' ? 'bg-green-50 text-green-900' : 'bg-yellow-50 text-yellow-900'}`}>
              <p className="font-medium capitalize">Decision: {review.decision}</p>
              {review.reason && <p className="mt-0.5">Reason: {review.reason}</p>}
              <p className="text-xs mt-1 opacity-80">
                {review.by ? `By ${review.by}` : 'Reviewer not recorded'}{review.at ? ` on ${formatDateTime(review.at)}` : ''}
              </p>
            </div>
          )}
        </AIOutputCard>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Recommendations' }]} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Recommendations</h1>
        <p className="text-sm text-gray-500">AI suggestions are advisory. Only items approved by an authorised reviewer become business decisions.</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          <div>
            <label className="label" htmlFor="rec-type">Run type</label>
            <select id="rec-type" className="input-field" value={runType} onChange={changeFilter(setRunType)}>
              <option value="">All run types</option>
              {RUN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rec-status">Run status</label>
            <select id="rec-status" className="input-field" value={status} onChange={changeFilter(setStatus)}>
              <option value="">All statuses</option>
              {RUN_STATUSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {runsQuery.isLoading ? (
        <LoadingSpinner text="Loading recommendations..." />
      ) : runsQuery.isError ? (
        <ErrorAlert message={errText(runsQuery.error, 'Failed to load recommendations.')} onRetry={() => runsQuery.refetch()} />
      ) : (runsQuery.data?.runs || []).length === 0 ? (
        <div className="card">
          <EmptyState
            title="No recommendations found"
            description="No AI runs match the current filters. Run a prediction from the Failure Risk page to generate recommendations."
            icon={SparklesIcon}
          />
        </div>
      ) : (
        <>
          <section aria-labelledby="ai-suggestions" className="rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary-600" />
              <h2 id="ai-suggestions" className="text-lg font-semibold text-gray-900">AI suggestions (not yet decided)</h2>
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{suggestions.length}</span>
            </div>
            <p className="text-xs text-gray-500">These are machine-generated and have no business effect until reviewed and approved.</p>
            {suggestions.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No suggestions awaiting review on this page.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{suggestions.map((r) => renderRun(r, 'suggestion'))}</div>
            )}
          </section>

          <section aria-labelledby="approved-decisions" className="rounded-xl border border-green-300 bg-green-50/40 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <CheckBadgeIcon className="h-5 w-5 text-green-600" />
              <h2 id="approved-decisions" className="text-lg font-semibold text-gray-900">Approved business decisions</h2>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{approved.length}</span>
            </div>
            <p className="text-xs text-gray-500">Recommendations approved by a named reviewer, with the recorded reason.</p>
            {approved.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No approved decisions on this page.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{approved.map((r) => renderRun(r, 'approved'))}</div>
            )}
          </section>

          {closed.length > 0 && (
            <section aria-labelledby="rejected-decisions" className="rounded-xl border border-gray-300 bg-white p-4 space-y-4">
              <div className="flex items-center gap-2">
                <XCircleIcon className="h-5 w-5 text-gray-500" />
                <h2 id="rejected-decisions" className="text-lg font-semibold text-gray-900">Rejected or overridden</h2>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{closed.length}</span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{closed.map((r) => renderRun(r, 'closed'))}</div>
            </section>
          )}

          {failed.length > 0 && (
            <section aria-labelledby="failed-runs" className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                <h2 id="failed-runs" className="text-lg font-semibold text-gray-900">Failed runs</h2>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{failed.length}</span>
              </div>
              <ul className="divide-y divide-red-100">
                {failed.map((run) => (
                  <li key={run.id} className="py-2 text-sm">
                    <p className="font-medium text-gray-800">{runTypeLabel(run.run_type)}{run.assets?.name ? ` - ${run.assets.name}` : ''}</p>
                    <p className="text-red-700">{run.error_message || 'The run failed without an error message.'}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(run.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Pagination pagination={runsQuery.data?.pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
