import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDaysIcon, UserGroupIcon, ExclamationTriangleIcon, ClockIcon, BoltIcon,
} from '@heroicons/react/24/outline';
import { maintenanceService } from '../services/maintenanceService';
import { technicianService } from '../services/technicianService';
import { workOrderService } from '../services/workOrderService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import ErrorAlert from '../components/common/ErrorAlert';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { formatDate, formatNumber } from '../utils/formatters';

const SKILLS = [
  { value: '', label: 'All skills' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'general', label: 'General' },
];

const DAY_MS = 86400000;

function unwrap(res) {
  const body = res?.data;
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function toList(payload, extraKeys = []) {
  if (Array.isArray(payload)) return payload;
  for (const k of [...extraKeys, 'items', 'results']) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  return [];
}

const dueOf = (p) => p.nextDueDate || p.dueDate || p.scheduledDate || p.date;
const idOf = (x, i) => x._id || x.id || i;
const assetNameOf = (p) => p.assetName || p.asset?.name || (typeof p.asset === 'string' ? p.asset : '');

function urgencyOf(plan) {
  const due = dueOf(plan);
  if (!due) return 'upcoming';
  const diff = (new Date(due).getTime() - Date.now()) / DAY_MS;
  if (plan.status === 'completed' || plan.status === 'closed') return 'done';
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'soon';
  return 'upcoming';
}

const URGENCY_STYLE = {
  overdue: { border: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
  soon: { border: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', label: 'Due within 7 days' },
  upcoming: { border: 'border-l-blue-400', bg: 'bg-white', text: 'text-blue-700', label: 'Upcoming' },
  done: { border: 'border-l-green-500', bg: 'bg-white', text: 'text-green-700', label: 'Completed' },
};

function weekOfMonth(d) {
  return Math.ceil(d.getDate() / 7);
}

function groupByMonthWeek(plans) {
  const months = new Map();
  [...plans]
    .sort((a, b) => new Date(dueOf(a) || 0) - new Date(dueOf(b) || 0))
    .forEach((p) => {
      const due = dueOf(p);
      const d = due ? new Date(due) : null;
      const monthKey = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'unscheduled';
      const monthLabel = d ? d.toLocaleString(undefined, { month: 'long', year: 'numeric' }) : 'Unscheduled';
      const weekKey = d ? weekOfMonth(d) : 0;
      if (!months.has(monthKey)) months.set(monthKey, { label: monthLabel, weeks: new Map() });
      const m = months.get(monthKey);
      if (!m.weeks.has(weekKey)) m.weeks.set(weekKey, []);
      m.weeks.get(weekKey).push(p);
    });
  return [...months.entries()].map(([key, m]) => ({
    key,
    label: m.label,
    weeks: [...m.weeks.entries()].map(([w, items]) => ({ week: w, items })),
  }));
}

function StatTile({ icon: Icon, label, value, tone }) {
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

export default function MaintenanceCalendar() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().slice(0, 10);

  const [filters, setFilters] = useState({ from: defaultFrom, to: defaultTo, skill: '' });
  const rangeInvalid = filters.from && filters.to && filters.from > filters.to;

  const calParams = useMemo(() => {
    const p = {};
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = filters.to;
    if (filters.skill) p.skill = filters.skill;
    return p;
  }, [filters]);

  const calendarQuery = useQuery({
    queryKey: ['maintenance', 'calendar', calParams],
    queryFn: () => maintenanceService.getCalendar(calParams),
    enabled: !rangeInvalid,
  });

  const queueQuery = useQuery({
    queryKey: ['technicians', 'queue', filters.skill],
    queryFn: () => technicianService.getQueue(filters.skill ? { skill: filters.skill } : undefined),
  });

  const downtimeQuery = useQuery({
    queryKey: ['work-orders', 'downtime', filters.from, filters.to],
    queryFn: () => {
      const p = { limit: 1000 };
      if (filters.from) p.from = filters.from;
      if (filters.to) p.to = filters.to;
      return workOrderService.getAll(p);
    },
  });

  const plans = useMemo(() => {
    const list = toList(unwrap(calendarQuery.data), ['plans', 'events', 'calendar']);
    if (!filters.skill) return list;
    return list.filter((p) => !p.requiredSkill && !p.skill ? true : [p.requiredSkill, p.skill].includes(filters.skill));
  }, [calendarQuery.data, filters.skill]);

  const grouped = useMemo(() => groupByMonthWeek(plans), [plans]);
  const overdue = useMemo(() => plans.filter((p) => urgencyOf(p) === 'overdue'), [plans]);

  const technicians = useMemo(() => {
    const list = toList(unwrap(queueQuery.data), ['technicians', 'queue']);
    if (!filters.skill) return list;
    return list.filter((t) => {
      const skills = t.skills || t.technician?.skills || [];
      return !skills.length || skills.map((s) => String(s).toLowerCase()).includes(filters.skill);
    });
  }, [queueQuery.data, filters.skill]);

  const downtime = useMemo(() => {
    const list = toList(unwrap(downtimeQuery.data), ['workOrders']);
    const events = list.filter((w) => Number(w.downtimeHours ?? w.downtime ?? 0) > 0);
    const hours = events.reduce((s, w) => s + Number(w.downtimeHours ?? w.downtime ?? 0), 0);
    return { events: events.length, hours, avg: events.length ? hours / events.length : 0 };
  }, [downtimeQuery.data]);

  const setField = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));
  const resetFilters = () => setFilters({ from: defaultFrom, to: defaultTo, skill: '' });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'Maintenance Calendar' }]} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Calendar &amp; Technician Queue</h1>
        <p className="text-sm text-gray-500 mt-1">Plan preventive maintenance, balance technician workload and track downtime.</p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label htmlFor="from" className="label">From</label>
            <input id="from" type="date" value={filters.from} onChange={setField('from')} className="input-field" />
          </div>
          <div>
            <label htmlFor="to" className="label">To</label>
            <input id="to" type="date" value={filters.to} onChange={setField('to')} className="input-field" />
          </div>
          <div>
            <label htmlFor="skill" className="label">Skill</label>
            <select id="skill" value={filters.skill} onChange={setField('skill')} className="input-field">
              {SKILLS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <button onClick={resetFilters} className="btn-secondary w-full">Reset filters</button>
          </div>
        </div>
        {rangeInvalid && <p className="mt-2 text-xs text-red-600">The start date must be before the end date.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          icon={ClockIcon}
          label="Total downtime (hours)"
          value={downtimeQuery.isLoading ? '...' : formatNumber(downtime.hours, 1)}
          tone="bg-purple-50 text-purple-600"
        />
        <StatTile
          icon={BoltIcon}
          label="Downtime events"
          value={downtimeQuery.isLoading ? '...' : formatNumber(downtime.events)}
          tone="bg-orange-50 text-orange-600"
        />
        <StatTile
          icon={ExclamationTriangleIcon}
          label="Avg. hours per event"
          value={downtimeQuery.isLoading ? '...' : formatNumber(downtime.avg, 1)}
          tone="bg-blue-50 text-blue-600"
        />
      </div>
      {downtimeQuery.isError && (
        <ErrorAlert message="Unable to load downtime analytics." onRetry={() => downtimeQuery.refetch()} />
      )}

      <div className="card border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
          <h2 className="text-base font-semibold text-gray-900">Failure-Risk Alerts</h2>
          <span className="ml-auto text-xs font-medium text-red-700 bg-red-50 rounded-full px-2 py-0.5">{overdue.length} overdue</span>
        </div>
        {calendarQuery.isLoading ? (
          <LoadingSpinner size="sm" text="" />
        ) : overdue.length === 0 ? (
          <p className="text-sm text-gray-500">No overdue maintenance plans in the selected range. All clear.</p>
        ) : (
          <ul className="space-y-2">
            {overdue.map((p, i) => {
              const days = Math.ceil((Date.now() - new Date(dueOf(p)).getTime()) / DAY_MS);
              const assetId = p.assetId || p.asset?._id || p.asset?.id;
              return (
                <li key={idOf(p, i)} className="flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-900 truncate">{p.title || p.name || 'Maintenance plan'}</p>
                    <p className="text-xs text-red-700 truncate">
                      {assetId ? (
                        <Link to={`/assets/${assetId}`} className="underline hover:text-red-900">{assetNameOf(p) || 'View asset'}</Link>
                      ) : (
                        assetNameOf(p) || 'Unassigned asset'
                      )}
                      {' · '}Due {formatDate(dueOf(p))}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-red-700 shrink-0">{days} day{days === 1 ? '' : 's'} late</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="card xl:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDaysIcon className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Maintenance Calendar</h2>
            <span className="ml-auto text-xs text-gray-500">{plans.length} plan{plans.length === 1 ? '' : 's'}</span>
          </div>

          <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-600">
            {Object.entries(URGENCY_STYLE).map(([k, s]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={`h-3 w-1 rounded border-l-4 ${s.border}`} />
                {s.label}
              </span>
            ))}
          </div>

          {rangeInvalid ? (
            <EmptyState title="Invalid date range" description="Adjust the dates to view the calendar." />
          ) : calendarQuery.isLoading ? (
            <LoadingSpinner text="Loading calendar..." />
          ) : calendarQuery.isError ? (
            <ErrorAlert
              message={calendarQuery.error?.response?.data?.message || 'Failed to load the maintenance calendar.'}
              onRetry={() => calendarQuery.refetch()}
            />
          ) : grouped.length === 0 ? (
            <EmptyState title="No scheduled maintenance" description="There are no maintenance plans in the selected date range." />
          ) : (
            <div className="space-y-6">
              {grouped.map((m) => (
                <section key={m.key}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-2">{m.label}</h3>
                  <div className="space-y-4">
                    {m.weeks.map((w) => (
                      <div key={w.week}>
                        {w.week > 0 && <p className="text-xs font-medium text-gray-500 mb-1.5">Week {w.week}</p>}
                        <ul className="space-y-2">
                          {w.items.map((p, i) => {
                            const u = urgencyOf(p);
                            const style = URGENCY_STYLE[u];
                            return (
                              <li
                                key={idOf(p, i)}
                                className={`border border-gray-200 border-l-4 ${style.border} ${style.bg} rounded-lg px-4 py-3 flex items-start justify-between gap-3`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{p.title || p.name || 'Maintenance plan'}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                                    {assetNameOf(p) || 'No asset'}
                                    {p.frequency ? ` · ${p.frequency}` : ''}
                                    {p.requiredSkill || p.skill ? ` · ${p.requiredSkill || p.skill}` : ''}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-xs font-semibold ${style.text}`}>{formatDate(dueOf(p))}</p>
                                  {p.priority && <div className="mt-1"><StatusBadge status={p.priority} /></div>}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="card xl:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <UserGroupIcon className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Technician Queue</h2>
            <span className="ml-auto text-xs text-gray-500">{technicians.length}</span>
          </div>

          {queueQuery.isLoading ? (
            <LoadingSpinner text="Loading queue..." />
          ) : queueQuery.isError ? (
            <ErrorAlert
              message={queueQuery.error?.response?.data?.message || 'Failed to load the technician queue.'}
              onRetry={() => queueQuery.refetch()}
            />
          ) : technicians.length === 0 ? (
            <EmptyState title="No technicians in queue" description="No technicians match the selected skill filter." />
          ) : (
            <ul className="space-y-4">
              {technicians.map((t, i) => {
                const name = t.name || t.fullName || t.technician?.name || 'Technician';
                const orders = t.workOrders || t.assignedWorkOrders || t.queue || [];
                const skills = t.skills || t.technician?.skills || [];
                return (
                  <li key={idOf(t, i)} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        {skills.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {skills.map((s) => (
                              <span key={s} className="text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium text-primary-700 bg-primary-50 rounded-full px-2 py-0.5 shrink-0">
                        {orders.length} order{orders.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {orders.length === 0 ? (
                      <p className="mt-3 text-xs text-gray-400">No assigned work orders.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {orders.map((w, j) => (
                          <li key={idOf(w, j)} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded px-3 py-2">
                            <span className="truncate text-gray-800">{w.title || w.workOrderNumber || 'Work order'}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {w.priority && <StatusBadge status={w.priority} />}
                              {w.status && <StatusBadge status={w.status} />}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
