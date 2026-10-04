import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * items: array of { label, path }. Items without a path (or the last item) render as plain text.
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="flex items-center flex-wrap gap-1 text-sm text-gray-500 print:hidden" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />}
            {item.path && !last ? (
              <Link to={item.path} className="hover:text-primary-600">{item.label}</Link>
            ) : (
              <span className={last ? 'text-gray-900 font-medium' : ''} aria-current={last ? 'page' : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
