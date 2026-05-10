import { useEffect, useRef, useState } from "react";
import { Send, Copy, Check, Trash2, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-4 py-3">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce 
                      [animation-delay:-0.3s]" />
      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce 
                      [animation-delay:-0.15s]" />
      <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" />
    </div>
  );
}

function MessageBubble({ message, adminName }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTimeLabel = () => {
    if (!message.time) return "";
    return new Date(message.time).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-green-600 text-white rounded-2xl 
                        rounded-tr-sm px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
          <p className="text-xs text-green-100 text-right mt-1">
            {getTimeLabel()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start group">
      <div className="max-w-[85%] bg-gray-50 border border-gray-100 
                      text-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 
                      shadow-sm relative">
        {message.isStreaming ? (
          <div className="flex items-center gap-2">
            <TypingIndicator />
            {message.content && (
              <p className="text-sm leading-relaxed text-gray-700">
                {message.content}
                <span className="animate-pulse text-green-500">▌</span>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="prose prose-sm max-w-none
                           prose-headings:text-gray-900
                           prose-headings:font-bold
                           prose-headings:mt-3
                           prose-headings:mb-1
                           prose-p:text-gray-700
                           prose-p:leading-relaxed
                           prose-p:my-1
                           prose-strong:text-gray-900
                           prose-strong:font-semibold
                           prose-li:text-gray-700
                           prose-li:my-0.5
                           prose-ul:my-1
                           prose-ol:my-1
                           prose-a:text-green-600
                           prose-a:no-underline
                           prose-a:hover:underline
                           prose-table:text-sm
                           prose-th:bg-green-50
                           prose-th:text-green-700
                           prose-th:font-semibold
                           prose-th:px-3
                           prose-th:py-2
                           prose-td:px-3
                           prose-td:py-2
                           prose-td:border-gray-200
                           prose-code:bg-gray-100
                           prose-code:text-green-700
                           prose-code:px-1
                           prose-code:rounded">
              <ReactMarkdown 
                components={{
                  a: (props) => <a {...props} />,
                  img: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">{getTimeLabel()}</p>
              <button
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 p-1 
                           hover:bg-gray-200 rounded-lg transition-all
                           text-gray-400 hover:text-gray-600"
                title="Copy message"
              >
                {copied
                  ? <Check className="w-3.5 h-3.5 text-green-500" />
                  : <Copy className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminAIChat({
  messages,
  isStreaming,
  inputText,
  onInputChange,
  onSend,
  onClear,
  onExport,
  adminName,
  platformData,
}) {
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isStreaming) onSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white border border-gray-100 
                    rounded-2xl overflow-hidden min-w-0">

      {/* Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 
                      border-b border-gray-100 flex-shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 border border-green-100 
                          rounded-xl flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <p className="text-gray-900 font-semibold text-sm">
              AI Admin Assistant
            </p>
            <p className="text-gray-400 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full 
                               animate-pulse inline-block" />
              Powered by Groq · llama-3.3-70b · Admin Mode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors 
                       text-gray-400 hover:text-gray-600"
            title="Export chat"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClear}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors 
                       text-gray-400 hover:text-red-500"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, index) => (
          <MessageBubble
            key={index}
            message={msg}
            adminName={adminName}
          />
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl 
                            rounded-tl-sm px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Platform data indicator */}
      {platformData && (
        <div className="px-4 py-2 border-t border-gray-50 flex-shrink-0">
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full 
                             inline-block" />
            Live data connected — {platformData.totalStudents} students
            · {platformData.totalTeachers} teachers
          </p>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about platform data, draft an announcement, 
generate a report, or request any admin document..."
            rows={2}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 
                       rounded-xl text-sm text-gray-900 
                       placeholder-gray-400 resize-none
                       focus:outline-none focus:ring-2 focus:ring-green-500 
                       focus:border-transparent transition-all"
          />
          <button
            onClick={onSend}
            disabled={!inputText.trim() || isStreaming}
            className="p-3 bg-green-600 hover:bg-green-700 text-white 
                       rounded-xl transition-all shadow-sm flex-shrink-0
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-gray-400 text-[10px] mt-2 text-center">
          AI responses are suggestions only. Always verify data before 
          using in official documents.
        </p>
      </div>
    </div>
  );
}
