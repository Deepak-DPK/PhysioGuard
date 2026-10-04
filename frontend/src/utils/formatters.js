import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date) {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy');
}

export function formatDateTime(date) {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy HH:mm');
}

export function formatRelative(date) {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatNumber(num, decimals = 0) {
  if (num == null) return '—';
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercentage(num) {
  if (num == null) return '—';
  return `${Number(num).toFixed(1)}%`;
}

export function truncate(str, maxLen = 50) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

export function categoryLabel(category) {
  const map = {
    therapy_bed: 'Therapy Bed',
    electrotherapy_unit: 'Electrotherapy Unit',
    exercise_equipment: 'Exercise Equipment',
    mobility_aid: 'Mobility Aid',
    treatment_room: 'Treatment Room',
  };
  return map[category] || category;
}
