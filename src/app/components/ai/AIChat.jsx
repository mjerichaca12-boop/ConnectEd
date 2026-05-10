import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

export function AIChat({
  messages,
  setMessages,
  inputText,
  setInputText,
  handleSend,
  isStreaming,
  inputRef,
  fileContents,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content: "🗑️ Chat cleared. How can I help you?",
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-gray-700 text-sm">AI Teaching Assistant</span>
          {fileContents && fileContents.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-full">
              <span>📎</span>
              {fileContents.length} file{fileContents.length > 1 ? 's' : ''} attached
            </span>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce"></span>
              Thinking...
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0" style={{scrollbarWidth: "none"}}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-green-600 text-white rounded-tr-sm"
                  : "bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your request or click a Quick Action..."
            rows={2}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 text-gray-900"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !inputText.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1 pl-1">Shift+Enter for new line</p>
      </div>
    </>
  );
}
