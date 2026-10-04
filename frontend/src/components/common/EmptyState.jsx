import { InboxIcon } from '@heroicons/react/24/outline';

export default function EmptyState({ title = 'No data found', description = 'There are no records to display.', icon: Icon = InboxIcon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
