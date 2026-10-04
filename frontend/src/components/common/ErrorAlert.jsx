import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ErrorAlert({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-red-800">{message}</p>
          {onRetry && (
            <button onClick={onRetry} className="mt-2 text-sm font-medium text-red-700 hover:text-red-900">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
