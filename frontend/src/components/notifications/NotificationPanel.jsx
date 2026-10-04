import { useNotifications } from '../../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatRelative } from '../../utils/formatters';
import { STATUS_COLORS } from '../../utils/constants';
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function NotificationPanel({ onClose }) {
  const { notifications, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = async (notification) => {
    if (!notification.is_read) await markRead(notification.id);
    onClose();
    if (notification.related_entity_type === 'work_order') {
      navigate('/maintenance-planning');
    } else if (notification.related_entity_type === 'asset') {
      navigate(`/assets/${notification.related_entity_id}`);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-[70vh] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Notifications</h3>
        <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
          <CheckIcon className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>
      <div className="overflow-y-auto max-h-96 divide-y divide-gray-100">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            <BellIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No notifications
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-primary-50/50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${n.severity === 'critical' ? 'bg-red-500' : n.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatRelative(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      <div className="border-t border-gray-200 px-4 py-2">
        <button
          onClick={() => { onClose(); navigate('/notifications'); }}
          className="w-full text-center text-sm text-primary-600 hover:text-primary-800 font-medium py-1"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
