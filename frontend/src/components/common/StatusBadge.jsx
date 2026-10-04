import { STATUS_COLORS } from '../../utils/constants';

export default function StatusBadge({ status, label }) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label || status?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}
