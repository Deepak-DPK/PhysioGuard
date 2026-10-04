import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Send, Trash2, RotateCcw } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { sendMessage, getSuggestions } from '../../services/chatService';

const FALLBACK_SUGGESTIONS = [
  'Which assets are at highest risk?',
  'Summarise overdue maintenance',
  'Show open work orders',
];

function getUserInitial() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const name = u?.name || u?.firstName || u?.email || '';
    return name ? name.charAt(0).toUpperCase() : 'U';
  } catch {
    return 'U';
  }
}

function extractReply(res) {
  const d = res?.data ?? res;
  return d?.reply || d?.response || d?.message || d?.answer || (typeof d === 'string' ? d : '');
}

function extractSuggestions(res) {
  const d = res?.data ?? res;
  const list = Array.isArray(d) ? d : d?.suggestions;
  return Array.isArray(list) ? list.map((s) => (typeof s === 'string' ? s : s?.text || s?.label)).filter(Boolean) : [];
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUserText, setLastUserText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [hasNewSuggestions, setHasNewSuggestions] = useState(false);
  const [, setTick] = useState(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const userInitial = getUserInitial();

  useEffect(() => {
    let cancelled = false;
    getSuggestions()
      .then((res) => {
        if (cancelled) return;
        const s = extractSuggestions(res);
        setSuggestions(s.length ? s : FALLBACK_SUGGESTIONS);
        setHasNewSuggestions(true);
      })
      .catch(() => {
        if (!cancelled) setSuggestions(FALLBACK_SUGGESTIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, error, open]);

  useEffect(() => {
    if (open) {
      setHasNewSuggestions(false);
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Refresh relative timestamps
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [open]);

  const send = useCallback(
    async (text, baseHistory) => {
      const content = text.trim();
      if (!content || loading) return;
      const history = (baseHistory ?? messages).filter((m) => !m.error);
      const userMsg = { role: 'user', content, timestamp: Date.now() };
      setMessages([...history, userMsg]);
      setInput('');
      setError(null);
      setLastUserText(content);
      setLoading(true);
      try {
        const res = await sendMessage(
          content,
          history.map(({ role, content: c }) => ({ role, content: c }))
        );
        const reply = extractReply(res) || 'I could not generate a response.';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
      } catch (err) {
        setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [messages, loading]
  );

  const retry = () => {
    // Drop the failed user message and resend it
    const base = messages.slice(0, -1);
    send(lastUserText, base);
  };

  const clear = () => {
    setMessages([]);
    setError(null);
    setInput('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const showSuggestions = suggestions.length > 0 && !loading && !error &&
    (messages.length === 0 || messages[messages.length - 1].role === 'assistant');

  return (
    <div className="print:hidden">
      {/* Panel */}
      <div
        className={`fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] h-[520px] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden origin-bottom-right transition-all duration-300 ease-out ${
          open
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">PhysioGuard AI</h3>
            <p className="text-xs text-indigo-100 truncate">Your maintenance intelligence assistant</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clear}
              title="Clear conversation"
              aria-label="Clear conversation"
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            title="Close"
            aria-label="Close chat"
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-3">
                <Sparkles className="w-7 h-7 text-indigo-600" />
              </div>
              <p className="text-sm font-semibold text-gray-800">How can I help?</p>
              <p className="text-xs text-gray-500 mt-1">
                Ask about asset health, failure risk, work orders or maintenance schedules.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatMessage key={i} message={m} userInitial={userInitial} />
          ))}

          {loading && (
            <div className="flex items-end gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                AI
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs flex items-center gap-2">
              <span className="flex-1">{error}</span>
              <button
                onClick={retry}
                className="flex items-center gap-1 font-medium text-red-700 hover:text-red-900"
              >
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="px-3 pt-2 pb-1 border-t border-gray-100 bg-white">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex-shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-3 pt-2 pb-1 bg-white border-t border-gray-100 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your assets..."
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-gray-400 text-center pb-2 bg-white">Powered by Gemini AI</p>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center"
      >
        {!open && hasNewSuggestions && (
          <span className="absolute inset-0 rounded-full bg-indigo-500 opacity-60 animate-ping" />
        )}
        <span className="relative">
          {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
        </span>
        {!open && (
          <span className="absolute -top-1 -right-1 bg-white text-indigo-700 text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow border border-indigo-100">
            AI
          </span>
        )}
      </button>
    </div>
  );
}
