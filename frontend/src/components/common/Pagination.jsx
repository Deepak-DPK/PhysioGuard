import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <p className="text-sm text-gray-500">
        Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={!pagination.hasPrev}
          className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={!pagination.hasNext}
          className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-100"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
