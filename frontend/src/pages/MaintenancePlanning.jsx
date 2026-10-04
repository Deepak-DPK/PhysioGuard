import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  XMarkIcon,
  UserPlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  LockClosedIcon,
  PaperClipIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  PlayIcon,
  PaperAirplaneIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { workOrderService } from '../services/workOrderService';
import { assetService } from '../services/assetService';
import { technicianService } from '../services/technicianService';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { PRIORITY } from '../utils/constants';
import { formatDateTime, formatNumber } from '../utils/formatters';

const COLUMNS = [
  { key: 'open', label: 'Open', accent: 'border-t-blue-500' },
  { key: 'assigned', label: 'Assigned', accent: 'border-t-indigo-500' },
  { key: 'in_progress', label: 'In Progress', accent: 'border-t-yellow-500' },
  { key: 'pending_review', label: 'Pending Review', accent: 'border-t-purple-500' },
  { key: 'closed', label: 'Closed', accent: 'border-t-gray-400' },
];

const WO_TYPES = [
  { value: 'preventive', label: 'Preventive' },
  { value: 'corrective', label: 'Corrective' },
  { value: 'emergency', label: 'Emergency' },
];

const EMPTY_FORM = { asset_id: '', title: '', type: 'corrective', priority: 'medium', assigned_to: '', estimated_downtime_hours: '', notes: '' };

const LOG_KEY = 'wo_decision_log_v1';

function readLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLog(log) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* storage unavailable; log stays in memory only */
  }
}

function errMsg(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
}

function partsList(wo) {
  const parts = wo?.parts_used;
  if (!Array.isArray(parts)) return [];
  return parts.map((p) => (typeof p === 'string' ? { name: p } : p));
}

function evidenceList(wo) {
  return Array.isArray(wo?.evidence_urls) ? wo.evidence_urls : [];
}

export default function MaintenancePlanning() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canCreate = can('work_orders:create');
  const canUpdate = can('work_orders:update');
  const canApprove = can('work_orders:approve');
  const canClose = can('work_orders:close');

  const [priorityFilter, setPriorityFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignee, setAssignee] = useState('');
  const [decision, setDecision] = useState(null); // { wo, action: 'approve'|'reject'|'close' }
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');
  const [log, setLog] = useState(readLog);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const woQuery = useQuery({
    queryKey: ['work-orders', 'board'],
    queryFn: async () => {
      const res = await workOrderService.getAll({ limit: 100, sort: '-created_at' });
      return res.data?.data || [];
    },
  });

  const assetsQuery = useQuery({
    queryKey: ['assets', 'options'],
    queryFn: async () => {
      const res = await assetService.getAll({ limit: 100 });
      return res.data?.data || [];
    },
    staleTime: 60000,
  });

  const techQuery = useQuery({
    queryKey: ['technicians', 'options'],
    queryFn: async () => {
      const res = await technicianService.getAll();
      return res.data?.data || [];
    },
    staleTime: 60000,
    retry: false,
  });

  const technicians = techQuery.data || [];
  const techName = useCallback(
    (userId) => {
      if (!userId) return null;
      const t = technicians.find((x) => x.user_id === userId);
      return t?.users?.full_name || `User ${String(userId).slice(0, 6)}`;
    },
    [technicians]
  );

  const workOrders = woQuery.data || [];
  const filtered = useMemo(
    () => workOrders.filter((w) => !priorityFilter || w.priority === priorityFilter),
    [workOrders, priorityFilter]
  );

  const grouped = useMemo(() => {
    const map = {};
    COLUMNS.forEach((c) => (map[c.key] = []));
    filtered.forEach((w) => {
      // approved/rejected work orders awaiting closure stay visible in the review column
      const key = w.status === 'approved' || w.status === 'rejected' ? 'pending_review' : w.status;
      if (map[key]) map[key].push(w);
    });
    return map;
  }, [filtered]);

  const selected = useMemo(() => workOrders.find((w) => w.id === selectedId) || null, [workOrders, selectedId]);

  const appendLog = useCallback(
    (woId, entry) => {
      setLog((prev) => {
        const next = { ...prev, [woId]: [...(prev[woId] || []), entry] };
        writeLog(next);
        return next;
      });
    },
    []
  );

  const actor = user?.full_name || user?.name || user?.email || 'Unknown user';

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['work-orders'] });

  const createMutation = useMutation({
    mutationFn: (payload) => workOrderService.create(payload),
    onSuccess: (res) => {
      const created = res.data?.data;
      if (created?.id) {
        appendLog(created.id, { action: 'created', actor, at: new Date().toISOString(), reason: form.notes || 'Work order created' });
      }
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setFormError('');
      showToast('Work order created');
      refresh();
    },
    onError: (err) => setFormError(errMsg(err, 'Failed to create work order')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => workOrderService.update(id, data),
    onSuccess: refresh,
    onError: (err) => showToast(errMsg(err, 'Update failed')),
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ wo, action, reason: why }) => {
      if (action === 'approve') return workOrderService.approve(wo.id, why);
      if (action === 'reject') return workOrderService.reject(wo.id, why);
      return workOrderService.close(wo.id);
    },
    onSuccess: (_res, vars) => {
      appendLog(vars.wo.id, {
        action: vars.action === 'close' ? 'closed' : vars.action === 'approve' ? 'approved' : 'rejected',
        actor,
        at: new Date().toISOString(),
        reason: vars.reason,
      });
      setDecision(null);
      setReason('');
      setActionError('');
      showToast(`Work order ${vars.action === 'close' ? 'closed' : vars.action === 'approve' ? 'approved' : 'rejected'}`);
      refresh();
    },
    onError: (err) => setActionError(errMsg(err, 'Action failed')),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }) => workOrderService.uploadEvidence(id, file),
    onSuccess: (_res, vars) => {
      appendLog(vars.id, { action: 'evidence_uploaded', actor, at: new Date().toISOString(), reason: vars.file.name });
      showToast('Evidence uploaded');
      refresh();
    },
    onError: (err) => showToast(errMsg(err, 'Evidence upload failed')),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.asset_id) return setFormError('Please select an asset.');
    if (!form.title.trim()) return setFormError('Title is required.');
    const payload = {
      asset_id: form.asset_id,
      title: form.title.trim(),
      type: form.type,
      priority: form.priority,
      notes: form.notes.trim() || undefined,
    };
    if (form.assigned_to) {
      payload.assigned_to = form.assigned_to;
      payload.status = 'assigned';
    }
    if (form.estimated_downtime_hours !== '') payload.estimated_downtime_hours = Number(form.estimated_downtime_hours);
    createMutation.mutate(payload);
  };

  const openAssign = (wo) => {
    setAssignTarget(wo);
    setAssignee(wo.assigned_to || '');
  };

  const submitAssign = () => {
    if (!assignee) return;
    const wo = assignTarget;
    updateMutation.mutate(
      { id: wo.id, data: { assigned_to: assignee, status: 'assigned' } },
      {
        onSuccess: () => {
          appendLog(wo.id, { action: 'assigned', actor, at: new Date().toISOString(), reason: `Assigned to ${techName(assignee)}` });
          setAssignTarget(null);
          showToast('Work order assigned');
        },
      }
    );
  };

  const moveStatus = (wo, status, label) => {
    updateMutation.mutate(
      { id: wo.id, data: { status } },
      {
        onSuccess: () => {
          appendLog(wo.id, { action: label, actor, at: new Date().toISOString(), reason: `Status changed to ${status.replace(/_/g, ' ')}` });
        },
      }
    );
  };

  const triggerUpload = (wo) => {
    setUploadTarget(wo.id);
    fileInputRef.current?.click();
  };

  const onFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (file && uploadTarget) uploadMutation.mutate({ id: uploadTarget, file });
    e.target.value = '';
  };

  const openDecision = (wo, action) => {
    setDecision({ wo, action });
    setReason('');
    setActionError('');
  };

  const confirmDecision = () => {
    if (!reason.trim()) {
      setActionError('A reason is mandatory for this decision.');
      return;
    }
    decisionMutation.mutate({ wo: decision.wo, action: decision.action, reason: reason.trim() });
  };

  const renderCardActions = (wo) => {
    const btn = 'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border';
    return (
      <div className="flex flex-wrap gap-1.5 mt-3">
        {canUpdate && (wo.status === 'open' || wo.status === 'assigned') && (
          <button onClick={() => openAssign(wo)} className={`${btn} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}>
            <UserPlusIcon className="h-3.5 w-3.5" /> {wo.assigned_to ? 'Reassign' : 'Assign'}
          </button>
        )}
        {canUpdate && wo.status === 'assigned' && (
          <button onClick={() => moveStatus(wo, 'in_progress', 'started')} className={`${btn} border-yellow-200 text-yellow-700 hover:bg-yellow-50`}>
            <PlayIcon className="h-3.5 w-3.5" /> Start
          </button>
        )}
        {canUpdate && wo.status === 'in_progress' && (
          <button onClick={() => moveStatus(wo, 'pending_review', 'submitted_for_review')} className={`${btn} border-purple-200 text-purple-700 hover:bg-purple-50`}>
            <PaperAirplaneIcon className="h-3.5 w-3.5" /> Submit for review
          </button>
        )}
        {canApprove && wo.status === 'pending_review' && (
          <>
            <button onClick={() => openDecision(wo, 'approve')} className={`${btn} border-green-200 text-green-700 hover:bg-green-50`}>
              <CheckCircleIcon className="h-3.5 w-3.5" /> Approve
            </button>
            <button onClick={() => openDecision(wo, 'reject')} className={`${btn} border-red-200 text-red-700 hover:bg-red-50`}>
              <XCircleIcon className="h-3.5 w-3.5" /> Reject
            </button>
          </>
        )}
        {canClose && (wo.status === 'approved' || wo.status === 'pending_review') && (
          <button onClick={() => openDecision(wo, 'close')} className={`${btn} border-gray-300 text-gray-700 hover:bg-gray-50`}>
            <LockClosedIcon className="h-3.5 w-3.5" /> Close
          </button>
        )}
        {canUpdate && wo.status !== 'closed' && (
          <button onClick={() => triggerUpload(wo)} className={`${btn} border-gray-200 text-gray-600 hover:bg-gray-50`}>
            <PaperClipIcon className="h-3.5 w-3.5" /> Evidence
          </button>
        )}
      </div>
    );
  };

  const selectedLog = selected ? log[selected.id] || [] : [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Maintenance Planning' }]} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Planning</h1>
          <p className="text-sm text-gray-500">Plan work orders, track progress, and verify closure with evidence.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input-field w-auto" aria-label="Filter by priority">
            <option value="">All priorities</option>
            {Object.entries(PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {canCreate && (
            <button onClick={() => { setShowCreate(true); setFormError(''); }} className="btn-primary inline-flex items-center gap-2">
              <PlusIcon className="h-5 w-5" /> Create Work Order
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFileChosen} />

      {woQuery.isLoading ? (
        <LoadingSpinner text="Loading work orders..." />
      ) : woQuery.isError ? (
        <ErrorAlert message={errMsg(woQuery.error, 'Failed to load work orders.')} onRetry={() => woQuery.refetch()} />
      ) : workOrders.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No work orders yet"
            description="Create the first work order to start planning maintenance."
            icon={WrenchScrewdriverIcon}
            action={canCreate && <button onClick={() => setShowCreate(true)} className="btn-primary">Create Work Order</button>}
          />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className={`flex-shrink-0 w-72 sm:w-80 bg-gray-50 rounded-xl border border-gray-200 border-t-4 ${col.accent}`}>
              <div className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-sm font-semibold text-gray-800">{col.label}</h2>
                <span className="text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-2 py-0.5">{grouped[col.key].length}</span>
              </div>
              <div className="px-3 pb-3 space-y-3 max-h-[70vh] overflow-y-auto">
                {grouped[col.key].length === 0 && <p className="text-xs text-gray-400 text-center py-6">No work orders</p>}
                {grouped[col.key].map((wo) => (
                  <div key={wo.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => setSelectedId(wo.id)} className="text-left text-sm font-semibold text-gray-900 hover:text-primary-600">
                        {wo.title}
                      </button>
                      <StatusBadge status={wo.priority} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{wo.assets?.name || 'Unknown asset'}</p>
                    <dl className="mt-2 space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Technician</dt>
                        <dd>{techName(wo.assigned_to) || 'Unassigned'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Exp. downtime</dt>
                        <dd>{wo.estimated_downtime_hours != null ? `${formatNumber(wo.estimated_downtime_hours, 1)} h` : '—'}</dd>
                      </div>
                    </dl>
                    {(wo.status === 'approved' || wo.status === 'rejected') && (
                      <div className="mt-2"><StatusBadge status={wo.status} /></div>
                    )}
                    {renderCardActions(wo)}
                    <button onClick={() => setSelectedId(wo.id)} className="mt-2 text-xs text-primary-600 hover:underline">
                      {wo.status === 'closed' ? 'Closure verification' : 'View details'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Work Order</h3>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Close"><XMarkIcon className="h-5 w-5 text-gray-500" /></button>
            </div>
            {formError && <ErrorAlert message={formError} />}
            <div>
              <label className="label" htmlFor="wo-asset">Asset</label>
              <select id="wo-asset" className="input-field" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
                <option value="">{assetsQuery.isLoading ? 'Loading assets...' : 'Select an asset'}</option>
                {(assetsQuery.data || []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {assetsQuery.isError && <p className="text-xs text-red-600 mt-1">Could not load assets.</p>}
            </div>
            <div>
              <label className="label" htmlFor="wo-title">Title</label>
              <input id="wo-title" className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={300} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="wo-type">Type</label>
                <select id="wo-type" className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {WO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="wo-priority">Priority</label>
                <select id="wo-priority" className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="wo-assign">Assigned to</label>
                <select id="wo-assign" className="input-field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.user_id} value={t.user_id}>{t.users?.full_name || t.user_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="wo-downtime">Expected downtime (h)</label>
                <input id="wo-downtime" type="number" min="0" step="0.5" className="input-field" value={form.estimated_downtime_hours} onChange={(e) => setForm({ ...form, estimated_downtime_hours: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="wo-notes">Notes</label>
              <textarea id="wo-notes" rows={3} className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Assign work order</h3>
            <p className="text-sm text-gray-600">{assignTarget.title}</p>
            <div>
              <label className="label" htmlFor="assign-tech">Technician</label>
              <select id="assign-tech" className="input-field" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Select technician</option>
                {technicians.map((t) => (
                  <option key={t.user_id} value={t.user_id}>{t.users?.full_name || t.user_id}</option>
                ))}
              </select>
              {techQuery.isError && <p className="text-xs text-red-600 mt-1">Could not load technicians.</p>}
              {!techQuery.isError && !techQuery.isLoading && technicians.length === 0 && <p className="text-xs text-gray-500 mt-1">No technicians available.</p>}
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setAssignTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={!assignee || updateMutation.isPending} onClick={submitAssign}>
                {updateMutation.isPending ? 'Saving...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision modal with mandatory reason */}
      {decision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {decision.action === 'approve' ? 'Approve' : decision.action === 'reject' ? 'Reject' : 'Close'} work order
            </h3>
            <p className="text-sm text-gray-600">{decision.wo.title}</p>
            <p className="text-xs text-gray-500">
              This decision will be recorded against <strong>{actor}</strong> at the time of submission.
            </p>
            {actionError && <ErrorAlert message={actionError} />}
            <div>
              <label className="label" htmlFor="decision-reason">Reason (required)</label>
              <textarea id="decision-reason" rows={3} className="input-field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the basis for this decision" />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => { setDecision(null); setActionError(''); }}>Cancel</button>
              <button
                className={decision.action === 'reject' ? 'btn-danger' : decision.action === 'approve' ? 'btn-success' : 'btn-primary'}
                disabled={decisionMutation.isPending || !reason.trim()}
                onClick={confirmDecision}
              >
                {decisionMutation.isPending ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details / closure verification drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setSelectedId(null)}>
          <aside className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 space-y-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.title}</h3>
                <p className="text-sm text-gray-500">
                  {selected.assets?.name ? (
                    <Link to={`/assets/${selected.asset_id}`} className="text-primary-600 hover:underline">{selected.assets.name}</Link>
                  ) : 'Unknown asset'}
                </p>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Close details"><XMarkIcon className="h-5 w-5 text-gray-500" /></button>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selected.status} />
              <StatusBadge status={selected.priority} label={`${PRIORITY[selected.priority] || selected.priority} priority`} />
              <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full capitalize">{selected.type}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Technician</p>
                <p className="font-medium text-gray-900">{techName(selected.assigned_to) || 'Unassigned'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Opened</p>
                <p className="font-medium text-gray-900">{formatDateTime(selected.opened_at)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Expected downtime</p>
                <p className="font-medium text-gray-900">{selected.estimated_downtime_hours != null ? `${formatNumber(selected.estimated_downtime_hours, 1)} h` : '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Actual downtime</p>
                <p className="font-medium text-gray-900">{selected.actual_downtime_hours != null ? `${formatNumber(selected.actual_downtime_hours, 1)} h` : '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Approved by</p>
                <p className="font-medium text-gray-900">{selected.approved_by ? techName(selected.approved_by) : '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Closed</p>
                <p className="font-medium text-gray-900">{formatDateTime(selected.closed_at)}</p>
              </div>
            </div>

            {selected.notes && (
              <div>
                <p className="label">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}

            <section>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
                <ClipboardDocumentCheckIcon className="h-4 w-4" /> Closure verification
              </h4>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Parts used</p>
                  {partsList(selected).length === 0 ? (
                    <p className="text-sm text-gray-400">No parts recorded.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                      {partsList(selected).map((p, i) => (
                        <li key={i} className="flex justify-between px-3 py-2 text-sm">
                          <span>{p.name || p.part_number || 'Part'}</span>
                          <span className="text-gray-500">{p.quantity != null ? `x${p.quantity}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Evidence</p>
                  {evidenceList(selected).length === 0 ? (
                    <p className="text-sm text-gray-400">No evidence uploaded.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {evidenceList(selected).map((item, i) => {
                        const url = typeof item === 'string' ? item : item.url;
                        const isImage = /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url || '');
                        return isImage ? (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={`Evidence ${i + 1}`} className="h-24 w-full object-cover rounded-lg border border-gray-200" />
                          </a>
                        ) : (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="h-24 flex items-center justify-center text-xs text-primary-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <PaperClipIcon className="h-4 w-4 mr-1" /> File {i + 1}
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {canUpdate && selected.status !== 'closed' && (
                    <button onClick={() => triggerUpload(selected)} className="btn-secondary mt-2 text-sm inline-flex items-center gap-1" disabled={uploadMutation.isPending}>
                      <PaperClipIcon className="h-4 w-4" /> {uploadMutation.isPending ? 'Uploading...' : 'Upload evidence'}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
                <ClockIcon className="h-4 w-4" /> Decision log
              </h4>
              {selectedLog.length === 0 ? (
                <p className="text-sm text-gray-400">No decisions recorded in this browser yet.</p>
              ) : (
                <ol className="space-y-2">
                  {[...selectedLog].reverse().map((entry, i) => (
                    <li key={i} className="border-l-2 border-primary-300 pl-3 text-sm">
                      <p className="font-medium text-gray-900 capitalize">{entry.action.replace(/_/g, ' ')}</p>
                      <p className="text-gray-600">{entry.reason}</p>
                      <p className="text-xs text-gray-400">{entry.actor} &middot; {formatDateTime(entry.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <div className="pt-2 border-t border-gray-100">{renderCardActions(selected)}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
