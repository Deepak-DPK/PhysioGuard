import { formatDateTime } from '../../utils/formatters';
import { CpuChipIcon } from '@heroicons/react/24/outline';

export default function AIOutputCard({ result, title, children }) {
  if (!result) return null;

  const confidenceColor = result.confidence >= 0.8 ? 'text-green-600' : result.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="card border-l-4 border-l-primary-500">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <CpuChipIcon className="h-5 w-5 text-primary-600" />
          <h4 className="font-semibold text-gray-900">{title || 'AI Analysis'}</h4>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">AI Generated</span>
        </div>
      </div>

      {result.explanation && (
        <p className="text-sm text-gray-700 mb-3">{result.explanation}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {result.risk_score != null && (
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Risk Score</p>
            <p className={`text-lg font-bold ${result.risk_score > 70 ? 'text-red-600' : result.risk_score > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
              {result.risk_score}%
            </p>
          </div>
        )}
        {result.rul_days != null && (
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Remaining Life</p>
            <p className="text-lg font-bold text-gray-900">{result.rul_days} days</p>
          </div>
        )}
        {result.confidence != null && (
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Confidence</p>
            <p className={`text-lg font-bold ${confidenceColor}`}>{(result.confidence * 100).toFixed(1)}%</p>
          </div>
        )}
        {result.model_version && (
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Model</p>
            <p className="text-sm font-medium text-gray-700">{result.model_version}</p>
          </div>
        )}
      </div>

      {result.factors && result.factors.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Contributing Factors</p>
          <div className="flex flex-wrap gap-1">
            {result.factors.map((f, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{f}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
        <span>Generated: {formatDateTime(result.timestamp)}</span>
        {result.ai_run_id && <span>Run ID: {result.ai_run_id?.slice(0, 8)}</span>}
      </div>

      {children}
    </div>
  );
}
