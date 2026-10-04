import { useState } from 'react';
import { aiService } from '../../services/aiService';
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

export default function AIReviewActions({ runId, onReviewed }) {
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!decision || !reason.trim()) return;
    setSubmitting(true);
    try {
      await aiService.reviewRun(runId, decision, reason);
      setSubmitted(true);
      onReviewed?.({ decision, reason });
    } catch (err) {
      alert('Failed to submit review: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${decision === 'approved' ? 'bg-green-50 text-green-800' : decision === 'rejected' ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'}`}>
        Review submitted: {decision}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-sm font-medium text-gray-700 mb-2">Review this AI output</p>
      <div className="flex gap-2 mb-2">
        {[
          { key: 'approved', label: 'Approve', icon: CheckCircleIcon, color: 'text-green-600 border-green-300 bg-green-50' },
          { key: 'rejected', label: 'Reject', icon: XCircleIcon, color: 'text-red-600 border-red-300 bg-red-50' },
          { key: 'overridden', label: 'Override', icon: PencilSquareIcon, color: 'text-yellow-600 border-yellow-300 bg-yellow-50' },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setDecision(opt.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${decision === opt.key ? opt.color : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <opt.icon className="h-4 w-4" />
            {opt.label}
          </button>
        ))}
      </div>
      {decision && (
        <>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason is required..."
            className="input-field text-sm h-20 resize-none"
          />
          <button onClick={handleSubmit} disabled={!reason.trim() || submitting} className="btn-primary mt-2 text-sm">
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </>
      )}
    </div>
  );
}
