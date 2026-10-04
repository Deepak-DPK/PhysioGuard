import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, NoSymbolIcon, ArrowPathIcon, XMarkIcon, UsersIcon } from '@heroicons/react/24/outline';
import { userService } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Breadcrumbs from '../components/common/Breadcrumbs';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import Pagination from '../components/common/Pagination';
import ErrorAlert from '../components/common/ErrorAlert';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { ROLE_LABELS, ROLES } from '../utils/constants';
import { formatDate, formatDateTime } from '../utils/formatters';

const PAGE_SIZE = 10;

const PERMISSION_MATRIX = [
  { area: 'Assets', actions: { 'View': [1, 1, 1, 'own'], 'Create / edit': [1, 0, 1, 0], 'Delete': [1, 0, 0, 0] } },
  { area: 'Work orders', actions: { 'View': [1, 1, 1, 'own'], 'Create / update': [1, 1, 1, 0], 'Approve': [1, 0, 1, 0], 'Close': [1, 1, 1, 0] } },
  { area: 'Maintenance', actions: { 'View': [1, 1, 1, 0], 'Create / update': [1, 0, 1, 0] } },
  { area: 'Inspections', actions: { 'View / create': [1, 1, 1, 0] } },
  { area: 'Technicians', actions: { 'View': [1, 1, 1, 0], 'Manage': [1, 0, 0, 0] } },
  { area: 'AI insights', actions: { 'View': [1, 1, 1, 0], 'Run / review': [1, 0, 1, 0] } },
  { area: 'Reports', actions: { 'View': [1, 1, 1, 0], 'Export': [1, 0, 1, 0] } },
  { area: 'Users', actions: { 'View / manage': [1, 0, 0, 0] } },
  { area: 'Audit logs', actions: { 'View': [1, 0, 1, 0] } },
  { area: 'System settings', actions: { 'View / update': [1, 0, 0, 0] } },
  { area: 'Notifications', actions: { 'View': [1, 1, 1, 1] } },
];

const ROLE_ORDER = [ROLES.MAINTENANCE_ADMIN, ROLES.TECHNICIAN, ROLES.OPERATIONS_MANAGER, ROLES.VENDOR];

const emptyForm = { email: '', password: '', full_name: '', role: ROLES.TECHNICIAN, is_active: true };

const errMsg = (err, fallback) => err?.response?.data?.error?.message || err?.response?.data?.message || fallback;

function UserFormModal({ mode, initial, onClose, onSubmit, saving, error }) {
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState(false);
  const isCreate = mode === 'create';

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const emailOk = /^\S+@\S+\.\S+$/.test(form.email || '');
  const valid = form.full_name.trim().length > 0 && (!isCreate || (emailOk && (form.password || '').length >= 8));

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{isCreate ? 'Create user' : 'Edit user'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        {error && <ErrorAlert message={error} />}
        <div>
          <label className="label" htmlFor="um-name">Full name</label>
          <input id="um-name" className="input-field" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          {touched && !form.full_name.trim() && <p className="mt-1 text-xs text-red-600">Full name is required.</p>}
        </div>
        <div>
          <label className="label" htmlFor="um-email">Email</label>
          <input id="um-email" type="email" className="input-field" value={form.email} disabled={!isCreate} onChange={(e) => set('email', e.target.value)} />
          {touched && isCreate && !emailOk && <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>}
        </div>
        {isCreate && (
          <div>
            <label className="label" htmlFor="um-pass">Password</label>
            <input id="um-pass" type="password" autoComplete="new-password" className="input-field" value={form.password} onChange={(e) => set('password', e.target.value)} />
            {touched && form.password.length < 8 && <p className="mt-1 text-xs text-red-600">Password must be at least 8 characters.</p>}
          </div>
        )}
        <div>
          <label className="label" htmlFor="um-role">Role</label>
          <select id="um-role" className="input-field" value={form.role} onChange={(e) => set('role', e.target.value)}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        {!isCreate && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Account is active
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : isCreate ? 'Create user' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}

function PermissionMatrix() {
  const cell = (v) => {
    if (v === 'own') return <span className="text-xs text-yellow-700 bg-yellow-50 rounded px-1.5 py-0.5">Own only</span>;
    return v ? <span className="text-green-600 font-bold" aria-label="Allowed">&#10003;</span> : <span className="text-gray-300" aria-label="Not allowed">&mdash;</span>;
  };
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">Role permission matrix</h2>
        <p className="text-xs text-gray-500">Read-only overview of what each role can do.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Area</th>
              <th className="px-4 py-2 text-left">Action</th>
              {ROLE_ORDER.map((r) => <th key={r} className="px-4 py-2 text-center">{ROLE_LABELS[r]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {PERMISSION_MATRIX.flatMap((row) =>
              Object.entries(row.actions).map(([action, vals], i) => (
                <tr key={`${row.area}-${action}`}>
                  <td className="px-4 py-2 font-medium text-gray-900">{i === 0 ? row.area : ''}</td>
                  <td className="px-4 py-2 text-gray-600">{action}</td>
                  {vals.map((v, idx) => <td key={idx} className="px-4 py-2 text-center">{cell(v)}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const { can } = usePermissions();
  const canManage = can('users:update');

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal] = useState(null); // { mode, user }
  const [formError, setFormError] = useState('');
  const [toDeactivate, setToDeactivate] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showMatrix, setShowMatrix] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = { page, limit: PAGE_SIZE };
  if (search) params.search = search;
  if (roleFilter) params.role = roleFilter;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', params],
    queryFn: async () => (await userService.getAll(params)).data,
    placeholderData: keepPreviousData,
  });

  const users = data?.data || [];
  const pagination = data?.pagination;

  const onDone = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    setNotice({ type: 'success', text: msg });
    setModal(null);
    setFormError('');
  };

  const createMut = useMutation({
    mutationFn: (f) => userService.create({ email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), role: f.role }),
    onSuccess: () => onDone('User created.'),
    onError: (err) => setFormError(errMsg(err, 'Failed to create user.')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }) => userService.update(id, { full_name: f.full_name.trim(), role: f.role, is_active: f.is_active }),
    onSuccess: () => onDone('User updated.'),
    onError: (err) => setFormError(errMsg(err, 'Failed to update user.')),
  });

  const deactivateMut = useMutation({
    mutationFn: (id) => userService.remove(id),
    onSuccess: () => { setToDeactivate(null); onDone('User deactivated.'); },
    onError: (err) => { setToDeactivate(null); setNotice({ type: 'error', text: errMsg(err, 'Failed to deactivate user.') }); },
  });

  const reactivateMut = useMutation({
    mutationFn: (id) => userService.update(id, { is_active: true }),
    onSuccess: () => onDone('User reactivated.'),
    onError: (err) => setNotice({ type: 'error', text: errMsg(err, 'Failed to reactivate user.') }),
  });

  const openCreate = () => { setFormError(''); setModal({ mode: 'create', user: emptyForm }); };
  const openEdit = (u) => {
    setFormError('');
    setModal({ mode: 'edit', id: u.id, user: { email: u.email, password: '', full_name: u.full_name || '', role: u.role, is_active: u.is_active !== false } });
  };

  const handleSubmit = (f) => {
    setFormError('');
    if (modal.mode === 'create') createMut.mutate(f);
    else updateMut.mutate({ id: modal.id, f });
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Home', path: '/dashboard' }, { label: 'User Management' }]} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User &amp; Role Management</h1>
          <p className="text-sm text-gray-500">Manage accounts, roles and access.</p>
        </div>
        {canManage && (
          <button className="btn-primary inline-flex items-center gap-2" onClick={openCreate}>
            <PlusIcon className="h-4 w-4" />Create user
          </button>
        )}
      </div>

      {notice && (
        <div className={`rounded-lg border p-3 text-sm flex items-center justify-between ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <span>{notice.text}</span>
          <button className="text-xs underline" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search by name or email" aria-label="Search users" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <select className="input-field sm:w-56" aria-label="Filter by role" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading users..." />
      ) : error ? (
        <ErrorAlert message={errMsg(error, 'Failed to load users.')} onRetry={refetch} />
      ) : users.length === 0 ? (
        <div className="card">
          <EmptyState icon={UsersIcon} title="No users found" description={search || roleFilter ? 'Try adjusting your search or filters.' : 'Create the first user to get started.'}
            action={canManage && !search && !roleFilter ? <button className="btn-primary" onClick={openCreate}>Create user</button> : null} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th><th className="px-4 py-2">Last login</th><th className="px-4 py-2">Created</th>
                  {canManage && <th className="px-4 py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isSelf = me?.id === u.id;
                  const active = u.is_active !== false;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{u.full_name || '—'}{isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}</td>
                      <td className="px-4 py-2 text-gray-600">{u.email}</td>
                      <td className="px-4 py-2">{ROLE_LABELS[u.role] || u.role}</td>
                      <td className="px-4 py-2"><StatusBadge status={active ? 'active' : 'inactive'} /></td>
                      <td className="px-4 py-2 whitespace-nowrap">{u.last_login ? formatDateTime(u.last_login) : 'Never'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDate(u.created_at)}</td>
                      {canManage && (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Edit" aria-label={`Edit ${u.email}`} onClick={() => openEdit(u)}>
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            {active ? (
                              <button className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40" title={isSelf ? 'You cannot deactivate yourself' : 'Deactivate'}
                                aria-label={`Deactivate ${u.email}`} disabled={isSelf} onClick={() => setToDeactivate(u)}>
                                <NoSymbolIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              <button className="p-2 rounded-lg text-green-600 hover:bg-green-50" title="Reactivate" aria-label={`Reactivate ${u.email}`}
                                disabled={reactivateMut.isPending} onClick={() => reactivateMut.mutate(u.id)}>
                                <ArrowPathIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-2 pb-3"><Pagination pagination={pagination} onPageChange={setPage} /></div>
        </div>
      )}

      <div>
        <button className="btn-secondary mb-3" onClick={() => setShowMatrix((s) => !s)}>{showMatrix ? 'Hide' : 'Show'} role permission matrix</button>
        {showMatrix && <PermissionMatrix />}
      </div>

      {modal && (
        <UserFormModal mode={modal.mode} initial={modal.user} onClose={() => setModal(null)} onSubmit={handleSubmit}
          saving={createMut.isPending || updateMut.isPending} error={formError} />
      )}

      <ConfirmDialog open={!!toDeactivate} danger title="Deactivate user"
        message={toDeactivate ? `Deactivate ${toDeactivate.full_name || toDeactivate.email}? They will no longer be able to sign in.` : ''}
        confirmLabel={deactivateMut.isPending ? 'Deactivating...' : 'Deactivate'}
        onConfirm={() => deactivateMut.mutate(toDeactivate.id)} onCancel={() => setToDeactivate(null)} />
    </div>
  );
}
