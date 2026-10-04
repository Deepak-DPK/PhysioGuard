import { formatDistanceToNowStrict } from 'date-fns';

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  return `${formatDistanceToNowStrict(ts).replace(' minutes', 'm').replace(' minute', 'm').replace(' hours', 'h').replace(' hour', 'h').replace(' days', 'd').replace(' day', 'd').replace(' seconds', 's')} ago`;
}

function renderInline(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

function renderContent(content) {
  const lines = String(content || '').split('\n');
  const out = [];
  let bullets = [];

  const flush = (idx) => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${idx}`} className="list-disc pl-5 my-1 space-y-0.5">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b, `li-${idx}-${i}`)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };

  lines.forEach((line, idx) => {
    const m = line.match(/^\s*[-*•]\s+(.*)$/);
    if (m) {
      bullets.push(m[1]);
      return;
    }
    flush(idx);
    if (line.trim() === '') {
      out.push(<br key={`br-${idx}`} />);
    } else {
      out.push(
        <p key={`p-${idx}`} className="my-0.5">
          {renderInline(line, `p-${idx}`)}
        </p>
      );
    }
  });
  flush('end');
  return out;
}

export default function ChatMessage({ message, userInitial = 'U' }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
          isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-indigo-600 to-purple-600'
        }`}
      >
        {isUser ? userInitial : 'AI'}
      </div>
      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <span className="text-[10px] font-medium text-indigo-600 mb-0.5 ml-1">PhysioGuard AI</span>
        )}
        <div
          className={`px-3 py-2 text-sm leading-relaxed break-words ${
            isUser
              ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
              : message.error
              ? 'bg-red-50 text-red-700 border border-red-200 rounded-2xl rounded-bl-sm'
              : 'bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'
          }`}
        >
          {renderContent(message.content)}
        </div>
        <span className="text-[10px] text-gray-400 mt-0.5 mx-1">{relativeTime(message.timestamp)}</span>
      </div>
    </div>
  );
}
