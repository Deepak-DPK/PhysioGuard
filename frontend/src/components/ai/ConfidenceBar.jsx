export default function ConfidenceBar({ value, label = 'Confidence' }) {
  if (value == null) return null;
  const pct = (value * 100).toFixed(1);
  const color = value >= 0.8 ? 'bg-green-500' : value >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
